#!/usr/bin/env python3
"""Build a deterministic Hong Kong Tramways snapshot from Transportation Department source files."""

import argparse
from collections import defaultdict
from datetime import timedelta, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import subprocess
from tempfile import mkstemp
import xml.etree.ElementTree as ET
from zipfile import BadZipFile, ZipFile

ROOT = Path(__file__).resolve().parents[1]
XML_BASE = "https://static.data.gov.hk/td/routes-fares-xml/"
SOURCES = {
    "ROUTE_TRAM.xml": XML_BASE + "ROUTE_TRAM.xml",
    "RSTOP_TRAM.xml": XML_BASE + "RSTOP_TRAM.xml",
    "STOP_TRAM.xml": XML_BASE + "STOP_TRAM.xml",
    "JSON_TRAM.json": "https://static.data.gov.hk/td/routes-fares-geojson/JSON_TRAM.json",
}
AUDITED_COUNTS = {"routes": 6, "directions": 12, "stops": 117, "visits": 427}
HONG_KONG = timezone(timedelta(hours=8))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def xml_rows(raw, tag):
    require(not re.search(rb"<!\s*(?:DOCTYPE|ENTITY)", raw, re.I), f"{tag}: unexpected XML declaration")
    root = ET.fromstring(raw)
    require(root.tag == "dataroot" and root.get("generated"), f"{tag}: invalid XML root metadata")
    rows = []
    for element in root:
        require(element.tag == tag and len({field.tag for field in element}) == len(element)
                and all(len(field) == 0 for field in element), f"{tag}: invalid XML row")
        rows.append({field.tag: (field.text or "").strip() for field in element})
    require(rows, f"{tag}: empty XML")
    return rows, root.get("generated")


def integer(row, key):
    value = row.get(key, "")
    require(re.fullmatch(r"[1-9][0-9]*", value), f"{key}: invalid positive integer {value!r}")
    return int(value)


def names(row, prefix):
    fields = [row.get(prefix + suffix, "") for suffix in ("C", "S", "E")]
    require(all(value and "\ufffd" not in value for value in fields), f"{prefix}: missing or invalid localized name")
    return tuple(fields)


def localized(parts):
    return {"zh-HK": parts[0], "en": parts[2]}


def unique_set(target, key, value, description):
    require(key not in target, f"Duplicate {description} {key}")
    target[key] = value


def catalogue(route_rows, stop_rows, visit_rows):
    route_names = {}
    grid = {}
    for row in route_rows:
        route_id = integer(row, "ROUTE_ID")
        require(row.get("COMPANY_CODE") == "TRAM" and row.get("ROUTE_TYPE") == "4",
                f"Route {route_id}: expected street tram")
        unique_set(route_names, route_id, names(row, "ROUTE_NAME"), "route ID")
    for row in stop_rows:
        stop_id = integer(row, "STOP_ID")
        x, y = integer(row, "X"), integer(row, "Y")
        require(row.get("STOP_TYPE") == "5" and 799500 <= x <= 867500 and 799000 <= y <= 848000,
                f"Stop {stop_id}: invalid tram grid record")
        unique_set(grid, stop_id, (x, y), "stop ID")

    visits = {}
    stop_names = {}
    directions = defaultdict(dict)
    for row in visit_rows:
        route_id, direction, sequence, stop_id, pick_drop = (
            integer(row, key) for key in ("ROUTE_ID", "ROUTE_SEQ", "STOP_SEQ", "STOP_ID", "STOP_PICK_DROP")
        )
        require(route_id in route_names and stop_id in grid, f"Unresolved visit reference {route_id}/{stop_id}")
        require(direction in (1, 2) and pick_drop in (1, 2, 3), f"Invalid direction or pick/drop {route_id}/{direction}")
        stop_name = names(row, "STOP_NAME")
        require(stop_names.setdefault(stop_id, stop_name) == stop_name, f"Conflicting names for stop {stop_id}")
        unique_set(visits, (route_id, direction, sequence), (stop_id, pick_drop), "visit")
        directions[route_id].setdefault(direction, []).append([sequence, stop_id, pick_drop])

    require(grid.keys() == stop_names.keys(), "Coordinate records and referenced stops differ")
    require(route_names.keys() == directions.keys(), "Route records and referenced routes differ")
    for route_id, bounds in directions.items():
        require(set(bounds) == {1, 2}, f"Missing official direction for route {route_id}")
        for direction, rows in bounds.items():
            rows.sort()
            require([row[0] for row in rows] == list(range(1, len(rows) + 1)),
                    f"Non-contiguous sequence {route_id}/{direction}")
    return route_names, grid, visits, stop_names, directions


def geo_coordinates(raw, route_names, visits, stop_names):
    geo = json.loads(raw.decode("utf-8-sig"))
    require(geo.get("type") == "FeatureCollection" and isinstance(geo.get("features"), list), "Invalid GeoJSON")
    points = {}
    seen = set()
    for feature in geo["features"]:
        props, geometry = feature["properties"], feature["geometry"]
        key = tuple(props[k] for k in ("routeId", "routeSeq", "stopSeq"))
        stop_id, pick_drop = props["stopId"], props["stopPickDrop"]
        require(all(type(v) is int for v in (*key, stop_id, pick_drop))
                and feature.get("type") == "Feature" and props.get("companyCode") == "TRAM" and props.get("routeType") == 4
                and key not in seen and visits.get(key) == (stop_id, pick_drop),
                f"GeoJSON visit mismatch {key}")
        seen.add(key)
        require(tuple(props["routeName"+s] for s in "CSE") == route_names[key[0]]
                and tuple(props["stopName"+s] for s in "CSE") == stop_names[stop_id],
                f"GeoJSON name mismatch {key}")
        pair = geometry.get("coordinates")
        require(geometry.get("type") == "Point" and isinstance(pair, list) and len(pair) == 2
                and all(type(v) in (float, int) for v in pair)
                and 113.82 <= pair[0] <= 114.46 and 22.12 <= pair[1] <= 22.59, f"Invalid WGS84 point for stop {stop_id}")
        point = (pair[1], pair[0])
        require(points.setdefault(stop_id, point) == point, f"Conflicting GeoJSON points for stop {stop_id}")
    require(seen == visits.keys(), "GeoJSON coverage differs from XML stop sequence")
    return points


def build(raw, evidence):
    require(raw.keys() == SOURCES.keys() and evidence.keys() == SOURCES.keys(), "Missing or extra source files")
    source_records = {}
    for name, url in SOURCES.items():
        meta = evidence[name]
        digest = sha256(raw[name]).hexdigest()
        require(digest == meta["sha256"], f"{name}: SHA-256 differs from reviewed source manifest")
        fetched = parsedate_to_datetime(meta["fetchedAt"])
        modified = parsedate_to_datetime(meta["lastModified"])
        require(fetched.tzinfo and modified.tzinfo and modified <= fetched, f"{name}: invalid source dates")
        source_records[name] = {"url": url, "sha256": digest,
                                "fetchedAt": fetched.astimezone(HONG_KONG).isoformat(),
                                "lastModified": modified.astimezone(HONG_KONG).isoformat()}

    tables = []
    for tag in ("ROUTE", "STOP", "RSTOP"):
        name = f"{tag}_TRAM.xml"
        rows, generated = xml_rows(raw[name], tag)
        tables.append(rows)
        source_records[name]["sourceGeneratedAt"] = generated

    route_names, grid, visits, stop_names, directions = catalogue(*tables)
    points = geo_coordinates(raw["JSON_TRAM.json"], route_names, visits, stop_names)
    checked = subprocess.run(
        ["node", str(ROOT / "scripts/check-tram-grid.cjs")],
        input=json.dumps([[stop_id, *grid[stop_id], *points[stop_id]] for stop_id in sorted(grid)]),
        text=True, capture_output=True, check=False,
    )
    require(checked.returncode == 0, "Grid reconciliation failed: " + checked.stderr.strip())
    counts = {"routes": len(route_names), "directions": sum(map(len, directions.values())),
              "stops": len(grid), "visits": len(visits)}
    modified_at = max(record["lastModified"] for record in source_records.values())
    version_hash = sha256("".join(record["sha256"] for record in source_records.values()).encode()).hexdigest()[:12]
    return {
        "schemaVersion": 1,
        "sourceVersion": f"td-tram-{modified_at[:10]}-{version_hash}",
        "sourceUpdatedAt": modified_at,
        "source": {
            "dataset": "https://data.gov.hk/en-data/dataset/hk-td-tis_14-routes-fares-xml",
            "dictionary": XML_BASE + "dataspec/ptroutefare_xml_dataspec.pdf",
            "terms": "https://data.gov.hk/en/terms-and-conditions",
            "attribution": {"zh-HK": "香港特別行政區政府運輸署 · DATA.GOV.HK",
                            "en": "Transport Department, HKSAR Government · DATA.GOV.HK"},
            "files": source_records,
        },
        "counts": counts,
        "routes": [
            {"routeId": route_id, "localizedRouteNames": localized(route_names[route_id]),
             "directions": [{"directionId": bound, "visits": rows}
                            for bound, rows in sorted(directions[route_id].items())]}
            for route_id in sorted(route_names)
        ],
        "stops": [
            {"stopId": stop_id, "localizedStopNames": localized(stop_names[stop_id]),
             "latitude": points[stop_id][0], "longitude": points[stop_id][1]}
            for stop_id in sorted(grid)
        ],
    }


def encode(snapshot):
    # Keep one complete record on each line while keeping the source manifest readable.
    data = dict(snapshot)
    records = [(key, data.pop(key)) for key in ("routes", "stops")]
    header = json.dumps(data, ensure_ascii=False, indent=2)[:-2]
    sections = [
        f'  "{key}": [\n' + ",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in rows) + "\n  ]"
        for key, rows in records
    ]
    return header + ",\n" + ",\n".join(sections) + "\n}\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sources", type=Path, help="Archive or directory containing the four named source files")
    parser.add_argument("manifest", type=Path, help="Reviewed SHA-256, fetch time and HTTP Last-Modified per file")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/data/tram-static.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        if args.sources.is_dir():
            raw = {name: (args.sources / name).read_bytes() for name in SOURCES}
        else:
            with ZipFile(args.sources) as archive:
                require(sorted(archive.namelist()) == sorted(SOURCES), "Unexpected archive members")
                raw = {name: archive.read(name) for name in SOURCES}
        snapshot = build(raw, json.loads(args.manifest.read_text(encoding="utf-8")))
        counts = snapshot["counts"]
        if counts != AUDITED_COUNTS:
            print(f"Source coverage changed. Review baseline {AUDITED_COUNTS} vs actual {counts}.")
            if not args.check and args.output.resolve() == (ROOT / "assets/data/tram-static.json").resolve():
                raise ValueError("Write changed coverage to a separate output for review before updating the baseline")
        result = encode(snapshot)
        if args.check:
            require(args.output.read_text(encoding="utf-8") == result, "Generated snapshot differs")
        else:
            fd, name = mkstemp(dir=args.output.parent)
            temp_path = Path(name)
            try:
                with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as output:
                    output.write(result)
                temp_path.replace(args.output)
            finally:
                temp_path.unlink(missing_ok=True)
        print(f"{'Verified' if args.check else 'Generated'} {args.output} {counts}")
    except (ValueError, KeyError, TypeError, AttributeError, OSError, BadZipFile, ET.ParseError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()

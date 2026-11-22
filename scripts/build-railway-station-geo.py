#!/usr/bin/env python3
"""Build railway geography from a pinned official iGeoCom extract and explicit ID review.

No geocoding, fuzzy matching, network access or inferred station/platform coordinates.
"""

import argparse
import csv
from datetime import datetime, timedelta
import gzip
from hashlib import sha256
import io
import json
from math import isfinite
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / "scripts/fixtures/railway-geo"
SOURCE = FIXTURES / "igeocom-railway-source.json.gz"
REVIEW = FIXTURES / "station-mapping-review.json"
OUTPUT = ROOT / "assets/data/railway-station-geo.json"
BASE_URL = "https://open.hkmapservice.gov.hk/OpenData/directDownload?productName=iGeoCom&sheetName=iGeoCom&productFormat="
DATASET = "https://data.gov.hk/en-data/dataset/hk-landsd-openmap-development-hkms-digital-geocom"
DICTIONARY = "https://open.hkmapservice.gov.hk/OpenData/opendata_static/resources/resources_iGeoCom_GeoJSON.zip"
REVISION = "https://www.landsd.gov.hk/doc/en/mapping/digital-map/common/update/igeocom_update.csv"
TYPES = ("RSN", "MTA", "LRA")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def encode(value):
    return (json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode()


def archive_member(path, extension):
    with ZipFile(path) as archive:
        members = [name for name in archive.namelist() if name.lower().endswith(extension)]
        require(len(members) == 1, f"Expected one {extension} file in {path}")
        return members[0], archive.read(members[0])


def checked_coordinate(feature):
    geometry = feature["geometry"]
    require(feature["type"] == "Feature" and geometry["type"] == "Point", "Expected official Point geometry")
    point = geometry["coordinates"]
    require(isinstance(point, list) and len(point) == 2, "Invalid WGS84 dimensions")
    longitude, latitude = point
    require(all(type(value) in (int, float) and isfinite(value) for value in point)
            and 113.82 <= longitude <= 114.46 and 22.12 <= latitude <= 22.59,
            f"Invalid Hong Kong WGS84 point {point}")
    return {"latitude": latitude, "longitude": longitude}


def capture(csv_zip, geojson_zip, dictionary_zip, revision_file, fetched_at, resource_updated):
    require(datetime.fromisoformat(fetched_at).utcoffset() == timedelta(hours=8), "Use Hong Kong download time (+08:00)")
    datetime.strptime(resource_updated, "%Y-%m-%d")
    csv_name, csv_raw = archive_member(csv_zip, ".csv")
    geo_name, geo_raw = archive_member(geojson_zip, ".geojson")
    dictionary_name, dictionary_raw = archive_member(dictionary_zip, ".pdf")
    revision_rows = list(csv.reader(io.StringIO(revision_file.read_text())))
    revisions = {row[0].strip(): datetime.strptime(row[1].strip(), "%Y%m%d").date().isoformat()
                 for row in revision_rows[1:] if row}
    require(revisions["CSV"] == revisions["GeoJSON"], "CSV and GeoJSON revisions differ")
    csv_rows = list(csv.DictReader(io.StringIO(csv_raw.decode("utf-8-sig"))))
    collection = json.loads(geo_raw)
    require(collection["type"] == "FeatureCollection" and collection["name"] == "iGeoCom"
            and "crs" not in collection, "Unexpected iGeoCom GeoJSON format; review its CRS")
    features = collection["features"]
    require(len(csv_rows) == len(features), "CSV and GeoJSON total counts differ")
    csv_by_id = {row["GEONAMEID"]: row for row in csv_rows}
    require(len(csv_by_id) == len(csv_rows), "Duplicate official CSV GEONAMEID")
    selected = [feature for feature in features if feature["properties"]["TYPE"] in TYPES]
    require(selected, "No official railway features")
    selected_csv = {row["GEONAMEID"] for row in csv_rows if row["TYPE"] in TYPES}
    require(selected_csv == {str(f["properties"]["GEONAMEID"]) for f in selected}, "Railway scopes differ")
    for feature in selected:
        fields = feature["properties"]
        checked_coordinate(feature)
        require(fields["CLASS"] == "TRS", "Unexpected railway feature class")
        row = csv_by_id[str(fields["GEONAMEID"])]
        require(set(row) == set(fields), "CSV/GeoJSON field sets differ")
        require(all((row[key] or "").strip() == (str(value) if value is not None else "").strip()
                    for key, value in fields.items()), f"CSV/GeoJSON attributes differ for {fields['GEONAMEID']}")
    selected.sort(key=lambda feature: feature["properties"]["GEONAMEID"])

    def download(path, url, name, raw):
        return {"url": url, "archiveSha256": sha256(path.read_bytes()).hexdigest(), "member": name,
                "sha256": sha256(raw).hexdigest(), "bytes": len(raw)}

    return {
        "schemaVersion": 1,
        "source": {
            "id": "landsd-igeocom", "provider": "Lands Department, HKSAR Government", "dataset": DATASET,
            "dictionaryVersion": "5.0 (March 2026)", "fetchedAt": fetched_at,
            "revisionOn": revisions["GeoJSON"], "dataGovResourceUpdatedOn": resource_updated,
            "geometryCrs": "EPSG:4326", "geometryOrder": ["longitude", "latitude"],
            "attributeCrs": "EPSG:2326", "attributeUnits": "metres",
            "coordinateMethod": "Official WGS84 Point geometry; no local conversion or averaging",
            "csv": download(csv_zip, BASE_URL + "CSV", csv_name, csv_raw),
            "geojson": download(geojson_zip, BASE_URL + "GEOJSON", geo_name, geo_raw),
            "dictionary": download(dictionary_zip, DICTIONARY, dictionary_name, dictionary_raw),
            "revision": {"url": REVISION, "sha256": sha256(revision_file.read_bytes()).hexdigest()},
            "rawRecordCount": len(features), "railwayRecordCount": len(selected),
            "csvGeojsonMatchedRailwayRecords": len(selected),
            "typeCounts": {kind: sum(f["properties"]["TYPE"] == kind for f in selected) for kind in TYPES},
        },
        "features": selected,
    }


def build(raw_source, review, mtr, light_rail):
    require(sha256(raw_source).hexdigest() == review["sourceSha256"], "Source changed: review IDs and coordinates first")
    source = json.loads(raw_source)
    require(source["schemaVersion"] == review["schemaVersion"] == 1, "Unknown source/review schema")
    for name, catalogue in (("mtr", mtr), ("lightRail", light_rail)):
        require(sha256(encode(catalogue)).hexdigest() == review["catalogueSha256"][name], f"{name} catalogue changed; review mapping")
    features = source["features"]
    by_id = {}
    for feature in features:
        fields = feature["properties"]
        record_id = str(fields["GEONAMEID"])
        require(record_id not in by_id, f"Duplicate official ID {record_id}")
        require(fields["TYPE"] in TYPES and fields["CLASS"] == "TRS", "Non-railway feature in extract")
        checked_coordinate(feature)
        by_id[record_id] = feature
    require(len(by_id) == source["source"]["railwayRecordCount"], "Incomplete railway extract")
    used = set()
    result = {}
    for mode, catalogue, key, expected_type in (("mtr", mtr, "stations", "RSN"), ("lightRail", light_rail, "stops", "LRA")):
        targets = catalogue[key]
        mappings = review[mode]
        require(set(mappings).issubset(targets), f"Unknown {mode} station ID")
        stations = {}
        for station_id, station in sorted(targets.items()):
            mapping = mappings.get(station_id)
            if not mapping or mapping.get("unresolvedReason"):
                stations[station_id] = {"status": "unresolved", "positions": [],
                                        "reason": (mapping or {}).get("unresolvedReason", "No reviewed official mapping")}
                continue
            anchor_id = mapping["stationRecordId"]
            anchor = by_id[anchor_id]
            fields = anchor["properties"]
            require(fields["TYPE"] == expected_type, f"Wrong railway identity type for {mode}/{station_id}")
            require(fields["ENGLISHNAME"] == mapping["sourceName"]["en"]
                    and fields["CHINESENAME"] == mapping["sourceName"]["zh"], f"Source name drift for {mode}/{station_id}")
            expected_en = f"Mass Transit Railway {station['en']} Station" if mode == "mtr" else f"LR-{station['en']}"
            expected_zh = f"香港鐵路{station['zh']}站" if mode == "mtr" else f"輕鐵－{station['zh']}"
            require(fields["ENGLISHNAME"] == expected_en, f"Operator/source English identity differs: {station_id}")
            if fields["CHINESENAME"] != expected_zh:
                exception = review["nameExceptions"].get(f"{mode}/{station_id}", {})
                require(exception.get("catalogue") == station["zh"] and exception.get("source") == fields["CHINESENAME"]
                        and exception.get("basis"), f"Unreviewed Chinese identity difference: {station_id}")
            ids = [anchor_id, *mapping["entranceRecordIds"]]
            require(mode == "mtr" or len(ids) == 1, "Light Rail has no reviewed platform/entrance points")
            positions = {}
            for record_id in ids:
                require(record_id not in used, f"Source record assigned more than once: {record_id}")
                feature = by_id[record_id]
                record = feature["properties"]
                entrance = record_id != anchor_id
                if entrance:
                    require(record["TYPE"] == "MTA" and record["E_SITENAME"] == fields["ENGLISHNAME"]
                            and record["C_SITENAME"] == fields["CHINESENAME"], f"Unverified official parent association: {record_id}")
                used.add(record_id)
                coordinate = checked_coordinate(feature)
                kind = "entrance" if entrance else "station-reference"
                # Co-located official entrances share a point, retaining every ID and label.
                position_key = (kind, coordinate["latitude"], coordinate["longitude"])
                position = positions.setdefault(position_key, {"kind": kind, "coordinate": coordinate, "sourceRecordIds": []})
                position["sourceRecordIds"].append(record_id)
            stations[station_id] = {"status": "verified", "stationRecordId": anchor_id, "positions": list(positions.values())}
        result[mode] = stations
    excluded = {entry["recordId"] for entry in review["unresolvedSourceRecords"]}
    require(len(excluded) == len(review["unresolvedSourceRecords"]) and not used & excluded, "Conflicting unresolved record IDs")
    require(used | excluded == set(by_id), "Unreviewed source records; explicitly map or quarantine each ID")
    counts = {
        mode: {"total": len(stations), "verified": sum(s["status"] == "verified" for s in stations.values()),
               "unresolved": [code for code, entry in stations.items() if entry["status"] == "unresolved"]}
        for mode, stations in result.items()
    }
    counts.update({"mappedSourceRecords": len(used), "unresolvedSourceRecords": len(excluded), "conflicts": 0})
    return {"schemaVersion": 1, "source": source["source"], "reviewedOn": review["reviewedOn"],
            "sourceExtractSha256": sha256(raw_source).hexdigest(), "mappingReviewSha256": sha256(encode(review)).hexdigest(),
            "mappingBasis": review["mappingBasis"], "counts": counts,
            "unresolvedSourceRecords": review["unresolvedSourceRecords"], **result}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--review", type=Path, default=REVIEW)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--capture-source", action="store_true", help="Extract downloaded official files; requires a subsequent ID review")
    for name in ("csv", "geojson", "dictionary", "revision"):
        parser.add_argument("--" + name, type=Path)
    parser.add_argument("--fetched-at")
    parser.add_argument("--resource-updated")
    args = parser.parse_args()
    try:
        if args.capture_source:
            require(not args.check and all((args.csv, args.geojson, args.dictionary, args.revision, args.fetched_at, args.resource_updated)),
                    "Capture requires CSV/GeoJSON/dictionary ZIPs, revision CSV, download time and resource update date")
            source = capture(args.csv, args.geojson, args.dictionary, args.revision, args.fetched_at, args.resource_updated)
            args.source.parent.mkdir(parents=True, exist_ok=True)
            args.source.write_bytes(gzip.compress(encode(source), mtime=0))
            print(f"Captured {len(source['features'])} official railway features; review mapping before building")
            return
        result = build(gzip.decompress(args.source.read_bytes()), json.loads(args.review.read_bytes()),
                       json.loads((ROOT / "assets/data/mtr-static.json").read_bytes()),
                       json.loads((ROOT / "assets/data/light-rail-static.json").read_bytes()))
        output = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
        if args.check:
            require(args.output.read_text() == output, "Snapshot differs; review before replacing")
        else:
            args.output.write_text(output)
        print(f"{'Verified' if args.check else 'Generated'} {args.output}: {json.dumps(result['counts'])}")
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()

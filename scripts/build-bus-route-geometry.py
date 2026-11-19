#!/usr/bin/env python3
"""Rebuild only the UI-02D0-approved Transport Department route lines."""
import argparse
import gzip
import hashlib
import json
import math
import tempfile
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / "assets/data"
REVIEW = json.loads((DATA / "bus-route-geometry-approvals.json").read_text())
OUTPUT = DATA / "bus-route-geometry.json"
SCALE = 1_000_000
METRES_LON = 111195 * math.cos(math.radians(22.35))
METRES_LAT = 111195
LINE_FIELDS = ("OBJECTID,ROUTE_ID,ROUTE_SEQ,COMPANY_CODE,ROUTE_NAMEE,"
               "ST_STOP_ID,ST_STOP_NAMEC,ED_STOP_ID,ED_STOP_NAMEC,Shape_Length")


def encode(value, *, sort_keys=False):
    return json.dumps(value, separators=(",", ":"), sort_keys=sort_keys, allow_nan=False).encode()


def sha(value):
    return hashlib.sha256(encode(value, sort_keys=True)).hexdigest()


def checksum(value):
    result = 0x811C9DC5
    for byte in encode(value):
        result = ((result ^ byte) * 0x01000193) & 0xffffffff
    return result


def require(condition, message):
    if not condition:
        raise ValueError(message)


def point(pair):
    lon, lat = pair
    require(type(lon) in (int, float) and type(lat) in (int, float)
            and 113.82 <= lon <= 114.46 and 22.12 <= lat <= 22.59,
            f"Invalid WGS84 [longitude, latitude]: {pair!r}")
    return lon, lat


def distance(a, b):
    return math.hypot((a[0] - b[0]) * METRES_LON, (a[1] - b[1]) * METRES_LAT)


def verify_path(stops, parts):
    ends = [distance(stops[0], parts[0][0]), distance(stops[-1], parts[-1][-1])]
    gap = max((distance(a[-1], b[0]) for a, b in zip(parts, parts[1:])), default=0)
    require(max(ends) <= 50 and gap <= 0.1, f"Endpoint or multipart gap outside reviewed limit: {ends}, {gap}")
    segments = []
    offset = 0
    for part in parts:
        for a, b in zip(part, part[1:]):
            dx = (b[0] - a[0]) * METRES_LON
            dy = (b[1] - a[1]) * METRES_LAT
            length = math.hypot(dx, dy)
            if length:
                segments.append((a, dx, dy, length, offset))
                offset += length
    progress = 0
    furthest = 0
    for stop in stops:
        matches = []
        for origin, dx, dy, length, start in segments:
            x = (stop[0] - origin[0]) * METRES_LON
            y = (stop[1] - origin[1]) * METRES_LAT
            t = max(0, min(1, (x * dx + y * dy) / length**2))
            error = math.hypot(x - t * dx, y - t * dy)
            at = start + t * length
            if error <= 50 and at >= progress - 1e-6:
                matches.append((at, error))
        require(matches, "Stop has no projection in route order within 50 metres")
        progress = min(matches)[0]
        furthest = max(furthest, min(error for _, error in matches))
    return [round(m, 2) for m in (*ends, furthest)]


def geometry_parts(geometry):
    kind = geometry["type"]
    require(kind in ("LineString", "MultiLineString"), f"Unsupported GeoJSON geometry: {kind}")
    coordinates = geometry["coordinates"]
    parts = [coordinates] if kind == "LineString" else coordinates
    require(parts and all(len(part) >= 2 for part in parts), "Empty or truncated line")
    parts = [[point(p) for p in part] for part in parts]
    distinct = {min(tuple(part), tuple(reversed(part))) for part in parts}
    require(len(distinct) == len(parts), "Duplicate line segments")
    return parts


def read_json(path):
    return json.loads(path.read_bytes())


def line_url(number):
    return REVIEW["queryUrl"] + "?" + urlencode({
        "where": f"ROUTE_NAMEE='{number}'", "outFields": LINE_FIELDS, "outSR": 4326, "f": "geojson",
    })


def operator_input(number, direction, service):
    if service is None:
        return (f"ctb-{number}-{direction}.json",
                f"https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/{number}/{direction}")
    return (f"kmb-{number}-{direction}-{service}.json",
            f"https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{number}/{direction}/{service}")


def download_inputs(directory):
    directory.mkdir(parents=True, exist_ok=True)
    inputs = {"td-stops.json": REVIEW["tdStopsUrl"]}
    for key in REVIEW["approvals"]:
        _, number, direction, service = json.loads(key)
        inputs[f"td-line-{number}.json"] = line_url(number)
        filename, url = operator_input(number, direction, service)
        inputs[filename] = url
    for filename, url in inputs.items():
        path = directory / filename
        if not path.exists():
            with urlopen(url, timeout=90) as response:
                path.write_bytes(response.read())


def verify_record(key, record, approval):
    require(record["td"] == approval["td"], f"{key}: wrong TD identity")
    require(sha(record["visits"]) == approval["stopSha256"], f"{key}: changed operator visits")
    require(record["parts"] and approval["packChecksum"] == checksum([key, record["td"], record["visits"], record["parts"]]),
            f"{key}: corrupt geometry payload")
    for part in record["parts"]:
        require(len(part) >= 2, f"{key}: incomplete segment")
        for pair in part:
            require(all(type(value) is int for value in pair), f"{key}: malformed coordinates")
            point([value / SCALE for value in pair])


def check_pack(pack):
    require(pack["version"] == 1 and pack["crs"] == "EPSG:4326" and pack["scale"] == SCALE
            and pack["datasetRevision"] == REVIEW["datasetRevision"] and pack["source"] == REVIEW["datasetUrl"]
            and pack["terms"] == REVIEW["termsUrl"] and pack["credit"] == REVIEW["credit"],
            "Unknown data format or provenance")
    require(pack["records"].keys() == REVIEW["approvals"].keys(), "Pack differs from reviewed route identities")
    for key, approval in REVIEW["approvals"].items():
        verify_record(key, pack["records"][key], approval)


def build(directory):
    stops_raw = (directory / "td-stops.json").read_bytes()
    require(hashlib.sha256(stops_raw).hexdigest() == REVIEW["tdStopsSha256"],
            "TD stop archive differs from the reviewed snapshot")
    td_stops = defaultdict(list)
    td_keys = {tuple(approval["td"]) for approval in REVIEW["approvals"].values()}
    archive = json.loads(stops_raw)
    require(archive["type"] == "FeatureCollection", "Invalid TD stop archive")
    for row in archive["features"]:
        p = row["properties"]
        key = (p["companyCode"], p["routeId"], p["routeSeq"])
        if key in td_keys:
            td_stops[key].append(row)
    del archive, stops_raw

    points = {source: {row[0]: point([row[4], row[3]]) for row in rows}
              for source, rows in read_json(DATA / "nearby-stops.json")["stops"].items()}
    reverse_index = read_json(DATA / "nearby-stop-routes.json")["sources"]
    documents = {}
    records = {}
    for key, approval in REVIEW["approvals"].items():
        source, number, direction, service = json.loads(key)
        company, td_route, td_seq = approval["td"]
        require((source == "kmbLwb" and company == "KMB" and service is not None)
                or (source == "citybus" and company == "CTB" and service is None), f"{key}: wrong operator")
        td_key = (company, td_route, td_seq)
        if number not in documents:
            documents[number] = read_json(directory / f"td-line-{number}.json")
        lines = documents[number]
        require(lines["type"] == "FeatureCollection" and not lines.get("exceededTransferLimit"),
                f"{number}: invalid line response")
        matching = [f for f in lines["features"] if (
            f["properties"]["COMPANY_CODE"], f["properties"]["ROUTE_ID"], f["properties"]["ROUTE_SEQ"],
            f["properties"]["ROUTE_NAMEE"],
        ) == (*td_key, number)]
        require(len(matching) == 1, f"{key}: missing or non-unique TD feature")
        line = matching[0]
        require(sha(line["geometry"]) == approval["geojsonSha256"], f"{key}: geometry changed, review again")
        parts = geometry_parts(line["geometry"])
        props = line["properties"]

        filename, operator_url = operator_input(number, direction, service)
        operator = read_json(directory / filename)
        bound = {"outbound": "O", "inbound": "I"}[direction]
        visits = []
        for visit in operator["data"]:
            require(visit["route"] == number and (
                (visit["bound"] == bound and str(visit["service_type"]) == service) if service
                else (visit["co"] == company and visit["dir"] == bound)
            ), f"{key}: operator response identity mismatch")
            visits.append((int(visit["seq"]), visit["stop"]))
        visits.sort()
        feed = reverse_index[source]
        [route_pos] = [i for i, item in enumerate(feed["routes"]) if item[:3] == [number, bound, service or ""]]
        cached = sorted((seq, stop) for stop, rows in feed["stops"].items() for i, seq in rows if i == route_pos)
        require(visits == cached and [n for n, _ in visits] == list(range(1, len(visits) + 1)),
                f"{key}: changed, missing or duplicated operator stop sequence")
        operator_points = [points[source][stop] for _, stop in visits]
        anchors = [[seq, stop, round(lat * SCALE), round(lon * SCALE)]
                   for (seq, stop), (lon, lat) in zip(visits, operator_points)]
        td = sorted(td_stops[td_key], key=lambda row: row["properties"]["stopSeq"])
        require(len(td) == len(visits) and [row["properties"]["stopSeq"] for row in td] == list(range(1, len(td) + 1)),
                f"{key}: changed TD stop order")
        p = [row["properties"] for row in td]
        require(all(row["routeNameE"] == number for row in p)
                and [p[0]["stopId"], p[-1]["stopId"]] == [props["ST_STOP_ID"], props["ED_STOP_ID"]],
                f"{key}: TD line and stop identities disagree")
        td_points = [point(row["geometry"]["coordinates"]) for row in td if row["geometry"]["type"] == "Point"]
        require(len(td_points) == len(visits), f"{key}: TD point missing")
        delta = max(distance(a, b) for a, b in zip(operator_points, td_points))
        require(delta <= 100, f"{key}: matched operator and TD stops differ by {delta:.1f} m")
        td_metrics = verify_path(td_points, parts)
        metrics = verify_path(operator_points, parts)
        packed = [[[round(lon * SCALE), round(lat * SCALE)] for lon, lat in part] for part in parts]
        rounding = max(distance(original, [v / SCALE for v in rounded])
                       for a, b in zip(parts, packed) for original, rounded in zip(a, b))
        require(rounding < 0.08, f"{key}: unexpected rounding deviation")
        verify_path(operator_points, [[[lon / SCALE, lat / SCALE] for lon, lat in part] for part in packed])

        records[key] = {
            "td": approval["td"], "objectId": props["OBJECTID"],
            "operatorStopUrl": operator_url, "operatorSnapshot": operator["generated_timestamp"],
            "tdStopDates": sorted({row["lastUpdateDate"][:10] for row in p}),
            "qualityMetres": {"operatorStartEndAndOrderedMax": metrics, "tdStartEndAndOrderedMax": td_metrics,
                              "tdOperatorMax": round(delta, 2), "maxRounding": round(rounding, 4)},
            "visits": anchors, "parts": packed,
        }
        print(f"{key} -> {approval['td']} | {len(visits)} visits, {sum(map(len, packed))} vertices, "
              f"endpoints {metrics[:2]} m, ordered projection up to {metrics[-1]} m, TD stop gap {delta:.1f} m")
    return {"version": 1, "crs": "EPSG:4326", "scale": SCALE, "datasetRevision": REVIEW["datasetRevision"],
            "source": REVIEW["datasetUrl"], "credit": REVIEW["credit"], "terms": REVIEW["termsUrl"], "records": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot-dir", type=Path, help="Directory of downloaded official responses used in UI-02D0")
    parser.add_argument("--download", action="store_true", help="Fetch any missing files from the recorded official URLs")
    parser.add_argument("--check", action="store_true", help="Validate existing pack, optionally reproducing from snapshot")
    args = parser.parse_args()
    if not args.snapshot_dir and (args.download or not args.check):
        parser.error("--snapshot-dir is required for extraction or download")

    if args.download:
        download_inputs(args.snapshot_dir)
    if args.snapshot_dir:
        pack = build(args.snapshot_dir)
        check_pack(pack)
        payload = encode(pack) + b"\n"
        if args.check:
            require(OUTPUT.read_bytes() == payload, "Checked-in geometry does not reproduce byte-for-byte")
        else:
            # Publish only after every reviewed option passes; a failing update keeps the previous pack.
            with tempfile.NamedTemporaryFile(dir=DATA, delete=False) as handle:
                path = Path(handle.name)
                handle.write(payload)
            path.chmod(0o644)
            path.replace(OUTPUT)
    else:
        payload = OUTPUT.read_bytes()
        pack = json.loads(payload)
        check_pack(pack)
    vertices = sum(len(part) for rec in pack["records"].values() for part in rec["parts"])
    print(f"Verified {len(pack['records'])} lines, {vertices} vertices, {len(payload)} bytes "
          f"({len(gzip.compress(payload, mtime=0))} gzip), SHA-256 {hashlib.sha256(payload).hexdigest()}")


if __name__ == "__main__":
    main()

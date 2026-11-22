#!/usr/bin/env python3
"""Build the compact offline index from three downloaded Transport Department snapshots."""

import argparse
from collections import defaultdict
from datetime import date
import hashlib
import json
from pathlib import Path

SOURCE = "https://static.data.gov.hk/td/routes-fares-geojson/JSON_GMB.json"
REGIONS = ("HKI", "KLN", "NT")


def load(path):
    data = path.read_bytes()
    return json.loads(data), hashlib.sha256(data).hexdigest()


def index_geojson(document):
    if document["type"] != "FeatureCollection":
        raise ValueError("Expected a FeatureCollection")
    directions, coordinates, visits = {}, {}, {}
    for feature in document["features"]:
        props = feature["properties"]
        region, code, route_id, direction, stop_id, sequence, use = (
            props[key] for key in ("district", "routeNameE", "routeId", "routeSeq", "stopId", "stopSeq", "stopPickDrop")
        )
        geom = feature["geometry"]
        lon, lat = geom["coordinates"]
        if (props["companyCode"] != "GMB" or region not in REGIONS or not code or
                any(type(v) is not int or v < 1 for v in (route_id, stop_id, sequence)) or
                direction not in (1, 2) or use not in (1, 2, 3) or geom["type"] != "Point" or
                not (22.12 <= lat <= 22.59 and 113.82 <= lon <= 114.46)):
            raise ValueError(f"Invalid geographic record {route_id}/{direction}/{sequence}")
        key = route_id, direction
        route = [region, code, props["locStartNameC"], props["locStartNameE"],
                 props["locEndNameC"], props["locEndNameE"]]
        if directions.setdefault(key, route) != route or coordinates.setdefault(stop_id, (lat, lon)) != (lat, lon):
            raise ValueError(f"Inconsistent direction or coordinates {key}, stop {stop_id}")
        name = [props["stopNameC"], props["stopNameE"]]
        if any(not isinstance(value, str) for value in route + name) or not any(name):
            raise ValueError(f"Missing text on {key}, stop {stop_id}")
        visit = route_id, direction, sequence
        if visit in visits:
            raise ValueError(f"Duplicate visit {visit}")
        visits[visit] = (stop_id, use, *name)
    return directions, coordinates, visits


def build(geo_path, catalogue_path, csdi_path, captured_on):
    geo, geo_hash = load(geo_path)
    catalogue, catalogue_hash = load(catalogue_path)
    csdi, csdi_hash = load(csdi_path)
    directions, coordinates, visits = index_geojson(geo)
    catalogue_codes = {(r, c) for r in REGIONS for c in catalogue["data"]["routes"][r]}
    geo_codes = {tuple(direction[:2]) for direction in directions.values()}
    csdi_directions = {(row["attributes"]["ROUTE_ID"], row["attributes"]["ROUTE_SEQ"]): row["attributes"]["ROUTE_NAME"]
                       for row in csdi["features"]}
    geo_directions = {key: value[1] for key, value in directions.items()}
    if not directions or csdi.get("exceededTransferLimit") or geo_directions != csdi_directions or catalogue_codes != geo_codes:
        raise ValueError("Coverage mismatch against the official route catalogues. Review the sources before replacing the snapshot.")

    ordered_directions = sorted(directions)
    direction_indices = {key: i for i, key in enumerate(ordered_directions)}
    by_stop = defaultdict(list)
    for (route_id, direction, sequence), (stop_id, use, zh, en) in sorted(visits.items()):
        by_stop[stop_id].append([direction_indices[route_id, direction], sequence, use, zh, en])
    return {
        "source": {"url": SOURCE, "capturedOn": captured_on,
                   "latestRecordDate": max(f["properties"]["lastUpdateDate"] for f in geo["features"])[:10],
                   "catalogueGeneratedAt": catalogue["generated_timestamp"],
                   "sha256": {"geojson": geo_hash, "catalogue": catalogue_hash, "csdiDirections": csdi_hash}},
        "counts": {"codes": {r: len([1 for region, _ in geo_codes if region == r]) for r in REGIONS},
                   "variants": len({r for r, _ in directions}), "directions": len(directions),
                   "stops": len(coordinates), "visits": len(visits),
                   "boardingVisits": sum(use != 1 for _, use, *_ in visits.values()),
                   "boardingStops": sum(any(v[2] != 1 for v in rows) for rows in by_stop.values())},
        "directions": [[*key, *directions[key]] for key in ordered_directions],
        "stops": [[stop_id, *coordinates[stop_id], by_stop[stop_id]] for stop_id in sorted(coordinates)],
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    for name in ("geojson", "catalogue", "csdi", "output"):
        cli.add_argument(name, type=Path)
    cli.add_argument("--captured-on", required=True, type=date.fromisoformat)
    args = cli.parse_args()
    result = build(args.geojson, args.catalogue, args.csdi, args.captured_on.isoformat())
    document = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    temp = args.output.with_suffix(".tmp")
    temp.write_text(document + "\n", encoding="utf-8")
    temp.replace(args.output)
    print(json.dumps(result["counts"]))


if __name__ == "__main__":
    main()

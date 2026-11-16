#!/usr/bin/env python3
"""Build an offline stop snapshot from public operator endpoints (never run inside the app)."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import math
from pathlib import Path
import re
import subprocess
import time

KMB = "https://data.etabus.gov.hk/v1/transport/kmb/stop"
CITYBUS = "https://rt.data.gov.hk/v2/transport/citybus"
NLB = "https://rt.data.gov.hk/v2/transport/nlb"
CITYBUS_ROUTES = (
    "1", "5B", "10", "11", "12A", "23", "25", "27", "101", "110", "116",
    "118", "170", "182", "307", "608", "793", "962X", "967", "969", "B15", "B3X", "B5",
)


def build(cache, output):
    cache.mkdir(parents=True, exist_ok=True)

    def fetch(file, url):
        path = cache / file
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        data = subprocess.check_output([
            "curl", "--fail", "--silent", "--show-error", "--connect-timeout", "10",
            "--max-time", "30", "--retry", "2", "--retry-max-time", "90", url,
        ])
        obj = json.loads(data)
        path.write_bytes(data)
        return obj

    kmb = fetch("kmb.json", KMB)["data"]
    catalogue = fetch("ctb.json", f"{CITYBUS}/route/CTB")["data"]
    live_ctb_ids = {route["route"] for route in catalogue if route["co"] == "CTB"}
    routes = [route for route in CITYBUS_ROUTES if route in live_ctb_ids]
    nlb_ids = sorted({str(row["routeId"]) for row in fetch("nlb.json", f"{NLB}/route.php?action=list")["routes"]})
    if not routes or not nlb_ids:
        raise ValueError("Missing official Citybus or NLB route catalogue")

    def citybus_ids(request):
        route, direction = request
        payload = fetch(f"ctb-{route}-{direction}.json", f"{CITYBUS}/route-stop/CTB/{route}/{direction}")
        expected_dir = "O" if direction == "outbound" else "I"
        for row in payload["data"]:
            if row["co"] != "CTB" or row["route"] != route or row["dir"] != expected_dir:
                raise ValueError(f"Unexpected Citybus route-stop data for {route} {direction}")
            if not isinstance(row["stop"], str) or not re.fullmatch(r"\d{6}", row["stop"]):
                raise ValueError(f"Invalid Citybus stop ID for {route}")
        return [row["stop"] for row in payload["data"]]

    def citybus_stop(stop_id):
        payload = fetch(f"ctb-stop-{stop_id}.json", f"{CITYBUS}/stop/{stop_id}")
        if payload["data"]["stop"] != stop_id:
            raise ValueError(f"Mismatched Citybus stop ID {stop_id}")
        return payload["data"]

    def nlb_stops(route_id):
        return fetch(f"nlb-{route_id}.json", f"{NLB}/stop.php?action=list&routeId={route_id}")["stops"]

    with ThreadPoolExecutor(max_workers=3) as pool:
        nlb_by_route = list(pool.map(nlb_stops, nlb_ids))
        nlb_stops_raw = [row for stops in nlb_by_route for row in stops]
        print(f"NLB: {len(nlb_ids)} route IDs, {sum(bool(stops) for stops in nlb_by_route)} with stops", flush=True)
        directions = [(route, direction) for route in routes for direction in ("outbound", "inbound")]
        ids = sorted({stop for group in pool.map(citybus_ids, directions) for stop in group})
        print(f"Citybus: {len(routes)} routes, {len(ids)} unique V2 stop IDs to verify", flush=True)
        citybus = list(pool.map(citybus_stop, ids))

    def collect(source, rows):
        stops = {}
        skipped = 0
        for row in rows:
            if source == "nlb":
                stop_id = str(row.get("stopId", ""))
                zh, en = row.get("stopName_c", ""), row.get("stopName_e", "")
                street_zh, street_en = row.get("stopLocation_c", ""), row.get("stopLocation_e", "")
                lat, lon = row.get("latitude"), row.get("longitude")
                valid_id = re.fullmatch(r"\d+", stop_id)
            else:
                stop_id = row.get("stop", "")
                zh, en = row.get("name_tc", ""), row.get("name_en", "")
                street_zh = street_en = ""
                lat, lon = row.get("lat"), row.get("long")
                valid_id = isinstance(stop_id, str) and re.fullmatch(
                    r"[A-Fa-f0-9]{16}" if source == "kmbLwb" else r"\d{6}", stop_id,
                )
            try:
                lat, lon = float(lat), float(lon)
            except (TypeError, ValueError):
                skipped += 1
                continue
            if not valid_id or not (zh or en) or not (22.12 <= lat <= 22.59 and 113.82 <= lon <= 114.46):
                skipped += 1
                continue
            data = [stop_id, zh, en, round(lat, 6), round(lon, 6), street_zh, street_en]
            old = stops.setdefault(stop_id, data)
            if not math.isclose(old[3], data[3], abs_tol=0.00001) or not math.isclose(old[4], data[4], abs_tol=0.00001):
                raise ValueError(f"Conflicting coordinates for {source} stop {stop_id}")
        if not stops:
            raise ValueError(f"Empty snapshot for {source}")
        print(f"{source}: {len(stops)} indexed; {skipped} source rows outside the bounds or invalid", flush=True)
        return [stops[key] for key in sorted(stops)]

    snapshot = {
        "capturedAt": int(time.time() * 1000),
        "citybusRoutes": routes,
        "nlbRoutes": len(nlb_ids),
        "stops": {
            "kmbLwb": collect("kmbLwb", kmb),
            "citybus": collect("citybus", citybus),
            "nlb": collect("nlb", nlb_stops_raw),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", required=True, type=Path, help="New scratch directory for source JSON and interrupted run recovery")
    parser.add_argument("--output", type=Path, default=Path("assets/data/nearby-stops.json"))
    args = parser.parse_args()
    build(args.cache_dir, args.output)

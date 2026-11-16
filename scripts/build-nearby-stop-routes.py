#!/usr/bin/env python3
"""Build the stop-to-route index from official responses cached by build-nearby-stops.py."""

import argparse
from collections import defaultdict
import json
from pathlib import Path
import re
import subprocess
import time


KMB = "https://data.etabus.gov.hk/v1/transport/kmb"


def build(cache, stops_path, output):
    def read(file):
        return json.loads((cache / file).read_text(encoding="utf-8"))

    def kmb_json(file, url):
        if (cache / file).exists():
            return read(file)
        data = subprocess.check_output([
            "curl", "--compressed", "--fail", "--silent", "--show-error",
            "--connect-timeout", "10", "--max-time", "150", url,
        ])
        result = json.loads(data)
        (cache / file).write_bytes(data)
        return result

    seed = json.loads(stops_path.read_text(encoding="utf-8"))
    names = {source: {row[0]: row[1:3] for row in rows} for source, rows in seed["stops"].items()}

    # Metadata is stored once per route option; each stop references it with its official sequence.
    def index(groups, destinations, origins=None):
        table = []
        by_stop = defaultdict(list)
        for route, visits in sorted(groups.items()):
            number, direction, variant = route
            terminal = max(visits, key=lambda visit: visit[1])[0]
            zh, en = destinations.get(route, ("", ""))
            row = [number, direction, variant, zh, en, terminal]
            if origins:
                row.extend(origins[route])
            table.append(row)
            for stop, seq in sorted(set(visits), key=lambda visit: (visit[1], visit[0])):
                by_stop[stop].append([len(table) - 1, seq])
        print(f"{len(table)} route options; {len(by_stop)} stops; {sum(map(len, by_stop.values()))} visits", flush=True)
        return {"routes": table, "stops": dict(sorted(by_stop.items()))}

    kmb_groups = defaultdict(list)
    raw_kmb = kmb_json("kmb-route-stops.json", f"{KMB}/route-stop")["data"]
    if len(raw_kmb) < 30_000:
        raise ValueError("Expected a complete KMB Route-Stop catalogue")
    for row in raw_kmb:
        route = (row["route"], row["bound"], str(row["service_type"]))
        stop, seq = row["stop"], int(row["seq"])
        if route[1] not in ("I", "O") or not re.fullmatch(r"[A-Fa-f0-9]{16}", stop) or seq < 1:
            raise ValueError(f"Invalid KMB visit {route} {stop} {seq}")
        kmb_groups[route].append((stop, seq))
    kmb_routes = kmb_json("kmb-routes.json", f"{KMB}/route/")["data"]
    kmb_destinations = {
        (row["route"], row["bound"], str(row["service_type"])): (row["dest_tc"], row["dest_en"])
        for row in kmb_routes
    }
    for route, visits in kmb_groups.items():
        terminal = max(visits, key=lambda visit: visit[1])[0]
        kmb_destinations.setdefault(route, names["kmbLwb"].get(terminal, ("", "")))

    city_groups = defaultdict(list)
    city_destinations = {}
    city_catalogue = {row["route"]: row for row in read("ctb.json")["data"] if row["co"] == "CTB"}
    for number in seed["citybusRoutes"]:
        for direction, bound in (("outbound", "O"), ("inbound", "I")):
            route = (number, bound, "")
            for row in read(f"ctb-{number}-{direction}.json")["data"]:
                stop, seq = row["stop"], int(row["seq"])
                if row["co"] != "CTB" or row["route"] != number or row["dir"] != bound or not re.fullmatch(r"\d{6}", stop) or seq < 1:
                    raise ValueError(f"Invalid Citybus visit {route} {stop} {seq}")
                city_groups[route].append((stop, seq))
            if route in city_groups:
                # The catalogue labels the public direction, which can differ from a circular route's final stop.
                record = city_catalogue.get(number, {})
                endpoint = "dest" if bound == "O" else "orig"
                terminal = max(city_groups[route], key=lambda visit: visit[1])[0]
                zh, en = names["citybus"].get(terminal, ("", ""))
                city_destinations[route] = (record.get(f"{endpoint}_tc") or zh, record.get(f"{endpoint}_en") or en)

    nlb_groups = defaultdict(list)
    nlb_destinations = {}
    nlb_origins = {}
    # NLB route IDs carry the direction. The published array is in stop sequence order.
    for row in read("nlb.json")["routes"]:
        route = (row["routeNo"], "", str(row["routeId"]))
        for seq, record in enumerate(read(f"nlb-{route[2]}.json")["stops"], 1):
            stop = str(record["stopId"])
            if not re.fullmatch(r"\d+", stop):
                raise ValueError(f"Invalid NLB stop ID {stop}")
            nlb_groups[route].append((stop, seq))
        nlb_destinations[route] = tuple(
            text.partition(">")[2].strip() or text.strip() for text in (row["routeName_c"], row["routeName_e"])
        )
        nlb_origins[route] = tuple(
            text.split(">", 1)[0].strip() if ">" in text else "" for text in (row["routeName_c"], row["routeName_e"])
        )

    if not city_groups or not nlb_groups:
        raise ValueError("Missing Citybus or NLB Route-Stop data")

    data = {
        "capturedAt": int(time.time() * 1000),
        "sources": {
            "kmbLwb": index(kmb_groups, kmb_destinations),
            "citybus": index(city_groups, city_destinations),
            "nlb": index(nlb_groups, nlb_destinations, nlb_origins),
        },
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, required=True)
    parser.add_argument("--stops", type=Path, default=Path("assets/data/nearby-stops.json"))
    parser.add_argument("--output", type=Path, default=Path("assets/data/nearby-stop-routes.json"))
    args = parser.parse_args()
    build(args.cache_dir, args.stops, args.output)

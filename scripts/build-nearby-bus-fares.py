#!/usr/bin/env python3
"""Derive a small fare pack from reviewed TD and operator route identities."""

import argparse
import csv
from collections import defaultdict
from datetime import date
from decimal import Decimal
from hashlib import sha256
import json
import math
from pathlib import Path
import subprocess
import unicodedata
from xml.etree.ElementTree import iterparse


DATA = Path(__file__).resolve().parent.parent / "assets/data"
OUTPUT = DATA / "nearby-bus-fares.json"
GEO = "https://static.data.gov.hk/td/routes-fares-geojson/"
XML = "https://static.data.gov.hk/td/routes-fares-xml/"
SOURCES = {"geo.json": GEO + "JSON_BUS.json", "geo-date.csv": GEO + "DATA_LAST_UPDATED_DATE.csv",
           "fare.xml": XML + "FARE_BUS.xml", "xml-date.csv": XML + "DATA_LAST_UPDATED_DATE.csv"}

# App source, route, operator bound/variant, TD company/route ID/sequence, reviewed for sections.
APPROVALS = (
    ("nlb", "B2", "", "37", "NLB", 1735, 1, False),
    ("nlb", "B2", "", "38", "NLB", 1735, 2, False),
    ("citybus", "B15", "O", "", "CTB", 1000725, 1, True),
    ("citybus", "B15", "I", "", "CTB", 1000725, 2, True),
    ("kmbLwb", "68A", "O", "1", "KMB", 1286, 1, False),
    ("kmbLwb", "68A", "I", "1", "KMB", 1286, 2, False),
    ("kmbLwb", "68X", "I", "1", "KMB", 1288, 2, False),
    ("kmbLwb", "258P", "O", "1", "KMB", 1090, 1, False),
    ("kmbLwb", "258P", "I", "1", "KMB", 8558, 1, True),
    ("kmbLwb", "261P", "O", "1", "KMB", 1104, 1, True),
    ("kmbLwb", "268X", "O", "1", "KMB", 8203, 1, False),
    ("kmbLwb", "268X", "I", "1", "KMB", 8203, 2, False),
    ("kmbLwb", "268X", "O", "3", "KMB", 1000333, 1, True),
)


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def operator_input(source, route, bound, variant):
    if source == "nlb":
        return f"nlb{variant}.json", f"https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId={variant}"
    direction = {"O": "outbound", "I": "inbound"}[bound]
    if source == "citybus":
        return f"{route}-{direction}.json", f"https://rt.data.gov.hk/v2/transport/citybus/route-stop/CTB/{route}/{direction}"
    return (f"{route}-{direction}-{variant}.json",
            f"https://data.etabus.gov.hk/v1/transport/kmb/route-stop/{route}/{direction}/{variant}")


def cents(price):
    scaled = Decimal(str(price)) * 100
    require(scaled.is_finite() and 0 < scaled < 1_000_000 and scaled == scaled.to_integral_value(),
            f"Invalid HKD price: {price}")
    return int(scaled)


def unchanged_daily_fare(prices):
    # The selected TD records have no DAY_CODE. The explicit all-days code is 511.
    if len(prices) == 1:
        scope, price = next(iter(prices))
        if scope in (None, "511"):
            return price
    return None


def fare_to_any_destination(prices, boarding, destinations):
    values = {unchanged_daily_fare(prices.get((boarding, alight), set())) for alight in destinations}
    return next(iter(values)) if len(values) == 1 else None


def read_fare_xml(path, route_ids):
    prices = defaultdict(lambda: defaultdict(set))
    fare_dates = defaultdict(set)
    events = iterparse(path, events=("start", "end"))
    _, root = next(events)
    generated = date.fromisoformat(root.attrib["generated"][:10])
    for event, row in events:
        if event != "end" or row.tag != "FARE":
            continue
        route_id = int(row.findtext("ROUTE_ID"))
        if route_id in route_ids:
            key = route_id, int(row.findtext("ROUTE_SEQ"))
            trip = int(row.findtext("ON_SEQ")), int(row.findtext("OFF_SEQ"))
            day = row.findtext("DAY_CODE") or None
            prices[key][trip].add((day, cents(row.findtext("PRICE"))))
            fare_dates[key].add(row.findtext("LAST_UPDATE_DATE")[:10])
        root.clear()
    return generated, prices, fare_dates


def normal_name(name):
    normalized = unicodedata.normalize("NFKC", name).casefold()
    return "".join(char for char in normalized if char.isalnum())


def stop_names_match(td, stop, terminal=False):
    for name, app_name in ((td["stopNameC"], stop[1]), (td["stopNameE"], stop[2])):
        left, right = normal_name(name), normal_name(app_name)
        if terminal:
            right = right.removesuffix("落客站").removesuffix("alightingstop")
        if left and left == right:
            return True
    return False


def stop_distance(point, stop):
    longitude, latitude = point
    require(-180 <= longitude <= 180 and -90 <= latitude <= 90, "Invalid TD coordinate")
    return 111_195 * math.hypot(latitude - stop[3], (longitude - stop[4]) * math.cos(math.radians(latitude)))


def read_operator_visits(directory, source, route, bound, variant, company):
    name, _ = operator_input(source, route, bound, variant)
    data = read_json(directory / name)
    if source == "nlb":
        return [(i, str(stop["stopId"])) for i, stop in enumerate(data["stops"], 1)], data["stops"][0]
    rows = data["data"]
    require(all(row["route"] == route and (
        row["dir"] == bound and row["co"] == company if source == "citybus"
        else row["bound"] == bound and str(row["service_type"]) == variant
    ) for row in rows), f"Different operator route in {name}")
    return sorted((int(row["seq"]), row["stop"]) for row in rows), None


def build(directory, reviewed):
    dataset_date, price_index, fare_dates = read_fare_xml(directory / "fare.xml", {row[5] for row in APPROVALS})
    for filename in ("geo-date.csv", "xml-date.csv"):
        with (directory / filename).open(encoding="utf-8-sig", newline="") as file:
            _, revision = list(csv.reader(file))
        require(date.fromisoformat(revision[0]) == dataset_date, f"Inconsistent TD revision in {filename}")
    require(0 <= (reviewed - dataset_date).days < 14, "TD revision is invalid or expired")

    # GeoJSON repeats route properties for each official stop visit.
    reviewed_td = {(route, company, rid, seq) for _, route, _, _, company, rid, seq, _ in APPROVALS}
    td_routes = defaultdict(list)
    for feature in read_json(directory / "geo.json")["features"]:
        row = feature["properties"]
        key = row["routeNameE"], row["companyCode"], row["routeId"], row["routeSeq"]
        if key in reviewed_td:
            require(row["routeType"] == 1 and feature["geometry"]["type"] == "Point", f"Invalid TD row {key}")
            td_routes[key].append((row, feature["geometry"]["coordinates"]))

    app_routes = read_json(DATA / "nearby-stop-routes.json")["sources"]
    app_stops = {source: {row[0]: row for row in rows} for source, rows in read_json(DATA / "nearby-stops.json")["stops"].items()}
    records = {}
    for source, route, bound, variant, company, rid, seq, sections in APPROVALS:
        identity = f"{company} {route} {bound or variant} {variant if bound else ''}".strip()
        index = app_routes[source]
        [route_index] = [i for i, row in enumerate(index["routes"]) if row[:3] == [route, bound, variant]]
        cached_visits = sorted((n, stop) for stop, rows in index["stops"].items() for i, n in rows if i == route_index)
        live_visits, nlb_first = read_operator_visits(directory, source, route, bound, variant, company)
        td = sorted(td_routes[route, company, rid, seq], key=lambda row: row[0]["stopSeq"])
        count = len(td)
        require(count >= 2 and cached_visits == live_visits and [n for n, _ in live_visits] == list(range(1, count + 1))
                and [row[0]["stopSeq"] for row in td] == list(range(1, count + 1)), f"{identity}: stop sequence changed")
        require(len({row["stopId"] for row, _ in td}) == len({stop for _, stop in live_visits}) == count,
                f"{identity}: repeated stop requires separate review")
        matched = []
        for (position, stop_id), (row, point) in zip(live_visits, td):
            stop = app_stops[source][stop_id]
            distance = stop_distance(point, stop)
            endpoint = position in (1, count)
            name_matches = stop_names_match(row, stop, terminal=position == count)
            if endpoint or sections:
                # The identified NLB border terminal offset is allowed for full fare only.
                border = source == "nlb" and stop_id == "152" and row["stopId"] == 12728
                require(name_matches and distance <= (700 if border else 100), f"{identity}: stop {position} mismatch")
            matched.append((position, stop_id, distance, row["stopPickDrop"]))

        full_prices = {cents(row["fullFare"]) for row, _ in td}
        require(len(full_prices) == 1 and all(row["specialType"] in (0, 1) for row, _ in td),
                f"{identity}: divergent or date-dependent full fares")
        [full] = full_prices
        prices = price_index[rid, seq]
        require(matched[0][3] in (2, 3) and matched[-1][3] in (1, 3)
                and unchanged_daily_fare(prices.get((1, count), set())) == full, f"{identity}: full fare cross-check failed")
        if nlb_first is not None:
            require(cents(nlb_first["fare"]) == cents(nlb_first["fareHoliday"]) == full,
                    f"{identity}: operator's weekday or holiday fare differs")

        boardings = {}
        if sections:
            for position, stop_id, distance, access in matched:
                if distance > 50 or access not in (2, 3):
                    continue
                destinations = [alight for alight, _, _, drop in matched if alight > position and drop in (1, 3)]
                price = fare_to_any_destination(prices, position, destinations)
                if price is not None and price <= full:
                    boardings[str(position)] = {"stopId": stop_id, "cents": price}

        key_parts = [source, variant] if source == "nlb" else [source, route, {"O": "outbound", "I": "inbound"}[bound], variant or None]
        key = json.dumps(key_parts, separators=(",", ":"))
        require(key not in records, f"Duplicate app route {key}")
        records[key] = {"number": route, "td": [company, rid, seq], "fullCents": full, "boarding": boardings,
                        "routeUpdated": sorted({row["lastUpdateDate"][:10] for row, _ in td}),
                        "fareUpdated": sorted(fare_dates[rid, seq])}

    return {"version": 1, "datasetDate": dataset_date.isoformat(), "reviewedDate": reviewed.isoformat(),
            "sources": SOURCES, "sha256": {name: sha256((directory / name).read_bytes()).hexdigest() for name in SOURCES},
            "records": records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input_dir", type=Path)
    parser.add_argument("--reviewed", required=True, type=date.fromisoformat, help="Hong Kong evidence review date")
    parser.add_argument("--download", action="store_true", help="Fetch official files into input_dir before building")
    parser.add_argument("--check", action="store_true", help="Compare with the checked-in pack without writing")
    args = parser.parse_args()
    if args.download:
        args.input_dir.mkdir(parents=True, exist_ok=True)
        inputs = {**SOURCES, **dict(operator_input(*row[:4]) for row in APPROVALS)}
        for name, url in inputs.items():
            # A failed transfer must not leave a file that can be mistaken for a complete input.
            destination = args.input_dir / name
            temporary = destination.with_suffix(destination.suffix + ".part")
            subprocess.run(["curl", "-fLsS", "--max-time", "60", "-o", str(temporary), url], check=True)
            temporary.replace(destination)
    pack = build(args.input_dir, args.reviewed)
    output = json.dumps(pack, indent=2, ensure_ascii=False) + "\n"
    if args.check:
        require(OUTPUT.read_text(encoding="utf-8") == output, "Fare pack differs from the reviewed inputs")
    else:
        OUTPUT.write_text(output, encoding="utf-8")
    print(f"{len(pack['records'])} route options, {sum(len(r['boarding']) for r in pack['records'].values())} boarding prices")


if __name__ == "__main__":
    main()

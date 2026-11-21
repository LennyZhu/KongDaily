#!/usr/bin/env python3
"""Verify the operator's Light Rail Routes & Stops CSV and generate the offline snapshot."""

import argparse
from collections import defaultdict
import csv
from datetime import datetime, date, timedelta
from email.utils import parsedate_to_datetime
from hashlib import sha256
import io
import json
from pathlib import Path
import re
from zipfile import BadZipFile, ZipFile


OUTPUT = Path(__file__).resolve().parents[1] / "assets/data/light-rail-static.json"
RESOURCE = "https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/d0662909-9919-4f01-b4f9-eccc4b2acbb5"
CSV_URL = "https://opendata.mtr.com.hk/data/light_rail_routes_and_stops.csv"
DICTIONARY = "https://opendata.mtr.com.hk/doc/DataDictionary.zip"
TIMETABLE = {
    "zh-HK": "https://www.mtr.com.hk/ch/customer/services/schedule_index.html",
    "en": "https://www.mtr.com.hk/en/customer/services/schedule_index.html",
}
HEADERS = ("Line Code", "Direction", "Stop Code", "Stop ID", "Chinese Name", "English Name", "Sequence")
CIRCULAR_ROUTES = {"705", "706"}  # Confirmed by the operator timetable.


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_csv(raw):
    reader = csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline=""), strict=True)
    require(tuple(next(reader, ())) == HEADERS, "Unexpected official CSV header")
    patterns = defaultdict(dict)
    stops = {}
    codes = {}
    rows = 0
    blank_rows = 0
    for row in reader:
        if not any(row):
            blank_rows += 1
            continue
        context = f"CSV line {reader.line_num}"
        require(len(row) == len(HEADERS) and all(value.strip() for value in row), f"{context}: missing or extra fields")
        route, direction, code, stop_id, zh, en, sequence = (value.strip() for value in row)
        require(re.fullmatch(r"[1-9][0-9]{1,3}[A-Z]?", route) and direction in ("1", "2"),
                f"{context}: unrecognized route code or direction {route}/{direction}")
        require(re.fullmatch("[A-Z]{3}", code) and re.fullmatch("[1-9][0-9]*", stop_id),
                f"{context}: invalid stop identity")
        require(re.fullmatch("[1-9][0-9]*", sequence), f"{context}: invalid sequence")
        require("\ufffd" not in zh + en and "&#" not in zh + en, f"{context}: unresolved name encoding")
        stop = {"code": code, "zh": zh, "en": en}
        require(stops.setdefault(stop_id, stop) == stop, f"{context}: conflicting records for stop ID {stop_id}")
        require(codes.setdefault(code, stop_id) == stop_id, f"{context}: conflicting IDs for stop code {code}")
        visits = patterns[route].setdefault(direction, {})
        number = int(sequence)
        # A stop ID can appear more than once in a pattern. Only sequence is unique in that pattern.
        require(number not in visits, f"{context}: duplicate sequence for {route}/{direction}")
        visits[number] = stop_id
        rows += 1

    require(patterns and CIRCULAR_ROUTES.issubset(patterns), "Reviewed circular routes missing")
    routes = {}
    for route, directions in sorted(patterns.items()):
        require(set(directions) == {"1", "2"}, f"{route}: missing published direction")
        sequences = {}
        for direction, visits in sorted(directions.items()):
            require(set(visits) == set(range(1, len(visits) + 1)), f"{route}/{direction}: missing sequence")
            sequences[direction] = [visits[i] for i in range(1, len(visits) + 1)]
        if route in CIRCULAR_ROUTES:
            first, second = sequences["1"], sequences["2"]
            require(first[-1] == second[0] and second[-1] == first[0], f"{route}: circular segment boundaries changed")
        routes[route] = {"circular": route in CIRCULAR_ROUTES, "directions": sequences}

    counts = {"csvRows": rows, "blankRows": blank_rows, "routes": len(routes), "stops": len(stops),
              "patterns": sum(len(item) for item in patterns.values())}
    return routes, dict(sorted(stops.items(), key=lambda stop: int(stop[0]))), counts


def encode_records(records):
    return "{\n" + ",\n".join(
        f"    {json.dumps(key)}: {json.dumps(value, ensure_ascii=False)}"
        for key, value in records.items()
    ) + "\n  }"


def build(raw, dictionary, fetched_at, resource_updated, last_modified):
    require(datetime.fromisoformat(fetched_at).utcoffset() == timedelta(hours=8), "Download time must use Hong Kong time (+08:00)")
    date.fromisoformat(resource_updated)
    require(parsedate_to_datetime(last_modified).tzinfo is not None, "CSV Last-Modified must include its time zone")
    with ZipFile(io.BytesIO(dictionary)) as archive:
        require("light_rail_routes_and_stops_dataspec.pdf" in archive.namelist(), "Light Rail CSV dictionary missing")
    routes, stops, counts = read_csv(raw)
    source = {
        "resource": RESOURCE, "csv": CSV_URL, "dictionary": DICTIONARY, "timetable": TIMETABLE,
        "fetchedAt": fetched_at, "resourceUpdatedOn": resource_updated, "csvLastModified": last_modified,
        "csvSha256": sha256(raw).hexdigest(), "dictionarySha256": sha256(dictionary).hexdigest(),
    }
    values = {"schemaVersion": "1", "source": json.dumps(source, indent=2).replace("\n", "\n  "),
              "counts": json.dumps(counts), "routes": encode_records(routes), "stops": encode_records(stops)}
    return "{\n" + ",\n".join(f'  "{key}": {value}' for key, value in values.items()) + "\n}\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("dictionary", type=Path)
    parser.add_argument("--fetched-at", required=True, help="Download time in Hong Kong, ISO 8601 (+08:00)")
    parser.add_argument("--resource-updated", required=True, help="DATA.GOV.HK resource updated date")
    parser.add_argument("--last-modified", required=True, help="CSV HTTP Last-Modified header")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true", help="Compare the snapshot without writing")
    args = parser.parse_args()
    try:
        result = build(args.csv.read_bytes(), args.dictionary.read_bytes(), args.fetched_at,
                       args.resource_updated, args.last_modified)
        if args.check:
            require(args.output.read_text(encoding="utf-8") == result, "Snapshot differs. Review the official data diff.")
        else:
            args.output.write_text(result, encoding="utf-8")
    except (ValueError, OSError, csv.Error, BadZipFile) as error:
        parser.exit(1, f"{error}\n")
    print(f"{'Verified' if args.check else 'Generated'} {args.output}")


if __name__ == "__main__":
    main()

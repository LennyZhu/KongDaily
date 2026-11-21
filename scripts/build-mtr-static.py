#!/usr/bin/env python3
"""Validate the official MTR lines/stations CSV and build the offline snapshot."""

import argparse
from datetime import date
import csv
from email.utils import parsedate_to_datetime
from hashlib import sha256
import io
import json
from pathlib import Path
import re
from zipfile import BadZipFile, ZipFile


OUTPUT = Path(__file__).resolve().parents[1] / "assets/data/mtr-static.json"
RESOURCE = "https://data.gov.hk/en-data/dataset/mtr-data-routes-fares-barrier-free-facilities/resource/8daba4fe-b879-4a51-8962-27b4cffdc61c"
CSV_URL = "https://opendata.mtr.com.hk/data/mtr_lines_and_stations.csv"
DICTIONARY = "https://opendata.mtr.com.hk/doc/DataDictionary.zip"
SYSTEM_MAP = "https://www.mtr.com.hk/en/customer/services/system_map.html"
RACECOURSE_SOURCE = "https://opendata.mtr.com.hk/doc/Next_Train_DataDictionary_v1.7.pdf"
RACECOURSE_HOURS = "https://www.mtr.com.hk/en/customer/services/service_hours_search.php?query_type=search&station=70"

# Display names checked against the operator's bilingual system map.
LINE_NAMES = {
    "AEL": ("機場快綫", "Airport Express"),
    "DRL": ("迪士尼綫", "Disneyland Resort Line"),
    "EAL": ("東鐵綫", "East Rail Line"),
    "ISL": ("港島綫", "Island Line"),
    "KTL": ("觀塘綫", "Kwun Tong Line"),
    "SIL": ("南港島綫", "South Island Line"),
    "TKL": ("將軍澳綫", "Tseung Kwan O Line"),
    "TCL": ("東涌綫", "Tung Chung Line"),
    "TML": ("屯馬綫", "Tuen Ma Line"),
    "TWL": ("荃灣綫", "Tsuen Wan Line"),
}
BRANCH_DIRECTIONS = {
    "EAL": ("LMC-UT", "LMC-DT"),
    "TKL": ("TKS-UT", "TKS-DT"),
}
# The operator lists these physical interchanges on both lines under the same station maps.
SHARED_STATIONS = {
    "HOK": {"AEL": 44, "TCL": 39},
    "KOW": {"AEL": 45, "TCL": 40},
    "TSY": {"AEL": 46, "TCL": 42},
}
HEADERS = ("Line Code", "Direction", "Station Code", "Station ID", "Chinese Name", "English Name", "Sequence")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_csv(raw):
    records = csv.reader(io.StringIO(raw.decode("utf-8-sig"), newline=""), strict=True)
    require(tuple(next(records, ())) == HEADERS, "Unexpected official CSV header")
    patterns = {}
    stations = {}
    ids = {}
    blank_rows = 0
    row_count = 0
    for row in records:
        if not any(row):
            blank_rows += 1
            continue
        context = f"CSV line {records.line_num}"
        require(len(row) == len(HEADERS) and all(value.strip() for value in row), f"{context}: missing or extra fields")
        line, direction, code, station_id, zh, en, sequence = (value.strip() for value in row)
        require(line in LINE_NAMES and direction in ("UT", "DT", *BRANCH_DIRECTIONS.get(line, ())),
                f"{context}: unknown line/direction {line}/{direction}")
        require(re.fullmatch("[A-Z]{3}", code) and re.fullmatch("[1-9][0-9]*", station_id),
                f"{context}: invalid station code or ID")
        require(re.fullmatch(r"[1-9][0-9]*(?:\.0+)?", sequence), f"{context}: invalid sequence")
        require("\ufffd" not in zh + en and "&#" not in zh + en, f"{context}: unresolved station name encoding")
        station_id = int(station_id)
        sequence = int(sequence.split(".")[0])
        require(ids.setdefault(station_id, code) == code, f"{context}: station ID {station_id} maps to multiple codes")
        station = stations.setdefault(code, {"zh": zh, "en": en, "lineIds": {}})
        require((station["zh"], station["en"]) == (zh, en), f"{context}: conflicting names for {code}")
        require(station["lineIds"].setdefault(line, station_id) == station_id,
                f"{context}: inconsistent ID for {line}/{code}")
        visits = patterns.setdefault((line, direction), {})
        require(sequence not in visits and code not in visits.values(), f"{context}: duplicate sequence or station")
        visits[sequence] = code
        row_count += 1

    for code, station in stations.items():
        memberships = station["lineIds"]
        if len(set(memberships.values())) > 1:
            require(memberships == SHARED_STATIONS.get(code), f"{code}: unreviewed shared station identity")
    for code, memberships in SHARED_STATIONS.items():
        require(stations.get(code, {}).get("lineIds") == memberships, f"{code}: reviewed identities changed")

    lines = {}
    for line, (zh, en) in LINE_NAMES.items():
        directions = {}
        for direction in ("UT", "DT", *BRANCH_DIRECTIONS.get(line, ())):
            visits = patterns.get((line, direction), {})
            require(visits and set(visits) == set(range(1, len(visits) + 1)), f"{line}/{direction}: missing sequence")
            directions[direction] = [visits[i] for i in range(1, len(visits) + 1)]
        lines[line] = {"zh": zh, "en": en, "directions": directions}

    counts = {
        "csvRows": row_count, "blankRows": blank_rows, "patterns": len(patterns),
        "lineStationPairs": sum(len(station["lineIds"]) for station in stations.values()),
        "officialIds": len(ids), "stationCodes": len(stations),
    }
    require("RAC" not in stations, "RAC now appears in the CSV. Review and remove the supplemental entry.")
    # RAC is confirmed on East Rail by the operator's map and v1.7 line/station table.
    # The CSV provides neither its numeric ID nor its position in an ordered pattern.
    stations["RAC"] = {"zh": "馬場", "en": "Racecourse", "lineIds": {"EAL": None}, "supplemental": True}
    return lines, dict(sorted(stations.items())), counts


def encode_records(records):
    return "{\n" + ",\n".join(
        f"    {json.dumps(key)}: {json.dumps(value, ensure_ascii=False, separators=(', ', ': '))}"
        for key, value in records.items()
    ) + "\n  }"


def build(raw, dictionary, fetched_on, resource_updated, last_modified):
    date.fromisoformat(fetched_on)
    date.fromisoformat(resource_updated)
    require(parsedate_to_datetime(last_modified).tzinfo is not None, "CSV HTTP Last-Modified must include its time zone")
    with ZipFile(io.BytesIO(dictionary)) as archive:
        require("mtr_lines_and_stations_dataspec.pdf" in archive.namelist(), "Rail CSV dictionary missing from archive")
    lines, stations, counts = read_csv(raw)
    source = {
        "resource": RESOURCE, "csv": CSV_URL, "dictionary": DICTIONARY,
        "systemMap": SYSTEM_MAP, "racecourseCodeSource": RACECOURSE_SOURCE, "racecourseHours": RACECOURSE_HOURS,
        "fetchedOn": fetched_on, "resourceUpdatedOn": resource_updated, "csvLastModified": last_modified,
        "csvSha256": sha256(raw).hexdigest(), "dictionarySha256": sha256(dictionary).hexdigest(),
    }
    values = {"schemaVersion": "1", "source": json.dumps(source, ensure_ascii=False, indent=2).replace("\n", "\n  "),
              "counts": json.dumps(counts), "lines": encode_records(lines), "stations": encode_records(stations)}
    return "{\n" + ",\n".join(f'  "{key}": {value}' for key, value in values.items()) + "\n}\n"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("dictionary", type=Path)
    parser.add_argument("--fetched-on", required=True, help="Download date in Hong Kong (YYYY-MM-DD)")
    parser.add_argument("--resource-updated", required=True, help="Date shown on the DATA.GOV.HK resource page")
    parser.add_argument("--last-modified", required=True, help="CSV HTTP Last-Modified header")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--check", action="store_true", help="Compare with the current snapshot without writing")
    args = parser.parse_args()
    try:
        snapshot = build(args.csv.read_bytes(), args.dictionary.read_bytes(), args.fetched_on,
                         args.resource_updated, args.last_modified)
        if args.check:
            require(args.output.read_text(encoding="utf-8") == snapshot, "Snapshot differs. Review the generated data diff.")
        else:
            args.output.write_text(snapshot, encoding="utf-8")
    except (ValueError, OSError, csv.Error, BadZipFile) as error:
        parser.exit(1, f"{error}\n")
    print(f"{'Verified' if args.check else 'Generated'} {args.output}")


if __name__ == "__main__":
    main()

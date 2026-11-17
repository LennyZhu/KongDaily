#!/usr/bin/env python3
"""Validate the official CSDI GeoJSON and atomically replace the AFCD snapshot."""

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import tempfile
from urllib.request import urlopen
import xml.etree.ElementTree as ET

PORTAL = "https://portal.csdi.gov.hk"
DATASET = "afcd_rcd_1635136427551_29173"
LAYER = "Toilets_Toilets_Ext_GDB"
DATASET_URL = f"{PORTAL}/csdi-webpage/dataset/{DATASET}"
DOWNLOAD_URL = f"{PORTAL}/csdi-webpage/file-api?dataset_id={DATASET}&format=geojson&layer_name={LAYER}"
METADATA_URL = (
    f"{PORTAL}/geoportal/csw?service=CSW&version=2.0.2&request=GetRecordById&elementSetName=full&id={DATASET}"
)
COUNT_URL = f"{PORTAL}/server/rest/services/common/{DATASET}/MapServer/0/query?where=1%3D1&returnCountOnly=true&f=pjson"
NOTICES_URL = "https://www.hiking.gov.hk/news"
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "assets/data/afcd-toilets.json"
NAMESPACES = {"dc": "http://purl.org/dc/elements/1.1/", "dct": "http://purl.org/dc/terms/"}
TYPES = {"Flushing Toilet": "沖水式廁所", "Dry Toilet": "旱廁", "Portable Toilet": "流動廁所"}
NOTICE_REVIEW_DATE = "2026-11-17"
# Matching evidence and facilities with an unresolved identity are documented in docs/afcd-toilet-data.md.
NOTICES = {
    "ABD/TF/001": ("2025-02-13", [114.1594508141, 22.2541703862], "67ae9a4e8f4c4"),
    "PSL/TF/002": ("2024-10-28", [114.2372177388, 22.5023917185], "6718b51d42dc8"),
    "TT/TF/002": ("2024-08-19", [114.2212515011, 22.2401102415], "66bd74b8b0b61"),
}


def bilingual(properties, prefix):
    values = {}
    for locale, suffix in (("zh-HK", "TC"), ("en", "EN")):
        value = properties[f"{prefix}_{suffix}"]
        if value is not None and not isinstance(value, str):
            raise ValueError(f"Unexpected text field {prefix}_{suffix}")
        if value and value.strip():
            values[locale] = value.strip()
    return values


def verify_metadata(payload):
    if b"<!DOCTYPE" in payload.upper() or b"<!ENTITY" in payload.upper():
        raise ValueError("Unexpected CSDI metadata document definition")
    root = ET.fromstring(payload)
    if root.findtext(".//dc:identifier", namespaces=NAMESPACES) != DATASET:
        raise ValueError("CSDI metadata does not identify the AFCD dataset")
    if not any(node.text == DOWNLOAD_URL for node in root.findall(".//dct:references", NAMESPACES)):
        raise ValueError("CSDI metadata no longer lists the verified GeoJSON download")
    revision = root.findtext(".//dct:modified", "", NAMESPACES)
    return datetime.fromisoformat(revision.replace("Z", "+00:00")).date().isoformat()


def parse_snapshot(geojson, metadata, count, fetched_at):
    snapshot_date = verify_metadata(metadata)
    if date.fromisoformat(snapshot_date) > fetched_at.date():
        raise ValueError("AFCD revision date is newer than the recorded acquisition")
    source_count = json.loads(count)["count"]
    collection = json.loads(geojson)
    features = collection["features"]
    if (collection.get("type") != "FeatureCollection" or collection.get("name") != LAYER
            or not isinstance(features, list) or type(source_count) is not int
            or not features or len(features) != source_count):
        raise ValueError("AFCD download is empty, has the wrong layer or does not match the official layer count")
    crs = collection.get("crs")
    if crs and crs["properties"]["name"] not in ("EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"):
        raise ValueError("AFCD GeoJSON declares an unexpected coordinate system")

    records = {}
    types, barrier_free, coverage = Counter(), Counter(), Counter()
    by_coordinate = Counter()
    name_points = {"zh-HK": defaultdict(set), "en": defaultdict(set)}
    for feature in features:
        properties, geometry = feature["properties"], feature["geometry"]
        facility_id = properties["FAC_ID"]
        if not isinstance(facility_id, str) or not facility_id.strip() or facility_id in records:
            raise ValueError(f"Invalid or duplicate AFCD FAC_ID {facility_id!r}")
        longitude, latitude = geometry["coordinates"]
        if (feature["type"] != "Feature" or geometry["type"] != "Point"
                or type(latitude) not in (int, float) or type(longitude) not in (int, float)
                or not (22.12 <= latitude <= 22.59 and 113.82 <= longitude <= 114.46)):
            raise ValueError(f"{facility_id} has invalid WGS84 coordinates")

        name = bilingual(properties, "FACILITY_NAME")
        area = bilingual(properties, "COUNTRY_PARK")
        type_name = bilingual(properties, "TYPE")
        official_type = type_name.get("en")
        barrier_code = properties["BARRIER_FREE_FAC"]
        if not name or official_type not in TYPES or type_name.get("zh-HK") != TYPES[official_type]:
            raise ValueError(f"{facility_id} has no usable name or an unknown toilet classification")
        if barrier_code not in ("Y", "N"):
            raise ValueError(f"{facility_id} has an unknown BARRIER_FREE_FAC value")
        record = {
            "officialId": facility_id,
            "officialType": official_type,
            "typeName": type_name,
            "name": name,
            "coordinate": {"latitude": latitude, "longitude": longitude},
            "barrierFreeCode": barrier_code,
        }
        if area:
            record["area"] = area
        notice = NOTICES.get(facility_id)
        # A changed official point requires the notice-to-facility match to be independently reviewed again.
        if notice and official_type == "Flushing Toilet" and [longitude, latitude] == notice[1]:
            start, _, attachment = notice
            record.update({
                "serviceNotice": True,
                "remarks": {
                    "zh-HK": f"漁護署公告指本公廁自 {start} 起暫停使用，直至另行通知。公告核對日期 {NOTICE_REVIEW_DATE}。",
                    "en": f"AFCD announced a temporary closure from {start} until further notice. Notice checked {NOTICE_REVIEW_DATE}.",
                },
                "serviceNoticeEvidence": {
                    "startsOn": start, "verifiedOn": NOTICE_REVIEW_DATE,
                    "url": f"https://www.hiking.gov.hk/console/public/uploads/news/{attachment}.pdf",
                },
            })
        records[facility_id] = record
        types[official_type] += 1
        barrier_free[barrier_code] += 1
        by_coordinate[(longitude, latitude)] += 1
        for locale, label in name.items():
            name_points[locale][label].add((longitude, latitude))
            coverage[f"name_{locale}"] += 1
        for locale in area:
            coverage[f"area_{locale}"] += 1

    rows = [records[key] for key in sorted(records)]
    checksum = hashlib.sha256(
        json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "schemaVersion": 1,
        "version": f"afcd-toilets-{snapshot_date}-{checksum[:12]}",
        "snapshotDate": snapshot_date,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceName": {"zh-HK": "漁農自然護理署", "en": "Agriculture, Fisheries and Conservation Department"},
        "source": {
            "url": DATASET_URL, "downloadUrl": DOWNLOAD_URL, "metadataUrl": METADATA_URL, "countUrl": COUNT_URL,
            "noticesUrl": NOTICES_URL, "layer": LAYER, "coordinateSystem": "EPSG:4326 (longitude, latitude)",
            "fetchedAt": fetched_at.isoformat(timespec="seconds"),
            "sha256": hashlib.sha256(geojson).hexdigest(),
        },
        "recordCount": len(rows),
        "recordsSha256": checksum,
        "audit": {
            "rawCount": len(features), "layerCount": source_count, "invalidOrRejected": 0,
            "duplicateIds": 0, "sameCoordinateGroups": sum(value > 1 for value in by_coordinate.values()),
            "sameNameDifferentCoordinates": {
                loc: sum(len(points) > 1 for points in groups.values()) for loc, groups in name_points.items()
            },
            "typeCounts": dict(types), "barrierFreeCodes": dict(barrier_free), "textCoverage": dict(coverage),
            "serviceNotices": sum(bool(row.get("serviceNotice")) for row in rows),
        },
        "records": rows,
    }


def save_snapshot(output, snapshot):
    if output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if snapshot["snapshotDate"] < previous["snapshotDate"]:
            raise ValueError("AFCD snapshot is older than the existing import")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=output.parent, delete=False) as file:
            temporary = Path(file.name)
            header = {key: value for key, value in snapshot.items() if key != "records"}
            file.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "records": [\n')
            file.write(",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in snapshot["records"]))
            file.write("\n  ]\n}\n")
        temporary.chmod(0o644)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="Use captured official afcd.geojson, metadata.xml and count.json")
    parser.add_argument("--fetched-at", type=datetime.fromisoformat, help="Acquisition time for --input-dir")
    parser.add_argument("--audit-only", action="store_true", help="Audit without writing the offline index")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if bool(args.input_dir) != bool(args.fetched_at) or (args.fetched_at and args.fetched_at.tzinfo is None):
        parser.error("--input-dir requires --fetched-at with an explicit timezone")

    def read(name, url):
        if args.input_dir:
            return (args.input_dir / name).read_bytes()
        with urlopen(url, timeout=30) as response:
            return response.read()

    geojson = read("afcd.geojson", DOWNLOAD_URL)
    fetched_at = args.fetched_at or datetime.now(timezone.utc)
    snapshot = parse_snapshot(geojson, read("metadata.xml", METADATA_URL), read("count.json", COUNT_URL), fetched_at)
    print(json.dumps({key: value for key, value in snapshot.items() if key != "records"}, ensure_ascii=False, indent=2))
    if not args.audit_only:
        save_snapshot(args.output, snapshot)


if __name__ == "__main__":
    main()

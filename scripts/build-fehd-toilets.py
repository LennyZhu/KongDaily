#!/usr/bin/env python3
"""Audit both official FEHD XML feeds and atomically replace the offline toilet snapshot."""

import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
from urllib.request import urlopen
import xml.etree.ElementTree as ET

URLS = {
    "zh-HK": "https://www.fehd.gov.hk/tc_chi/map/fehd_map_c.xml",
    "en": "https://www.fehd.gov.hk/english/map/fehd_map_e.xml",
}
FILES = {"zh-HK": ("tc.xml", "c"), "en": ("en.xml", "e")}
TYPES = {"toilet", "ap", "portable_toilet"}
PLACEHOLDERS = {"n/a", "不適用", "不适用", "???"}
SERVICE_NOTICE = re.compile(
    r"\b(?:suspension|suspend(?:ed|ing)?|closure|closed|temporary arrangements?)\b"
    r"|暫停服務|暫停使用|關閉|停用|臨時安排", re.IGNORECASE,
)
HONG_KONG = timezone(timedelta(hours=8))
DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "assets/data/fehd-toilets.json"


def cleaned(value):
    value = (value or "").strip()
    return value if value and value.casefold() not in PLACEHOLDERS else None


def coordinate(text):
    if not text:
        return None
    try:
        latitude, longitude = map(float, text.split(","))
    except ValueError:
        return None
    if 22.12 <= latitude <= 22.59 and 113.82 <= longitude <= 114.46:
        # The official XML orders WGS84 latitude before longitude.
        return {"latitude": latitude, "longitude": longitude}
    return None


def codes(root, tag):
    entries = {}
    for node in root.findall(f"{tag}/CODE"):
        key, name = node.get("ID"), cleaned(node.text)
        if not key or not name or key in entries:
            raise ValueError(f"Invalid or duplicate {tag} entry")
        entries[key] = name
    if not entries:
        raise ValueError(f"Missing {tag}")
    return entries


def parse_feed(locale, payload, fetched_at):
    if re.search(rb"<!\s*(?:DOCTYPE|ENTITY)\b", payload, re.IGNORECASE):
        raise ValueError(f"{locale} XML contains an unexpected document definition")
    root = ET.fromstring(payload)
    if root.tag != "DATA" or root.findtext("link") != "https://www.fehd.gov.hk":
        raise ValueError(f"Unexpected {locale} FEHD XML envelope")
    snapshot_date = date.fromisoformat(root.findtext("generation_date", ""))
    if snapshot_date > fetched_at.astimezone(HONG_KONG).date():
        raise ValueError(f"{locale} FEHD snapshot is dated after acquisition")
    types = codes(root, "map_type_CODE")
    districts = codes(root, "districtID_CODE")
    if not TYPES <= types.keys():
        raise ValueError(f"{locale} type dictionary is missing a toilet category")
    counts = dict.fromkeys(types, 0)
    rejected = Counter()
    seen = set()
    toilets = {}
    locations = root.findall("fehd_service_locations/map")
    _, suffix = FILES[locale]
    for node in locations:
        official_id = node.findtext("mapID", "").strip()
        code = node.findtext("map_type", "").strip()
        district = node.findtext("districtID", "").strip()
        if not re.fullmatch(r"[0-9]+", official_id) or official_id in seen:
            raise ValueError(f"Invalid or duplicate {locale} mapID: {official_id!r}")
        if code not in types or district not in districts:
            raise ValueError(f"{locale} mapID {official_id} uses an undefined type or district")
        seen.add(official_id)
        counts[code] += 1
        coordinate_text = cleaned(node.findtext("map_coordinate"))
        point = coordinate(coordinate_text)
        if not point:
            rejected["allMissingCoordinate" if not coordinate_text else "allInvalidCoordinate"] += 1
        if code not in TYPES:
            continue
        if not point:
            rejected["toiletsMissingCoordinate" if not coordinate_text else "toiletsInvalidCoordinate"] += 1
            continue
        name = cleaned(node.findtext(f"name_{suffix}"))
        if not name:
            rejected["toiletsMissingName"] += 1
            continue
        updated = datetime.strptime(node.findtext("updateDate", ""), "%Y-%m-%d %H:%M:%S")
        if updated.date() > snapshot_date:
            raise ValueError(f"{locale} mapID {official_id} is newer than the XML generation date")
        toilets[official_id] = {
            "officialType": code,
            "districtCode": district,
            "name": name,
            "address": cleaned(node.findtext(f"address_{suffix}")),
            "openingHours": cleaned(node.findtext(f"openHr_{suffix}")),
            "remarks": cleaned(node.findtext(f"remarks_{suffix}")),
            "coordinate": point,
            "updatedAt": updated.replace(tzinfo=HONG_KONG).isoformat(),
        }

    if not locations or not toilets:
        raise ValueError(f"{locale} FEHD XML has no valid toilet records")

    names = defaultdict(set)
    for row in toilets.values():
        names[row["name"]].add(tuple(row["coordinate"].values()))
    notices = [row["remarks"] for row in toilets.values() if SERVICE_NOTICE.search(row["remarks"] or "")]
    return {
        "source": {
            "url": URLS[locale],
            "snapshotDate": snapshot_date.isoformat(),
            "fetchedAt": fetched_at.isoformat(timespec="seconds"),
            "sha256": hashlib.sha256(payload).hexdigest(),
        },
        "audit": {
            "rawCount": len(locations),
            "typeCounts": {key: {"name": types[key], "count": count} for key, count in counts.items()},
            "outOfScope": sum(count for key, count in counts.items() if key not in TYPES),
            "toiletCandidates": sum(counts[key] for key in TYPES),
            "validToilets": len(toilets),
            "missingCoordinates": rejected["allMissingCoordinate"],
            "invalidCoordinates": rejected["allInvalidCoordinate"],
            "toiletsMissingCoordinates": rejected["toiletsMissingCoordinate"],
            "toiletsInvalidCoordinates": rejected["toiletsInvalidCoordinate"],
            "toiletsMissingNames": rejected["toiletsMissingName"],
            "duplicateIds": 0,
            "sameNameDifferentCoordinates": sum(len(points) > 1 for points in names.values()),
            "remarks": sum(bool(row["remarks"]) for row in toilets.values()),
            "serviceNotices": len(notices),
            "untilFurtherNotice": sum(bool(re.search(r"further notice|另行通知", s, re.I)) for s in notices),
        },
        "types": types,
        "districts": districts,
        "records": toilets,
    }


def revised_snapshot(feeds):
    primary = max(feeds, key=lambda loc: (feeds[loc]["source"]["snapshotDate"], loc == "en"))
    other = next(loc for loc in feeds if loc != primary)
    base, alternate = feeds[primary]["records"], feeds[other]["records"]
    shared = base.keys() & alternate.keys()
    if len(shared) < max(len(base), len(alternate)) * 0.9:
        raise ValueError("Bilingual FEHD IDs no longer match closely enough to update automatically")

    paired = 0
    location_conflicts = 0
    type_labels = {key: {loc: feed["types"][key] for loc, feed in feeds.items()} for key in sorted(TYPES)}
    records = []
    for official_id, row in sorted(base.items(), key=lambda kv: int(kv[0])):
        matched = {primary: row}
        peer = alternate.get(official_id)
        if peer:
            identity_ok = all(row[key] == peer[key] for key in ("officialType", "districtCode", "coordinate"))
            if not identity_ok:
                location_conflicts += 1
            elif row["updatedAt"] == peer["updatedAt"]:
                matched[other] = peer
                paired += 1
        record = {
            "officialId": official_id,
            "officialType": row["officialType"],
            "coordinate": row["coordinate"],
            "updatedAt": row["updatedAt"],
        }
        for key in ("name", "address", "openingHours", "remarks"):
            translations = {loc: entry[key] for loc, entry in matched.items() if entry[key]}
            if translations:
                record[key] = translations
        record["district"] = {
            loc: feed["districts"][row["districtCode"]]
            for loc, feed in feeds.items() if row["districtCode"] in feed["districts"]
        }
        # Prefer the primary notice if the other language lacks the warning at the same revision.
        notes = record.get("remarks", {})
        if any(SERVICE_NOTICE.search(text) for text in notes.values()):
            record["serviceNotice"] = True
            record["remarks"] = {loc: text for loc, text in notes.items() if SERVICE_NOTICE.search(text)}
        records.append(record)

    checksum = hashlib.sha256(
        json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    snapshot_date = feeds[primary]["source"]["snapshotDate"]
    return {
        "schemaVersion": 1,
        "version": f"fehd-toilets-{snapshot_date}-{checksum[:12]}",
        "snapshotDate": snapshot_date,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "primaryLocale": primary,
        "sourceName": {"zh-HK": "食物環境衞生署", "en": "Food and Environmental Hygiene Department"},
        "sources": {loc: feed["source"] for loc, feed in feeds.items()},
        "recordCount": len(records),
        "recordsSha256": checksum,
        "audit": {
            "feeds": {loc: feed["audit"] for loc, feed in feeds.items()},
            "sharedToiletIds": len(shared),
            "paired": paired,
            "primaryLanguageOnly": len(records) - paired,
            "primaryOnlyIds": len(base.keys() - alternate.keys()),
            "olderOnlyIdsExcluded": len(alternate.keys() - base.keys()),
            "locationOrTypeConflicts": location_conflicts,
        },
        "typeLabels": type_labels,
        "records": records,
    }


def save_snapshot(output, snapshot):
    if output.exists():
        previous = json.loads(output.read_text(encoding="utf-8"))
        if any(snapshot["sources"][loc]["snapshotDate"] < previous["sources"][loc]["snapshotDate"] for loc in URLS):
            raise ValueError("FEHD snapshot is older than the existing import")
        if snapshot["recordCount"] < previous["recordCount"] * 0.9:
            raise ValueError("FEHD catalogue fell by more than 10%; review the source before replacing it")
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
    parser.add_argument("--input-dir", type=Path, help="Use previously downloaded official tc.xml and en.xml")
    parser.add_argument("--fetched-at", type=datetime.fromisoformat, help="Recorded acquisition time for --input-dir")
    parser.add_argument("--audit-only", action="store_true", help="Audit without writing the offline index")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if bool(args.input_dir) != bool(args.fetched_at) or (args.fetched_at and args.fetched_at.tzinfo is None):
        parser.error("--input-dir requires --fetched-at with an explicit timezone")
    feeds = {}
    for locale, url in URLS.items():
        if args.input_dir:
            data = (args.input_dir / FILES[locale][0]).read_bytes()
            fetched_at = args.fetched_at
        else:
            with urlopen(url, timeout=30) as response:
                data = response.read()
            fetched_at = datetime.now(timezone.utc)
        feeds[locale] = parse_feed(locale, data, fetched_at)
    snapshot = revised_snapshot(feeds)
    print(json.dumps({key: value for key, value in snapshot.items() if key != "records"}, ensure_ascii=False, indent=2))
    if not args.audit_only:
        save_snapshot(args.output, snapshot)


if __name__ == "__main__":
    main()

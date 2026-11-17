#!/usr/bin/env python3
"""Build the reviewed LCSD IPPET subset from CSDI GeoJSON and its WGS84 REST export."""

import argparse
from collections import defaultdict
from datetime import date, datetime, timezone
from hashlib import sha256
from html import unescape
import json
from math import hypot, isfinite
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
import unicodedata
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / "assets/data"
SOURCE = "lcsd-inclusive-pet-parks"
LAYER = "IPPET"
IDENTITY_FIELDS = ("name", "district", "address")
SCOPES = {"venue", "designated", "exclusions", "unknown"}


def fingerprint(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def plain_text(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValueError("Expected text in IPPET")
    lines = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    text = unescape(re.sub(r"<[^>]+>", "", lines))
    text = "\n".join(" ".join(line.split()) for line in text.splitlines() if line.strip())
    return "" if text.casefold() in {"n.a.", "n/a", "na", "不適用"} else text


def bilingual(fields, prefix):
    return {locale: text for locale, suffix in (("zh-HK", "TC"), ("en", "EN"))
            if (text := plain_text(fields[prefix + suffix]))}


def coordinate(lon, lat):
    if (any(type(value) not in (int, float) or not isfinite(value) for value in (lon, lat))
            or not (113.82 <= lon <= 114.46 and 22.12 <= lat <= 22.59)):
        raise ValueError("Invalid IPPET Hong Kong WGS84 point")
    return {"longitude": lon, "latitude": lat}


def distance(left, right):
    # Local approximation solely for metre-scale identity and export comparisons in Hong Kong.
    return hypot((left["longitude"] - right["longitude"]) * 103_000,
                 (left["latitude"] - right["latitude"]) * 111_000)


def parse_rows(collection):
    if collection["type"] != "FeatureCollection" or collection["name"] != LAYER:
        raise ValueError("Unexpected IPPET layer")
    crs = collection.get("crs")
    if crs and crs["properties"]["name"] not in {"EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"}:
        raise ValueError("Unexpected IPPET GeoJSON CRS")
    rows = {}
    for feature in collection["features"]:
        fields, point = feature["properties"], feature["geometry"]
        object_id = fields["OBJECTID"]
        if (feature["type"] != "Feature" or point["type"] != "Point"
                or type(object_id) is not int or object_id <= 0 or object_id in rows):
            raise ValueError(f"Invalid or duplicate IPPET feature {object_id}")
        kinds = bilingual(fields, "FacilityType")
        if ("寵物共享公園" not in re.split(r"\s*[,，]\s*", kinds.get("zh-HK", ""))
                or "INCLUSIVE PARK FOR PETS" not in re.split(r"\s*,\s*", kinds.get("en", ""))):
            raise ValueError(f"Unexpected official classification for IPPET/{object_id}")
        row = {key: bilingual(fields, key.title()) for key in IDENTITY_FIELDS}
        if any(len(value) != 2 for value in row.values()):
            raise ValueError(f"Missing bilingual identity for IPPET/{object_id}")
        row.update(coordinate=coordinate(*point["coordinates"]), upstreamTypeName=kinds,
                   updatedAt=datetime.strptime(fields["LASTUPDATE"], "%Y%m%d%H%M%S").isoformat())
        for key, prefix in (("openingHours", "OpeningHours"), ("details", "FacilityDetails"), ("phone", "Telephone")):
            if value := bilingual(fields, prefix):
                row[key] = value
        rows[object_id] = row
    return rows


def identity(row):
    return tuple(" ".join(unicodedata.normalize("NFKC", row[key][locale]).casefold().split())
                 for key in IDENTITY_FIELDS for locale in ("zh-HK", "en"))


def match_rows(rows, anchors):
    by_identity = defaultdict(list)
    for object_id, row in rows.items():
        by_identity[identity(row)].append((object_id, row))
    for anchor in anchors:
        approved = anchor["coordinate"]
        point = coordinate(approved["longitude"], approved["latitude"])
        yield anchor, [(oid, row) for oid, row in by_identity[identity(anchor)] if distance(row["coordinate"], point) <= 1]


def update_diff(rows, anchors):
    report = {"missingOrMoved": [], "identityConflict": [], "renumbered": [], "changedFields": [], "outsidePublishedSubset": []}
    claimed = set()
    for anchor, matches in match_rows(rows, anchors):
        if not matches:
            report["missingOrMoved"].append(anchor["id"])
        elif len(matches) > 1 or matches[0][0] in claimed:
            report["identityConflict"].append(anchor["id"])
        else:
            object_id, row = matches[0]
            claimed.add(object_id)
            if object_id != anchor["upstreamRecords"][0]["objectId"]:
                report["renumbered"].append({"id": anchor["id"], "objectId": object_id})
            if fingerprint(row) != anchor["reviewedFieldsSha256"]:
                report["changedFields"].append(anchor["id"])
    report["outsidePublishedSubset"] = sorted(rows.keys() - claimed)
    return report


def check_rest(rest, rows):
    if (rest["spatialReference"]["wkid"] != 4326 or rest["geometryType"] != "esriGeometryPoint"
            or rest.get("exceededTransferLimit") or len(rest["features"]) != len(rows)):
        raise ValueError("Invalid or truncated IPPET WGS84 response")
    references = {item["attributes"]["OBJECTID"]: item for item in rest["features"]}
    if references.keys() != rows.keys():
        raise ValueError("IPPET GeoJSON and REST object IDs differ")
    for object_id, row in rows.items():
        ref = references[object_id]
        if (distance(row["coordinate"], coordinate(ref["geometry"]["x"], ref["geometry"]["y"])) > 0.1
                or bilingual(ref["attributes"], "Name") != row["name"]):
            raise ValueError(f"IPPET/{object_id} differs from the official WGS84 reference")


def build_index(geojson, rest_json, registry, fetched_at):
    if (registry["schemaVersion"], registry["source"], registry["layer"]) != (1, SOURCE, LAYER):
        raise ValueError("Invalid IPPET registry")
    reviewed = registry["reviewedSnapshot"]
    snapshot = date.fromisoformat(reviewed["snapshotDate"])
    revision = date.fromisoformat(reviewed["revisionDate"])
    if not revision <= snapshot <= fetched_at.date():
        raise ValueError("Invalid IPPET snapshot or acquisition date")
    rows = parse_rows(json.loads(geojson))
    digest = sha256(geojson).hexdigest()
    if digest != reviewed["sha256"]:
        report = update_diff(rows, registry["records"])
        raise ValueError(f"IPPET SHA-256 changed ({digest}); review before importing.\n{json.dumps(report, indent=2)}")
    if len(rows) != reviewed["rawCount"]:
        raise ValueError("IPPET download count differs from review")
    check_rest(json.loads(rest_json), rows)

    ids, claimed, records = set(), set(), []
    evidence = registry["sourceEvidence"]
    acquired = fetched_at.isoformat(timespec="seconds")
    for anchor, matches in match_rows(rows, registry["records"]):
        stable_id, scope = anchor["id"], anchor["scope"]
        if (not re.fullmatch(r"inclusive-pet-[0-9]{3,}", stable_id) or stable_id in ids or len(matches) != 1
                or matches[0][0] in claimed or fingerprint(matches[0][1]) != anchor["reviewedFieldsSha256"]):
            raise ValueError(f"Missing, changed or conflicting identity for {stable_id}")
        if (scope not in SCOPES - {"unknown"} or not anchor["scopeEvidence"]
                or any(not anchor["scopeText"].get(lang) for lang in ("zh-HK", "en"))):
            raise ValueError(f"Unverified pet access scope for {stable_id}")
        object_id, row = matches[0]
        current = {"snapshotDate": snapshot.isoformat(), "objectId": object_id}
        if anchor["upstreamRecords"][0] != current:
            raise ValueError(f"Registry does not cite the reviewed IPPET row for {stable_id}")
        ids.add(stable_id)
        claimed.add(object_id)
        record = {**row, "officialId": stable_id, "officialType": "inclusive_pet_park",
                  "sourceUrl": evidence["datasetUrl"], "snapshotDate": snapshot.isoformat(), "fetchedAt": acquired,
                  "upstreamObjectId": object_id, "listingEvidence": anchor["listingEvidence"],
                  "petAccess": {"scope": scope, "scopeText": anchor["scopeText"], "scopeEvidence": anchor["scopeEvidence"],
                                "rulesUrl": evidence["rulesUrls"], "leashRequired": True}}
        if aliases := anchor.get("aliases"):
            record["aliases"] = aliases
        # The reviewed notice is part of the upstream details field for this venue.
        if anchor.get("noticeInDetails"):
            record["details"], record["remarks"] = {}, {}
            for locale in ("zh-HK", "en"):
                text = row.get("details", {}).get(locale, "")
                details, separator, notice = text.partition("\n")
                if not (details and separator and notice):
                    raise ValueError(f"Reviewed notice is missing for {stable_id}")
                record["details"][locale] = details
                record["remarks"][locale] = notice
            record["serviceNotice"] = True
        records.append(record)
    held = set(reviewed["heldObjectIds"])
    if claimed & held or claimed | held != rows.keys() or len(records) != reviewed["approvedCount"]:
        raise ValueError("Published and held IPPET records do not match the reviewed snapshot")

    records.sort(key=lambda record: record["officialId"])
    content_sha = fingerprint([{key: value for key, value in row.items() if key != "fetchedAt"} for row in records])
    return {
        "schemaVersion": 1, "version": f"{SOURCE}-{snapshot}-{content_sha[:12]}",
        "snapshotDate": snapshot.isoformat(), "revisionDate": revision.isoformat(), "sourceName": registry["sourceName"],
        "source": {
            "url": evidence["datasetUrl"], "downloadUrl": evidence["downloadUrl"], "metadataUrl": evidence["metadataUrl"],
            "coordinateCheckUrl": evidence["coordinateCheckUrl"], "layer": LAYER, "coordinateSystem": "WGS84",
            "coordinateRole": "venue_reference", "fetchedAt": acquired, "sha256": digest,
            "termsUrl": evidence["termsUrl"], "attribution": registry["attribution"], "listingUrls": evidence["listingUrls"],
            "rulesUrls": evidence["rulesUrls"], "rules": ["leashDogs", "keepPetsUnderControl", "cleanUp", "avoidNuisance"],
            "annexUrl": evidence["annexUrl"],
        },
        "recordCount": len(records), "recordsSha256": content_sha, "records": records,
    }


def save_index(path, index):
    if path.exists():
        previous = json.loads(path.read_bytes())
        before = {row["officialId"]: row for row in previous["records"]}
        after = {row["officialId"]: row for row in index["records"]}
        if (index["snapshotDate"] < previous["snapshotDate"] or not before.keys() <= after.keys()
                or any(identity(row) != identity(after[key]) or distance(row["coordinate"], after[key]["coordinate"]) > 1
                       for key, row in before.items())):
            raise ValueError("IPPET update would replace or remove a published identity")
    temp = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temp = Path(stream.name)
            header = {key: value for key, value in index.items() if key != "records"}
            stream.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "records": [\n')
            stream.write(",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in index["records"]))
            stream.write("\n  ]\n}\n")
        temp.chmod(0o644)
        os.replace(temp, path)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def download(url):
    with urlopen(url, timeout=30) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="Read inclusive.json and inclusive-rest4326.json")
    parser.add_argument("--fetched-at", type=datetime.fromisoformat, help="Acquisition time for local files, with timezone")
    parser.add_argument("--output", type=Path, default=DATA / f"{SOURCE}.json")
    parser.add_argument("--audit-only", action="store_true", help="Validate without changing an index")
    args = parser.parse_args()
    if bool(args.input_dir) != bool(args.fetched_at) or (args.fetched_at and args.fetched_at.tzinfo is None):
        parser.error("--input-dir requires --fetched-at with an explicit timezone")
    registry = json.loads((DATA / "lcsd-inclusive-pet-park-identity-registry.json").read_bytes())
    evidence = registry["sourceEvidence"]
    if args.input_dir:
        geojson = (args.input_dir / "inclusive.json").read_bytes()
        rest = (args.input_dir / "inclusive-rest4326.json").read_bytes()
        fetched_at = args.fetched_at
    else:
        geojson = download(evidence["downloadUrl"])
        fetched_at = datetime.now(timezone.utc)
        rest = download(evidence["coordinateCheckUrl"])
    index = build_index(geojson, rest, registry, fetched_at)
    if not args.audit_only:
        save_index(args.output, index)
    print(f'{index["version"]}: {index["recordCount"]} verified records')


if __name__ == "__main__":
    main()

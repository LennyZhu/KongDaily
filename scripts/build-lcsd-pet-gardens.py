#!/usr/bin/env python3
"""Build the approved PETG subset. An upstream change requires a new registry review."""

import argparse
from collections import defaultdict
from datetime import date, datetime, timezone
from hashlib import sha256
from html import unescape
import json
from math import asin, cos, isfinite, radians, sin, sqrt
import os
from pathlib import Path
import re
import tempfile
import unicodedata
from urllib.request import urlopen

DATA = Path(__file__).resolve().parents[1] / "assets/data"
SOURCE = "lcsd-pet-gardens"
LAYER = "PETG"
DATASET = "lcsd_rcd_1670384486075_71092"
PORTAL = "https://portal.csdi.gov.hk"
DATASET_URL = f"{PORTAL}/csdi-webpage/dataset/{DATASET}"
METADATA_URL = f"{PORTAL}/csdi-webpage/metadata/{DATASET}/html"
DOWNLOAD_URL = f"{PORTAL}/csdi-webpage/file-api?dataset_id={DATASET}&format=geojson&layer_name={LAYER}"
POINTS_URL = (
    f"{PORTAL}/server/rest/services/common/{DATASET}/FeatureServer/0/query"
    "?where=1%3D1&outFields=OBJECTID%2CNameTC%2CNameEN&outSR=4326&orderByFields=OBJECTID&f=json"
)
TERMS_URL = f"{PORTAL}/csdi-webpage/doc/TNC"
LOCALES = (("zh-HK", "TC"), ("en", "EN"))
FIELDS = (("name", "Name"), ("district", "District"), ("address", "Address"))


def checksum(value):
    return sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def bilingual(fields, prefix):
    copy = {}
    for locale, suffix in LOCALES:
        value = fields[prefix + suffix]
        if value is None:
            continue
        if not isinstance(value, str):
            raise ValueError(f"Invalid PETG field {prefix + suffix}")
        plain = unescape(re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE))
        plain = "\n".join(" ".join(line.split()) for line in plain.splitlines() if line.strip())
        if plain.strip().casefold() not in {"", "n.a.", "n/a", "na", "不適用"}:
            copy[locale] = plain
    return copy


def point(longitude, latitude):
    if (any(type(n) not in (int, float) or not isfinite(n) for n in (longitude, latitude))
            or not (113.82 <= longitude <= 114.46 and 22.12 <= latitude <= 22.59)):
        raise ValueError("Invalid PETG Hong Kong WGS84 coordinate")
    return {"longitude": longitude, "latitude": latitude}


def distance(left, right):
    lat1, lat2 = (radians(row["latitude"]) for row in (left, right))
    delta = radians(left["longitude"] - right["longitude"])
    return 12_742_017.6 * asin(sqrt(sin((lat1 - lat2) / 2) ** 2 + cos(lat1) * cos(lat2) * sin(delta / 2) ** 2))


def identity(row):
    return tuple(" ".join(unicodedata.normalize("NFKC", row[key][locale]).casefold().split())
                 for key, _ in FIELDS for locale, _ in LOCALES)


def parse_rows(collection):
    if collection["type"] != "FeatureCollection" or collection["name"] != LAYER:
        raise ValueError("Unexpected PETG layer")
    crs = collection.get("crs")
    if crs is not None and crs["properties"]["name"] not in {"EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"}:
        raise ValueError("Unexpected PETG CRS")
    records = {}
    for feature in collection["features"]:
        fields, geometry = feature["properties"], feature["geometry"]
        object_id = fields["OBJECTID"]
        if (feature["type"] != "Feature" or geometry["type"] != "Point" or type(object_id) is not int
                or object_id <= 0 or object_id in records):
            raise ValueError(f"Invalid or duplicate PETG feature {object_id}")
        official_type = bilingual(fields, "FacilityType")
        if (official_type.get("en") not in {"PET GARDEN", "DOG GARDENS/PET GARDENS"}
                or official_type.get("zh-HK") not in {"寵物公園", "狗公園/寵物公園"}):
            raise ValueError(f"Unexpected dedicated garden classification for PETG/{object_id}")
        row = {key: bilingual(fields, prefix) for key, prefix in FIELDS}
        if any(len(row[key]) != len(LOCALES) for key, _ in FIELDS):
            raise ValueError(f"Incomplete PETG/{object_id} identity")
        row.update({
            "upstreamObjectId": object_id,
            "officialType": official_type["en"],
            "upstreamTypeName": official_type,
            "coordinate": point(*geometry["coordinates"]),
            "updatedAt": datetime.strptime(fields["LASTUPDATE"], "%Y%m%d%H%M%S").isoformat(),
        })
        for key, prefix in (("openingHours", "OpeningHours"), ("details", "FacilityDetails"), ("phone", "Telephone")):
            value = bilingual(fields, prefix)
            if value:
                row[key] = value
        records[object_id] = row
    return records


def match_rows(rows, anchors):
    by_identity = defaultdict(list)
    for row in rows.values():
        by_identity[identity(row)].append(row)
    for anchor in anchors:
        approved = point(**anchor["coordinate"])
        # One metre absorbs export rounding; movement or ambiguous identities need manual review.
        yield anchor, [row for row in by_identity[identity(anchor)] if distance(row["coordinate"], approved) <= 1]


def difference(rows, registry):
    anchors = registry["records"]
    report = {"rawCount": {"reviewed": registry["reviewedSnapshot"]["rawCount"], "received": len(rows)},
              "missingOrMoved": [], "ambiguous": [], "renumbered": [], "changedPublishedFields": [],
              "unreviewed": []}
    claimed = set()
    for anchor, matches in match_rows(rows, anchors):
        if not matches:
            report["missingOrMoved"].append(anchor["id"])
            continue
        if len(matches) != 1 or matches[0]["upstreamObjectId"] in claimed:
            report["ambiguous"].append(anchor["id"])
            continue
        row = matches[0]
        object_id = row["upstreamObjectId"]
        claimed.add(object_id)
        if object_id != anchor["upstreamRecords"][0]["objectId"]:
            report["renumbered"].append({"id": anchor["id"], "objectId": object_id})
        if checksum({k: v for k, v in row.items() if k != "upstreamObjectId"}) != anchor["reviewedFieldsSha256"]:
            report["changedPublishedFields"].append(anchor["id"])
    report["unreviewed"] = [{"objectId": key, "name": row["name"]} for key, row in rows.items() if key not in claimed]
    return report


def build_snapshot(geojson, rest_json, registry, fetched_at):
    if registry["schemaVersion"] != 1 or registry["source"] != SOURCE or registry["layer"] != LAYER:
        raise ValueError("Unexpected dedicated garden registry")
    reviewed = registry["reviewedSnapshot"]
    snapshot = date.fromisoformat(reviewed["snapshotDate"])
    revision = date.fromisoformat(reviewed["revisionDate"])
    if not revision <= snapshot <= fetched_at.date():
        raise ValueError("Invalid dedicated garden acquisition or review dates")
    snapshot_date = snapshot.isoformat()
    acquired = fetched_at.isoformat(timespec="seconds")
    digest = sha256(geojson).hexdigest()
    rows = parse_rows(json.loads(geojson))
    if digest != reviewed["sha256"]:
        report = json.dumps(difference(rows, registry), ensure_ascii=False, indent=2)
        raise ValueError(f"PETG differs from reviewed {snapshot} (SHA-256 {digest}); review before importing.\n{report}")
    rest = json.loads(rest_json)
    if (rest["spatialReference"]["wkid"] != 4326 or rest["geometryType"] != "esriGeometryPoint"
            or rest.get("exceededTransferLimit") or len(rest["features"]) != reviewed["rawCount"]
            or len(rows) != reviewed["rawCount"]):
        raise ValueError("Invalid or truncated official PETG WGS84 response")
    references = {item["attributes"]["OBJECTID"]: item for item in rest["features"]}
    if references.keys() != rows.keys():
        raise ValueError("PETG GeoJSON and REST object IDs differ")
    for key, row in rows.items():
        ref = references[key]
        if (distance(row["coordinate"], point(ref["geometry"]["x"], ref["geometry"]["y"])) > 0.1
                or any(bilingual(ref["attributes"], "Name").get(locale) != row["name"][locale] for locale, _ in LOCALES)):
            raise ValueError(f"Official coordinates or name differ for PETG/{key}")

    records, ids, claimed = [], set(), set()
    for anchor, matches in match_rows(rows, registry["records"]):
        stable_id = anchor["id"]
        if (not re.fullmatch(r"pet-garden-[0-9]{3,}", stable_id) or stable_id in ids or len(matches) != 1
                or matches[0]["upstreamObjectId"] in claimed):
            raise ValueError(f"PETG identity conflict for {stable_id}; review moves, splits and transfers")
        row = matches[0]
        listing = anchor["listingEvidence"]
        ids.add(stable_id)
        claimed.add(row["upstreamObjectId"])
        record = {"officialId": stable_id, **row, "sourceUrl": DATASET_URL,
                  "snapshotDate": snapshot_date, "fetchedAt": acquired, "listingEvidence": listing,
                  "unverified": ["entranceCoordinates", "petAreaBoundary", "offLeashPermission", "liveStatus"]}
        if "remarks" in anchor:
            record["remarks"] = anchor["remarks"]
        records.append(record)
    exclusions = set(reviewed["excludedObjectIds"])
    if (len(records) != reviewed["approvedCount"] or claimed & exclusions or claimed | exclusions != rows.keys()):
        raise ValueError("PETG scope differs from the reviewed records and exclusions")
    records.sort(key=lambda row: row["officialId"])
    records_sha = checksum([{k: v for k, v in row.items() if k != "fetchedAt"} for row in records])
    return {
        "schemaVersion": 1, "version": f"{SOURCE}-{snapshot}-{records_sha[:12]}",
        "snapshotDate": snapshot_date, "revisionDate": revision.isoformat(), "sourceName": registry["sourceName"],
        "source": {
            "url": DATASET_URL, "metadataUrl": METADATA_URL, "downloadUrl": DOWNLOAD_URL, "coordinateCheckUrl": POINTS_URL,
            "layer": LAYER, "coordinateRole": "venue_reference", "coordinateSystem": "WGS84 (longitude, latitude)",
            "fetchedAt": acquired, "sha256": digest, "termsUrl": TERMS_URL,
            "attribution": registry["attribution"], "listingUrls": registry["listingUrls"],
        },
        "recordCount": len(records), "recordsSha256": records_sha,
        "audit": {"rawCount": len(rows), "bilingualListingCandidates": reviewed["bilingualListingCandidates"],
                  "excludedObjectIds": sorted(exclusions)},
        "records": records,
    }


def save_snapshot(path, snapshot):
    if path.exists():
        previous = json.loads(path.read_bytes())
        before = {row["officialId"]: row for row in previous["records"]}
        after = {row["officialId"]: row for row in snapshot["records"]}
        if (snapshot["snapshotDate"] < previous["snapshotDate"] or before.keys() != after.keys()
                or any(identity(row) != identity(before[key]) or distance(row["coordinate"], before[key]["coordinate"]) > 1
                       for key, row in after.items())):
            raise ValueError("PETG index would change a published identity or scope; review before replacing it")
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as file:
            temp = Path(file.name)
            header = {key: value for key, value in snapshot.items() if key != "records"}
            file.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "records": [\n')
            file.write(",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in snapshot["records"]))
            file.write("\n  ]\n}\n")
        temp.chmod(0o644)
        os.replace(temp, path)
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="Read preserved dog.json and dog-rest4326.json")
    parser.add_argument("--fetched-at", type=datetime.fromisoformat, help="Acquisition time for --input-dir, with timezone")
    parser.add_argument("--audit-only", action="store_true", help="Verify without writing the index")
    parser.add_argument("--output", type=Path, default=DATA / "lcsd-pet-gardens.json")
    args = parser.parse_args()
    if bool(args.input_dir) != bool(args.fetched_at) or (args.fetched_at and args.fetched_at.tzinfo is None):
        parser.error("--input-dir requires --fetched-at with an explicit timezone")

    def read(name, url):
        if args.input_dir:
            return (args.input_dir / name).read_bytes()
        with urlopen(url, timeout=30) as response:
            return response.read()

    geojson = read("dog.json", DOWNLOAD_URL)
    fetched_at = args.fetched_at or datetime.now(timezone.utc)
    registry = json.loads((DATA / "lcsd-pet-garden-identity-registry.json").read_bytes())
    snapshot = build_snapshot(geojson, read("dog-rest4326.json", POINTS_URL), registry, fetched_at)
    if not args.audit_only:
        save_snapshot(args.output, snapshot)
    print(f"{SOURCE}: verified {snapshot['recordCount']} of {snapshot['audit']['rawCount']} from {snapshot['snapshotDate']}")


if __name__ == "__main__":
    main()

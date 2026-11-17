#!/usr/bin/env python3
"""Verify the reviewed LCSD PARKS snapshot and build its offline index."""

import argparse
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
SOURCE = "lcsd-parks"
LAYER = "PARKS"
DATASET = "lcsd_rcd_1629267205215_19292"
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
IDENTITY_FIELDS = ("name", "district", "address")
# Allow conversion rounding only. A moved venue or an ambiguous match requires review.
IDENTITY_TOLERANCE_METRES = 1


def bilingual(properties, prefix, required=False):
    result = {}
    for locale, suffix in LOCALES:
        field = prefix + suffix
        value = properties[field]
        if value is not None and not isinstance(value, str):
            raise ValueError(f"Invalid LCSD {field}")
        if value:
            plain = unescape(re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE))
            plain = "\n".join(" ".join(line.split()) for line in plain.splitlines() if line.strip())
            if plain.casefold() not in {"", "n.a.", "n/a", "na", "不適用"}:
                result[locale] = plain
        if required and locale not in result:
            raise ValueError(f"Missing LCSD {field}")
    return result


def checked_point(longitude, latitude):
    if (type(longitude) not in (int, float) or type(latitude) not in (int, float)
            or not (isfinite(longitude) and isfinite(latitude))
            or not (113.82 <= longitude <= 114.46 and 22.12 <= latitude <= 22.59)):
        raise ValueError(f"Invalid Hong Kong WGS84 point ({longitude}, {latitude})")
    return {"latitude": latitude, "longitude": longitude}


def distance(a, b):
    lat1, lat2 = radians(a["latitude"]), radians(b["latitude"])
    lon_delta = radians(a["longitude"] - b["longitude"])
    return 12_742_017.6 * asin(sqrt(sin((lat1 - lat2) / 2) ** 2 + cos(lat1) * cos(lat2) * sin(lon_delta / 2) ** 2))


def identity_key(row):
    return tuple(
        " ".join(unicodedata.normalize("NFKC", row[field][locale]).casefold().split())
        for field in IDENTITY_FIELDS for locale, _ in LOCALES
    )


def match_registry(parks, registry):
    by_identity = {}
    for park in parks:
        by_identity.setdefault(identity_key(park), []).append(park)
    records, claimed = [], set()
    stable_ids = set()
    for anchor in registry:
        stable_id = anchor["id"]
        if not re.fullmatch(r"park-[0-9]{3,}", stable_id) or stable_id in stable_ids:
            raise ValueError(f"Conflicting LCSD registry ID {stable_id!r}")
        stable_ids.add(stable_id)
        coordinate = checked_point(**anchor["coordinate"])
        matches = [
            park for park in by_identity.get(identity_key(anchor), ())
            if distance(park["coordinate"], coordinate) <= IDENTITY_TOLERANCE_METRES
        ]
        if len(matches) != 1 or matches[0]["upstreamObjectId"] in claimed:
            raise ValueError(f"LCSD identity conflict for {stable_id} ({anchor['name']['zh-HK']}); review moves, splits or ambiguous matches")
        park = matches[0]
        claimed.add(park["upstreamObjectId"])
        records.append({"officialId": stable_id, **park})
    if len(claimed) != len(parks):
        raise ValueError("LCSD park scope differs from the reviewed registry")
    return sorted(records, key=lambda row: row["officialId"])


def build_snapshot(geojson, rest_json, registry, fetched_at):
    if registry["schemaVersion"] != 1 or registry["source"] != SOURCE or registry["layer"] != LAYER:
        raise ValueError("Unexpected LCSD identity registry")
    reviewed = registry["reviewedSnapshot"]
    snapshot_date = date.fromisoformat(reviewed["snapshotDate"])
    revision_date = date.fromisoformat(reviewed["revisionDate"])
    if not revision_date <= snapshot_date <= fetched_at.date():
        raise ValueError("Invalid LCSD acquisition or review dates")
    digest = sha256(geojson).hexdigest()
    if digest != reviewed["sha256"]:
        raise ValueError(f"LCSD download differs from reviewed {snapshot_date}: SHA-256 {digest}. Review scope before replacing the index")

    collection, rest = json.loads(geojson), json.loads(rest_json)
    features = collection["features"]
    raw_count = reviewed["rawCount"]
    crs = collection.get("crs")
    if (collection["type"] != "FeatureCollection" or collection["name"] != LAYER
            or not isinstance(features, list) or not features or len(features) != raw_count
            or (crs is not None and crs["properties"]["name"] not in ("EPSG:4326", "urn:ogc:def:crs:OGC:1.3:CRS84"))):
        raise ValueError("Invalid or incomplete LCSD PARKS GeoJSON")
    if (rest["spatialReference"]["wkid"] != 4326 or rest["geometryType"] != "esriGeometryPoint"
            or rest.get("exceededTransferLimit") or len(rest["features"]) != raw_count):
        raise ValueError("Invalid or incomplete official LCSD WGS84 cross-check")
    official_points = {row["attributes"]["OBJECTID"]: row for row in rest["features"]}

    parks, seen_ids = [], set()
    excluded_zoo = 0
    for feature in features:
        fields, geometry = feature["properties"], feature["geometry"]
        object_id = fields["OBJECTID"]
        if (feature["type"] != "Feature" or geometry["type"] != "Point"
                or type(object_id) is not int or object_id <= 0 or object_id in seen_ids):
            raise ValueError(f"Invalid LCSD feature or duplicate OBJECTID {object_id!r}")
        seen_ids.add(object_id)
        coordinate = checked_point(*geometry["coordinates"])
        official = official_points[object_id]
        official_point = checked_point(official["geometry"]["x"], official["geometry"]["y"])
        if (distance(coordinate, official_point) > 0.1
                or any(official["attributes"]["Name" + suffix] != fields["Name" + suffix] for _, suffix in LOCALES)):
            raise ValueError(f"Official CRS or identity mismatch for PARKS/{object_id}")
        category = bilingual(fields, "FacilityType", required=True)
        is_park_tc = "公園" in re.split(r"\s*[,，]\s*", category["zh-HK"])
        is_park_en = "PARK" in re.split(r"\s*[,，]\s*", category["en"])
        if is_park_tc != is_park_en:
            raise ValueError(f"Conflicting LCSD classification for PARKS/{object_id}")
        if not is_park_tc:
            continue
        name = bilingual(fields, "Name", required=True)
        if name == {"zh-HK": "香港動植物公園", "en": "Hong Kong Zoological & Botanical Gardens"}:
            excluded_zoo += 1
            continue
        changed_at = datetime.strptime(fields["LASTUPDATE"], "%Y%m%d%H%M%S")
        park = {
            "upstreamObjectId": object_id,
            "name": name,
            "district": bilingual(fields, "District", required=True),
            "address": bilingual(fields, "Address", required=True),
            "coordinate": coordinate,
            "updatedAt": changed_at.isoformat(),
        }
        for key, prefix in (("openingHours", "OpeningHours"), ("details", "FacilityDetails")):
            value = bilingual(fields, prefix)
            if value:
                park[key] = value
        parks.append(park)
    if len(parks) != reviewed["parkCount"] or excluded_zoo != 1:
        raise ValueError("LCSD classification no longer matches the reviewed park scope")
    records = match_registry(parks, registry["records"])
    checksum = sha256(json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return {
        "schemaVersion": 1,
        "version": f"{SOURCE}-{snapshot_date}-{checksum[:12]}",
        "snapshotDate": snapshot_date.isoformat(),
        "revisionDate": revision_date.isoformat(),
        "sourceName": {"zh-HK": "康樂及文化事務署", "en": "Leisure and Cultural Services Department"},
        "source": {
            "url": DATASET_URL, "downloadUrl": DOWNLOAD_URL, "metadataUrl": METADATA_URL, "coordinateCheckUrl": POINTS_URL,
            "layer": LAYER, "coordinateSystem": "WGS84 (longitude, latitude)", "coordinateRole": "venue_reference",
            "fetchedAt": fetched_at.isoformat(timespec="seconds"), "sha256": digest, "termsUrl": TERMS_URL,
            "attribution": {
                "zh-HK": "資料來源：香港特別行政區政府、康樂及文化事務署及空間數據共享平台（CSDI Portal）。資料知識產權由政府及相關機構擁有。",
                "en": "Source: Hong Kong SAR Government, Leisure and Cultural Services Department and CSDI Portal. The Government and relevant organisations own the intellectual property rights in the data.",
            },
        },
        "recordCount": len(records),
        "recordsSha256": checksum,
        "audit": {"rawCount": raw_count, "parkTypeCount": len(records) + excluded_zoo, "zooExcluded": excluded_zoo},
        "records": records,
    }


def save_snapshot(path, snapshot):
    if path.exists():
        old = json.loads(path.read_bytes())
        if snapshot["snapshotDate"] < old["snapshotDate"]:
            raise ValueError("LCSD snapshot predates the existing index")
        previous = {park["officialId"]: park for park in old["records"]}
        current = {park["officialId"]: park for park in snapshot["records"]}
        if current.keys() != previous.keys() or any(
            identity_key(park) != identity_key(previous[key])
            or distance(park["coordinate"], previous[key]["coordinate"]) > IDENTITY_TOLERANCE_METRES
            for key, park in current.items()
        ):
            raise ValueError("LCSD registry would reassign existing IDs; review before replacing the index")
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as file:
            temporary = Path(file.name)
            header = {key: value for key, value in snapshot.items() if key != "records"}
            file.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "records": [\n')
            file.write(",\n".join("    " + json.dumps(row, ensure_ascii=False) for row in snapshot["records"]))
            file.write("\n  ]\n}\n")
        temporary.chmod(0o644)
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, help="Use captured parks.geojson and parks-rest4326.json")
    parser.add_argument("--fetched-at", type=datetime.fromisoformat, help="Acquisition time for --input-dir, with timezone")
    parser.add_argument("--audit-only", action="store_true", help="Verify without updating the index")
    parser.add_argument("--output", type=Path, default=DATA / "lcsd-parks.json")
    args = parser.parse_args()
    if bool(args.input_dir) != bool(args.fetched_at) or (args.fetched_at and args.fetched_at.tzinfo is None):
        parser.error("--input-dir requires --fetched-at with an explicit timezone")

    def read(name, url):
        if args.input_dir:
            return (args.input_dir / name).read_bytes()
        with urlopen(url, timeout=30) as response:
            return response.read()

    geojson = read("parks.geojson", DOWNLOAD_URL)
    fetched_at = args.fetched_at or datetime.now(timezone.utc)
    points = read("parks-rest4326.json", POINTS_URL)
    registry = json.loads((DATA / "lcsd-park-identity-registry.json").read_bytes())
    snapshot = build_snapshot(geojson, points, registry, fetched_at)
    if not args.audit_only:
        save_snapshot(args.output, snapshot)
    print(f"{SOURCE}: verified {snapshot['recordCount']} of {snapshot['audit']['rawCount']} records from {snapshot['snapshotDate']}")


if __name__ == "__main__":
    main()

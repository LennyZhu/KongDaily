#!/usr/bin/env python3
"""Review a staged FEHD/AFCD index against the published favorite identities."""

import argparse
from datetime import date
from hashlib import sha256
import json
from math import isfinite
import os
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from urllib.parse import urlparse

DATA = Path(__file__).resolve().parents[1] / "assets/data"
ID_FIELDS = {"fehd": "mapID", "afcd": "FAC_ID"}
TEXT_FIELDS = ("name", "district", "area", "address")
ANCHOR_FIELDS = (*TEXT_FIELDS, "officialType", "coordinate", "serviceNotice")


def text(value):
    return isinstance(value, str) and bool(value.strip()) and value == value.strip()


def official_url(value):
    if not text(value):
        return False
    url = urlparse(value)
    host = url.hostname or ""
    return url.scheme == "https" and (host == "gov.hk" or host.endswith(".gov.hk"))


def valid_anchor(row, source):
    point = row["coordinate"]
    lon, lat = point["longitude"], point["latitude"]
    if (any(type(v) not in (int, float) or not isfinite(v) for v in (lon, lat))
            or not (113.82 <= lon <= 114.46 and 22.12 <= lat <= 22.59)):
        raise ValueError("Invalid Hong Kong WGS84 coordinate")
    for key in TEXT_FIELDS:
        if key in row and (not isinstance(row[key], dict) or not row[key]
                           or any(lang not in ("zh-HK", "en") or not text(value) for lang, value in row[key].items())):
            raise ValueError(f"Invalid official {key}")
    required = ("name", "district", "address") if source == "fehd" else ("name", "area")
    if any(key not in row for key in required) or not text(row["officialType"]):
        raise ValueError("Incomplete identity anchor")
    if "serviceNotice" in row and type(row["serviceNotice"]) is not bool:
        raise ValueError("Invalid service notice flag")
    return {key: row[key] for key in ANCHOR_FIELDS if key in row}


def read_index(path, source):
    raw = path.read_bytes()
    index = json.loads(raw)
    version, snapshot_date = index["version"], index["snapshotDate"]
    date.fromisoformat(snapshot_date)
    rows = index["records"]
    if (index["schemaVersion"] != 1 or not text(version) or not version.startswith(f"{source}-toilets-")
            or not rows or len(rows) != index["recordCount"]):
        raise ValueError("Invalid or truncated toilet index")
    anchors = {}
    for row in rows:
        official_id = row["officialId"]
        if not text(official_id) or official_id in anchors:
            raise ValueError(f"Invalid or duplicate {ID_FIELDS[source]} {official_id!r}")
        try:
            anchors[official_id] = valid_anchor(row, source)
        except ValueError as error:
            raise ValueError(f"{ID_FIELDS[source]} {official_id}: {error}") from error
    content = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    if sha256(content).hexdigest() != index["recordsSha256"]:
        raise ValueError("Candidate index records SHA-256 does not match")
    provenance = index["sources"] if source == "fehd" else {"dataset": index["source"]}
    if not provenance or any(not official_url(item["url"]) for item in provenance.values()):
        raise ValueError("Invalid official index provenance")
    snapshot = {"version": version, "date": snapshot_date, "indexSha256": sha256(raw).hexdigest(),
                "officialSources": provenance}
    return anchors, snapshot


def initial_registry(source, anchors, snapshot):
    return {
        "schemaVersion": 1, "source": source, "officialIdField": ID_FIELDS[source],
        "snapshot": snapshot,
        "records": [
            {"stableFacilityId": f"{source}-toilet-{number:04d}", "officialRecordId": official_id,
             "anchor": anchors[official_id],
             "upstreamRecords": [{"officialRecordId": official_id, "snapshotVersion": snapshot["version"],
                                  "basis": "audited_snapshot"}]}
            for number, official_id in enumerate(sorted(anchors), 1)
        ],
    }


def review_index(source, registry, anchors, snapshot, review):
    if (registry["schemaVersion"], registry["source"], registry["officialIdField"]) != (1, source, ID_FIELDS[source]):
        raise ValueError("Registry source or schema mismatch")
    if snapshot["date"] < registry["snapshot"]["date"]:
        raise ValueError("Candidate index predates the accepted snapshot")
    previous = {}
    previous_active = set()
    for record in registry["records"]:
        stable, official_id = record["stableFacilityId"], record["officialRecordId"]
        if (not re.fullmatch(rf"{source}-toilet-[0-9]{{4,}}", stable) or stable in previous or not text(official_id)
                or (not record.get("retired") and official_id in previous_active)
                or record["upstreamRecords"][-1]["officialRecordId"] != official_id):
            raise ValueError(f"Conflicting identity in published registry: {stable}")
        valid_anchor(record["anchor"], source)
        previous[stable] = record
        if not record.get("retired"):
            previous_active.add(official_id)

    decisions, additions = {}, {}
    if review is not None:
        if review["indexSha256"] != snapshot["indexSha256"]:
            raise ValueError("Review belongs to a different candidate index")
        for decision in review["decisions"]:
            action = decision["action"]
            if action not in {"continue", "retire", "add"} or not text(decision["reason"]) or not official_url(decision["evidenceUrl"]):
                raise ValueError("Review requires an action, reason and official HTTPS evidence")
            if action == "add":
                record_id = decision["officialRecordId"]
                if record_id not in anchors or record_id in additions:
                    raise ValueError(f"Invalid or repeated addition: {record_id}")
                additions[record_id] = decision
            else:
                stable = decision["stableFacilityId"]
                if stable not in previous or stable in decisions:
                    raise ValueError(f"Unknown or repeated reviewed identity: {stable}")
                decisions[stable] = decision

    report = {"missing": [], "changed": [], "unreviewed": [], "duplicateClaims": []}
    records, claimed = [], set()

    def claim(official_id):
        if official_id in claimed:
            report["duplicateClaims"].append(official_id)
        claimed.add(official_id)

    def evidence(official_id, decision):
        return {"officialRecordId": official_id, "snapshotVersion": snapshot["version"],
                "basis": "manual_review", "action": decision["action"],
                "reason": decision["reason"], "evidenceUrl": decision["evidenceUrl"]}

    for stable, record in previous.items():
        old_id = record["officialRecordId"]
        decision = decisions.get(stable)
        if decision:
            retiring = decision["action"] == "retire"
            official_id = old_id if retiring else decision["officialRecordId"]
            if not retiring and official_id not in anchors:
                raise ValueError(f"Reviewed continuation has no official record: {stable}")
            updated = {**record, "officialRecordId": official_id, "retired": retiring,
                       "anchor": record["anchor"] if retiring else anchors[official_id],
                       "upstreamRecords": [*record["upstreamRecords"], evidence(official_id, decision)]}
            if not retiring:
                claim(official_id)
            records.append(updated)
            continue

        if not record.get("retired"):
            if old_id not in anchors:
                report["missing"].append({"stableFacilityId": stable, "officialRecordId": old_id})
            else:
                claim(old_id)
                change = [key for key in ANCHOR_FIELDS if record["anchor"].get(key) != anchors[old_id].get(key)]
                if change:
                    report["changed"].append({"stableFacilityId": stable, "officialRecordId": old_id, "fields": change})
        records.append(record)

    last_number = max((int(stable.rsplit("-", 1)[1]) for stable in previous), default=0)
    for number, official_id in enumerate(sorted(additions), last_number + 1):
        claim(official_id)
        records.append({"stableFacilityId": f"{source}-toilet-{number:04d}", "officialRecordId": official_id,
                        "anchor": anchors[official_id], "upstreamRecords": [evidence(official_id, additions[official_id])]})
    report["unreviewed"] = sorted(anchors.keys() - claimed)
    if any(report.values()):
        raise ValueError("Official identity changes require review.\n" + json.dumps(report, ensure_ascii=False, indent=2))
    return {**registry, "snapshot": snapshot, "records": records}


def write_registry(path, registry):
    header = {key: value for key, value in registry.items() if key != "records"}
    temporary = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(json.dumps(header, ensure_ascii=False, indent=2)[:-2] + ',\n  "records": [\n')
            stream.write(",\n".join("    " + json.dumps(record, ensure_ascii=False) for record in registry["records"]))
            stream.write("\n  ]\n}\n")
        temporary.chmod(0o644)
        os.replace(temporary, path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", choices=ID_FIELDS)
    parser.add_argument("--index", type=Path, help="Staged normalized index, defaults to the bundled index")
    parser.add_argument("--registry", type=Path, help="Published registry, defaults to the bundled registry")
    parser.add_argument("--review", type=Path, help="Explicit review manifest bound to the candidate index SHA-256")
    writes = parser.add_mutually_exclusive_group()
    writes.add_argument("--initialize", action="store_true", help="Create the first registry at a new path")
    writes.add_argument("--apply", action="store_true", help="Atomically replace the registry after full validation")
    args = parser.parse_args()
    source = args.source
    registry_path = args.registry or DATA / f"{source}-toilet-identity-registry.json"
    anchors, snapshot = read_index(args.index or DATA / f"{source}-toilets.json", source)
    if args.initialize:
        if registry_path.exists() or args.review:
            raise ValueError("Initialization requires a new registry path and no review manifest")
        result = initial_registry(source, anchors, snapshot)
    else:
        result = review_index(source, json.loads(registry_path.read_bytes()), anchors, snapshot,
                              json.loads(args.review.read_bytes()) if args.review else None)
    if args.initialize or args.apply:
        write_registry(registry_path, result)
    print(f"{source}: {len(anchors)} current records, {len(result['records'])} stable identities validated")


if __name__ == "__main__":
    try:
        main()
    except (KeyError, TypeError, ValueError, OSError) as error:
        raise SystemExit(str(error)) from None

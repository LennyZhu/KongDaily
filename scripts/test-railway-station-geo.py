#!/usr/bin/env python3
"""Offline generation, provenance and failure tests for the reviewed railway crosswalk."""
import copy
import gzip
from hashlib import sha256
import importlib.util
import json
from pathlib import Path
import unittest

SPEC = importlib.util.spec_from_file_location("railway_geo", Path(__file__).with_name("build-railway-station-geo.py"))
geo = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(geo)


class RailwayGeoBuildTests(unittest.TestCase):
    def setUp(self):
        self.raw = gzip.decompress(geo.SOURCE.read_bytes())
        self.review = json.loads(geo.REVIEW.read_bytes())
        self.mtr = json.loads((geo.ROOT / "assets/data/mtr-static.json").read_bytes())
        self.lr = json.loads((geo.ROOT / "assets/data/light-rail-static.json").read_bytes())

    def build(self):
        return geo.build(self.raw, self.review, self.mtr, self.lr)

    def test_reproducible_snapshot_and_official_scope(self):
        result = self.build()
        self.assertEqual(json.dumps(result, ensure_ascii=False, indent=2) + "\n", geo.OUTPUT.read_text())
        self.assertEqual(result["source"]["rawRecordCount"], 37379)
        self.assertEqual(result["source"]["typeCounts"], {"RSN": 98, "MTA": 611, "LRA": 68})
        self.assertEqual(result["source"]["csvGeojsonMatchedRailwayRecords"], 777)
        self.assertEqual(result["counts"]["mtr"], {"total": 98, "verified": 98, "unresolved": []})
        self.assertEqual(result["counts"]["lightRail"], {"total": 68, "verified": 68, "unresolved": []})
        self.assertEqual(result["counts"]["conflicts"], 0)
        self.assertEqual(result["counts"]["unresolvedSourceRecords"], 1)

    def test_upstream_and_catalogue_drift_need_review(self):
        self.raw += b" "
        with self.assertRaisesRegex(ValueError, "Source changed"):
            self.build()
        self.raw = gzip.decompress(geo.SOURCE.read_bytes())
        self.lr["stops"]["250"]["en"] = "Old or unreviewed identity"
        with self.assertRaisesRegex(ValueError, "catalogue changed"):
            self.build()

    def test_every_official_id_is_explicit_unique_and_separated(self):
        for mode, catalogue, key in (("mtr", self.mtr, "stations"), ("lightRail", self.lr, "stops")):
            self.assertEqual(set(self.review[mode]), set(catalogue[key]))
        ids = [record_id for mode in ("mtr", "lightRail") for row in self.review[mode].values()
               for record_id in [row["stationRecordId"], *row["entranceRecordIds"]]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertNotEqual(self.review["mtr"]["TUM"]["stationRecordId"], self.review["lightRail"]["295"]["stationRecordId"])
        self.assertEqual(self.review["lightRail"]["250"]["stationRecordId"], "529462")
        self.assertEqual(self.review["lightRail"]["250"]["sourceName"], {"en": "LR-Hoi Wong Road", "zh": "輕鐵－海皇路"})

    def test_wrong_railway_type_and_unassociated_entrance_are_rejected(self):
        original = copy.deepcopy(self.review)
        self.review["lightRail"]["295"]["stationRecordId"] = self.review["mtr"]["TUM"]["stationRecordId"]
        with self.assertRaisesRegex(ValueError, "Wrong railway identity type"):
            self.build()
        self.review = original
        self.review["mtr"]["DIH"]["entranceRecordIds"].append("21279579")
        with self.assertRaisesRegex(ValueError, "Unverified official parent association"):
            self.build()

    def test_missing_station_mapping_stays_unresolved_without_blocking_others(self):
        withheld = self.review["mtr"].pop("RAC")
        self.review["unresolvedSourceRecords"] += [
            {"recordId": record_id, "reason": "Synthetic test: mapping awaits review"}
            for record_id in [withheld["stationRecordId"], *withheld["entranceRecordIds"]]
        ]
        result = self.build()
        self.assertEqual(result["mtr"]["RAC"]["status"], "unresolved")
        self.assertEqual(result["mtr"]["RAC"]["positions"], [])
        self.assertEqual(result["counts"]["mtr"]["verified"], 97)
        self.assertEqual(result["counts"]["lightRail"]["verified"], 68)

    def test_invalid_wgs84_points_fail_closed(self):
        feature = json.loads(self.raw)["features"][0]
        for coordinates in ([22.3, 114.1], [0, 0], [None, 22.3], [float("nan"), 22.3], [114.1, float("inf")], []):
            feature["geometry"]["coordinates"] = coordinates
            with self.assertRaises(ValueError):
                geo.checked_coordinate(feature)

    def test_repeated_source_identity_is_rejected(self):
        source = json.loads(self.raw)
        source["features"].append(source["features"][0])
        self.raw = geo.encode(source)
        self.review["sourceSha256"] = sha256(self.raw).hexdigest()
        with self.assertRaisesRegex(ValueError, "Duplicate official ID"):
            self.build()

    def test_glyph_exceptions_require_explicit_review(self):
        self.review["nameExceptions"].pop("mtr/LAK")
        with self.assertRaisesRegex(ValueError, "Unreviewed Chinese identity difference"):
            self.build()


if __name__ == "__main__":
    unittest.main()

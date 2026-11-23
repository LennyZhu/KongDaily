#!/usr/bin/env python3
"""Offline generator tests against the retained official XML and GeoJSON archive."""

import copy
from hashlib import sha256
import json
from pathlib import Path
import runpy
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent
GENERATOR = runpy.run_path(str(ROOT / "build-tram-static.py"))
FIXTURE = ROOT / "fixtures/tram/td-tram-2026-11-18"
with zipfile.ZipFile(FIXTURE.with_suffix(".zip")) as archive:
    RAW = {name: archive.read(name) for name in GENERATOR["SOURCES"]}
MANIFEST = json.loads(FIXTURE.with_suffix(".json").read_text())
EXPECTED = ROOT.parent / "assets/data/tram-static.json"


def build_with_replacement(name, value):
    raw, manifest = dict(RAW), copy.deepcopy(MANIFEST)
    raw[name] = value
    manifest[name]["sha256"] = sha256(value).hexdigest()
    return GENERATOR["build"](raw, manifest)


class TramGeneratorTest(unittest.TestCase):
    def test_byte_identical_snapshot(self):
        build, encode = GENERATOR["build"], GENERATOR["encode"]
        first = encode(build(RAW, MANIFEST))
        second = encode(build(dict(reversed(list(RAW.items()))), MANIFEST))
        self.assertEqual(first, second)
        self.assertEqual(first, EXPECTED.read_text())
        self.assertEqual(json.loads(first)["counts"], {"routes": 6, "directions": 12, "stops": 117, "visits": 427})

    def test_rejects_unreviewed_source_bytes(self):
        raw = {**RAW, "STOP_TRAM.xml": RAW["STOP_TRAM.xml"] + b" "}
        with self.assertRaisesRegex(ValueError, "SHA-256"):
            GENERATOR["build"](raw, MANIFEST)

    def test_rejects_peak_tram_or_missing_stop_reference(self):
        with self.assertRaisesRegex(ValueError, "street tram"):
            build_with_replacement("ROUTE_TRAM.xml", RAW["ROUTE_TRAM.xml"].replace(
                b"<ROUTE_TYPE>4</ROUTE_TYPE>", b"<ROUTE_TYPE>5</ROUTE_TYPE>", 1))
        with self.assertRaisesRegex(ValueError, "Unresolved visit"):
            build_with_replacement("RSTOP_TRAM.xml", RAW["RSTOP_TRAM.xml"].replace(
                b"<STOP_ID>99310</STOP_ID>", b"<STOP_ID>1</STOP_ID>", 1))

    def test_rejects_duplicate_visit_gaps_and_missing_languages(self):
        raw = RAW["RSTOP_TRAM.xml"]
        with self.assertRaisesRegex(ValueError, "Duplicate visit"):
            build_with_replacement("RSTOP_TRAM.xml", raw.replace(b"<STOP_SEQ>2</STOP_SEQ>", b"<STOP_SEQ>1</STOP_SEQ>", 1))
        with self.assertRaisesRegex(ValueError, "Non-contiguous"):
            build_with_replacement("RSTOP_TRAM.xml", raw.replace(b"<STOP_SEQ>2</STOP_SEQ>", b"<STOP_SEQ>99</STOP_SEQ>", 1))
        with self.assertRaisesRegex(ValueError, "localized name"):
            build_with_replacement("RSTOP_TRAM.xml", raw.replace(b"<STOP_NAMEE>Shau Kei Wan Terminus</STOP_NAMEE>",
                b"<STOP_NAMEE/>", 1))

    def test_rejects_incomplete_or_swapped_geojson_records(self):
        geo = json.loads(RAW["JSON_TRAM.json"].decode("utf-8-sig"))
        feature = geo["features"].pop()
        with self.assertRaisesRegex(ValueError, "coverage differs"):
            build_with_replacement("JSON_TRAM.json", json.dumps(geo).encode())
        geo["features"].append(feature)
        feature["geometry"]["coordinates"].reverse()
        with self.assertRaisesRegex(ValueError, "Invalid WGS84"):
            build_with_replacement("JSON_TRAM.json", json.dumps(geo).encode())

    def test_rejects_coherent_but_geographically_wrong_geojson_points(self):
        geo = json.loads(RAW["JSON_TRAM.json"].decode("utf-8-sig"))
        stop_id = geo["features"][0]["properties"]["stopId"]
        for feature in geo["features"]:
            if feature["properties"]["stopId"] == stop_id:
                feature["geometry"]["coordinates"][0] += 0.01
        with self.assertRaisesRegex(ValueError, "Grid reconciliation failed"):
            build_with_replacement("JSON_TRAM.json", json.dumps(geo).encode())

    def test_new_official_repeated_stop_is_preserved_even_when_coverage_changes(self):
        raw, manifest = dict(RAW), copy.deepcopy(MANIFEST)
        sequence = raw["RSTOP_TRAM.xml"]
        first = sequence[sequence.index(b"<RSTOP>"):sequence.index(b"</RSTOP>") + len(b"</RSTOP>")]
        repeated = first.replace(b"<STOP_SEQ>1</STOP_SEQ>", b"<STOP_SEQ>41</STOP_SEQ>", 1)
        raw["RSTOP_TRAM.xml"] = sequence.replace(b"</dataroot>", repeated + b"\n</dataroot>")

        geo = json.loads(raw["JSON_TRAM.json"].decode("utf-8-sig"))
        feature = copy.deepcopy(geo["features"][0])
        feature["properties"]["stopSeq"] = 41
        geo["features"].append(feature)
        raw["JSON_TRAM.json"] = json.dumps(geo).encode()
        for name in ("RSTOP_TRAM.xml", "JSON_TRAM.json"):
            manifest[name]["sha256"] = sha256(raw[name]).hexdigest()

        generated = GENERATOR["build"](raw, manifest)
        self.assertEqual(generated["counts"]["visits"], 428)
        visits = generated["routes"][0]["directions"][0]["visits"]
        self.assertEqual(visits[0][:2], [1, 99310])
        self.assertEqual(visits[-1][:2], [41, 99310])


if __name__ == "__main__":
    unittest.main()

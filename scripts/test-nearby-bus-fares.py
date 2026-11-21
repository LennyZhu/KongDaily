from pathlib import Path
from runpy import run_path
import unittest


builder = run_path(str(Path(__file__).with_name("build-nearby-bus-fares.py")))
cents = builder["cents"]
fare_to_any_destination = builder["fare_to_any_destination"]


class FareEvidenceTest(unittest.TestCase):
    def test_preserves_decimal_cents(self):
        self.assertEqual(cents("13.9"), 1390)
        self.assertEqual(cents("4.37"), 437)
        for invalid in ("4.373", "0", "NaN", "-14.2"):
            with self.assertRaises(ValueError):
                cents(invalid)

    def test_requires_the_same_unconditional_fare_for_every_destination(self):
        self.assertEqual(fare_to_any_destination({(2, 3): {(None, 900)}, (2, 4): {("511", 900)}}, 2, [3, 4]), 900)
        for second in (set(), {(None, 1100)}, {(None, 900), (None, 1100)}, {("480", 900)}, {("31", 900)},
                       {(None, 900), ("480", 1100)}):
            with self.subTest(second=second):
                self.assertIsNone(fare_to_any_destination({(2, 3): {(None, 900)}, (2, 4): second}, 2, [3, 4]))
        self.assertIsNone(fare_to_any_destination({}, 2, []))


if __name__ == "__main__":
    unittest.main()

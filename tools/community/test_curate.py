"""Unit tests for curate.py."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import curate


class TestCurateCheck(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.bundle_path = self.root / "patch-current.json"
        self.curated_path = self.root / "curated_builds.json"
        self.bundle_path.write_text(
            json.dumps(
                {
                    "emblems": [{"id": "001-bulbasaur"}],
                    "heldItems": [{"id": "muscle-band"}],
                    "battleItems": [{"id": "eject-button"}],
                    "pokemon": [
                        {
                            "id": "bulbasaur",
                            "name": "Bulbasaur",
                            "role": "Attacker",
                            "moves": [
                                {"name": "Solar Beam", "isUpgrade": True},
                                {"name": "Sludge Bomb", "isUpgrade": True},
                            ],
                        }
                    ],
                }
            )
        )

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def _patches(self):
        return (
            mock.patch.object(curate, "BUNDLE", self.bundle_path),
            mock.patch.object(curate, "CURATED", self.curated_path),
        )

    def test_check_flags_bad_emblem_with_suggestion(self):
        self.curated_path.write_text(
            json.dumps(
                {
                    "bulbasaur": {
                        "builds": [
                            {
                                "name": "Test",
                                "heldItemIds": ["muscle-band"],
                                "battleItemId": "eject-button",
                                "emblems": [{"emblemId": "001-bulbasa", "grade": "gold"}],
                                "moves": ["Solar Beam", "Sludge Bomb"],
                            }
                        ]
                    }
                }
            )
        )
        with self._patches()[0], self._patches()[1]:
            rc = curate.cmd_check()
        self.assertEqual(rc, 1)
        msg = curate._enhance_value_error(
            "bulbasaur recommended build 'Test': unknown emblemId '001-bulbasa'",
            {"001-bulbasaur"},
            set(),
            set(),
        )
        self.assertIn("did you mean", msg)

    def test_check_passes_clean_fixture(self):
        self.curated_path.write_text(
            json.dumps(
                {
                    "bulbasaur": {
                        "builds": [
                            {
                                "name": "Test",
                                "heldItemIds": ["muscle-band"],
                                "battleItemId": "eject-button",
                                "emblems": [{"emblemId": "001-bulbasaur", "grade": "gold"}],
                                "moves": ["Solar Beam", "Sludge Bomb"],
                            }
                        ]
                    }
                }
            )
        )
        with self._patches()[0], self._patches()[1]:
            rc = curate.cmd_check()
        self.assertEqual(rc, 0)

    def test_scaffold_known_id(self):
        with self._patches()[0], self._patches()[1]:
            rc = curate.cmd_scaffold("bulbasaur", write=False)
        self.assertEqual(rc, 0)

    def test_scaffold_unknown_id(self):
        with self._patches()[0], self._patches()[1]:
            rc = curate.cmd_scaffold("not-a-mon", write=False)
        self.assertEqual(rc, 1)


if __name__ == "__main__":
    unittest.main()

"""Unit tests for normalize.py helpers."""

from __future__ import annotations

import unittest

from normalize import strip_activation_note


class TestStripActivationNote(unittest.TestCase):
    def test_with_period(self):
        self.assertEqual(
            strip_activation_note("...kick style. Activates at Level 9"),
            "...kick style.",
        )

    def test_without_period(self):
        self.assertEqual(
            strip_activation_note("...loses its shield Activates at Level 8"),
            "...loses its shield.",
        )

    def test_noop(self):
        self.assertEqual(strip_activation_note("A plain sentence."), "A plain sentence.")


if __name__ == "__main__":
    unittest.main()

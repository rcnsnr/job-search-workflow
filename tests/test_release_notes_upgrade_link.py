from __future__ import annotations

import json

from scripts.check_release_notes_upgrade_link import (
    UPGRADE_GUIDE_URL,
    has_upgrade_link,
    release_body_from_event,
)


def test_release_notes_require_the_canonical_upgrade_link() -> None:
    assert has_upgrade_link(f"Upgrade here: {UPGRADE_GUIDE_URL}")
    assert not has_upgrade_link("No upgrade instructions are included.")


def test_release_event_reader_returns_release_body(tmp_path) -> None:
    event_path = tmp_path / "release.json"
    event_path.write_text(json.dumps({"release": {"body": UPGRADE_GUIDE_URL}}), encoding="utf-8")

    assert release_body_from_event(event_path) == UPGRADE_GUIDE_URL

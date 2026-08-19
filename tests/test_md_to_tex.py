from __future__ import annotations

import sys
from importlib import util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONVERTER_PATH = ROOT / "scripts" / "md_to_tex.py"
SPEC = util.spec_from_file_location("md_to_tex", CONVERTER_PATH)
assert SPEC and SPEC.loader
md_to_tex = util.module_from_spec(SPEC)
sys.modules[SPEC.name] = md_to_tex
SPEC.loader.exec_module(md_to_tex)


def test_convert_closes_each_itemize_block(tmp_path: Path) -> None:
    source = tmp_path / "sample-cv.md"
    source.write_text(
        "---\n"
        "title: Example Candidate\n"
        "author:\n"
        "  - City, Country | person@example.com | +1-555-0100\n"
        "  - LinkedIn: linkedin.com/in/example | GitHub: github.com/example\n"
        "---\n\n"
        "## Experience\n\n"
        "- Built a reliable service.\n"
        "- Improved deployment checks.\n\n"
        "## Skills\n\n"
        "Python and Linux.\n",
        encoding="utf-8",
    )

    rendered = md_to_tex.convert(source)

    assert rendered.count("\\begin{itemize}") == 1
    assert rendered.count("\\end{itemize}") == 1
    assert rendered.endswith("\\end{document}\n")

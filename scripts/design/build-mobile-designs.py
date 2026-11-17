#!/usr/bin/env python3
"""Bundle the source-based mobile design catalogue; no third-party packages needed."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2] / "docs/design/mobile"
data = {
    key: json.loads((root / filename).read_text())
    for key, filename in [
        ("screens", "screens.json"),
        ("navigation", "navigation.json"),
    ]
}
for platform, groups in data["navigation"].items():
    assert list(groups) == ["Home", "Usage", "Family", "Computers", "More"]
    assert sum(len(rows) for rows in groups.values()) == (
        21 if platform == "android" else 20
    )
    for routes in groups.values():
        for indices in routes.values():
            assert indices and all(
                1 <= index <= len(data["screens"][platform]) for index in indices
            )
css = (root / "catalogue.css").read_text()
js = (
    "const MOBILE_DESIGNS = "
    + json.dumps(data).replace("<", "\\u003c")
    + ";\n"
    + (root / "catalogue.js").read_text()
)
page = f"""<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NetSentry mobile navigation designs</title><style>{css}</style>
<header><h1 id="title">Mobile navigation designs</h1>
<p>Five persistent floating bottom tabs: Home, Usage, Family, Computers and More. Android has 21 submenu destinations; iOS has 20. Includes 66 previews of menus, sections, states and dialogs. These are source-based HTML reconstructions, not native screenshots. Native builds and device validation remain pending. Apple Screen Time requires separate authorization and provisioning.</p>
<nav class="controls" aria-label="Catalogue controls"><button data-platform="android">Android</button><button data-platform="ios">iOS</button><button id="mode">View all screens</button><input id="search" aria-label="Find a screen" placeholder="Find a screen…" hidden></nav></header>
<main><div class="workspace" id="workspace"><aside class="outline" id="outline" aria-label="Navigation map"></aside><div id="preview"></div></div><div id="gallery" hidden></div></main><script>{js}</script></html>"""
(root / "index.html").write_text(page)
print(
    "Built mobile catalogue: 5 tabs, 21 Android / 20 iOS submenu routes, 66 previews."
)

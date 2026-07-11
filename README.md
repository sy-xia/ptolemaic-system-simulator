# Ptolemaic System Simulator — HTML5 (KL-UNL accessible port)

An accessible HTML5 re-build of the legacy Flash *Ptolemaic System Simulator*
(Nebraska Astronomy Applet Project). Behavior is ported from the decompiled
ActionScript; chrome and layout use the shared **KL-UNL foundation** and follow
WCAG 2.1 AA.

## ⚠️ It must be served over HTTP — double-clicking `index.html` will not work

The KL-UNL masthead (title + Reset / Help / About) loads its text with
`fetch('foundation/contents.json')`. Browsers **block `fetch()` over the
`file://` protocol** (same-origin policy), so if you just double-click
`index.html` the masthead (and its Help/About text) will be empty/broken.
Serve the folder over HTTP instead.

## How to run it locally

Run a static server **from inside this `html5/` folder**, then open the root URL
(the sim is at the server root, so the URL is `http://localhost:PORT/` — *not*
`.../html5/index.html`).

```sh
# Python 3
python3 -m http.server 8123
#   then open  http://localhost:8123/

# Node
npx serve            # or:  npx http-server
```

On Windows without Python/Node, a tiny PowerShell static server is included:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1 8123
#   then open  http://localhost:8123/
```

(`serve.ps1` is only a local-dev convenience; it is not part of the sim.)

## Production

When deployed to the cloud host (served over HTTP/HTTPS) it just works — the
`file://` limitation only affects local double-clicking.

## MathJax dependency (important)

All mathematics/symbols shown (the degree, ratio, and rate readouts —
apogee angle, eccentricity, motion rate, epicycle size, path duration) are
authored as **MathJax/LaTeX** and typeset by the foundation's `kl-unl.js`.
MathJax is part of the shared KL-UNL foundation and is expected at
`foundation/mathjax/tex-mml-chtml.js`. **That library was not present in the
provided export** (the same gap the sibling "Gas Retention Simulator"
conversion hit), and this project is self-contained (no CDN), so you must
drop the foundation's local MathJax build into `foundation/mathjax/`. Until
it is present the sim still runs and shows readable plain-text fallbacks
(e.g. `106.7°`, `0.66`, `2.50 yr`), but the right-click "Show Math As" menu
and full math a11y require the library. See `CONVERSION_NOTES.md`.

## Files

```
index.html            KL-UNL scaffold: .app-shell + <kl-unl-masthead> + 5 panels
foundation/            copied from the shared KL-UNL foundation (see CONVERSION_NOTES
                        for the one necessary correction, contents.json)
styles/styles.css      sim-specific styles only (kl-unl.css is untouched)
simulation.js          all sim logic (physics port + accessible interaction)
assets/                reused exported vector shapes (circle, earth, sun,
                        planet, deferent-center, equant-point markers)
serve.ps1              optional local static server for Windows dev
README.md              this file
CONVERSION_NOTES.md    behavior model, AS→HTML5 mapping, deviations
ACCESSIBILITY.md       WCAG affordances, ARIA, keyboard map, live-region wording
```

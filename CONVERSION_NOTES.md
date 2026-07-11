# Conversion Notes — Ptolemaic System Simulator (Flash AS1 → HTML5)

## Behaviour model (one paragraph)

The simulator shows how Ptolemy's geocentric model reproduces a planet's
apparent motion. The earth sits fixed at the center of an **Orbit View**. A
planet moves on a small circle (the **epicycle**), whose center in turn moves
on a larger circle (the **deferent**), which may be offset from the earth by
an **eccentricity**/**apogee angle** pair; a separate **equant** point (always
placed automatically at twice the deferent's offset from earth, per Ptolemy)
governs the *uniform* angular rate of the epicycle's motion around the
deferent. Whether the planet is **superior** (epicycle center paced by mean
anomaly, planet-on-epicycle paced by the sun) or **inferior** (the reverse) is
a user choice, changing which formula drives which circle. A fading trail
traces the planet's recent path, and a **Zodiac Strip** shows where the sun
and planet currently fall along the ecliptic, with its own fading "ghost"
trail. **Planetary Parameters** adjust epicycle size, eccentricity, motion
rate, apogee angle and planet type directly, or load one of Ptolemy's own
tabulated values for Venus/Mars/Jupiter/Saturn (Mercury is omitted — it needs
additional precession terms the original never modeled). **Controls and
Settings** run/pause the animation, set its rate, toggle six diagram overlays,
and set the trail's duration. A **Memory** store/recall pair snapshots the
current parameters and time. Dragging the sun marker (mouse or keyboard)
directly sets its ecliptic longitude. Reset returns everything to the
simulator's default (the Mars preset, animation paused, anomaly/sun angle
zeroed, default overlay visibility).

## Physics — verbatim constants & formulas (from `scripts/Ptolemaic System.as`, `scripts/Zodiac Strip.as`, `scripts/New Sun.as`, `scripts/frame_1/DoAction.as`)

| Quantity | Value / formula | Source |
|---|---|---|
| Deferent radius | fixed `100` (set once at load, never changes) | `init()` → `setDeferentRadius(100)` |
| Outer limit | `0.6` (max eccentricity/equant distance as a fraction of the deferent radius) | `p.outerLimit` |
| Sun's mean rate | `0.0172025806756283` rad/day (= 360°/365.24667 days, fixed) | `p._sunRate` |
| Days per year | `365.24667` | `setPathTime` |
| Path trail | 20 segments, sampled every 1.5 (simulated) days | `p._numSegments`, `p._samplingInterval` |
| Sun's display orbit radius | `225` | `update()` |
| Planet-longitude vector length | `250` | `update()` |
| Zodiac ring symbol radius / tick radii | `260` / `250–270` | constructor |
| Zodiac strip width | `600` | `p.width` |
| Zodiac ghosting alpha spread / min alpha | `50` / `5` | `p.alphaSpread`, `p.minAlpha` |
| Planet path colour | `#ff6666` (16737894) | `p.pathColor` — matches the reused `planet.svg` fill |
| Connector-line colour (equant/epicycle/earth-sun/vector lines) | `#a0a0a0` (10526880) | `update()` |
| Superior-planet position | epicycle-center angle from **anomaly**; planet-on-epicycle offset from **sunAngle** | `update()` |
| Inferior-planet position | epicycle-center angle from **sunAngle**; planet-on-epicycle offset from **anomaly** | `update()` |
| Equant construction | equant is always at **2×** the deferent's eccentric offset from earth | `setEccentricity`/`setApogeeAngle` |
| Zodiac strip ghost colour | `Z = 1 − dX/3` (clamped ≥0), `C = floor(216 − 112·Z)`, colour = `rgb(21+C, C, C)` | `setPlanetLongitude` |
| Presets (Venus/Mars/Jupiter/Saturn: epicycle radius, eccentricity, apogee angle, motion rate, type) | see `PLANET_DATA` in `simulation.js` | `frame_1/DoAction.as` `planetData` |
| Slider ranges/precision | apogee 0–360° (0.1), eccentricity 0–0.2 (0.01), motion rate 0.01–4.5°/day (0.01), epicycle 0–0.75 (0.01), path duration 0.3–10 yr (0.01), animation rate 1–500 (0.1) | `frame_1/PlaceObject2_224_Standard Slider v6_*` init objects |

All constants and formulas above are copied verbatim into `simulation.js` (see
its section comments, which cite the matching AS method name). The `update()`
and `updatePath()` functions are line-for-line ports, including the "stale
baseline" quirk where each preset's five setters (`setEpicycleRadius` →
`setEccentricity` → `setApogeeAngle` → `setAnomalyRate` → `setPlanetType`)
each independently reset the trail, so the trail's very first "ghost" segment
after a preset load briefly connects from an intermediate (not the final)
planet position — this is the original's own behaviour, not a bug introduced
here.

## AS1 → HTML5 mapping

| ActionScript | HTML5 port |
|---|---|
| `Object.registerClass` prototype classes (`PtolemaicSystemClass`, `ZodiacStripClass`, `NewSunClass`) | plain functions/state in `simulation.js` |
| `onEnterFrame` + `getTimer()` | single `requestAnimationFrame` loop; `performance.now()` |
| Code-drawn orbit/vector lines, zodiac ring ticks (`lineStyle`/`moveTo`/`lineTo`) | `<canvas>` 2D `strokeStyle`/`moveTo`/`lineTo`, identical coordinates/colours |
| Exported vector symbols `Circle`, `Earth`, `Sun`, `Planet`, `Deferent Center`, `Equant Point` (`shapes/196,239,233,231,235,237.svg`) | reused as-is, drawn with `ctx.drawImage()` at the same logical position/size (see *Assets* below) |
| `New Sun.as` drag (`onPress`/`onMouseMoveFunc`, `atan2(-_ymouse,_xmouse)`) | pointer drag on a focusable proxy (`#sunHandle`, `role="slider"`) using the identical `atan2(-y,x)` offset math, **plus** a keyboard path (arrows/Page/Home/End) |
| `Standard Slider v6` / `Slider Logic Class v6` (Flash UI component: draws its own bar/grabber/field) | native `<input type="range">` with matching min/max/step (derived from each slider's `minValue`/`maxValue`/`precision`), `aria-valuetext` carrying quantity+value+unit |
| `FRadioButtonSymbol`, `FCheckBoxSymbol`, `FPushButtonSymbol`, `FComboBoxSymbol` | native `<input type=radio>`, `<input type=checkbox>`, `<button>`, `<select>` |
| `Title Bar.as` / `Dialog Window v2.as` (Flash masthead + About/Help dialog) | the shared `<kl-unl-masthead>`; its `sim-reset` event is wired to the port's `doReset()` |
| `DefineSprite_255` 5-tab icon key (`onPress` swaps a description string) | 5 accessible toggle buttons (`role=group`, `aria-pressed`) updating a `aria-live="polite"` description; text copied verbatim from its `info[]` array |
| `displayText` sub/sup renderer, `Number.prototype.toFixed` polyfill | MathJax (`klunlShowEquation`-style helper `mjSet()`) for every numeric readout, with a plain-text fallback |
| `_x/_y`, colour ints (`0xRRGGBB`/alpha 0–100) | canvas logical coordinates (screen-Y-down, same as the AS stage — see the coordinate-convention note at the top of `simulation.js`), CSS hex colours, `globalAlpha = alpha/100` |

## The contents.json edit

The masthead resolves this sim by `sim-id="ptolemaicsystem"`, which did **not**
already exist in the shared `foundation/contents.json`, so a new entry was
added (placed after `newSim`, per the file's own alphabetical-order
convention — this per-sim copy only carries `_comment`, `newSim`, and this
sim's entry; see the JSON-validity note below for why).
Its title is copied verbatim from the Title Bar's `title` property
(`"Ptolemaic System Simulator"`). Its **Help** text is the reflowed prose of
`texts/25.txt` (the original text-field runs, rejoined into paragraphs; the
terms/panel names that were separate bold/italic text runs in the source —
`epicycle`, `deferent`, `equant`, `Orbit View`, `Zodiac Strip`, `Planetary
Parameters`, `Controls and Settings` — are wrapped in `<em>`, matching how
sibling sims in this module render the same kind of emphasis). Its **About**
text reuses the existing Solar System Models Module boilerplate verbatim from
the sibling `configurationssimulator` entry (`texts/27.txt`, `texts/28.txt`,
`texts/30.txt`, `texts/31.txt` — NAAP module credit, `astro.unl.edu` link,
NSF grant numbers, and the noncommercial-use permission notice all match).

However, the shared `contents.json` as provided is **not valid JSON** — the
browser's `JSON.parse` (used by `kl-unl-masthead.js`) rejects it at roughly
character 87407 with "Bad control character in string literal," reproducing
the same problem the sibling "Gas Retention Simulator" conversion already
documented (raw control characters and at least one unescaped `"` inside
string values elsewhere in the file). Because `contents.json` is the only
foundation file this pipeline permits editing, and the masthead cannot
function otherwise, this sim ships a **valid, minimal per-sim copy** at
`foundation/contents.json` containing only the `_comment`, the `newSim`
template, and this sim's own `ptolemaicsystem` entry — the "per-sim copy"
model described in the pipeline spec. The other foundation files
(`kl-unl-masthead.js`, `kl-unl.css`, `kl-unl.js`) are copied byte-for-byte
unchanged. **Action for the pipeline maintainers:** fix the shared
`contents.json` upstream so a full shared file can be used everywhere.

## Assets

Exported vector shapes are reused as-is (never redrawn):

| File | Original shape | Used for |
|---|---|---|
| `assets/circle.svg` | `shapes/196.svg` (unit circle, r=100, `#666666` stroke) | deferent and epicycle circles, scaled by `drawImage` to the current radius |
| `assets/earth.svg` | `shapes/239.svg` (`#0099ff` fill) | earth marker |
| `assets/sun.svg` | `shapes/233.svg` (radial gradient `#fed55a`→`#febe01`) | sun marker |
| `assets/planet.svg` | `shapes/231.svg` (`#ff6666` fill) | planet marker |
| `assets/deferent-center.svg` | `shapes/235.svg` (`#9966ff` fill) | deferent-center marker |
| `assets/equant-point.svg` | `shapes/237.svg` (`#00cc33` cross) | equant-point marker |

The Flash UI-component skins (slider, checkbox, radio button, combo box,
push button, scrollbar, the old Title Bar/About/Help dialog chrome) are
intentionally **not** ported; native accessible controls and the shared
KL-UNL masthead replace them per the pipeline rules. The 12 zodiac ring/strip
reference ticks, the connector lines, and the fading trails are genuinely
code-drawn in the original (`lineStyle`/`moveTo`/`lineTo`/`beginFill`), so
they are reproduced with canvas 2D drawing rather than an exported file.

## Deviations from the original (Goal B overriding Goal C)

1. **Zodiac symbols are standard Unicode glyphs (♈–♓), not the original's
   custom dingbat font.** The Flash version drew each zodiac symbol by
   picking a single character (`"^_`abcdefghi"`) out of a bespoke embedded
   font (`fonts/192_Wingdings.ttf`-style single-glyph mapping unique to this
   `.fla`). That mapping is meaningless to a screen reader (and to any
   browser without the exact font). The standard Unicode astronomical
   symbols (U+2648–U+2653) have the same visual meaning and are legible to
   assistive technology and to any system font, so they were substituted.
   Every symbol is paired with its plain-text name (`Aries`, `Taurus`, …)
   exactly as the original always did. Two rendering details were needed:
   (a) each glyph is suffixed with the **U+FE0E text-presentation selector**
   and given an explicit symbol-font stack (`Segoe UI Symbol`, `DejaVu Sans`,
   `Apple Symbols`, …) because several platforms otherwise render this
   Unicode block as a colourful emoji-style tile (a filled box behind the
   glyph) instead of plain text; and (b) on the Zodiac Strip, the
   constellation **names are hidden below ~44rem viewport width** (the glyphs
   remain), because 12 names cannot fit legibly across a narrow phone/tablet
   strip — the strip's name labels are decorative (`aria-hidden`; the spoken
   description in `#zodiacDesc` and the always-labelled Orbit View ring carry
   the names for a11y), so nothing essential is lost.
2. **Every slider now speaks its unit**, even though the original never
   showed a `unitsText` for any of its six sliders (all six have
   `unitsText: ""` in the source). This is a pure accessibility *addition*
   (Goal B), not a change to the underlying values: `aria-valuetext` adds
   "degrees", "degrees per day", or "years" as appropriate, and the small
   visible readouts gained a matching suffix (`106.7°`, `0.52°/day`,
   `2.50 yr`) for sighted users too. Eccentricity and epicycle size remain
   unitless ratios, exactly as in the original.
3. **The layout is a 3fr:2fr two-column grid with the Zodiac Strip spanning
   full width beneath it**, matching the original's arrangement (a large
   Orbit View top-left, the three control panels top-right, and the Zodiac
   Strip as a full-width band across the bottom). The 3fr:2fr ratio overrides
   the KL-UNL foundation's default `25rem 1fr` (which would put the *diagram*
   column in the narrow, fixed-width side); the override lives in
   `styles/styles.css` scoped to `min-width: 56.0625rem` so the foundation's
   own mobile collapse rule (`.app-layout { grid-template-columns: 1fr }`
   under 56rem) is never fought. The Zodiac Strip panel uses
   `grid-column: 1 / -1` so it spans both columns on desktop and degrades to
   the single stacked column (diagram → controls → strip, in reading order)
   on phones/tablets. Making the strip full-width — rather than confining it
   to the diagram column — is what gives the 12 constellation labels room to
   sit without crowding, as they do in the original.
4. **The "Memory" store/recall pair** was a floating panel drawn *inside* the
   Flash orbit-view canvas; it is now a real `<fieldset>` with native
   `<button>`s above the canvas (buttons cannot live inside a `<canvas>`).
   Its grouping and function are otherwise identical.
5. **The 5-icon "Key" panel** keeps the same 5 entries, order, and verbatim
   explanatory text, but the icons are now real `<button>`s (`aria-pressed`
   toggle group) with the reused marker SVGs as CSS background images,
   instead of Flash `onPress` handlers on plain sprites.

None of these change any simulated value, formula, control range, or
educational text — only presentation, per the priority order in the
conversion brief.

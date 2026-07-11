# Accessibility Notes — Ptolemaic System Simulator

Target: WCAG 2.1 AA (AAA where reasonable). Human screen-reader QA on **NVDA
(Windows / Chrome + Firefox)** and **VoiceOver (macOS / Safari + Chrome)** is
still required — the notes below describe what was built for and verified
programmatically (accessibility-tree inspection, simulated pointer/keyboard
events, and canvas pixel checks), not what a human tester has confirmed.

## ⚠️ User-directed deviation: compact sizing (below the pipeline font floor)

At the reviewer's explicit direction ("make the right panels shorter … it does
not fit in a single page"), the sim's base body text is **0.9rem (~14px)** and
the control heights/spacing are tightened so the whole layout fits on one
screen without scrolling. This is **below** the pipeline's preferred
"≥ 1.125rem body / ≥ 44px touch-target" guidance (rule 10 / the responsiveness
section). The tradeoff was made deliberately and on request; it is recorded
here so it can be revisited. Mitigations that are still in place:
- All sizes remain in **rem**, so the text still scales with the user's browser
  font-size setting and with page zoom (it is not pinned in px).
- Contrast, semantic labels, keyboard operability, focus rings, `aria-valuetext`
  units, and the live-region narration are all unchanged — only the *visual
  size/spacing* was reduced, not the semantics or the screen-reader experience.
- The layout still reflows to a single stacked column on phones/tablets.
If full AA sizing is preferred over single-screen fit, raise the base font in
`styles/styles.css` (`.sim-panel { font-size }` and the "COMPACT VERTICAL
RHYTHM" block) back to 1.125rem and the touch targets to 2.75rem.

## Structure & landmarks
- Single `<h1>` = the simulation title, rendered by `<kl-unl-masthead>` (no
  competing `<h1>` is added).
- `<main>` holds five `<section>` panels, each labelled by its own `<h2>`
  (Orbit View, Zodiac Strip, Planetary Parameters, Controls and Settings,
  Key). Heading order does not skip levels.
- `<html lang="en">`. Every control has a real `<label>`/`<legend>` or
  `aria-label`.

## Canvas text alternatives
- Both `<canvas>` elements are `role="img"` with descriptive `aria-label`s.
- Each has a visually-hidden **`aria-live="polite"` description**
  (`#orbitDesc`, `#zodiacDesc`) kept updated from the single `render()`/state,
  e.g. *"Planet type superior. Deferent radius 100 units, eccentricity 0.10,
  apogee angle 106.7 degrees, epicycle size 0.66. Sun ecliptic longitude 90.0
  degrees. Animation running."* and *"Sun is near Aries. Planet is near
  Taurus, trailing a fading path of its recent motion."* — so an audio-only
  user gets the same "what's shown" a sighted user sees from the diagrams.
- While the animation is **running**, these descriptions are throttled to at
  most once every 2 seconds (continuous per-frame `aria-live` mutations would
  make the region unusable); while **paused**, every user-driven change
  (slider, checkbox, drag, preset, reset) updates them immediately, since
  those are discrete, meaningful, infrequent events.
- A separate `aria-live="polite"` status region (`#liveStatus`) announces
  discrete events with units: preset loaded, slider committed, checkbox
  toggled, planet type changed, animation started/paused, memory
  stored/recalled, sun longitude committed, reset. `aria-live="assertive"` is
  reserved for rare alerts (unused in normal operation).

## Units are always spoken with numbers
Screen readers only read the accessible name/value, so units are baked into
the accessible value, never left to an adjacent visual label — this is a
deliberate accessibility *addition* over the original, which never showed a
unit on any of its six sliders (see CONVERSION_NOTES.md deviation #2):
- Apogee angle `aria-valuetext` = *"apogee angle 106.7 degrees"*.
- Motion rate = *"motion rate 0.52 degrees per day"*.
- Path duration = *"path duration 2.50 years"*.
- Eccentricity / epicycle size (genuinely unitless ratios in the source) =
  *"eccentricity 0.10"* / *"epicycle size 0.66, a fraction of the deferent
  radius"*.
- The draggable Sun handle = *"Sun ecliptic longitude 90.0 degrees"*.

## Keyboard operability
Everything is reachable in a logical tab order with a visible
`:focus-visible` ring (from `kl-unl.css`); no keyboard traps; the masthead
dialog manages its own focus/Escape and is not fought.

| Control | Keys |
|---|---|
| Apogee / eccentricity / motion-rate / epicycle / animation-rate / path-duration sliders (native `range`) | ←/↓ decrement, →/↑ increment, PageUp/PageDown ×10 step, Home/End min/max |
| **Sun handle** (custom `role="slider"`) | Tab to focus **or** click/tap to focus; ←/↓ −1°, →/↑ +1°, PageUp/PageDown ±10°, Home/End 0°/360°; announced on commit with units |
| Planet type (native radio group) | ←/→ or ↑/↓ to move selection |
| Show-deferent/epicycle/vector/line checkboxes (native) | Space to toggle |
| Presets `<select>` | native combobox keys; OK button (Enter/Space) applies |
| Buttons (start/pause, OK, store, recall, Key tabs, masthead Reset/Help/About) | Enter/Space |

The Sun handle satisfies the two required focus behaviours: **(i)** Tab to
focus, then arrow-key rotate, and **(ii)** click/tap focuses the same element
(`.focus()` on `pointerdown`) so arrows work immediately after a drag.
Pointer and keyboard paths mutate the same `state.sunAngle`. The canvas
pointer handlers live on the handle element itself (not the canvas), so they
never swallow focus or key events, and Tab always moves away from it
normally — verified by dispatching synthetic `pointerdown`/`pointermove`/
`keydown` events and confirming `aria-valuenow`/`aria-valuetext` update
identically via either path (see CONVERSION_NOTES.md testing).

## Sliders don't get "stuck"
All six parameter/rate sliders are native `<input type="range">` (full arrow
/ Page / Home / End support for free), each given a `step` matching the
original's precision (`fixed digits`, 1–2 decimal places) so keyboard
increments land on the same values the Flash slider's rounding produced.

## Colour & contrast
- Text/UI uses the KL-UNL palette variables (≥ 4.5:1).
- The five marker colours (earth blue, planet/path red, sun gold, deferent
  purple, equant green) are the original's own identity colours, reused
  verbatim from the exported SVGs for recognisability — but colour never
  carries information alone: every marker also has a name in the Key panel's
  description text, and the Key panel's own icon buttons carry `aria-pressed`
  state plus a visible border highlight (not colour alone) to show which one
  is selected.
- The zodiac strip's "ghost" trail colour intentionally varies by recency (a
  meaningful visual, matching the original) but is purely decorative/motion
  history, not the sole carrier of any control state.

## Timing / motion
- Nothing animates on load; the original also starts paused (`animationRate`
  is only ever applied while the user has pressed **start animation**, which
  the same button also **pauses** — this is the masthead-independent Pause
  control the pipeline rules require).
- `requestAnimationFrame` naturally pauses in hidden/backgrounded tabs.
- The Sun-drag and slider interactions are instantaneous, user-initiated,
  and do not themselves loop or repeat.
- `prefers-reduced-motion`: because all continuous motion in this simulator
  is (a) never autoplayed and (b) already fully stoppable at any instant via
  the same "pause animation" button the user used to start it, there is no
  autonomous/looping motion left to suppress once reduced-motion is honoured
  by simply never auto-starting — which this port already does by default,
  matching the original. No `<canvas>` motion continues without an explicit,
  reversible user action.
- Nothing flashes more than 3×/second.

## Forms & language
- Every input has a real `<label>` (sliders, checkboxes, radios, the preset
  `<select>`) or an `aria-label`/`aria-labelledby` (the canvases, the Key
  panel's icon-only buttons via visually-hidden text). `<html lang="en">`.

## Responsiveness
- Desktop: `.app-layout` is overridden (only above the foundation's own
  56rem breakpoint) to a 3fr:2fr split so the diagram column is the wide one,
  matching the original's proportions, without fighting the foundation's own
  mobile collapse.
- Below 56rem the foundation's existing single-column collapse applies
  (diagram panels first, then controls, in reading order); below 30rem the
  sim's own breakpoint stacks each slider row and the checkbox grid into a
  single column and widens the preset picker to full width.
- The Orbit View and Zodiac Strip canvases keep their original internal
  coordinate systems (620×620 and 600×70 logical units, matching the AS
  stage's own unit scale) and are scaled purely by CSS (`max-width`/
  `aspect-ratio`), never reflowed/recomputed — verified the wrapper's
  rendered size (544×544px at desktop width) is a uniform scale of the
  logical 620×620 canvas. Pointer coordinates are mapped back through that
  same scale factor before being used in the sun-drag angle math.
- All interactive touch targets (buttons, checkboxes/radios, the Sun handle)
  are ≥ 2.75rem (44px); `touch-action: none` is set on the canvases and the
  Sun handle so dragging never scrolls the page.
- Nothing relies on `:hover` for information or functionality.

## Known limitation
Human screen-reader QA (VoiceOver + NVDA) has not been performed — this
document describes the implementation's design and automated verification,
not human confirmation.

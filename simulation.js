/* =====================================================================
   Ptolemaic System Simulator  --  HTML5 / KL-UNL accessible port
   Behavior is ported verbatim from the decompiled ActionScript (AS1):
   scripts/Ptolemaic System.as (PtolemaicSystemClass), scripts/Zodiac
   Strip.as, scripts/New Sun.as and scripts/frame_1/DoAction.as.

   Coordinate convention: canvas logical space is screen-Y-DOWN, exactly
   like the original Flash stage, so every AS formula (including its own
   "-" sign flips, e.g. sunMC._y = earthY - 225*sin(sunAngle)) is ported
   character-for-character with no extra re-flipping.
   ===================================================================== */

'use strict';

/* -------------------------------------------------------------------
   0.  Constants -- VERBATIM from Ptolemaic System.as / Zodiac Strip.as
   ------------------------------------------------------------------- */
const DEG2RAD = 0.017453292519943295;      // Math.PI/180
const TWO_PI = 6.283185307179586;

const OUTER_LIMIT = 0.6;                    // p.outerLimit
const DEFERENT_RADIUS = 100;                // fixed forever by init(): sysMC.setDeferentRadius(100)
const EARTH_X = 0, EARTH_Y = 0;              // earth never moves in this build
const SUN_RATE = 0.0172025806756283;         // p._sunRate, rad/day (fixed)
const DAYS_PER_YEAR = 365.24667;             // setPathTime multiplier
const NUM_SEGMENTS = 20;                     // p._numSegments
const SAMPLING_INTERVAL = 1.5;               // p._samplingInterval (time units = days)
const SUN_ORBIT_RADIUS = 225;                // sunMC display radius around earth
const PLANET_VECTOR_RADIUS = 250;            // earth-planet longitude indicator length

const PATH_COLOR = '#ff6666';                // p.pathColor (16737894) -- matches planet.svg fill
const TEMP_SEGMENT_COLOR = '#ff0000';        // red "ghost" segment to current planet position
const CONNECT_LINE_COLOR = '#a0a0a0';        // 10526880 -- equant/epicycle/earth-sun/vector lines
const REFERENCE_LINE_COLOR = '#000000';      // zodiac ring reference ticks/circle

const ZODIAC_RING_RADIUS = 260;              // symbol placement radius (orbit view)
const ZODIAC_TICK_R1 = 250, ZODIAC_TICK_R2 = 270;

const STRIP_WIDTH = 600;                     // p.width (Zodiac Strip)
const STRIP_ALPHA_SPREAD = 50;               // p.alphaSpread
const STRIP_MIN_ALPHA = 5;                   // p.minAlpha
const STRIP_HALF_HEIGHT = 10;                // segment half-height in AS (the "10" in setPlanetLongitude)

// Canvas logical (internal) resolution -- physics/drawing stay in these
// original-stage-like units; CSS scales the element visually (rule: "SCALE,
// do not reflow"). 620 gives ~40px margin beyond the r=270 zodiac ring.
const ORBIT_SIZE = 620;
const ORBIT_CENTER = ORBIT_SIZE / 2;
// The strip's DRAWN content (the fading trail band) is only +/-10 logical
// units tall (STRIP_HALF_HEIGHT). Keep the canvas close to that so it renders
// as a thin compact band -- like the original -- instead of a tall empty box.
const STRIP_HEIGHT = 24;

const ZODIAC_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpius', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
// Standard Unicode zodiac glyphs. The original used a custom dingbat font
// (fonts/192_Wingdings.ttf-style single-glyph mapping) which is unreadable
// to a screen reader; these are real, standard astronomical symbols with
// the same meaning, so they were substituted -- see CONVERSION_NOTES.md.
// Each is suffixed with U+FE0E (text variation selector) because several
// platforms otherwise render this Unicode block with a colourful emoji-style
// presentation (a filled box behind the glyph) instead of plain text -- the
// selector forces the plain-text glyph form.
const VS15 = '︎';
const ZODIAC_GLYPHS = ['♈', '♉', '♊', '♋', '♌', '♍',
  '♎', '♏', '♐', '♑', '♒', '♓'].map(g => g + VS15);

// Presets -- VERBATIM from frame_1/DoAction.as planetData
const PLANET_DATA = [
  { name: 'Venus',   epicycleRadius: 0.719444, eccentricity: 0.020833, apogeeAngle: 46.167,  motionRate: 1.6021,   planetType: 'inferior' },
  { name: 'Mars',    epicycleRadius: 0.658333, eccentricity: 0.1,      apogeeAngle: 106.667, motionRate: 0.52406,  planetType: 'superior' },
  { name: 'Jupiter', epicycleRadius: 0.191667, eccentricity: 0.045833, apogeeAngle: 152.15,  motionRate: 0.0831224,planetType: 'superior' },
  { name: 'Saturn',  epicycleRadius: 0.108333, eccentricity: 0.056944, apogeeAngle: 224.167, motionRate: 0.0334883,planetType: 'superior' }
];

/* -------------------------------------------------------------------
   1.  State object (single source of truth)
   ------------------------------------------------------------------- */
const state = {
  // deferent / equant geometry
  deferentX: -15, deferentY: 30,
  equantX: 10, equantY: 10,
  equantAngle: 0, equantDistance: 0,
  eccentricity: 0, apogeeAngle: 0,           // rad
  epicycleRadius: 60,
  isSuperiorPlanet: true,

  // motion
  anomaly: 0, sunAngle: 0,                    // rad
  anomalyRate: 0.009146573682278667,          // rad/day
  time: 0,                                    // simulated days
  animationRate: 0.1,                         // simulated days per real ms
  animating: false,
  timeLast: 0,                                // performance.now() ms

  // derived (recomputed by update())
  epicycleX: 0, epicycleY: 0,
  planetX: 0, planetY: 0,
  sunX: SUN_ORBIT_RADIUS, sunY: 0,
  planetLongitude: 0,
  lonArray: [],

  // trail (planet path in Orbit View)
  pathTime: 2.5 * DAYS_PER_YEAR,
  segments: [],            // { points:[[x,y],...] }
  tempSegment: null,       // ghost line from trail end to current planet pos
  currentSegment: 0,
  lastPathTime: 0, lastAnomaly: 0, lastSunAngle: 0,
  lastPathPlanetX: null, lastPathPlanetY: null,
  pathTimeCounter: 0,

  // zodiac strip ghosting
  zodiac: {
    segments: [], tempSegment: null, currentSegment: 0,
    timeCounter: 0, lastPlanetX: null, lastColor: '#d8d8d8'
  },

  // visibility toggles (Controls and Settings checkboxes)
  showDeferent: true, showEpicycle: true,
  showPlanetVector: false, showEquantVector: false,
  showEarthSunLine: false, showEpicyclePlanetLine: false,

  // UI bookkeeping (mirrors currentlySettingPresets / memoryObject)
  currentlySettingPresets: false,
  memory: null
};

/* -------------------------------------------------------------------
   2.  Core physics -- ported from PtolemaicSystemClass prototype
   ------------------------------------------------------------------- */
function clamp1(v) { return v < -1 ? -1 : (v > 1 ? 1 : v); }

// p.update
function update() {
  const s = state;
  const d = s.equantDistance;
  let alpha, angle, beta, k2;
  if (s.isSuperiorPlanet) {
    alpha = s.anomaly - s.equantAngle;
    k2 = clamp1((d / DEFERENT_RADIUS) * Math.sin(Math.PI - alpha));
    beta = alpha - Math.asin(k2);
    angle = s.equantAngle + beta;
    s.epicycleX = s.deferentX + DEFERENT_RADIUS * Math.cos(angle);
    s.epicycleY = -(s.deferentY + DEFERENT_RADIUS * Math.sin(angle));
    s.planetX = s.epicycleX + s.epicycleRadius * Math.cos(s.sunAngle);
    s.planetY = s.epicycleY + (-s.epicycleRadius) * Math.sin(s.sunAngle);
  } else {
    alpha = s.sunAngle - s.equantAngle;
    k2 = clamp1((d / DEFERENT_RADIUS) * Math.sin(Math.PI - alpha));
    beta = alpha - Math.asin(k2);
    angle = s.equantAngle + beta;
    s.epicycleX = s.deferentX + DEFERENT_RADIUS * Math.cos(angle);
    s.epicycleY = -(s.deferentY + DEFERENT_RADIUS * Math.sin(angle));
    s.planetX = s.epicycleX + s.epicycleRadius * Math.cos(s.anomaly);
    s.planetY = s.epicycleY + (-s.epicycleRadius) * Math.sin(s.anomaly);
  }
  s.sunX = EARTH_X + SUN_ORBIT_RADIUS * Math.cos(s.sunAngle);
  s.sunY = EARTH_Y - SUN_ORBIT_RADIUS * Math.sin(s.sunAngle);
  s.planetLongitude = Math.atan2(s.planetY - EARTH_Y, s.planetX - EARTH_X);
}

// p.updateLayout
function updateLayout() {
  update();
}

// p.setDeferentCenter-derived helpers used by setEccentricity/setApogeeAngle
function recomputeEquantFromEccentricity() {
  const s = state;
  const x = s.eccentricity * Math.cos(s.apogeeAngle);
  const y = s.eccentricity * Math.sin(s.apogeeAngle);
  s.deferentX = EARTH_X + x;
  s.deferentY = EARTH_Y + y;
  s.equantX = EARTH_X + 2 * x;
  s.equantY = EARTH_Y + 2 * y;
  const dy = s.equantY - s.deferentY, dx = s.equantX - s.deferentX;
  s.equantAngle = Math.atan2(dy, dx);
  s.equantDistance = Math.sqrt(dx * dx + dy * dy);
}

function setEccentricity(argStageUnits) {
  const s = state;
  s.eccentricity = Math.min(argStageUnits, OUTER_LIMIT * DEFERENT_RADIUS);
  recomputeEquantFromEccentricity();
  clearPath();
  updateLayout();
}
function setApogeeAngleDeg(argDeg) {
  state.apogeeAngle = argDeg * DEG2RAD;
  recomputeEquantFromEccentricity();
  clearPath();
  updateLayout();
}
function setEpicycleRadius(arg) {
  state.epicycleRadius = arg;
  clearPath();
  updateLayout();
}
function setAnomalyRateDeg(argDegPerDay) {
  state.anomalyRate = argDegPerDay * DEG2RAD;
  clearPath();
}
function setPlanetType(typeStr) {
  state.isSuperiorPlanet = typeStr === 'superior';
  clearPath();
}
function setSunAngle(arg) {
  state.sunAngle = ((arg % TWO_PI) + TWO_PI) % TWO_PI;
  clearPath();
  update();
  updatePath();
  updateZodiacStrip();
}

/* -------------------------------------------------------------------
   3.  Planet path trail -- ported from resetPathMC / updatePath / clearPath
   ------------------------------------------------------------------- */
function resetPathMC() {
  const s = state;
  s.segments = Array.from({ length: NUM_SEGMENTS }, () => ({ points: [], alpha: 100 }));
  s.tempSegment = { points: [] };
  s.currentSegment = 0;
  s.lastPathTime = s.time;
  s.lastAnomaly = s.anomaly;
  s.lastSunAngle = s.sunAngle;
  s.lastPathPlanetX = s.planetX;
  s.lastPathPlanetY = s.planetY;
  s.pathTimeCounter = 0;
}

function setPathTime(years) {
  state.pathTime = years * DAYS_PER_YEAR;
  state.zodiac.ghostingTime = state.pathTime;
  clearPath();
}

function clearPath() {
  resetPathMC();
  clearZodiacGhosting();
}

function updatePath() {
  const s = state;
  const sampInt = SAMPLING_INTERVAL;
  const numSegs = NUM_SEGMENTS;
  const eqAngle = s.equantAngle, defR = DEFERENT_RADIUS, epiR = s.epicycleRadius;
  let anomaly = s.lastAnomaly, sunAngle = s.lastSunAngle;
  const anomalyStep = sampInt * s.anomalyRate;
  const sunAngleStep = sampInt * SUN_RATE;
  const timePerSeg = s.pathTime / numSegs;
  const k = s.equantDistance / defR;
  const dt = s.time - s.lastPathTime;
  const numSteps = Math.floor(dt / sampInt);
  let lastPlaX = s.lastPathPlanetX, lastPlaY = s.lastPathPlanetY;
  if (lastPlaX == null) { lastPlaX = s.planetX; lastPlaY = s.planetY; }

  const lonArray = [];
  let cs = s.currentSegment;
  let seg = s.segments[cs];
  // AS does moveTo(lastPla) here WITHOUT clearing -- Flash vector drawing is
  // cumulative, so the current segment keeps the points drawn on previous
  // frames and we only append. (It is wiped by mc.clear() when cs advances,
  // below.) Seed the origin only if this segment was just reset/empty.
  if (seg.points.length === 0) seg.points.push([lastPlaX, lastPlaY]);
  let timeCounter = s.pathTimeCounter;
  const isSup = s.isSuperiorPlanet;

  for (let i = 0; i < numSteps; i++) {
    anomaly += anomalyStep;
    sunAngle += sunAngleStep;
    timeCounter += sampInt;
    if (timeCounter > timePerSeg) {
      timeCounter %= timePerSeg;
      cs = (cs + 1) % numSegs;
      seg = s.segments[cs];
      seg.points = [[lastPlaX, lastPlaY]];
    }
    let alpha, angle, beta, k2, epiX, epiY, plaX, plaY;
    if (isSup) {
      alpha = anomaly - eqAngle;
      k2 = clamp1(k * Math.sin(Math.PI - alpha));
      beta = alpha - Math.asin(k2);
      angle = eqAngle + beta;
      epiX = s.deferentX + defR * Math.cos(angle);
      epiY = -(s.deferentY + defR * Math.sin(angle));
      plaX = epiX + epiR * Math.cos(sunAngle);
      plaY = epiY + (-epiR) * Math.sin(sunAngle);
    } else {
      alpha = sunAngle - eqAngle;
      k2 = clamp1(k * Math.sin(Math.PI - alpha));
      beta = alpha - Math.asin(k2);
      angle = eqAngle + beta;
      epiX = s.deferentX + defR * Math.cos(angle);
      epiY = -(s.deferentY + defR * Math.sin(angle));
      plaX = epiX + epiR * Math.cos(anomaly);
      plaY = epiY + (-epiR) * Math.sin(anomaly);
    }
    const lon = Math.atan2(plaY - EARTH_Y, plaX - EARTH_X);
    lonArray.push(lon);
    seg.points.push([plaX, plaY]);
    lastPlaX = plaX; lastPlaY = plaY;
  }

  s.lonArray = lonArray;
  s.lastPathPlanetX = lastPlaX;
  s.lastPathPlanetY = lastPlaY;
  s.currentSegment = cs;
  s.pathTimeCounter = timeCounter;

  s.tempSegment = { points: [[lastPlaX, lastPlaY], [s.planetX, s.planetY]] };

  const alphaStep = 100 / numSegs;
  let a = alphaStep;
  for (let i = 0; i < numSegs; i++) {
    s.segments[(cs + i + 1) % numSegs].alpha = a;
    a += alphaStep;
  }
  s.lastPathTime += numSteps * sampInt;
  s.lastAnomaly = anomaly;
  s.lastSunAngle = sunAngle;
}

/* -------------------------------------------------------------------
   4.  Zodiac strip -- ported from ZodiacStripClass
   ------------------------------------------------------------------- */
function clearZodiacGhosting() {
  const z = state.zodiac;
  z.segments = Array.from({ length: NUM_SEGMENTS }, () => ({ points: [], color: '#d8d8d8', alpha: STRIP_MIN_ALPHA + STRIP_ALPHA_SPREAD }));
  z.tempSegment = { points: [], color: '#d8d8d8', alpha: STRIP_MIN_ALPHA + STRIP_ALPHA_SPREAD };
  z.currentSegment = 0;
  z.timeCounter = 0;
  z.lastPlanetX = null;
}

function stripColorForZ(zVal) {
  const Z = zVal < 0 ? 0 : zVal;
  const C = Math.floor(216 - 112 * Z);
  const R = Math.min(255, 21 + C);
  return `rgb(${R},${C},${C})`;
}

function setSunLongitude(lon) {
  state.zodiacSunX = (((lon * (STRIP_WIDTH / TWO_PI)) % STRIP_WIDTH) + STRIP_WIDTH) % STRIP_WIDTH;
}

function setPlanetLongitude(lon, lonList) {
  const z = state.zodiac;
  const w = STRIP_WIDTH, hw = w / 2;
  let cs = z.currentSegment;
  const numSegs = NUM_SEGMENTS;
  const sampInt = SAMPLING_INTERVAL;
  const timePerSeg = (state.zodiac.ghostingTime || state.pathTime) / numSegs;
  const n = lonList.length;
  let lastX = z.lastPlanetX;
  if (lastX == null) lastX = (((lon * (w / TWO_PI)) % w) + w) % w;
  const q1 = 150, q2 = w - q1;
  let timeCounter = z.timeCounter;
  let seg = z.segments[cs];
  // Do NOT clear here -- like the AS, the current strip segment accumulates its
  // filled spans across frames and is only wiped by mc.clear() when cs advances.

  function pushSpan(mcSeg, xFrom, xNow, color) {
    if (xNow > q2 && xFrom < q1) {
      mcSeg.points.push({ a: xFrom, b: 0, color });
      mcSeg.points.push({ a: xNow, b: w, color });
    } else if (xNow < q1 && xFrom > q2) {
      mcSeg.points.push({ a: xNow, b: 0, color });
      mcSeg.points.push({ a: xFrom, b: w, color });
    } else {
      mcSeg.points.push({ a: xFrom, b: xNow, color });
    }
  }

  let newColor = z.lastColor;
  for (let i = 0; i < n; i++) {
    timeCounter += sampInt;
    if (timeCounter > timePerSeg) {
      timeCounter %= timePerSeg;
      cs = (cs + 1) % numSegs;
      seg = z.segments[cs];
      seg.points = [];
    }
    const xNow = (((lonList[i] * (w / TWO_PI)) % w) + w) % w;
    let dX = (((xNow - lastX) % w) + w) % w;
    if (dX > hw) dX = w - dX;
    const Zv = 1 - dX / 3;
    newColor = stripColorForZ(Zv);
    pushSpan(seg, lastX, xNow, newColor);
    lastX = xNow;
  }
  z.lastColor = newColor;

  const xNow = (((lon * (w / TWO_PI)) % w) + w) % w;
  z.tempSegment = { points: [], color: newColor };
  pushSpan(z.tempSegment, lastX, xNow, newColor);

  const alphaStep = STRIP_ALPHA_SPREAD / numSegs;
  for (let i = 0; i < numSegs; i++) {
    z.segments[(cs + i + 1) % numSegs].alpha = STRIP_MIN_ALPHA + i * alphaStep;
  }
  z.timeCounter = timeCounter;
  z.currentSegment = cs;
  z.lastPlanetX = lastX;
  state.zodiacPlanetX = xNow;
}

function updateZodiacStrip() {
  setSunLongitude(-state.sunAngle);
  setPlanetLongitude(state.planetLongitude, state.lonArray);
}

/* -------------------------------------------------------------------
   5.  Presets / reset / memory -- ported from frame_1/DoAction.as
   ------------------------------------------------------------------- */
function updateSys() {
  update();
  updatePath();
  updateZodiacStrip();
}

function applyPreset(p) {
  setEpicycleRadius(p.epicycleRadius * 100);
  setEccentricity(p.eccentricity * 100);
  setApogeeAngleDeg(p.apogeeAngle);
  setAnomalyRateDeg(p.motionRate);
  setPlanetType(p.planetType);
  updateSys();
}

function setPresetsFromSelect() {
  state.currentlySettingPresets = true;
  const idx = Number(ui.presetSelect.value);
  applyPreset(PLANET_DATA[idx]);
  syncControlsFromState();
  state.currentlySettingPresets = false;
  setOkEnabled(false);
}

function doReset() {
  if (state.animating) toggleAnimation();
  setRecallEnabled(false);
  state.anomaly = 0;
  state.sunAngle = 0;
  ui.presetSelect.value = '1';   // Mars
  setPresetsFromSelect();
  ui.animationRateSlider.value = '100';
  changeAnimationRate(100);
  ui.pathDurationSlider.value = '2.5';
  changePathTime(2.5);
  setCheck('showEpicycleCheck', true);
  setCheck('showDeferentCheck', true);
  setCheck('showPlanetVectorCheck', false);
  setCheck('showEquantVectorCheck', false);
  setCheck('showEarthSunLineCheck', false);
  setCheck('showEpicyclePlanetLineCheck', false);
  announce('liveStatus', 'Simulation reset. Preset: Mars.');
  render();
}

function memoryStore() {
  state.memory = {
    eccentricity: Number(ui.eccentricitySlider.value),
    epicycleRadius: Number(ui.epicycleSlider.value),
    apogeeAngle: Number(ui.apogeeSlider.value),
    motionRate: Number(ui.motionRateSlider.value),
    planetType: getPlanetTypeValue(),
    anomaly: state.anomaly,
    sunAngle: state.sunAngle
  };
  setRecallEnabled(true);
  announce('liveStatus', 'Current parameters stored to memory.');
}

function memoryRecall() {
  if (!state.memory) return;
  if (state.animating) toggleAnimation();
  state.currentlySettingPresets = true;
  const m = state.memory;
  state.anomaly = m.anomaly;
  state.sunAngle = m.sunAngle;
  setEpicycleRadius(m.epicycleRadius * 100);
  setEccentricity(m.eccentricity * 100);
  setApogeeAngleDeg(m.apogeeAngle);
  setAnomalyRateDeg(m.motionRate);
  setPlanetType(m.planetType);
  updateSys();
  setPlanetTypeValue(m.planetType);
  ui.eccentricitySlider.value = String(m.eccentricity);
  ui.apogeeSlider.value = String(m.apogeeAngle);
  ui.motionRateSlider.value = String(m.motionRate);
  ui.epicycleSlider.value = String(m.epicycleRadius);
  state.currentlySettingPresets = false;
  setOkEnabled(true);
  refreshReadouts();
  announce('liveStatus', 'Parameters recalled from memory.');
  render();
}

/* =====================================================================
   6.  DOM wiring
   ===================================================================== */
const ui = {};
['orbitCanvas', 'zodiacCanvas', 'orbitWrap', 'stripWrap', 'zodiacRing', 'sunHandle',
  'stripMarkers', 'sunMarkerLabel', 'planetMarkerLabel', 'zodiacStripLabels',
  'presetSelect', 'presetOkButton', 'epicycleSlider', 'epicycleReadout',
  'eccentricitySlider', 'eccentricityReadout', 'motionRateSlider', 'motionRateReadout',
  'apogeeSlider', 'apogeeReadout', 'planetTypeSuperior', 'planetTypeInferior',
  'animateButton', 'animationRateSlider', 'animationRateReadout', 'pathDurationSlider', 'pathDurationReadout',
  'showDeferentCheck', 'showEpicycleCheck', 'showPlanetVectorCheck', 'showEquantVectorCheck',
  'showEarthSunLineCheck', 'showEpicyclePlanetLineCheck',
  'memoryStoreButton', 'memoryRecallButton', 'orbitDesc', 'zodiacDesc',
  'liveStatus', 'liveAlert', 'keyInfo'
].forEach(id => { ui[id] = document.getElementById(id); });

const orbitCtx = ui.orbitCanvas.getContext('2d');
const zodiacCtx = ui.zodiacCanvas.getContext('2d');

function announce(regionId, text) {
  ui[regionId].textContent = '';
  // Force a DOM mutation even if the text is repeated, so AT re-announces.
  // setTimeout (not requestAnimationFrame) so this still fires in a
  // backgrounded/hidden tab, where rAF callbacks are suspended.
  setTimeout(() => { ui[regionId].textContent = text; }, 0);
}

function getPlanetTypeValue() { return ui.planetTypeSuperior.checked ? 'superior' : 'inferior'; }
function setPlanetTypeValue(v) {
  ui.planetTypeSuperior.checked = v === 'superior';
  ui.planetTypeInferior.checked = v === 'inferior';
}
function setOkEnabled(v) { ui.presetOkButton.disabled = !v; }
function setRecallEnabled(v) { ui.memoryRecallButton.disabled = !v; }
function setCheck(id, v) { document.getElementById(id).checked = v; syncVisibilityFromChecks(); }

function syncVisibilityFromChecks() {
  state.showDeferent = ui.showDeferentCheck.checked;
  state.showEpicycle = ui.showEpicycleCheck.checked;
  state.showPlanetVector = ui.showPlanetVectorCheck.checked;
  state.showEquantVector = ui.showEquantVectorCheck.checked;
  state.showEarthSunLine = ui.showEarthSunLineCheck.checked;
  state.showEpicyclePlanetLine = ui.showEpicyclePlanetLineCheck.checked;
}

function syncControlsFromState() {
  ui.eccentricitySlider.value = String(state.eccentricity / 100);
  ui.apogeeSlider.value = String(state.apogeeAngle / DEG2RAD);
  ui.motionRateSlider.value = String(state.anomalyRate / DEG2RAD);
  ui.epicycleSlider.value = String(state.epicycleRadius / 100);
  setPlanetTypeValue(state.isSuperiorPlanet ? 'superior' : 'inferior');
  refreshReadouts();
}

/* -------------------------------------------------------------------
   7.  MathJax rendering helper (all math/values go through MathJax,
       with a readable plain-text fallback if the library is absent).
   ------------------------------------------------------------------- */
const mjQueue = new Set();
let mjTimer = null;
function mjSet(el, latex, plainText) {
  if (!el) return;
  el.dataset.plain = plainText;
  el.textContent = plainText;   // immediate readable fallback
  el.dataset.latex = latex;
  mjQueue.add(el);
  if (mjTimer) return;
  mjTimer = setTimeout(flushMathJax, 60);
}
function flushMathJax() {
  mjTimer = null;
  if (!(window.MathJax && MathJax.typesetPromise)) return;
  const els = Array.from(mjQueue);
  mjQueue.clear();
  els.forEach(el => { el.innerHTML = '\\(' + el.dataset.latex + '\\)'; });
  MathJax.typesetPromise(els).catch(err => console.error(err));
}

function refreshReadouts() {
  const apogee = Number(ui.apogeeSlider.value);
  const ecc = Number(ui.eccentricitySlider.value);
  const motion = Number(ui.motionRateSlider.value);
  const epi = Number(ui.epicycleSlider.value);
  const path = Number(ui.pathDurationSlider.value);

  mjSet(ui.apogeeReadout, apogee.toFixed(1) + '^{\\circ}', apogee.toFixed(1) + '°');
  mjSet(ui.eccentricityReadout, ecc.toFixed(2), ecc.toFixed(2));
  mjSet(ui.motionRateReadout, motion.toFixed(2) + '^{\\circ}/\\text{day}', motion.toFixed(2) + '°/day');
  mjSet(ui.epicycleReadout, epi.toFixed(2), epi.toFixed(2));
  mjSet(ui.pathDurationReadout, path.toFixed(2) + '\\ \\text{yr}', path.toFixed(2) + ' yr');
  const rate = Number(ui.animationRateSlider.value);
  mjSet(ui.animationRateReadout, rate.toFixed(0), rate.toFixed(0));

  ui.apogeeSlider.setAttribute('aria-valuetext', `apogee angle ${apogee.toFixed(1)} degrees`);
  ui.eccentricitySlider.setAttribute('aria-valuetext', `eccentricity ${ecc.toFixed(2)}`);
  ui.motionRateSlider.setAttribute('aria-valuetext', `motion rate ${motion.toFixed(2)} degrees per day`);
  ui.epicycleSlider.setAttribute('aria-valuetext', `epicycle size ${epi.toFixed(2)}, a fraction of the deferent radius`);
  ui.pathDurationSlider.setAttribute('aria-valuetext', `path duration ${path.toFixed(2)} years`);
  ui.animationRateSlider.setAttribute('aria-valuetext', `animation rate ${Number(ui.animationRateSlider.value).toFixed(0)}`);
}

/* -------------------------------------------------------------------
   8.  Preloaded reused assets (exported vector shapes -- drawn AS-IS,
       never redrawn by hand). See html5/assets/.
   ------------------------------------------------------------------- */
const ASSETS = {};
const ASSET_FILES = {
  circle: 'assets/circle.svg',              // unit circle, r=100, used for deferent/epicycle
  earth: 'assets/earth.svg',
  planet: 'assets/planet.svg',
  sun: 'assets/sun.svg',
  deferentCenter: 'assets/deferent-center.svg',
  equantPoint: 'assets/equant-point.svg'
};
let assetsReady = false;
Promise.all(Object.entries(ASSET_FILES).map(([key, src]) => new Promise(resolve => {
  const img = new Image();
  img.onload = () => { ASSETS[key] = img; resolve(); };
  img.onerror = () => resolve();
  img.src = src;
}))).then(() => { assetsReady = true; render(); });

/* -------------------------------------------------------------------
   9.  Rendering -- Orbit View
   ------------------------------------------------------------------- */
function toPx(x, y) { return [ORBIT_CENTER + x, ORBIT_CENTER + y]; }

function drawCircleAsset(ctx, cx, cy, radius) {
  if (!ASSETS.circle) return;
  const [px, py] = toPx(cx, cy);
  ctx.drawImage(ASSETS.circle, px - radius, py - radius, radius * 2, radius * 2);
}
function drawMarkerAsset(ctx, key, x, y) {
  const img = ASSETS[key];
  const [px, py] = toPx(x, y);
  if (!img) { ctx.beginPath(); ctx.arc(px, py, 3, 0, TWO_PI); ctx.fill(); return; }
  ctx.drawImage(img, px - img.naturalWidth / 2, py - img.naturalHeight / 2);
}
function drawLine(ctx, x1, y1, x2, y2, color, width) {
  const [px1, py1] = toPx(x1, y1), [px2, py2] = toPx(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  ctx.beginPath();
  ctx.moveTo(px1, py1);
  ctx.lineTo(px2, py2);
  ctx.stroke();
}

function drawZodiacRingReference(ctx) {
  ctx.strokeStyle = REFERENCE_LINE_COLOR;
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = i * 30 * DEG2RAD;
    const x1 = ZODIAC_TICK_R1 * Math.cos(a), y1 = -ZODIAC_TICK_R1 * Math.sin(a);
    const x2 = ZODIAC_TICK_R2 * Math.cos(a), y2 = -ZODIAC_TICK_R2 * Math.sin(a);
    drawLine(ctx, x1, y1, x2, y2, REFERENCE_LINE_COLOR, 1);
  }
}

function drawPathSegments(ctx, segments, tempSegment, colorHex, scale) {
  segments.forEach(seg => {
    if (seg.points.length < 2) return;
    ctx.globalAlpha = (seg.alpha / 100) * (scale == null ? 1 : scale);
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [p0x, p0y] = toPx(seg.points[0][0], seg.points[0][1]);
    ctx.moveTo(p0x, p0y);
    for (let i = 1; i < seg.points.length; i++) {
      const [px, py] = toPx(seg.points[i][0], seg.points[i][1]);
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  if (tempSegment && tempSegment.points.length >= 2) {
    ctx.strokeStyle = TEMP_SEGMENT_COLOR;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [p0x, p0y] = toPx(tempSegment.points[0][0], tempSegment.points[0][1]);
    ctx.moveTo(p0x, p0y);
    const [p1x, p1y] = toPx(tempSegment.points[1][0], tempSegment.points[1][1]);
    ctx.lineTo(p1x, p1y);
    ctx.stroke();
  }
}

function renderOrbit() {
  const ctx = orbitCtx;
  ctx.clearRect(0, 0, ORBIT_SIZE, ORBIT_SIZE);
  drawZodiacRingReference(ctx);

  drawPathSegments(ctx, state.segments, state.tempSegment, PATH_COLOR);

  // deferentY / equantY are stored in the AS's math convention (Y-up); the
  // stage is Y-down, so they are NEGATED when placed on screen -- exactly as
  // AS updateLayout does (_deferentMC._y = -_deferentY, _equantPointMC._y =
  // -_equantY). Without this the earth/deferent/equant stack is flipped.
  if (state.showDeferent) drawCircleAsset(ctx, state.deferentX, -state.deferentY, DEFERENT_RADIUS);
  if (state.showEpicycle) drawCircleAsset(ctx, state.epicycleX, state.epicycleY, state.epicycleRadius);

  if (state.showEquantVector) drawLine(ctx, state.equantX, -state.equantY, state.epicycleX, state.epicycleY, CONNECT_LINE_COLOR);
  if (state.showEpicyclePlanetLine) drawLine(ctx, state.epicycleX, state.epicycleY, state.planetX, state.planetY, CONNECT_LINE_COLOR);
  if (state.showEarthSunLine) drawLine(ctx, EARTH_X, EARTH_Y, state.sunX, state.sunY, CONNECT_LINE_COLOR);
  if (state.showPlanetVector) {
    const lon = state.planetLongitude;
    drawLine(ctx, 0, 0, PLANET_VECTOR_RADIUS * Math.cos(lon), PLANET_VECTOR_RADIUS * Math.sin(lon), CONNECT_LINE_COLOR);
  }

  drawMarkerAsset(ctx, 'deferentCenter', state.deferentX, -state.deferentY);
  drawMarkerAsset(ctx, 'equantPoint', state.equantX, -state.equantY);
  drawMarkerAsset(ctx, 'earth', EARTH_X, EARTH_Y);
  drawMarkerAsset(ctx, 'sun', state.sunX, state.sunY);
  drawMarkerAsset(ctx, 'planet', state.planetX, state.planetY);

  // position the focusable Sun drag-handle exactly on the sun marker
  const sunPct = [(ORBIT_CENTER + state.sunX) / ORBIT_SIZE * 100, (ORBIT_CENTER + state.sunY) / ORBIT_SIZE * 100];
  ui.sunHandle.style.left = sunPct[0] + '%';
  ui.sunHandle.style.top = sunPct[1] + '%';
  const sunDeg = ((state.sunAngle / DEG2RAD) % 360 + 360) % 360;
  ui.sunHandle.setAttribute('aria-valuenow', sunDeg.toFixed(1));
  ui.sunHandle.setAttribute('aria-valuetext', `Sun ecliptic longitude ${sunDeg.toFixed(1)} degrees`);
}

/* -------------------------------------------------------------------
   10. Rendering -- Zodiac Strip
   ------------------------------------------------------------------- */
/* Strip x is already in logical strip units (0..STRIP_WIDTH), which is also the
   canvas's LOGICAL coordinate space (the backing store is dpr-scaled via the
   context transform, so drawing code always works in logical units). */
function stripToPx(x) { return x; }

function drawStripSpans(ctx, segments, tempSegment) {
  const yScale = STRIP_HEIGHT / (STRIP_HALF_HEIGHT * 2);
  const midY = STRIP_HEIGHT / 2;
  const h = STRIP_HALF_HEIGHT * yScale;
  segments.forEach(seg => {
    ctx.globalAlpha = seg.alpha / 100;
    seg.points.forEach(span => {
      const a = stripToPx(span.a), b = stripToPx(span.b);
      ctx.fillStyle = span.color;
      ctx.fillRect(Math.min(a, b), midY - h, Math.abs(b - a), h * 2);
    });
  });
  ctx.globalAlpha = 1;
  if (tempSegment) {
    tempSegment.points.forEach(span => {
      const a = stripToPx(span.a), b = stripToPx(span.b);
      ctx.fillStyle = span.color;
      ctx.fillRect(Math.min(a, b), midY - h, Math.abs(b - a), h * 2);
    });
  }
}

function renderZodiacStrip() {
  const ctx = zodiacCtx;
  ctx.clearRect(0, 0, STRIP_WIDTH, STRIP_HEIGHT);
  drawStripSpans(ctx, state.zodiac.segments, state.zodiac.tempSegment);

  const sunPct = (state.zodiacSunX || 0) / STRIP_WIDTH * 100;
  const planetPct = (state.zodiacPlanetX || 0) / STRIP_WIDTH * 100;
  ui.sunMarkerLabel.style.left = sunPct + '%';
  ui.planetMarkerLabel.style.left = planetPct + '%';
}

/* -------------------------------------------------------------------
   11. Static ring / strip zodiac labels (built once -- real HTML text,
       positioned with percentages so they scale without JS on resize)
   ------------------------------------------------------------------- */
function buildZodiacRingLabels() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 12; i++) {
    const a = (15 + i * 30) * DEG2RAD;
    const x = ZODIAC_RING_RADIUS * Math.cos(a);
    const y = -ZODIAC_RING_RADIUS * Math.sin(a);
    const leftPct = (ORBIT_CENTER + x) / ORBIT_SIZE * 100;
    const topPct = (ORBIT_CENTER + y) / ORBIT_SIZE * 100;
    const el = document.createElement('span');
    el.className = 'sim-zodiac-symbol';
    el.style.left = leftPct + '%';
    el.style.top = topPct + '%';
    el.innerHTML = `<span class="sim-zodiac-symbol__glyph">${ZODIAC_GLYPHS[i]}</span><span class="sim-zodiac-symbol__name">${ZODIAC_NAMES[i]}</span>`;
    frag.appendChild(el);
  }
  ui.zodiacRing.appendChild(frag);
}

function buildZodiacStripLabels() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 12; i++) {
    const xpos = STRIP_WIDTH - (15 + i * 30) * (STRIP_WIDTH / 360);
    const leftPct = xpos / STRIP_WIDTH * 100;
    const el = document.createElement('span');
    el.className = 'sim-zodiac-strip-label';
    el.style.left = leftPct + '%';
    el.innerHTML = `<span class="sim-zodiac-strip-label__glyph">${ZODIAC_GLYPHS[i]}</span>` +
      `<span class="sim-zodiac-strip-label__name">${ZODIAC_NAMES[i]}</span>`;
    frag.appendChild(el);
  }
  ui.zodiacStripLabels.appendChild(frag);
}

/* -------------------------------------------------------------------
   12. Accessible descriptions (throttled while animating, immediate
       when paused/user-driven -- see ACCESSIBILITY.md).
   ------------------------------------------------------------------- */
let lastDescUpdate = 0;
function nearestZodiacSign(lonRad) {
  // Ring symbol i sits at true angle (15+30i) deg, so its 30-deg-wide zone
  // is exactly [30i, 30i+30) -- convert the (screen-convention) longitude
  // back to true angle first (see updateZodiacStrip's -sunAngle negation).
  const deg = (((-lonRad) / DEG2RAD) % 360 + 360) % 360;
  const idx = Math.floor(deg / 30) % 12;
  return ZODIAC_NAMES[idx];
}

function updateDescriptions(force) {
  const now = performance.now();
  if (!force && state.animating && now - lastDescUpdate < 2000) return;
  lastDescUpdate = now;

  const sunDeg = ((state.sunAngle / DEG2RAD) % 360 + 360) % 360;
  const planetDeg = (((-state.planetLongitude) / DEG2RAD) % 360 + 360) % 360;
  const sunSign = nearestZodiacSign(-state.sunAngle);
  const planetSign = nearestZodiacSign(state.planetLongitude);
  const type = state.isSuperiorPlanet ? 'superior' : 'inferior';

  // Lead with WHERE THE SUN AND PLANET ARE (sign + longitude) so an audio-only
  // user hears the sky positions up front, not only at the very end of the page.
  ui.orbitDesc.textContent =
    `Sun in ${sunSign}, ecliptic longitude ${sunDeg.toFixed(1)} degrees. ` +
    `Planet in ${planetSign}, ecliptic longitude ${planetDeg.toFixed(1)} degrees. ` +
    `Planet type ${type}. Deferent radius ${DEFERENT_RADIUS} units, eccentricity ${(state.eccentricity / 100).toFixed(2)}, ` +
    `apogee angle ${(state.apogeeAngle / DEG2RAD).toFixed(1)} degrees, epicycle size ${(state.epicycleRadius / 100).toFixed(2)}. ` +
    `Animation ${state.animating ? 'running' : 'paused'}.`;

  ui.zodiacDesc.textContent =
    `Sun in ${sunSign}, ecliptic longitude ${sunDeg.toFixed(1)} degrees. ` +
    `Planet in ${planetSign}, ecliptic longitude ${planetDeg.toFixed(1)} degrees, ` +
    `trailing a fading path of its recent motion.`;
}

/* -------------------------------------------------------------------
   13. render() -- the single redraw entry point (canvas + DOM + a11y)
   ------------------------------------------------------------------- */
function render(force) {
  if (!assetsReady) return;
  renderOrbit();
  renderZodiacStrip();
  updateDescriptions(force);
}

/* -------------------------------------------------------------------
   14. Animation loop -- requestAnimationFrame, elapsed wall-clock time
       (ports onEnterFrameFunc: getTimer() -> performance.now())
   ------------------------------------------------------------------- */
function tick(now) {
  if (state.animating) {
    const dtMs = now - state.timeLast;
    const dtDays = state.animationRate * dtMs;
    state.time += dtDays;
    state.anomaly += state.anomalyRate * dtDays;
    state.sunAngle += SUN_RATE * dtDays;
    update();
    updatePath();
    updateZodiacStrip();
    state.timeLast = now;
    render();
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* -------------------------------------------------------------------
   15. Control handlers
   ------------------------------------------------------------------- */
function changeAnimationRate(sliderVal) { state.animationRate = sliderVal / 1000; }
function changePathTime(years) { setPathTime(years); }

function toggleAnimation() {
  state.animating = !state.animating;
  state.timeLast = performance.now();
  ui.animateButton.textContent = state.animating ? 'pause animation' : 'start animation';
  announce('liveStatus', state.animating ? 'Animation started.' : 'Animation paused.');
  updateDescriptions(true);
}

ui.animateButton.addEventListener('click', toggleAnimation);

ui.presetSelect.addEventListener('change', () => { setOkEnabled(true); });
ui.presetOkButton.addEventListener('click', () => {
  setPresetsFromSelect();
  announce('liveStatus', `Preset loaded: ${PLANET_DATA[Number(ui.presetSelect.value)].name}.`);
  render(true);
});

function wireContinuousSlider(input, onCommit, describe) {
  const handler = () => {
    if (!state.currentlySettingPresets) setOkEnabled(true);
    onCommit(Number(input.value));
    updateSys();
    refreshReadouts();
    render();
  };
  input.addEventListener('input', handler);
  input.addEventListener('change', () => { announce('liveStatus', describe(Number(input.value))); updateDescriptions(true); });
}
wireContinuousSlider(ui.epicycleSlider, v => setEpicycleRadius(v * 100), v => `Epicycle size ${v.toFixed(2)}.`);
wireContinuousSlider(ui.eccentricitySlider, v => setEccentricity(v * 100), v => `Eccentricity ${v.toFixed(2)}.`);
wireContinuousSlider(ui.motionRateSlider, v => setAnomalyRateDeg(v), v => `Motion rate ${v.toFixed(2)} degrees per day.`);
wireContinuousSlider(ui.apogeeSlider, v => setApogeeAngleDeg(v), v => `Apogee angle ${v.toFixed(1)} degrees.`);

ui.animationRateSlider.addEventListener('input', () => {
  changeAnimationRate(Number(ui.animationRateSlider.value));
  refreshReadouts();
});
ui.animationRateSlider.addEventListener('change', () => {
  announce('liveStatus', `Animation rate ${Number(ui.animationRateSlider.value).toFixed(0)}.`);
});

ui.pathDurationSlider.addEventListener('input', () => {
  changePathTime(Number(ui.pathDurationSlider.value));
  refreshReadouts();
  render();
});
ui.pathDurationSlider.addEventListener('change', () => {
  announce('liveStatus', `Path duration ${Number(ui.pathDurationSlider.value).toFixed(2)} years.`);
});

[ui.planetTypeSuperior, ui.planetTypeInferior].forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    if (!state.currentlySettingPresets) setOkEnabled(true);
    setPlanetType(radio.value);
    updateSys();
    render();
    announce('liveStatus', `Planet type set to ${radio.value}.`);
  });
});

['showDeferentCheck', 'showEpicycleCheck', 'showPlanetVectorCheck', 'showEquantVectorCheck',
  'showEarthSunLineCheck', 'showEpicyclePlanetLineCheck'].forEach(id => {
  ui[id].addEventListener('change', () => {
    syncVisibilityFromChecks();
    render();
    const labelText = document.querySelector(`label[for="${id}"]`).textContent.trim();
    announce('liveStatus', `${labelText}: ${ui[id].checked ? 'on' : 'off'}.`);
  });
});

ui.memoryStoreButton.addEventListener('click', memoryStore);
ui.memoryRecallButton.addEventListener('click', memoryRecall);

/* -------------------------------------------------------------------
   16. Sun drag -- pointer (canvas-relative offset math ported from
       New Sun.as onPress/onMouseMoveFunc) AND keyboard, both mutating
       the same state.
   ------------------------------------------------------------------- */
function pointerToLogical(evt) {
  const rect = ui.orbitWrap.getBoundingClientRect();
  const scale = ORBIT_SIZE / rect.width;
  const px = (evt.clientX - rect.left) * scale;
  const py = (evt.clientY - rect.top) * scale;
  return [px - ORBIT_CENTER, py - ORBIT_CENTER];
}

let sunAngleOffset = 0;
ui.sunHandle.addEventListener('pointerdown', evt => {
  ui.sunHandle.setPointerCapture(evt.pointerId);
  const [lx, ly] = pointerToLogical(evt);
  sunAngleOffset = Math.atan2(-ly, lx) - state.sunAngle;
  ui.sunHandle.focus();
});
ui.sunHandle.addEventListener('pointermove', evt => {
  if (evt.buttons !== 1) return;
  const [lx, ly] = pointerToLogical(evt);
  const angle = Math.atan2(-ly, lx) - sunAngleOffset;
  setSunAngle(angle);
  updateZodiacStrip();
  render();
});
ui.sunHandle.addEventListener('pointerup', () => {
  const deg = ((state.sunAngle / DEG2RAD) % 360 + 360) % 360;
  announce('liveStatus', `Sun in ${nearestZodiacSign(-state.sunAngle)}, ecliptic longitude ${deg.toFixed(1)} degrees.`);
  updateDescriptions(true);
});

const SUN_STEP = 1 * DEG2RAD, SUN_STEP_BIG = 10 * DEG2RAD;
ui.sunHandle.addEventListener('keydown', evt => {
  let delta = null;
  switch (evt.key) {
    case 'ArrowLeft': case 'ArrowDown': delta = -SUN_STEP; break;
    case 'ArrowRight': case 'ArrowUp': delta = SUN_STEP; break;
    case 'PageDown': delta = -SUN_STEP_BIG; break;
    case 'PageUp': delta = SUN_STEP_BIG; break;
    case 'Home': setSunAngle(0); break;
    case 'End': setSunAngle(TWO_PI); break;
    default: return;
  }
  evt.preventDefault();
  if (delta != null) setSunAngle(state.sunAngle + delta);
  render();
  const deg = ((state.sunAngle / DEG2RAD) % 360 + 360) % 360;
  announce('liveStatus', `Sun in ${nearestZodiacSign(-state.sunAngle)}, ecliptic longitude ${deg.toFixed(1)} degrees.`);
  updateDescriptions(true);
});

/* -------------------------------------------------------------------
   17. Key / legend panel -- replaces the Flash 5-tab icon key
       (DefineSprite_255) with accessible toggle buttons. Text is
       VERBATIM from DefineSprite_255/frame_1/DoAction.as `info[]`.
   ------------------------------------------------------------------- */
const KEY_INFO = {
  earth: "The earth. In Ptolemy's model the earth is stationary at the center.",
  planet: 'The planet, which in this model orbits the earth using a circle on circle construction. The large circle is the deferent and the small one is the epicycle.',
  sun: "The sun. Note that this icon indicates the sun's direction with respect to the earth, not its absolute position in space.",
  deferent: 'The center of the deferent (the larger circle on which the epicycle moves).',
  equant: 'The equant, which is the center of uniform motion of the epicycle around the deferent.'
};
document.querySelectorAll('.sim-key__tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sim-key__tab').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    ui.keyInfo.textContent = KEY_INFO[btn.dataset.key];
  });
});

/* -------------------------------------------------------------------
   18. Reduced motion / masthead reset wiring
   ------------------------------------------------------------------- */
document.querySelector('kl-unl-masthead').addEventListener('sim-reset', doReset);

/* -------------------------------------------------------------------
   19. MathJax equation setup hook (redefines the foundation default).
       This sim has no headline displayed equation, but every symbol
       shown (degrees, ratios, rates) is still typeset via mjSet()
       above, satisfying "every math symbol goes through MathJax".
   ------------------------------------------------------------------- */
window.klunlInitEqn = function () {};

/* -------------------------------------------------------------------
   20. Startup
   ------------------------------------------------------------------- */
/* Give each canvas a backing store at the DISPLAY's pixel density while keeping
   all drawing code in the original logical coordinate system (the context is
   pre-scaled by dpr). Without this the canvas is rasterised at CSS resolution
   and then scaled by the browser, which looks soft/fuzzy on HiDPI screens. */
let currentDpr = 1;
function initCanvasResolution() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  currentDpr = dpr;
  ui.orbitCanvas.width = Math.round(ORBIT_SIZE * dpr);
  ui.orbitCanvas.height = Math.round(ORBIT_SIZE * dpr);
  orbitCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ui.zodiacCanvas.width = Math.round(STRIP_WIDTH * dpr);
  ui.zodiacCanvas.height = Math.round(STRIP_HEIGHT * dpr);
  zodiacCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* Re-rasterise if the window moves to a display with a different pixel density
   (or the user zooms, which changes devicePixelRatio). */
window.addEventListener('resize', () => {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  if (Math.abs(dpr - currentDpr) > 0.01) { initCanvasResolution(); render(true); }
});

function boot() {
  initCanvasResolution();
  buildZodiacRingLabels();
  buildZodiacStripLabels();
  state.timeLast = performance.now();
  doReset();
}
boot();

// ---------------------------------------------------------------------------
// Vocab Flight: an ISEE vocabulary board game.
//
// Each turn shows a word; the player types a definition, which Grader scores
// as "mostly" (roll 2 dice), "somewhat" (roll 1 die) or "miss" (no move).
// The plane flies along a winding path to the finish.
//
// Board length: 2 dice average 7 and 1 die averages 3.5. Assuming roughly
// half of correct answers are "mostly", a correct answer moves ~5.25 spots.
// Simulated, 76 spots takes ~15 correct answers on average (about 14 if
// most answers are "mostly", 17 if most are "somewhat").
// ---------------------------------------------------------------------------

const BOARD_SPOTS = 76;           // spots to travel from START (0) to FINISH
const OFFER_END_AFTER_TURNS = 35; // after this many turns, offer to end early
const LS_RANGE_KEY = "vocab_flight_range_v1";

const EXTRA = window.EXTRA_ANSWERS || {};
const WORDS = window.WORD_BANK.map(([word, level, pos, def]) => ({ word, level, pos, def, extra: EXTRA[word] || "" }));

// ---- helpers -------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rollDie = () => 1 + Math.floor(Math.random() * 6);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
}
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

// ---- setup screen: dictionary-style range -----------------------------------

const prefix2 = (w) => w.slice(0, 2).toLowerCase();
const PREFIXES = [...new Set(WORDS.map((w) => prefix2(w.word)))].sort();

function wordsInRange(from, to) {
  if (from > to) [from, to] = [to, from];
  return WORDS.filter((w) => { const p = prefix2(w.word); return p >= from && p <= to; });
}

function renderSetup() {
  const fromSel = $("from-select"), toSel = $("to-select");
  const firstWord = (p) => WORDS.find((w) => prefix2(w.word) === p).word;
  const options = PREFIXES.map((p) => `<option value="${p}">${p.toUpperCase()}  (${firstWord(p)}…)</option>`).join("");
  fromSel.innerHTML = options;
  toSel.innerHTML = options;
  const saved = load(LS_RANGE_KEY);
  fromSel.value = saved && PREFIXES.includes(saved.from) ? saved.from : PREFIXES[0];
  toSel.value = saved && PREFIXES.includes(saved.to) ? saved.to : PREFIXES[PREFIXES.length - 1];
  fromSel.onchange = toSel.onchange = updateRangeSummary;
  updateRangeSummary();
}

function updateRangeSummary() {
  const from = $("from-select").value, to = $("to-select").value;
  const words = wordsInRange(from, to);
  const [a, b] = from <= to ? [from, to] : [to, from];
  $("range-summary").innerHTML = `<b>${words.length}</b> words from <b>${a.toUpperCase()}</b> to <b>${b.toUpperCase()}</b>`;
  $("word-preview").innerHTML = words.map((w) => `<div>${w.word}</div>`).join("");
  $("start-btn").disabled = words.length === 0;
  store(LS_RANGE_KEY, { from, to });
}

// ---- board ------------------------------------------------------------------

const SVG_NS = "http://www.w3.org/2000/svg";
let boardPath = null;     // the winding <path>
let spotLengths = [];     // distance along the path for each spot index
let planeEl = null;

function svg(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

// A serpentine path: five wavy rows joined by U-turns, starting bottom-left
// and finishing top-right.
function windingPathD() {
  const rows = [565, 445, 325, 205, 85];
  const left = 90, right = 910, wave = 16, segs = 4;
  const segW = (right - left) / segs;
  let d = `M ${left - 40} ${rows[0]} L ${left} ${rows[0]}`;
  rows.forEach((y, r) => {
    const goingRight = r % 2 === 0;
    for (let s = 0; s < segs; s++) {
      const x0 = goingRight ? left + s * segW : right - s * segW;
      const x1 = goingRight ? x0 + segW : x0 - segW;
      const bump = (s % 2 === 0 ? -wave : wave);
      d += ` C ${x0 + (x1 - x0) / 3} ${y + bump}, ${x0 + 2 * (x1 - x0) / 3} ${y + bump}, ${x1} ${y}`;
    }
    if (r < rows.length - 1) {
      const x = goingRight ? right : left;
      d += ` A 60 60 0 0 ${goingRight ? 0 : 1} ${x} ${rows[r + 1]}`;
    }
  });
  d += ` L ${right + 40} ${rows[rows.length - 1]}`;
  return d;
}

const PLANE_SVG = `
  <g transform="scale(1.35)">
    <ellipse cx="2" cy="3" rx="20" ry="5" fill="rgba(0,0,0,0.15)"/>
    <path d="M 2 -2 L -7 -17 L -12 -17 L -5 -2 Z" fill="#ff6b35" stroke="#fff" stroke-width="1"/>
    <path d="M 2 2 L -7 17 L -12 17 L -5 2 Z" fill="#ff6b35" stroke="#fff" stroke-width="1"/>
    <path d="M -13 -2 L -18 -8 L -21 -8 L -18 -2 Z" fill="#ff6b35"/>
    <path d="M -13 2 L -18 8 L -21 8 L -18 2 Z" fill="#ff6b35"/>
    <path d="M -19 -3 L 11 -3 Q 20 0 11 3 L -19 3 Q -21 0 -19 -3 Z" fill="#fff" stroke="#10304f" stroke-width="1.2"/>
    <circle cx="10" cy="0" r="1.6" fill="#5aa9e6"/>
  </g>`;

function buildBoard() {
  const board = $("board");
  board.innerHTML = "";

  // scenery: clouds and a few landmarks
  const clouds = [[180, 140], [560, 30], [820, 380], [300, 500], [650, 265], [120, 380]];
  clouds.forEach(([x, y]) => {
    const g = svg("g", { opacity: 0.85, transform: `translate(${x} ${y})` }, board);
    svg("ellipse", { cx: 0, cy: 0, rx: 34, ry: 14, fill: "#fff" }, g);
    svg("ellipse", { cx: -18, cy: 4, rx: 22, ry: 11, fill: "#fff" }, g);
    svg("ellipse", { cx: 20, cy: 4, rx: 24, ry: 11, fill: "#fff" }, g);
  });
  [["🏝️", 450, 520], ["⛰️", 860, 160], ["🌈", 230, 285], ["🏰", 720, 400], ["🎈", 500, 628]].forEach(([e, x, y]) => {
    const t = svg("text", { x, y, "font-size": 34, "text-anchor": "middle" }, board);
    t.textContent = e;
  });

  const d = windingPathD();
  svg("path", { d, fill: "none", stroke: "rgba(16,48,79,0.18)", "stroke-width": 34, "stroke-linecap": "round", transform: "translate(0 4)" }, board);
  boardPath = svg("path", { d, fill: "none", stroke: "#fff", "stroke-width": 30, "stroke-linecap": "round" }, board);
  svg("path", { d, fill: "none", stroke: "#cfe6f7", "stroke-width": 2, "stroke-dasharray": "10 10" }, board);

  // spots evenly spaced along the path (leaving room for the START/FINISH pads)
  const total = boardPath.getTotalLength();
  const startAt = 40, endAt = total - 40;
  spotLengths = [];
  for (let i = 0; i <= BOARD_SPOTS; i++) spotLengths.push(startAt + (endAt - startAt) * (i / BOARD_SPOTS));

  const spotsG = svg("g", { id: "spots" }, board);
  spotLengths.forEach((len, i) => {
    if (i === 0 || i === BOARD_SPOTS) return;
    const p = boardPath.getPointAtLength(len);
    const milestone = i % 10 === 0;
    svg("circle", { cx: p.x, cy: p.y, r: milestone ? 13 : 8, class: `spot${milestone ? " milestone" : ""}`, "data-i": i }, spotsG);
    if (milestone) {
      const t = svg("text", { x: p.x, y: p.y + 1, class: "spot-num" }, spotsG);
      t.textContent = i;
    }
  });

  // START and FINISH pads
  const s = boardPath.getPointAtLength(spotLengths[0]);
  // sits just below the path so the parked plane doesn't cover it
  svg("rect", { x: s.x - 34, y: s.y + 20, width: 68, height: 30, rx: 10, fill: "#1f9d55", stroke: "#fff", "stroke-width": 3 }, board);
  const st = svg("text", { x: s.x, y: s.y + 41, class: "board-label", style: "fill:#fff;font-size:15px" }, board);
  st.textContent = "START";

  const f = boardPath.getPointAtLength(spotLengths[BOARD_SPOTS]);
  const flag = svg("g", { transform: `translate(${f.x} ${f.y})` }, board);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      svg("rect", { x: -30 + c * 10, y: -20 + r * 10, width: 10, height: 10, fill: (r + c) % 2 ? "#10304f" : "#fff" }, flag);
    }
  }
  svg("rect", { x: -30, y: -20, width: 60, height: 40, fill: "none", stroke: "#10304f", "stroke-width": 2 }, flag);
  const fl = svg("text", { x: 0, y: -30, class: "board-label" }, flag);
  fl.textContent = "FINISH";

  planeEl = svg("g", { id: "plane" }, board);
  planeEl.innerHTML = PLANE_SVG;
  placePlaneAt(spotLengths[0], 1);
}

function placePlaneAt(len, scale) {
  const p = boardPath.getPointAtLength(len);
  const a = boardPath.getPointAtLength(Math.min(len + 2, boardPath.getTotalLength()));
  const b = boardPath.getPointAtLength(Math.max(len - 2, 0));
  const angle = Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
  planeEl.setAttribute("transform", `translate(${p.x} ${p.y}) rotate(${angle}) scale(${scale})`);
}

function markVisited(upTo) {
  document.querySelectorAll("#spots .spot").forEach((c) => {
    c.classList.toggle("visited", Number(c.dataset.i) <= upTo);
  });
}

// Fly hop-by-hop from one spot to another, with a little lift on each hop.
async function flyPlane(fromSpot, toSpot) {
  for (let i = fromSpot; i < toSpot; i++) {
    const a = spotLengths[i], b = spotLengths[i + 1];
    const dur = 300;
    await new Promise((resolve) => {
      const t0 = performance.now();
      function frame(now) {
        const t = Math.min(1, (now - t0) / dur);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        placePlaneAt(a + (b - a) * e, 1 + 0.35 * Math.sin(Math.PI * t));
        if (t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    markVisited(i + 1);
    $("hud-spot").textContent = i + 1;
  }
}

// ---- dice ---------------------------------------------------------------

// Rotation that brings each face to the front (faces laid out so opposite
// sides sum to 7).
const FACE_ROT = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

function dieHtml() {
  const faces = [1, 2, 3, 4, 5, 6].map((n) => {
    const pips = Array.from({ length: 9 }, (_, k) => (PIPS[n].includes(k + 1) ? `<div class="pip"></div>` : `<div></div>`)).join("");
    return `<div class="face f${n}">${pips}</div>`;
  }).join("");
  return `<div class="die" style="transform: rotateX(-20deg) rotateY(25deg)">${faces}</div>`;
}

async function animateDice(values) {
  const tray = $("dice-tray");
  tray.innerHTML = values.map(dieHtml).join("");
  const dice = [...tray.querySelectorAll(".die")];
  await sleep(50); // let the starting pose render so the transition plays
  dice.forEach((die, i) => {
    const [rx, ry] = FACE_ROT[values[i]];
    const spinsX = 2 + Math.floor(Math.random() * 2), spinsY = 2 + Math.floor(Math.random() * 2);
    die.style.transitionDuration = `${1.1 + i * 0.25}s`;
    die.style.transform = `rotateX(${rx + 360 * spinsX}deg) rotateY(${ry + 360 * spinsY}deg)`;
  });
  await sleep(1150 + (values.length - 1) * 250);
}

// ---- game state ---------------------------------------------------------------

let game = null;

function newGame(words) {
  game = {
    deck: shuffle(words),
    allWords: words,
    position: 0,
    turn: 0,
    correct: 0,
    mostly: 0,
    somewhat: 0,
    missed: new Map(),     // word -> entry, for the end-of-game review list
    offeredEnd: false,
    current: null,
    busy: false,
  };
}

// Pull the next word; refill from a fresh shuffle when the deck runs out.
function nextWord() {
  if (!game.deck.length) game.deck = shuffle(game.allWords);
  return game.deck.shift();
}

// Missed / half-right words go back into the deck at a random spot so they
// come up again unpredictably (never as the very next word).
function requeue(entry) {
  const i = game.deck.length ? 1 + Math.floor(Math.random() * game.deck.length) : 0;
  game.deck.splice(i, 0, entry);
}

function updateHud() {
  $("hud-turn").textContent = game.turn;
  $("hud-correct").textContent = game.correct;
  $("hud-spot").textContent = game.position;
  $("hud-total").textContent = BOARD_SPOTS;
  $("end-btn").style.display = game.turn >= OFFER_END_AFTER_TURNS ? "" : "none";
}

function showQuestion() {
  game.current = nextWord();
  const w = game.current;
  $("question-card").innerHTML = `
    <div class="word">${escapeHtml(w.word)}</div>
    <div class="pos">${escapeHtml(w.pos || "")}</div>
    <input class="answer-input" id="answer" maxlength="120" autocomplete="off" autocapitalize="off" spellcheck="false"
           placeholder="What does it mean?">
    <div class="actions">
      <button class="btn" id="check-btn">Check ✓</button>
      <button class="btn secondary" id="skip-btn">I don't know</button>
    </div>
  `;
  const input = $("answer");
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitAnswer(input.value); });
  $("check-btn").onclick = () => submitAnswer(input.value);
  $("skip-btn").onclick = () => submitAnswer("");
}

// Highlight definition words the player hit.
function highlightDefinition(def, matched) {
  if (!matched.length) return escapeHtml(def);
  return def.split(/(\s+)/).map((tok) => {
    const words = Grader.contentWords(tok);
    // negations are graded as one word ("not spending" -> "spendless")
    const hit = words.length && words.some((w) => matched.includes(w) || matched.includes(w + "less"));
    return hit ? `<mark>${escapeHtml(tok)}</mark>` : escapeHtml(tok);
  }).join("");
}

const VERDICTS = {
  mostly: ["🎉 Mostly right!", "You earned <b>2 dice</b>!"],
  somewhat: ["👍 Somewhat right!", "You earned <b>1 die</b>."],
  miss: ["😕 Not quite", "No roll this time — this word will come back later."],
};

function submitAnswer(answer) {
  if (game.busy) return;
  game.busy = true;
  const w = game.current;
  const { grade, matched } = answer.trim() ? Grader.grade(answer, w) : { grade: "miss", matched: [] };

  game.turn++;
  if (grade === "mostly") { game.correct++; game.mostly++; }
  else if (grade === "somewhat") { game.correct++; game.somewhat++; requeue(w); }
  else { game.missed.set(w.word, w); requeue(w); }
  updateHud();

  const [title, sub] = VERDICTS[grade];
  const diceCount = grade === "mostly" ? 2 : grade === "somewhat" ? 1 : 0;
  $("question-card").innerHTML = `
    <div class="word">${escapeHtml(w.word)}</div>
    <div class="pos">${escapeHtml(w.pos || "")}</div>
    <div class="result ${grade}">
      <div class="verdict">${title}</div>
      <div class="def-label">Definition</div>
      <div class="def">${highlightDefinition(w.def, matched)}</div>
      ${answer.trim() ? `<div class="yours">You said: “${escapeHtml(answer.trim())}”</div>` : ""}
      <div style="margin-bottom:12px">${sub}</div>
      <div class="dice-tray" id="dice-tray"></div>
      <div class="roll-total" id="roll-total"></div>
      <div class="actions" id="result-actions">
        ${diceCount ? `<button class="btn" id="roll-btn">Roll 🎲</button>` : `<button class="btn" id="next-btn">Next word →</button>`}
      </div>
    </div>
  `;
  if (diceCount) {
    $("roll-btn").focus();
    $("roll-btn").onclick = () => doRoll(diceCount);
  } else {
    $("next-btn").focus();
    $("next-btn").onclick = afterTurn;
  }
  game.busy = false;
}

async function doRoll(count) {
  if (game.busy) return;
  game.busy = true;
  $("roll-btn").disabled = true;
  const values = Array.from({ length: count }, rollDie);
  await animateDice(values);
  const total = values.reduce((a, b) => a + b, 0);
  $("roll-total").textContent = `You rolled ${total}! ✈️`;
  await sleep(700);

  const from = game.position;
  const to = Math.min(BOARD_SPOTS, from + total);
  await flyPlane(from, to);
  game.position = to;
  updateHud();
  game.busy = false;

  if (game.position >= BOARD_SPOTS) {
    await sleep(400);
    finishGame(true);
    return;
  }
  $("result-actions").innerHTML = `<button class="btn" id="next-btn">Next word →</button>`;
  $("next-btn").focus();
  $("next-btn").onclick = afterTurn;
}

function afterTurn() {
  if (game.turn >= OFFER_END_AFTER_TURNS && !game.offeredEnd) {
    game.offeredEnd = true;
    openModal(`
      <h2>⏱️ ${game.turn} turns!</h2>
      <p>You've flown to spot <b>${game.position}</b> of ${BOARD_SPOTS}.
         You can land here, or keep flying until you reach the finish.</p>
      <div class="actions">
        <button class="btn" id="keep-btn">Keep flying ✈️</button>
        <button class="btn secondary" id="land-btn">End game</button>
      </div>
    `);
    $("keep-btn").onclick = () => { closeModal(); showQuestion(); };
    $("land-btn").onclick = () => finishGame(false);
    return;
  }
  showQuestion();
}

// ---- end of game ---------------------------------------------------------------

function openModal(html) {
  $("modal").innerHTML = html;
  $("modal-bg").classList.add("open");
}
function closeModal() { $("modal-bg").classList.remove("open"); }

function finishGame(won) {
  const pct = Math.round((game.position / BOARD_SPOTS) * 100);
  const review = [...game.missed.values()];
  openModal(`
    <h2>${won ? "🏆 You made it!" : "🛬 Nice flying!"}</h2>
    <p>${won ? `You reached the finish in <b>${game.turn}</b> turns.` : `You flew <b>${pct}%</b> of the way there.`}</p>
    <div class="summary-stats">
      <div><b>${game.correct}</b>correct</div>
      <div><b>${game.turn}</b>turns</div>
      <div><b>${game.mostly}</b>mostly right</div>
      <div><b>${game.somewhat}</b>somewhat right</div>
    </div>
    ${review.length ? `<p style="margin:0 0 6px"><b>Words to review</b></p>
      <div class="review">${review.map((w) => `<div><b>${escapeHtml(w.word)}</b> — ${escapeHtml(w.def)}</div>`).join("")}</div>` : ""}
    <div class="actions">
      <button class="btn" id="again-btn">Play again</button>
      <button class="btn secondary" id="menu2-btn">Change words</button>
    </div>
  `);
  $("again-btn").onclick = () => { closeModal(); startGame(game.allWords); };
  $("menu2-btn").onclick = () => { closeModal(); showSetup(); };
  if (won) confetti();
}

function confetti() {
  const canvas = $("confetti"), ctx = canvas.getContext("2d");
  canvas.width = innerWidth; canvas.height = innerHeight;
  const colors = ["#ff6b35", "#ffd166", "#1f9d55", "#5aa9e6", "#ef476f"];
  const bits = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width, y: -20 - Math.random() * canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    r: 4 + Math.random() * 5, c: colors[Math.floor(Math.random() * colors.length)], a: Math.random() * Math.PI,
  }));
  const t0 = performance.now();
  (function frame(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bits.forEach((b) => {
      b.x += b.vx; b.y += b.vy; b.a += 0.1;
      ctx.fillStyle = b.c;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
    });
    if (now - t0 < 4000) requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })(t0);
}

// ---- screens ---------------------------------------------------------------

function showSetup() {
  $("game").style.display = "none";
  $("setup").style.display = "block";
}

function startGame(words) {
  $("setup").style.display = "none";
  $("game").style.display = "block";
  newGame(words);
  buildBoard();
  updateHud();
  showQuestion();
}

window.addEventListener("DOMContentLoaded", () => {
  renderSetup();
  $("start-btn").onclick = () => startGame(wordsInRange($("from-select").value, $("to-select").value));
  $("menu-btn").onclick = () => { if (confirm("Leave this game and go back to the menu?")) showSetup(); };
  $("end-btn").onclick = () => finishGame(false);
});

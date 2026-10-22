// ---------------------------------------------------------------------------
// Oct 21 Latin quiz practice. Two games, each going through all 5 sentences:
//   mark       circle subjects, underline verbs, bracket direct objects by
//              tapping words; graded word by word, with a final grade
//   translate  type a translation; not graded, the answer key is shown
//              underneath to compare
// Sentences and the answer key live in sentences.js.
// ---------------------------------------------------------------------------

const MARKS = {
  subject: { tool: "Circle", what: "subjects", one: "subject", icon: "◯" },
  verb: { tool: "Underline", what: "verbs", one: "verb", icon: "U̲" },
  object: { tool: "Bracket", what: "direct objects", one: "direct object", icon: "[ ]" },
};
const MARK_KEYS = Object.keys(MARKS);

const $ = (id) => document.getElementById(id);
let game = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showScreen(id) {
  ["menu", "play", "done"].forEach((s) => { $(s).style.display = s === id ? "block" : "none"; });
  window.scrollTo(0, 0);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each run goes through all 5 sentences in a new random order.
function startGame(mode) {
  const order = shuffle(SENTENCES.map((_, i) => i));
  game = { mode, order, index: 0, correct: 0, possible: 0, results: [] };
  showScreen("play");
  showSentence();
}

function progressHtml() {
  return `<button class="link" id="quit-btn">← Menu</button>
    <div class="progress">Sentence ${game.index + 1} of ${SENTENCES.length}</div>`;
}

const currentSentence = () => SENTENCES[game.order[game.index]];
const currentNumber = () => game.order[game.index] + 1; // number on the study sheet

function nextSentence() {
  game.index++;
  if (game.index >= SENTENCES.length) showDone();
  else showSentence();
}

function showSentence() {
  if (game.mode === "mark") renderMark();
  else renderTranslate();
  $("quit-btn").onclick = () => showScreen("menu");
}

// Words of a sentence with marks drawn on them. marks: { subject: Set, ... }
// status (after submit): per word and mark, "right" | "wrong" | "missed".
// Brackets wrap each run of neighboring bracketed words: [tunicam et togam].
function sentenceHtml(s, marks, status) {
  const bracketed = (i) => marks.object.has(i) || (status && status[i] && status[i].object === "missed");
  return s.words.map((w, i) => {
    const classes = ["word"];
    for (const m of MARK_KEYS) {
      const st = status && status[i] && status[i][m];
      if (marks[m].has(i) || st === "missed") classes.push(`m-${m}`);
      if (st) classes.push(`${m}-${st}`);
    }
    const open = bracketed(i) && !bracketed(i - 1);
    const close = bracketed(i) && !bracketed(i + 1);
    const bracketClass = status && status[i] && status[i].object ? `br-${status[i].object}` : "";
    return `${open ? `<span class="bracket ${bracketClass}">[</span>` : ""}<button class="${classes.join(" ")}" data-i="${i}">${escapeHtml(w)}</button>${close ? `<span class="bracket ${bracketClass}">]</span>` : ""}`;
  }).join(" ");
}

// ---- mark sentences ---------------------------------------------------------

function renderMark() {
  const s = currentSentence();
  const marks = { subject: new Set(), verb: new Set(), object: new Set() };
  let tool = "subject";

  $("play").innerHTML = `
    ${progressHtml()}
    <div class="card">
      <div class="instructions">Circle the <b>subjects</b>, underline the <b>verbs</b>, and bracket the <b>direct objects</b>. Pick a tool, then tap words.</div>
      <div class="tools">
        ${MARK_KEYS.map((m) => `<button class="tool tool-${m}" data-tool="${m}"><span class="tool-icon">${MARKS[m].icon}</span>${MARKS[m].tool}<small>${MARKS[m].what}</small></button>`).join("")}
      </div>
      <div class="sentence" id="sentence"></div>
      <div class="actions">
        <button class="btn secondary" id="clear-btn">Clear marks</button>
        <button class="btn" id="submit-btn">Submit</button>
      </div>
      <div id="feedback"></div>
    </div>`;

  const draw = () => {
    $("sentence").innerHTML = sentenceHtml(s, marks, null);
    document.querySelectorAll("#sentence .word").forEach((btn) => {
      btn.onclick = () => {
        const i = Number(btn.dataset.i);
        if (marks[tool].has(i)) marks[tool].delete(i); else marks[tool].add(i);
        draw();
      };
    });
  };
  const pickTool = (t) => {
    tool = t;
    document.querySelectorAll(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
  };
  document.querySelectorAll(".tool").forEach((b) => { b.onclick = () => pickTool(b.dataset.tool); });
  $("clear-btn").onclick = () => { MARK_KEYS.forEach((m) => marks[m].clear()); draw(); };
  $("submit-btn").onclick = () => gradeMark(s, marks);
  pickTool("subject");
  draw();
}

function gradeMark(s, marks) {
  const status = s.words.map(() => ({}));
  let right = 0, wrong = 0, missed = 0;
  const lines = [];
  for (const m of MARK_KEYS) {
    const key = new Set(s[m]);
    const got = { right: [], wrong: [], missed: [] };
    s.words.forEach((w, i) => {
      if (marks[m].has(i) && key.has(i)) { status[i][m] = "right"; got.right.push(w); }
      else if (marks[m].has(i)) { status[i][m] = "wrong"; got.wrong.push(w); }
      else if (key.has(i)) { status[i][m] = "missed"; got.missed.push(w); }
    });
    right += got.right.length; wrong += got.wrong.length; missed += got.missed.length;
    const clean = (arr) => arr.map((w) => escapeHtml(w.replace(/[.,?!“”"]/g, ""))).join(", ");
    const parts = [];
    if (got.right.length) parts.push(`<span class="ok">✓ ${clean(got.right)}</span>`);
    if (got.wrong.length) parts.push(`<span class="bad">✗ not a ${MARKS[m].one}: ${clean(got.wrong)}</span>`);
    if (got.missed.length) parts.push(`<span class="miss">missed: ${clean(got.missed)}</span>`);
    if (!key.size && !got.wrong.length) parts.push(`<span class="ok">✓ none in this sentence${m === "subject" ? " (the subject is in the verb ending)" : ""}</span>`);
    lines.push(`<div class="line"><b>${MARKS[m].tool}</b> (${MARKS[m].what}): ${parts.join(" · ")}</div>`);
  }

  // Grade: right marks out of everything that should be marked, plus any
  // wrong marks (so marking every word doesn't earn full credit).
  const possible = right + missed + wrong;
  game.correct += right;
  game.possible += possible;
  const perfect = !wrong && !missed;
  game.results.push({ number: currentNumber(), sentence: s.words.join(" "), right, possible, perfect });

  document.querySelectorAll(".tool, #clear-btn, #submit-btn").forEach((b) => { b.disabled = true; });
  $("sentence").innerHTML = sentenceHtml(s, marks, status);
  document.querySelectorAll("#sentence .word").forEach((b) => { b.disabled = true; });
  $("feedback").innerHTML = `
    <div class="verdict ${perfect ? "good" : "bad"}">${perfect ? "✓ All correct!" : `${right} of ${possible} correct`}</div>
    <div class="legend"><span class="ok">green = right</span> · <span class="bad">red = wrong</span> · <span class="miss">dashed orange = missed</span></div>
    <div class="breakdown">${lines.join("")}</div>
    <div class="translation-key"><b>Translation:</b> ${escapeHtml(s.translation)}</div>
    <button class="btn big" id="next-btn">${game.index + 1 >= SENTENCES.length ? "See my grade" : "Next sentence →"}</button>`;
  $("next-btn").onclick = nextSentence;
}

// ---- translate sentences ------------------------------------------------------

function renderTranslate() {
  const s = currentSentence();
  $("play").innerHTML = `
    ${progressHtml()}
    <div class="card">
      <div class="instructions">Translate this sentence into English.</div>
      <div class="sentence plain">${escapeHtml(s.words.join(" "))}</div>
      <textarea id="answer" rows="3" placeholder="Type your translation…" autocapitalize="sentences"></textarea>
      <div class="actions"><button class="btn" id="submit-btn">Show the answer</button></div>
      <div id="feedback"></div>
    </div>`;
  $("answer").focus();
  $("submit-btn").onclick = () => {
    const mine = $("answer").value.trim();
    $("answer").disabled = true;
    $("submit-btn").style.display = "none";
    game.results.push({ number: currentNumber(), sentence: s.words.join(" "), mine, key: s.translation });
    $("feedback").innerHTML = `
      <div class="compare">
        <div class="label">Your translation</div>
        <div class="mine">${mine ? escapeHtml(mine) : "<i>(left blank)</i>"}</div>
        <div class="label">Answer key</div>
        <div class="key">${escapeHtml(s.translation)}</div>
      </div>
      <button class="btn big" id="next-btn">${game.index + 1 >= SENTENCES.length ? "Finish" : "Next sentence →"}</button>`;
    $("next-btn").onclick = nextSentence;
  };
}

// ---- end screen ---------------------------------------------------------------

function showDone() {
  let html;
  if (game.mode === "mark") {
    const pct = game.possible ? Math.round((game.correct / game.possible) * 100) : 0;
    const msg = pct === 100 ? "Perfect! 🎉" : pct >= 90 ? "Excellent!" : pct >= 75 ? "Good work — review the misses." : "Keep practicing — try it again.";
    html = `
      <h2>Your grade</h2>
      <div class="grade">${pct}%</div>
      <p>${game.correct} of ${game.possible} marks correct. ${msg}</p>
      <div class="review">${game.results.map((r, i) => `
        <div class="${r.perfect ? "ok" : "bad"}">${r.perfect ? "✓" : "✗"} <b>${r.number}.</b> ${escapeHtml(r.sentence)} <span class="small">(${r.right}/${r.possible})</span></div>`).join("")}</div>`;
  } else {
    html = `
      <h2>All 5 translated</h2>
      <p>Compare your translations with the answer key:</p>
      <div class="review">${game.results.map((r, i) => `
        <div class="pair"><b>${r.number}. ${escapeHtml(r.sentence)}</b>
          <div class="label">You</div><div class="mine">${r.mine ? escapeHtml(r.mine) : "<i>(left blank)</i>"}</div>
          <div class="label">Key</div><div class="key">${escapeHtml(r.key)}</div></div>`).join("")}</div>`;
  }
  $("done").innerHTML = `
    <div class="card done">${html}
      <div class="actions">
        <button class="btn" id="again-btn">Play again</button>
        <button class="btn secondary" id="menu-btn">Menu</button>
      </div>
    </div>`;
  showScreen("done");
  $("again-btn").onclick = () => startGame(game.mode);
  $("menu-btn").onclick = () => showScreen("menu");
}

document.querySelectorAll("[data-start]").forEach((b) => { b.onclick = () => startGame(b.dataset.start); });
document.querySelectorAll("[data-menu]").forEach((b) => { b.onclick = () => showScreen("menu"); });

// ---------------------------------------------------------------------------
// Beatitudes recitation practice. Goes through Matthew 5:3–10 in order:
// speak (or type) each beatitude, fix up the transcript, submit, and see a
// word-by-word comparison: green = right, red strike = extra, dashed = missed.
// Speech uses the browser's built-in speech recognition (Chrome, Edge,
// Safari); where that's missing, the keyboard's own dictation still works.
// ---------------------------------------------------------------------------

const $ = (id) => document.getElementById(id);
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let index = 0;
let scores = [];       // first-try score (0-100) for each beatitude
let attempted = false; // has this beatitude been submitted yet?

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function showScreen(id) {
  ["menu", "play", "done"].forEach((s) => { $(s).style.display = s === id ? "block" : "none"; });
  window.scrollTo(0, 0);
}

// ---- speech ---------------------------------------------------------------------

let recognizer = null;
let micStream = null; // held open while practicing so the browser asks only once
let listening = false;
let baseText = "";   // what was in the box before this recording started
let heardText = "";  // finished phrases heard so far in this recording

function setListening(on) {
  listening = on;
  const btn = $("mic-btn");
  btn.classList.toggle("on", on);
  btn.innerHTML = on ? "⏹ Stop" : "🎤 Start speaking";
  $("answer").readOnly = on;
  $("submit-btn").disabled = on;
  $("status").textContent = on ? "Listening… say the beatitude, then press Stop." : "";
}

// Ask for the microphone once and keep it open while practicing. Browsers
// that don't remember the permission (http://localhost, embedded previews,
// "Allow this time") would otherwise ask again on every press.
async function ensureMic() {
  if (micStream && micStream.active) return true;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true; // let speech ask itself
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch (e) {
    $("status").textContent = "Microphone permission was blocked. Allow the microphone for this page, or type instead.";
    return false;
  }
}

function releaseMic() {
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  micStream = null;
}

// One recognizer for the whole visit; starting a new one each time can
// trigger a new permission prompt.
function getRecognizer() {
  if (recognizer) return recognizer;
  recognizer = new SpeechRecognition();
  recognizer.lang = "en-US";
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) heardText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    $("answer").value = [baseText, heardText.trim(), interim].filter(Boolean).join(" ");
  };
  recognizer.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      $("status").textContent = "Microphone permission was blocked. Allow the microphone for this page, or type instead.";
      setListening(false);
    }
  };
  // Phones stop listening after a pause; keep going until Stop is pressed.
  recognizer.onend = () => {
    if (!listening) return;
    baseText = $("answer").value.trim();
    heardText = "";
    try { recognizer.start(); } catch (e) { setListening(false); }
  };
  return recognizer;
}

async function startListening() {
  $("mic-btn").disabled = true;
  const ok = await ensureMic();
  $("mic-btn").disabled = false;
  if (!ok) return;
  baseText = $("answer").value.trim();
  heardText = "";
  try {
    getRecognizer().start();
    setListening(true);
  } catch (e) {
    $("status").textContent = "Couldn't start the microphone. You can type your answer instead.";
  }
}

function stopListening() {
  setListening(false);
  if (recognizer) recognizer.stop();
  $("answer").focus();
}

// ---- one beatitude ----------------------------------------------------------------

function startGame() {
  index = 0;
  scores = [];
  showScreen("play");
  showBeatitude();
}

function showBeatitude() {
  const b = BEATITUDES[index];
  attempted = false;
  $("play").innerHTML = `
    <button class="link" id="quit-btn">← Menu</button>
    <div class="progress">Beatitude ${index + 1} of ${BEATITUDES.length}</div>
    <div class="card">
      <div class="prompt">Say the <b>${ordinal(index + 1)}</b> beatitude <span class="verse">(${b.verse})</span></div>
      ${SpeechRecognition
        ? `<button class="mic" id="mic-btn">🎤 Start speaking</button>`
        : `<div class="no-speech">This browser can't listen here. Tap the box and use the 🎤 on your keyboard, or type it.</div>`}
      <div class="status" id="status"></div>
      <textarea id="answer" rows="4" placeholder="Your words show up here. You can fix them before you submit."></textarea>
      <div class="actions">
        <button class="btn secondary" id="clear-btn">Clear</button>
        <button class="btn" id="submit-btn">Submit</button>
      </div>
      <div id="feedback"></div>
    </div>`;
  $("quit-btn").onclick = () => { if (listening) stopListening(); releaseMic(); showScreen("menu"); };
  if (SpeechRecognition) $("mic-btn").onclick = () => (listening ? stopListening() : startListening());
  $("clear-btn").onclick = () => { $("answer").value = ""; $("feedback").innerHTML = ""; };
  $("submit-btn").onclick = submit;
}

function ordinal(n) {
  return ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth"][n - 1];
}

function submit() {
  if (listening) stopListening();
  const answer = $("answer").value.trim();
  if (!answer) { $("status").textContent = "Say or type the beatitude first."; return; }
  const b = BEATITUDES[index];
  const result = WordDiff.diff(b.text, answer);
  // score: right words out of the words needed plus any extras
  const score = Math.round((result.same / (result.total + result.extra)) * 100);
  const perfect = !result.missing && !result.extra;
  if (!attempted) scores[index] = score;
  attempted = true;

  const words = result.parts.map((p) => p.text ? `<span class="w ${p.type}">${escapeHtml(p.text)}</span>` : "").join(" ");
  $("feedback").innerHTML = `
    <div class="verdict ${perfect ? "good" : "bad"}">${perfect ? "✓ Perfect!" : `${result.same} of ${result.total} words right`}</div>
    <div class="legend"><span class="w same">right</span> <span class="w missing">left out</span> <span class="w extra">extra</span></div>
    <div class="diff">${words}</div>
    ${perfect ? "" : `<div class="label">The beatitude</div><div class="correct">${escapeHtml(b.text)}</div>`}
    <div class="actions">
      ${perfect ? "" : `<button class="btn secondary" id="retry-btn">Try again</button>`}
      <button class="btn" id="next-btn">${index + 1 >= BEATITUDES.length ? "Finish" : "Next beatitude →"}</button>
    </div>`;
  if (!perfect) $("retry-btn").onclick = () => { $("answer").value = ""; $("feedback").innerHTML = ""; $("answer").focus(); };
  $("next-btn").onclick = () => {
    index++;
    if (index >= BEATITUDES.length) showDone(); else showBeatitude();
  };
}

// ---- summary ------------------------------------------------------------------------

function showDone() {
  releaseMic();
  const avg = Math.round(scores.reduce((a, b) => a + (b || 0), 0) / BEATITUDES.length);
  const perfect = scores.filter((s) => s === 100).length;
  $("done").innerHTML = `
    <div class="card done">
      <h2>All 8 Beatitudes</h2>
      <div class="grade">${avg}%</div>
      <p>${perfect} of 8 perfect on the first try.</p>
      <div class="review">${BEATITUDES.map((b, i) => `
        <div><span class="score ${scores[i] === 100 ? "good" : "bad"}">${scores[i] ?? 0}%</span>
          <b>${i + 1}.</b> ${escapeHtml(b.text)}</div>`).join("")}</div>
      <div class="actions">
        <button class="btn" id="again-btn">Practice again</button>
        <button class="btn secondary" id="menu-btn">Menu</button>
      </div>
    </div>`;
  showScreen("done");
  $("again-btn").onclick = startGame;
  $("menu-btn").onclick = () => showScreen("menu");
}

$("start-btn").onclick = startGame;
$("study-btn").onclick = () => {
  const list = $("study-list");
  list.style.display = list.style.display === "none" ? "block" : "none";
};
$("study-list").innerHTML = BEATITUDES.map((b, i) => `<li>${escapeHtml(b.text)} <span class="verse">${b.verse}</span></li>`).join("");

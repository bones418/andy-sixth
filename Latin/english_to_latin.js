// ---------------------------------------------------------------------------
// English -> Latin games (loaded after app.js, uses its word bank + helpers):
//   mode4  English -> Latin       "like; love" (verb) -> amo
//   mode5  ... with endings       "of the girls" -> puellarum, "they walk" -> ambulant
//   mode6  Build the word         tap a stem (puell-) + an ending (-arum)
//
// The same English can have several right Latin answers ("the girl" =
// puella or puellam), so every question carries all accepted forms.
// Endings cover nouns in every case and verbs in the 3rd person, which is
// what the app's form engine (lib/morphology.js) can generate.
// ---------------------------------------------------------------------------

const E2L_CASE_ENGLISH = {
  nom: (x) => x, gen: (x) => `of ${x}`, dat: (x) => `to/for ${x}`, acc: (x) => x, abl: (x) => `by/with/from ${x}`,
};
const NOUN_GEN_ENDING = { 1: "ae", 2: "i", 3: "is", 4: "us", 5: "ei" };
const VERB_ENDING_TILES = ["at", "ant", "et", "ent", "it", "unt", "iunt"];

function normalizeLatin(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[.,!?;:"']/g, "").replace(/\s+/g, " ").trim();
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---- forms ------------------------------------------------------------------

function e2lNouns() {
  return wordsInSelectedLessons().filter((w) => w.pos === "noun" && w.genitive && w.declension && w.gender);
}

function e2lVerbs() {
  return wordsInSelectedLessons().filter((w) => w.pos === "verb" && w.conj && w.conj !== "irregular"
    && w.principalParts && !SENTENCE_VERB_EXCLUDE.has(w.lemma));
}

// "they be quiet" -> "they are quiet"
function englishPlural3(gloss) {
  return gloss.replace(/^be\b/, "are");
}

// Every form the endings games ask about:
// { latin, entry, english, kind, ending, stem }  (stem/ending only if the
// form is stem + ending, so it can be built from tiles)
function e2lForms() {
  const out = [];
  for (const n of e2lNouns()) {
    const stem = n.genitive.endsWith(NOUN_GEN_ENDING[n.declension])
      ? n.genitive.slice(0, n.genitive.length - NOUN_GEN_ENDING[n.declension].length) : null;
    const gloss = firstGloss(n.english);
    for (const number of ["sg", "pl"]) {
      for (const kase of ALL_CASES) {
        let latin;
        try { latin = Morphology.declineNoun(n, kase, number); } catch (e) { continue; }
        const noun = number === "pl" ? pluralizeEnglishNoun(gloss) : gloss;
        const buildable = stem && latin.startsWith(stem) && latin.length > stem.length;
        out.push({
          latin, entry: n, kind: "noun", english: E2L_CASE_ENGLISH[kase](`the ${noun}`),
          stem: buildable ? stem : null, ending: buildable ? latin.slice(stem.length) : null,
        });
      }
    }
  }
  for (const v of e2lVerbs()) {
    const inf = v.principalParts[1] || "";
    const stem = inf.replace(/(are|ere|ire)$/, "");
    const gloss = firstGloss(v.english);
    for (const number of ["sg", "pl"]) {
      let latin;
      try { latin = Morphology.conjugatePresent3({ lemma: v.lemma, conj: v.conj, principalParts: v.principalParts }, number); } catch (e) { continue; }
      const english = number === "sg" ? `he/she/it ${englishThirdPersonSingular(gloss)}` : `they ${englishPlural3(gloss)}`;
      const ending = latin.startsWith(stem) ? latin.slice(stem.length) : null;
      const buildable = stem !== inf && VERB_ENDING_TILES.includes(ending);
      out.push({ latin, entry: v, kind: "verb", english, stem: buildable ? stem : null, ending: buildable ? ending : null });
    }
  }
  return out;
}

// Group forms by English so each question accepts every right answer.
function groupByEnglish(forms) {
  const map = new Map();
  for (const f of forms) {
    const key = f.english.toLowerCase();
    if (!map.has(key)) map.set(key, { english: f.english, forms: [] });
    map.get(key).forms.push(f);
  }
  return [...map.values()].map((q) => ({
    ...q,
    accepted: [...new Set(q.forms.map((f) => f.latin))],
    entry: q.forms[0].entry,
    kind: q.forms[0].kind,
  }));
}

function mode4Pool() {
  return wordsInSelectedLessons();
}

function mode5Pool() {
  return groupByEnglish(e2lForms());
}

function mode6Pool() {
  return mode5Pool().filter((q) => q.forms.some((f) => f.stem));
}

// ---- grading -----------------------------------------------------------------

// accepted: right answers; otherForms: other real forms of the same word,
// so a wrong ending gets "right word, wrong ending" instead of a typo pass.
// A one-letter slip counts (with a spelling note) only if it isn't one of
// those real forms.
function gradeLatin(typed, accepted, otherForms) {
  const got = normalizeLatin(typed);
  if (!got) return { correct: false, note: "" };
  if (accepted.some((a) => normalizeLatin(a) === got)) return { correct: true, note: "" };
  const note = wrongEndingNote(otherForms, got);
  if (note) return { correct: false, note };
  const near = accepted.find((a) => normalizeLatin(a).length >= 5 && editDistance(got, normalizeLatin(a)) <= 1);
  if (near) return { correct: true, note: `Close enough — check your spelling: <b>${escapeHtml(near)}</b>.` };
  return { correct: false, note: "" };
}

// "Right word, wrong ending! puellis means 'to/for the girls' or 'by/with/from the girls'."
function wrongEndingNote(otherForms, latin) {
  const matches = otherForms.filter((f) => normalizeLatin(f.latin) === normalizeLatin(latin));
  if (!matches.length) return "";
  const meanings = [...new Set(matches.map((f) => `“${escapeHtml(f.english)}”`))].join(" or ");
  return `Right word, wrong ending! <b>${escapeHtml(matches[0].latin)}</b> means ${meanings}.`;
}

function formsOfSameWord(entry) {
  return e2lForms().filter((f) => f.entry === entry);
}

function e2lFeedback(correct, english, accepted, typed, note) {
  showFeedback(correct, `
    ${note ? `<div class="answer-note">${note}</div>` : ""}
    <div class="answer-label">“${escapeHtml(english)}” in Latin</div>
    <ul class="answer-list">${accepted.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}</ul>
    ${!correct && typed ? `<div class="answer-gloss">You wrote: <s>${escapeHtml(typed)}</s></div>` : ""}
  `);
}

function wireTypedAnswer(onSubmit) {
  const input = document.getElementById("e2l-input");
  input.focus();
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault(); // keep this Enter from also pressing Next
    onSubmit();
  });
  document.getElementById("e2l-submit").addEventListener("click", onSubmit);
}

function finishTyped(correct) {
  const input = document.getElementById("e2l-input");
  input.disabled = true;
  input.classList.add(correct ? "correct" : "wrong");
  document.getElementById("e2l-submit").disabled = true;
  recordAnswer(correct);
}

// ---- Mode 4: English -> Latin (dictionary form) -----------------------------------

function renderMode4Question(area) {
  const entry = randChoice(mode4Pool());
  const glossKey = (w) => w.english.split(";").map((g) => g.replace(/\([^)]*\)/g, "").trim().toLowerCase());
  const myGlosses = glossKey(entry);
  // any word in the chosen chapters sharing a meaning is also right ("road": via or iter)
  const accepted = [...new Set(mode4Pool().filter((w) => glossKey(w).some((g) => myGlosses.includes(g))).map((w) => w.lemma))];
  const hint = entry.pos === "verb" ? "verb — give the “I …” form, like amo"
    : entry.pos === "noun" ? "noun — give the dictionary form (nominative)"
    : entry.pos === "adjective" ? "adjective — give the masculine form"
    : entry.pos;
  area.innerHTML = `
    <div class="prompt-word english">${escapeHtml(entry.english)}</div>
    <div class="prompt-pos">${escapeHtml(hint)}</div>
    <input type="text" id="e2l-input" class="text-input" placeholder="Type it in Latin..." autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="action" id="e2l-submit">Check</button>
  `;
  wireTypedAnswer(() => {
    const input = document.getElementById("e2l-input");
    if (input.disabled || !input.value.trim()) return;
    // another form of the word (puellam) is "right word, wrong form"
    const others = formsOfSameWord(entry).filter((f) => !accepted.includes(f.latin));
    const { correct, note } = gradeLatin(input.value, accepted, others);
    finishTyped(correct);
    e2lFeedback(correct, entry.english, accepted, input.value.trim(), note);
  });
}

// ---- Mode 5: English -> Latin with endings -----------------------------------------

function renderMode5Question(area) {
  const q = randChoice(mode5Pool());
  area.innerHTML = `
    <div class="prompt-word english">${escapeHtml(q.english)}</div>
    <div class="prompt-pos">${q.kind} — type the Latin with the right ending</div>
    <input type="text" id="e2l-input" class="text-input" placeholder="Type it in Latin..." autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
    <button class="action" id="e2l-submit">Check</button>
  `;
  wireTypedAnswer(() => {
    const input = document.getElementById("e2l-input");
    if (input.disabled || !input.value.trim()) return;
    const others = formsOfSameWord(q.entry).filter((f) => !q.accepted.includes(f.latin));
    const { correct, note } = gradeLatin(input.value, q.accepted, others);
    finishTyped(correct);
    e2lFeedback(correct, q.english, q.accepted, input.value.trim(), note);
  });
}

// ---- Mode 6: build the word from a stem + an ending ---------------------------------

function renderMode6Question(area) {
  const q = randChoice(mode6Pool());
  const target = q.forms.find((f) => f.stem);
  const sameKind = mode6Pool().flatMap((x) => x.forms).filter((f) => f.kind === q.kind && f.stem && f.entry !== q.entry);
  const otherStems = [...new Set(sameKind.map((f) => f.stem))];
  const stems = shuffle([target.stem, ...shuffle(otherStems).slice(0, 2)]);
  // endings: every ending this word takes (nouns) or all verb endings
  const endings = q.kind === "verb" ? VERB_ENDING_TILES
    : [...new Set(formsOfSameWord(q.entry).filter((f) => f.stem).map((f) => f.ending))];
  const picks = { stem: null, ending: null };

  area.innerHTML = `
    <div class="prompt-pos">Build the Latin for</div>
    <div class="prompt-word english">${escapeHtml(q.english)}</div>
    <div class="build-slot" id="build-slot"><span class="ph">tap a stem + an ending</span></div>
    <div class="qgroup">
      <div class="qlabel">Stem</div>
      <div class="options">${stems.map((s) => `<button class="opt-btn tile" data-group="stem" data-value="${escapeHtml(s)}">${escapeHtml(s)}-</button>`).join("")}</div>
    </div>
    <div class="qgroup">
      <div class="qlabel">Ending</div>
      <div class="options">${endings.map((e) => `<button class="opt-btn tile" data-group="ending" data-value="${e}">-${e}</button>`).join("")}</div>
    </div>
    <button class="action" id="build-submit" disabled>Check</button>
  `;

  const slot = document.getElementById("build-slot");
  const refresh = () => {
    if (picks.stem && picks.ending) {
      slot.innerHTML = `${escapeHtml(picks.stem)}<span class="ending">${escapeHtml(picks.ending)}</span>`;
    } else {
      slot.innerHTML = `<span class="ph">${picks.stem ? escapeHtml(picks.stem) + "- …" : picks.ending ? "… -" + escapeHtml(picks.ending) : "tap a stem + an ending"}</span>`;
    }
    document.getElementById("build-submit").disabled = !(picks.stem && picks.ending);
  };
  area.querySelectorAll(".tile").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      const g = btn.dataset.group;
      area.querySelectorAll(`.tile[data-group="${g}"]`).forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      picks[g] = btn.dataset.value;
      refresh();
    });
  });

  document.getElementById("build-submit").addEventListener("click", () => {
    const built = picks.stem + picks.ending;
    const others = formsOfSameWord(q.entry).filter((f) => !q.accepted.includes(f.latin));
    const correct = q.accepted.includes(built);
    const rightEndings = q.forms.filter((f) => f.stem === target.stem).map((f) => f.ending);
    area.querySelectorAll(".tile").forEach((b) => {
      b.disabled = true;
      const isPick = b.dataset.value === picks[b.dataset.group];
      const isAnswer = b.dataset.group === "stem" ? b.dataset.value === target.stem : rightEndings.includes(b.dataset.value);
      b.classList.remove("selected");
      if (isAnswer) b.classList.add("correct");
      else if (isPick) b.classList.add("wrong");
    });
    slot.classList.add(correct ? "good" : "bad");
    document.getElementById("build-submit").disabled = true;
    recordAnswer(correct);
    const note = correct ? ""
      : picks.stem !== target.stem ? `That stem belongs to a different word — “${escapeHtml(q.english)}” uses <b>${escapeHtml(target.stem)}-</b>.`
      : wrongEndingNote(others, built);
    e2lFeedback(correct, q.english, q.accepted, correct ? "" : built, note);
  });
}

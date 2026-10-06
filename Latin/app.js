// ---------------------------------------------------------------------------
// Ecce Romani vocabulary study app. Three modes:
//   1. Latin -> English translation (dictionary/lemma forms only)
//   2. Identify case / number / gender of an inflected noun/adjective/pronoun
//   3. Translate a randomly-generated silly sentence built from the word bank
//
// Word bank is a CSV (lib/word_bank.csv). Since file:// pages can't fetch()
// sibling files, we bundle a default snapshot as a JS global
// (lib/word_bank_data.js) and additionally let the user load/override it
// from disk via a file picker (persisted to localStorage), so editing the
// CSV in a spreadsheet app and reloading it needs no build step.
// ---------------------------------------------------------------------------

const LS_KEY_CSV = "latin_wordbank_csv_v1";
const LS_KEY_CSV_NAME = "latin_wordbank_csv_name_v1";

const ALL_CASES = ["nom", "gen", "dat", "acc", "abl"];
const CASE_LABELS = { nom: "Nominative", gen: "Genitive", dat: "Dative", acc: "Accusative", abl: "Ablative" };
const GENDER_LABELS = { m: "Masculine", f: "Feminine", n: "Neuter" };

let WORD_BANK = [];       // all rows, normalized
let selectedLessons = new Set();
let currentMode = null;

// ---- data loading -----------------------------------------------------

function normalizeRow(raw) {
  const row = {
    lesson: parseInt(raw.lesson, 10),
    lemma: (raw.lemma || "").trim(),
    pos: (raw.pos || "").trim(),
    english: (raw.english || "").trim(),
    gender: (raw.gender || "").trim() || null,
    declension: raw.declension ? parseInt(raw.declension, 10) : null,
    genitive: (raw.genitive || "").trim() || null,
    conj: (raw.conj || "").trim() || null,
    principalParts: raw.principal_parts ? raw.principal_parts.split(";").map((s) => s.trim()) : null,
    spliceOk: (raw.splice_ok || "").trim().toLowerCase() === "yes",
    transitive: (raw.transitive || "").trim().toLowerCase() === "yes",
    notes: (raw.notes || "").trim(),
  };
  return row;
}

function parseCsv(csvText) {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return result.data.map(normalizeRow).filter((r) => r.lemma && !Number.isNaN(r.lesson));
}

function loadWordBank() {
  const saved = localStorage.getItem(LS_KEY_CSV);
  const csvText = saved || window.WORD_BANK_CSV_DEFAULT;
  WORD_BANK = parseCsv(csvText);
}

function wordBankSourceLabel() {
  const name = localStorage.getItem(LS_KEY_CSV_NAME);
  return name ? `Custom: ${name}` : "Bundled default";
}

function resetWordBankToDefault() {
  localStorage.removeItem(LS_KEY_CSV);
  localStorage.removeItem(LS_KEY_CSV_NAME);
  loadWordBank();
}

function loadWordBankFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result;
        const parsed = parseCsv(text);
        if (!parsed.length) throw new Error("No valid rows found in that file.");
        localStorage.setItem(LS_KEY_CSV, text);
        localStorage.setItem(LS_KEY_CSV_NAME, file.name);
        WORD_BANK = parsed;
        resolve(parsed.length);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsText(file);
  });
}

// ---- lesson-filtered pools -----------------------------------------------

function wordsInSelectedLessons() {
  return WORD_BANK.filter((w) => selectedLessons.has(w.lesson));
}

function mode1Pool() {
  return wordsInSelectedLessons(); // every word is fair game for lemma->English
}

function mode2Pool() {
  return wordsInSelectedLessons().filter((w) => {
    if (w.pos === "noun") {
      return w.genitive && w.declension && (w.gender === "m" || w.gender === "f");
    }
    if (w.pos === "adjective") {
      return !!w.genitive;
    }
    if (w.pos === "pronoun") {
      return !!Morphology.PRONOUN_PARADIGMS[w.lemma];
    }
    return false;
  });
}

// Copula and modal verbs grammatically need a complement (predicate noun/
// adjective, or infinitive) that this simple Subject-Verb-Object template
// doesn't generate, so a bare "the father is." or "streams be able." would
// be nonsense - excluded from Mode 3 (still fine in Mode 1).
const SENTENCE_VERB_EXCLUDE = new Set(["sum", "possum", "volo", "nolo"]);

// Verbs whose English gloss is a phrasal verb ending in a stranded
// preposition ("grab hold OF", "put ON") read as a broken fragment without
// their object, so these always get one (when the lesson selection has an
// eligible object noun) rather than the usual 70% chance.
const FORCE_OBJECT_VERBS = new Set(["arripio", "conspicio", "repello", "trado", "induo", "curo", "incito"]);

function mode3Pools() {
  const words = wordsInSelectedLessons();
  const nouns = words.filter((w) => w.pos === "noun" && w.genitive && w.declension && (w.gender === "m" || w.gender === "f"));
  const adjectives = words.filter((w) => w.pos === "adjective" && w.genitive);
  const verbs = words.filter((w) => w.pos === "verb" && (w.conj || Morphology.IRREGULAR_VERBS[w.lemma]) && !SENTENCE_VERB_EXCLUDE.has(w.lemma));
  const phrases = words.filter((w) => (w.pos === "adverb" || w.pos === "phrase") && w.spliceOk);
  return { nouns, adjectives, verbs, phrases };
}

// ---- English gloss helpers -------------------------------------------

function firstGloss(english) {
  return english.split(";")[0].replace(/\s*\([^)]*\)/g, "").trim();
}

const IRREGULAR_ENGLISH_3SG = { be: "is", have: "has" };

function englishThirdPersonSingular(verbGloss) {
  const words = verbGloss.split(" ");
  const head = words[0];
  let formed;
  if (IRREGULAR_ENGLISH_3SG[head]) formed = IRREGULAR_ENGLISH_3SG[head];
  else if (/[sxzo]$|[cs]h$/.test(head)) formed = head + "es";
  else if (/[^aeiou]y$/.test(head)) formed = head.slice(0, -1) + "ies";
  else formed = head + "s";
  return [formed, ...words.slice(1)].join(" ");
}

function englishVerbForm(verbGloss, number) {
  return number === "sg" ? englishThirdPersonSingular(verbGloss) : verbGloss;
}

// ---- random helpers -----------------------------------------------------

function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randBool(pTrue = 0.5) { return Math.random() < pTrue; }

// ---- Mode 2 morphology helpers ------------------------------------------

function formFor(entry, kase, number, gender) {
  if (entry.pos === "noun") return Morphology.declineNoun(entry, kase, number);
  if (entry.pos === "adjective") return Morphology.declineAdjective(entry, kase, number, gender);
  if (entry.pos === "pronoun") return Morphology.declinePronoun(entry.lemma, kase, number, gender);
  throw new Error(`Unsupported pos "${entry.pos}" for declension`);
}

// Latin inflection is full of real, unavoidable ambiguity out of context:
// e.g. 1st declension "-ae" is genitive sg, dative sg, AND nominative pl all
// at once. Grading a single pre-drawn (case,number,gender) answer would
// unfairly mark a student wrong for picking an equally valid alternate
// reading. Instead we compute every (case,number,gender) combination that
// produces the exact same surface string as the drawn form, and accept any
// of them - grading checks membership in that set, not equality to the
// one combo we happened to draw.
function computeTieSet(entry, drawnCase, drawnNumber, drawnGender) {
  const target = formFor(entry, drawnCase, drawnNumber, drawnGender);
  const genders = entry.pos === "noun" ? [entry.gender] : ["m", "f"];
  const ties = new Set();
  for (const g of genders) {
    for (const c of ALL_CASES) {
      for (const n of Morphology.NUMBERS) {
        if (formFor(entry, c, n, g) === target) ties.add(`${c}:${n}:${g}`);
      }
    }
  }
  return ties;
}

function pickMode2Question(pool) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const entry = randChoice(pool);
    const number = randChoice(Morphology.NUMBERS);
    const kase = randChoice(ALL_CASES);
    const gender = entry.pos === "noun" ? entry.gender : randChoice(["m", "f"]);

    let form;
    try {
      form = formFor(entry, kase, number, gender);
    } catch (e) {
      continue; // unsupported combo (e.g. missing paradigm) - reroll
    }

    const tieSet = computeTieSet(entry, kase, number, gender);
    // Always offer all five cases in textbook order - dropping one meant an
    // ambiguous form's most "obvious" valid reading could be missing.
    const caseOptions = ALL_CASES;

    return { entry, kase, number, gender, form, caseOptions, tieSet };
  }
  return null;
}

function formatTriple(caseNumGender, needsGender) {
  const [c, n, g] = caseNumGender.split(":");
  return `${CASE_LABELS[c]}, ${n === "sg" ? "Singular" : "Plural"}${needsGender ? `, ${GENDER_LABELS[g]}` : ""}`;
}

// ---- Mode 3 sentence generation ------------------------------------------

const IRREGULAR_ENGLISH_PLURAL = { man: "men", woman: "women", wolf: "wolves" };

function applyRegularPlural(word) {
  if (/[sxz]$|[cs]h$/.test(word)) return word + "es";
  if (/[^aeiou]y$/.test(word)) return word.slice(0, -1) + "ies";
  return word + "s";
}

function pluralizeEnglishNoun(noun) {
  if (IRREGULAR_ENGLISH_PLURAL[noun]) return IRREGULAR_ENGLISH_PLURAL[noun];
  if (noun.includes("-")) {
    const parts = noun.split("-");
    const last = parts.pop();
    return [...parts, IRREGULAR_ENGLISH_PLURAL[last] || applyRegularPlural(last)].join("-");
  }
  return applyRegularPlural(noun);
}

// Possessives ("my/your/his") and negative/indefinite determiners ("no",
// "another") read ungrammatically with a prepended "the" in English
// ("the my house", "the no mother") - skip the article for these.
const NO_ARTICLE_ADJECTIVES = new Set(["meus", "tuus", "suus", "nullus", "alius"]);

// A few adjective glosses are quantifier/determiner-like words whose English
// form changes with number in a way "add -s" can't capture ("another" has no
// plural - the plural equivalent is "other", not "anothers").
const ADJECTIVE_PLURAL_GLOSS_OVERRIDE = { alius: "other", multus: "many" };

function inflectedNounPhrase(noun, adjective, kase, number) {
  const nounForm = Morphology.declineNoun(noun, kase, number);
  const nounGloss = number === "pl" ? pluralizeEnglishNoun(firstGloss(noun.english)) : firstGloss(noun.english);
  if (!adjective) return { latin: nounForm, english: nounGloss, number, noArticle: false };
  const adjForm = Morphology.declineAdjective(adjective, kase, number, noun.gender);
  const latin = `${adjForm} ${nounForm}`;
  const adjGloss = (number === "pl" && ADJECTIVE_PLURAL_GLOSS_OVERRIDE[adjective.lemma])
    || firstGloss(adjective.english);
  const english = `${adjGloss} ${nounGloss}`;
  return { latin, english, number, noArticle: NO_ARTICLE_ADJECTIVES.has(adjective.lemma) };
}

function buildSillySentence(pools) {
  const { nouns, adjectives, verbs, phrases } = pools;
  if (!nouns.length || !verbs.length) return null;

  const subjectNumber = randBool(0.75) ? "sg" : "pl";
  const subjectNoun = randChoice(nouns);
  const subjectAdj = adjectives.length && randBool(0.5) ? randChoice(adjectives) : null;
  const subjectPhrase = inflectedNounPhrase(subjectNoun, subjectAdj, "nom", subjectNumber);

  const verb = randChoice(verbs);
  let verbLatin, verbEnglish;
  if (Morphology.IRREGULAR_VERBS[verb.lemma]) {
    verbLatin = Morphology.IRREGULAR_VERBS[verb.lemma][subjectNumber];
  } else {
    verbLatin = Morphology.conjugatePresent3(
      { lemma: verb.lemma, conj: verb.conj, principalParts: verb.principalParts },
      subjectNumber
    );
  }
  verbEnglish = englishVerbForm(firstGloss(verb.english), subjectNumber);

  const parts = [subjectPhrase.latin];
  const englishParts = [capitalize(withArticle(subjectPhrase.english, subjectNumber, subjectPhrase.noArticle))];

  // optional direct object - only for verbs that grammatically take one
  let objectPhrase = null;
  const objectCandidates = nouns.filter((n) => n.lemma !== subjectNoun.lemma);
  const wantsObject = FORCE_OBJECT_VERBS.has(verb.lemma) ? true : randBool(0.7);
  if (verb.transitive && objectCandidates.length && wantsObject) {
    const objectNumber = randBool(0.75) ? "sg" : "pl";
    const objectNoun = randChoice(objectCandidates);
    const objectAdj = adjectives.length && randBool(0.5) ? randChoice(adjectives) : null;
    objectPhrase = inflectedNounPhrase(objectNoun, objectAdj, "acc", objectNumber);
  }

  // optional adverbial phrase/adverb, spliced in verbatim
  const extra = phrases.length && randBool(0.6) ? randChoice(phrases) : null;

  parts.push(verbLatin);
  englishParts.push(verbEnglish);
  if (objectPhrase) {
    parts.push(objectPhrase.latin);
    englishParts.push(withArticle(objectPhrase.english, objectPhrase.number, objectPhrase.noArticle));
  }
  if (extra) {
    parts.push(extra.lemma);
    englishParts.push(firstGloss(extra.english));
  }

  const latinSentence = parts.join(" ") + ".";
  const englishSentence = englishParts.join(" ") + ".";
  const keyWords = [subjectPhrase.english, verbEnglish, objectPhrase ? objectPhrase.english : null, extra ? firstGloss(extra.english) : null]
    .filter(Boolean)
    .flatMap((s) => s.toLowerCase().split(/\s+/));

  return { latin: latinSentence, english: englishSentence, keyWords };
}

function withArticle(phrase, number, noArticle) {
  if (noArticle || number === "pl") return phrase;
  return `the ${phrase}`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ---- UI: menu --------------------------------------------------------

function renderLessonCheckboxes() {
  const lessons = [...new Set(WORD_BANK.map((w) => w.lesson))].sort((a, b) => a - b);
  const container = document.getElementById("lesson-list");
  container.innerHTML = "";
  lessons.forEach((n) => {
    const id = `lesson-${n}`;
    const label = document.createElement("label");
    label.className = "lesson-chip";
    label.innerHTML = `<input type="checkbox" id="${id}" value="${n}" checked> Lesson ${n}`;
    container.appendChild(label);
  });
  container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", syncSelectedLessons);
  });
  syncSelectedLessons();
}

function syncSelectedLessons() {
  selectedLessons = new Set(
    [...document.querySelectorAll("#lesson-list input:checked")].map((cb) => parseInt(cb.value, 10))
  );
  updateModeAvailability();
}

function updateModeAvailability() {
  const m1 = mode1Pool().length;
  const m2 = mode2Pool().length;
  const m3pools = mode3Pools();
  const m3ok = m3pools.nouns.length >= 1 && m3pools.verbs.length >= 1;

  setModeButtonState("mode1-btn", m1 > 0, `${m1} word${m1 === 1 ? "" : "s"} available`);
  setModeButtonState("mode2-btn", m2 >= 1, `${m2} declinable word${m2 === 1 ? "" : "s"} available`);
  setModeButtonState("mode3-btn", m3ok, m3ok
    ? `${m3pools.nouns.length} nouns, ${m3pools.verbs.length} verbs available`
    : "Needs at least 1 noun + 1 verb in the selected lessons");
}

function setModeButtonState(id, enabled, subtext) {
  const btn = document.getElementById(id);
  btn.disabled = !enabled;
  btn.querySelector(".mode-count").textContent = subtext;
}

function renderWordBankStatus() {
  document.getElementById("wordbank-source").textContent = wordBankSourceLabel();
  document.getElementById("wordbank-count").textContent = `${WORD_BANK.length} words loaded`;
}

// ---- screen management -----------------------------------------------

function showScreen(id) {
  ["menu", "quiz", "summary"].forEach((s) => {
    document.getElementById(s).style.display = s === id ? "block" : "none";
  });
}

// ---- shared quiz state -----------------------------------------------

let score = 0;
let answered = 0;
let totalQuestions = 0;

function resetScore() {
  score = 0;
  answered = 0;
}

function updateHud() {
  document.getElementById("score").textContent = score;
  document.getElementById("answered").textContent = answered;
}

function startMode(mode) {
  currentMode = mode;
  resetScore();
  showScreen("quiz");
  document.getElementById("quiz-title").textContent = {
    mode1: "Latin → English",
    mode2: "Case, Number & Gender",
    mode3: "Silly Sentences",
  }[mode];
  nextQuestion();
}

function nextQuestion() {
  const area = document.getElementById("quiz-area");
  area.innerHTML = "";
  document.getElementById("feedback").innerHTML = "";
  if (currentMode === "mode1") renderMode1Question(area);
  else if (currentMode === "mode2") renderMode2Question(area);
  else if (currentMode === "mode3") renderMode3Question(area);
  updateHud();
}

function recordAnswer(correct) {
  answered++;
  if (correct) score++;
  updateHud();
}

function showFeedback(correct, message) {
  const fb = document.getElementById("feedback");
  fb.innerHTML = `
    <div class="msg ${correct ? "good" : "bad"}">${correct ? "✓ Correct!" : "✗ Not quite"}</div>
    ${message ? `<div class="answer-box ${correct ? "good" : "bad"}">${message}</div>` : ""}
    <button class="action" id="next-btn">Next →</button>
    <button class="action secondary" id="end-btn">End Round</button>
  `;
  document.getElementById("next-btn").addEventListener("click", nextQuestion);
  document.getElementById("end-btn").addEventListener("click", endRound);
}

function endRound() {
  showScreen("summary");
  document.getElementById("final-score").textContent = `${score} / ${answered}`;
  const pct = answered ? Math.round((score / answered) * 100) : 0;
  let msg;
  if (!answered) msg = "No questions answered yet.";
  else if (pct === 100) msg = "Perfect score! 🎉";
  else if (pct >= 80) msg = "Great job!";
  else if (pct >= 50) msg = "Good start — keep practicing.";
  else msg = "Keep studying — you'll get there.";
  document.getElementById("final-msg").textContent = `${msg}${answered ? ` (${pct}%)` : ""}`;
}

// ---- Mode 1: Latin -> English ------------------------------------------

let mode1Current = null;

function renderMode1Question(area) {
  const pool = mode1Pool();
  mode1Current = randChoice(pool);
  area.innerHTML = `
    <div class="prompt-word">${mode1Current.lemma}</div>
    <div class="prompt-pos">${mode1Current.pos}</div>
    <input type="text" id="m1-input" class="text-input" placeholder="English meaning..." autocomplete="off">
    <button class="action" id="m1-submit">Check</button>
  `;
  const input = document.getElementById("m1-input");
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitMode1(); });
  document.getElementById("m1-submit").addEventListener("click", submitMode1);
}

function normalizeAnswer(s) {
  return s.toLowerCase().trim()
    .replace(/^(to|a|an|the)\s+/, "")
    .replace(/[.,!?;]+$/, "")
    .replace(/\s+/g, " ");
}

// Students naturally translate a 1st-principal-part verb like "habito" as a
// conjugated English phrase ("he/she/it lives", "I live"), so strip a leading
// subject pronoun before comparing.
const SUBJECT_PRONOUN_RE = /^(he\s*\/\s*she\s*\/\s*it|he\s*\/\s*she|he or she|he|she|it|they|i|we|you)\s+/;

// Every English string we'll accept for a word: each ";"-separated gloss,
// with and without its parenthetical note, plus the "he lives" 3rd-person
// form for verbs.
function acceptableAnswers(entry) {
  const out = new Set();
  for (const gloss of entry.english.split(";")) {
    for (const g of [gloss, gloss.replace(/\s*\([^)]*\)\s*/g, " ")]) {
      const n = normalizeAnswer(g);
      if (!n) continue;
      out.add(n);
      if (entry.pos === "verb") out.add(englishThirdPersonSingular(n));
    }
  }
  return out;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // swapped adjacent letters ("freind") count as one slip
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
    }
  }
  return dp[a.length][b.length];
}

// Returns "exact", "typo" (one-letter slip on a 5+ letter answer), or null.
// Also accepts a list like "house, villa" if any piece matches.
function gradeMode1(rawGiven, entry) {
  const acceptable = acceptableAnswers(entry);
  const stripSubject = (s) => (entry.pos === "verb" ? s.replace(SUBJECT_PRONOUN_RE, "") : s);
  const whole = stripSubject(normalizeAnswer(rawGiven));
  const candidates = [whole, ...whole.split(/\s*(?:,|;|\bor\b)\s*/).map((p) => stripSubject(normalizeAnswer(p)))]
    .filter(Boolean);
  if (candidates.some((c) => acceptable.has(c))) return "exact";
  for (const c of candidates) {
    for (const a of acceptable) {
      if (a.length >= 5 && editDistance(c, a) <= 1) return "typo";
    }
  }
  return null;
}

function submitMode1() {
  const input = document.getElementById("m1-input");
  if (!input || input.disabled) return;
  const grade = gradeMode1(input.value, mode1Current);
  const correct = grade !== null;
  input.disabled = true;
  input.classList.add(correct ? "correct" : "wrong");
  document.getElementById("m1-submit").disabled = true;
  recordAnswer(correct);
  const glosses = mode1Current.english.split(";").map((s) => `<li>${s.trim()}</li>`).join("");
  showFeedback(correct, `
    ${grade === "typo" ? `<div class="answer-note">Close enough — check your spelling.</div>` : ""}
    <div class="answer-label">${mode1Current.lemma} means</div>
    <ul class="answer-list">${glosses}</ul>
  `);
}

// ---- Mode 2: case / number / gender --------------------------------------

let mode2Current = null;
let mode2Answers = { kase: null, number: null, gender: null };

function renderMode2Question(area) {
  const pool = mode2Pool();
  const q = pickMode2Question(pool);
  if (!q) {
    area.innerHTML = `<div class="prompt-word">Not enough declinable words in this lesson selection.</div>`;
    return;
  }
  mode2Current = q;
  mode2Answers = { kase: null, number: null, gender: null };

  const needsGender = q.entry.pos !== "noun";

  area.innerHTML = `
    <div class="prompt-word">${q.form}</div>
    <div class="prompt-pos">${q.entry.pos} · lemma: ${q.entry.lemma}</div>

    <div class="qgroup">
      <div class="qlabel">Case</div>
      <div class="options" id="case-options">
        ${q.caseOptions.map((c) => `<button class="opt-btn" data-group="kase" data-value="${c}">${CASE_LABELS[c]}</button>`).join("")}
      </div>
    </div>

    <div class="qgroup">
      <div class="qlabel">Number</div>
      <div class="options">
        <button class="opt-btn" data-group="number" data-value="sg">Singular</button>
        <button class="opt-btn" data-group="number" data-value="pl">Plural</button>
      </div>
    </div>

    ${needsGender ? `
    <div class="qgroup">
      <div class="qlabel">Gender</div>
      <div class="options">
        <button class="opt-btn" data-group="gender" data-value="m">Masculine</button>
        <button class="opt-btn" data-group="gender" data-value="f">Feminine</button>
      </div>
    </div>` : ""}

    <button class="action" id="m2-submit" disabled>Check</button>
  `;

  area.querySelectorAll(".opt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.dataset.group;
      area.querySelectorAll(`.opt-btn[data-group="${group}"]`).forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      mode2Answers[group] = btn.dataset.value;
      maybeEnableSubmit(needsGender);
    });
  });
  document.getElementById("m2-submit").addEventListener("click", submitMode2);
}

function maybeEnableSubmit(needsGender) {
  const ready = mode2Answers.kase && mode2Answers.number && (!needsGender || mode2Answers.gender);
  document.getElementById("m2-submit").disabled = !ready;
}

function submitMode2() {
  const q = mode2Current;
  const needsGender = q.entry.pos !== "noun";
  const userGender = needsGender ? mode2Answers.gender : q.gender;
  const userTriple = `${mode2Answers.kase}:${mode2Answers.number}:${userGender}`;
  const correct = q.tieSet.has(userTriple);

  document.querySelectorAll(".opt-btn").forEach((b) => (b.disabled = true));
  document.getElementById("m2-submit").disabled = true;

  // Highlight one valid reading on the buttons: the user's own if correct,
  // otherwise the valid reading sharing the most parts with their answer
  // (so e.g. a right case + wrong number only flags the number).
  const [uc, un, ug] = userTriple.split(":");
  const shown = correct ? userTriple : [...q.tieSet].sort((a, b) => {
    const score = (t) => { const [c, n, g] = t.split(":"); return (c === uc) + (n === un) + (g === ug); };
    return score(b) - score(a);
  })[0];
  const [sc, sn, sg] = shown.split(":");
  const correctValue = { kase: sc, number: sn, gender: sg };
  document.querySelectorAll(".opt-btn").forEach((b) => {
    const isRight = correctValue[b.dataset.group] === b.dataset.value;
    if (isRight) b.classList.add("correct");
    else if (b.classList.contains("selected")) b.classList.add("wrong");
  });

  recordAnswer(correct);
  const readings = [...q.tieSet].map((t) => `<li>${formatTriple(t, needsGender)}</li>`).join("");
  showFeedback(correct, `
    <div class="answer-label">${q.tieSet.size > 1 ? "Valid readings (any is correct)" : "Answer"}</div>
    <ul class="answer-list">${readings}</ul>
    <div class="answer-gloss"><b>${q.form}</b> ← ${q.entry.lemma}, “${firstGloss(q.entry.english)}”</div>
  `);
}

// ---- Mode 3: silly sentences --------------------------------------------

let mode3Current = null;

function renderMode3Question(area) {
  const pools = mode3Pools();
  const sentence = buildSillySentence(pools);
  if (!sentence) {
    area.innerHTML = `<div class="prompt-word">Not enough vocabulary in this lesson selection to build a sentence.</div>`;
    return;
  }
  mode3Current = sentence;
  area.innerHTML = `
    <div class="prompt-word latin-sentence">${sentence.latin}</div>
    <input type="text" id="m3-input" class="text-input" placeholder="Your English translation..." autocomplete="off">
    <button class="action" id="m3-submit">Check</button>
  `;
  const input = document.getElementById("m3-input");
  input.focus();
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitMode3(); });
  document.getElementById("m3-submit").addEventListener("click", submitMode3);
}

function submitMode3() {
  const input = document.getElementById("m3-input");
  if (!input || input.disabled) return;
  const given = input.value.toLowerCase();
  const found = mode3Current.keyWords.filter((w) => given.includes(w));
  const missing = mode3Current.keyWords.filter((w) => !given.includes(w));

  input.disabled = true;
  document.getElementById("m3-submit").disabled = true;

  const area = document.getElementById("quiz-area");
  const checklist = document.createElement("div");
  checklist.className = "keyword-check";
  checklist.innerHTML = `
    <div class="reference"><strong>Reference translation:</strong> ${mode3Current.english}</div>
    <div class="kw-list">
      ${found.map((w) => `<span class="kw found">✓ ${w}</span>`).join("")}
      ${missing.map((w) => `<span class="kw missing">✗ ${w}</span>`).join("")}
    </div>
    <div class="self-grade">
      <span>Did you get it right?</span>
      <button class="action" id="self-yes">Yes</button>
      <button class="action secondary" id="self-no">No</button>
    </div>
  `;
  area.appendChild(checklist);

  document.getElementById("self-yes").addEventListener("click", () => finishMode3(true));
  document.getElementById("self-no").addEventListener("click", () => finishMode3(false));
}

function finishMode3(correct) {
  document.getElementById("self-yes").disabled = true;
  document.getElementById("self-no").disabled = true;
  recordAnswer(correct);
  showFeedback(correct, "");
}

// ---- boot ---------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  loadWordBank();
  renderWordBankStatus();
  renderLessonCheckboxes();

  document.getElementById("lessons-all").addEventListener("click", () => {
    document.querySelectorAll("#lesson-list input").forEach((cb) => (cb.checked = true));
    syncSelectedLessons();
  });
  document.getElementById("lessons-none").addEventListener("click", () => {
    document.querySelectorAll("#lesson-list input").forEach((cb) => (cb.checked = false));
    syncSelectedLessons();
  });

  document.getElementById("mode1-btn").addEventListener("click", () => startMode("mode1"));
  document.getElementById("mode2-btn").addEventListener("click", () => startMode("mode2"));
  document.getElementById("mode3-btn").addEventListener("click", () => startMode("mode3"));

  document.getElementById("csv-file-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById("csv-load-status");
    try {
      const count = await loadWordBankFromFile(file);
      statusEl.textContent = `Loaded ${count} rows from ${file.name}.`;
      statusEl.className = "csv-status ok";
      renderWordBankStatus();
      renderLessonCheckboxes();
    } catch (err) {
      statusEl.textContent = `Error: ${err.message}`;
      statusEl.className = "csv-status error";
    }
  });
  document.getElementById("csv-reset-btn").addEventListener("click", () => {
    resetWordBankToDefault();
    document.getElementById("csv-load-status").textContent = "Reset to bundled default.";
    document.getElementById("csv-load-status").className = "csv-status ok";
    renderWordBankStatus();
    renderLessonCheckboxes();
  });

  document.getElementById("quiz-menu-link").addEventListener("click", () => showScreen("menu"));
  document.getElementById("summary-menu-link").addEventListener("click", () => showScreen("menu"));
  document.getElementById("play-again-btn").addEventListener("click", () => startMode(currentMode));
});

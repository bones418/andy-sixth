// ---------------------------------------------------------------------------
// Minimal Latin morphology engine for the Ecce Romani study app.
//
// Design: for regular nouns/adjectives we only need the lemma (nominative
// singular, or 1st-person-singular for verbs) plus the genitive singular
// (for nouns/adjectives) or conjugation + infinitive (for verbs) to derive
// every form we need mechanically. Anything that doesn't fit a regular
// pattern (pronouns, irregular verbs, a handful of irregular nouns) is
// stored as a hand-written paradigm instead of generated.
//
// Works unmodified in Node (for testing) and in the browser (plain script).
// ---------------------------------------------------------------------------

const CASES = ["nom", "gen", "dat", "acc", "abl"];
const NUMBERS = ["sg", "pl"];
const GENDERS = ["m", "f", "n"];

function stripEnding(form, ending) {
  if (!form.endsWith(ending)) {
    throw new Error(`Expected "${form}" to end with "${ending}"`);
  }
  return form.slice(0, form.length - ending.length);
}

// ---- noun declension ------------------------------------------------------

// Each table maps gender -> { nom/acc overrides use lemma directly } and
// the case endings appended to the stem for every other slot.
// stem = genitive singular with its case ending removed (see genStemEnding).
const NOUN_GEN_SG_ENDING = { 1: "ae", 2: "i", 3: "is", 4: "us", 5: "ei" };

const NOUN_ENDINGS = {
  1: { // puella, -ae, f.
    f: {
      sg: { gen: "ae", dat: "ae", acc: "am", abl: "a" },
      pl: { nom: "ae", gen: "arum", dat: "is", acc: "as", abl: "is" },
    },
  },
  2: { // servus/-i m.; templum/-i n.
    m: {
      sg: { gen: "i", dat: "o", acc: "um", abl: "o" },
      pl: { nom: "i", gen: "orum", dat: "is", acc: "os", abl: "is" },
    },
    n: {
      sg: { gen: "i", dat: "o", acc: null /* = nom */, abl: "o" },
      pl: { nom: "a", gen: "orum", dat: "is", acc: "a", abl: "is" },
    },
  },
  3: { // rex/regis m.; mater/matris f.; nomen/nominis n.
    m: {
      sg: { gen: "is", dat: "i", acc: "em", abl: "e" },
      pl: { nom: "es", gen: "um", dat: "ibus", acc: "es", abl: "ibus" },
    },
    f: {
      sg: { gen: "is", dat: "i", acc: "em", abl: "e" },
      pl: { nom: "es", gen: "um", dat: "ibus", acc: "es", abl: "ibus" },
    },
    n: {
      sg: { gen: "is", dat: "i", acc: null, abl: "e" },
      pl: { nom: "a", gen: "um", dat: "ibus", acc: "a", abl: "ibus" },
    },
  },
  4: { // manus/-us f.; cornu/-us n. (neuter 4th decl is rare/irregular here)
    m: {
      sg: { gen: "us", dat: "ui", acc: "um", abl: "u" },
      pl: { nom: "us", gen: "uum", dat: "ibus", acc: "us", abl: "ibus" },
    },
    f: {
      sg: { gen: "us", dat: "ui", acc: "um", abl: "u" },
      pl: { nom: "us", gen: "uum", dat: "ibus", acc: "us", abl: "ibus" },
    },
  },
  5: { // res/rei f.; dies/diei m.
    m: {
      sg: { gen: "ei", dat: "ei", acc: "em", abl: "e" },
      pl: { nom: "es", gen: "erum", dat: "ebus", acc: "es", abl: "ebus" },
    },
    f: {
      sg: { gen: "ei", dat: "ei", acc: "em", abl: "e" },
      pl: { nom: "es", gen: "erum", dat: "ebus", acc: "es", abl: "ebus" },
    },
  },
};

// entry: { lemma, gender, declension, genitive }
function declineNoun(entry, kase, number) {
  if (kase === "nom" && number === "sg") return entry.lemma;

  const table = NOUN_ENDINGS[entry.declension];
  if (!table) throw new Error(`No noun table for declension ${entry.declension}`);
  const genderTable = table[entry.gender] || table.m || table.f;
  if (!genderTable) throw new Error(`No ${entry.gender} pattern for declension ${entry.declension}`);

  const genEnding = NOUN_GEN_SG_ENDING[entry.declension];
  const stem = stripEnding(entry.genitive, genEnding);

  const slot = genderTable[number][kase];
  if (number === "sg" && kase === "nom") return entry.lemma;
  if (slot === null) return number === "sg" ? entry.lemma : declineNoun(entry, "nom", "pl"); // neuter acc = nom
  if (slot === undefined) throw new Error(`No ending for ${kase}/${number}`);
  return stem + slot;
}

// ---- adjective declension (1st/2nd pattern: -us/-a/-um, -er/-a/-um, -er/-era/-erum) ----

// The "big nine" irregular 1st/2nd declension adjectives (unus, solus, totus,
// ullus, nullus, alter, uter, neuter, alius) take -ius in the genitive
// singular and -i in the dative singular, for ALL genders, otherwise
// regular. Keyed by lemma.
const ADJ_IRREGULAR_GEN_DAT_SG = {
  unus: { gen: "unius", dat: "uni" },
  solus: { gen: "solius", dat: "soli" },
  totus: { gen: "totius", dat: "toti" },
  ullus: { gen: "ullius", dat: "ulli" },
  nullus: { gen: "nullius", dat: "nulli" },
  alter: { gen: "alterius", dat: "alteri" },
  uter: { gen: "utrius", dat: "utri" },
  neuter: { gen: "neutrius", dat: "neutri" },
  alius: { gen: "alius", dat: "alii" },
};

// entry: { lemma (masc nom sg), genitive (masc gen sg, e.g. "pulchri") }
function declineAdjective(entry, kase, number, gender) {
  const stem = stripEnding(entry.genitive, "i"); // masc genitive sg always ends "-i"

  const irregular = ADJ_IRREGULAR_GEN_DAT_SG[entry.lemma];
  if (irregular && number === "sg" && (kase === "gen" || kase === "dat")) {
    return irregular[kase];
  }
  // alius, alia, aliud — uniquely has neuter nom/acc sg "-ud" instead of "-um"
  if (entry.lemma === "alius" && gender === "n" && number === "sg" && (kase === "nom" || kase === "acc")) {
    return stem + "ud";
  }

  if (gender === "m") {
    if (kase === "nom" && number === "sg") return entry.lemma;
    const endings = {
      sg: { gen: "i", dat: "o", acc: "um", abl: "o" },
      pl: { nom: "i", gen: "orum", dat: "is", acc: "os", abl: "is" },
    };
    return stem + endings[number][kase];
  }
  if (gender === "f") {
    const endings = {
      sg: { nom: "a", gen: "ae", dat: "ae", acc: "am", abl: "a" },
      pl: { nom: "ae", gen: "arum", dat: "is", acc: "as", abl: "is" },
    };
    return stem + endings[number][kase];
  }
  // neuter
  const endings = {
    sg: { nom: "um", gen: "i", dat: "o", acc: "um", abl: "o" },
    pl: { nom: "a", gen: "orum", dat: "is", acc: "a", abl: "is" },
  };
  return stem + endings[number][kase];
}

// ---- hardcoded irregular pronoun / adjective paradigms ---------------------
// Keyed by the lemma stored in the word bank (nom sg masc, or conventional
// citation form). Each is [gender][number][case] -> form.

const PRONOUN_PARADIGMS = {
  "is": { // is, ea, id — "he/she/it, this/that"
    m: { sg: { nom: "is", gen: "eius", dat: "ei", acc: "eum", abl: "eo" },
         pl: { nom: "ei", gen: "eorum", dat: "eis", acc: "eos", abl: "eis" } },
    f: { sg: { nom: "ea", gen: "eius", dat: "ei", acc: "eam", abl: "ea" },
         pl: { nom: "eae", gen: "earum", dat: "eis", acc: "eas", abl: "eis" } },
    n: { sg: { nom: "id", gen: "eius", dat: "ei", acc: "id", abl: "eo" },
         pl: { nom: "ea", gen: "eorum", dat: "eis", acc: "ea", abl: "eis" } },
  },
  "hic": { // hic, haec, hoc — "this"
    m: { sg: { nom: "hic", gen: "huius", dat: "huic", acc: "hunc", abl: "hoc" },
         pl: { nom: "hi", gen: "horum", dat: "his", acc: "hos", abl: "his" } },
    f: { sg: { nom: "haec", gen: "huius", dat: "huic", acc: "hanc", abl: "hac" },
         pl: { nom: "hae", gen: "harum", dat: "his", acc: "has", abl: "his" } },
    n: { sg: { nom: "hoc", gen: "huius", dat: "huic", acc: "hoc", abl: "hoc" },
         pl: { nom: "haec", gen: "horum", dat: "his", acc: "haec", abl: "his" } },
  },
  "ille": { // ille, illa, illud — "that"
    m: { sg: { nom: "ille", gen: "illius", dat: "illi", acc: "illum", abl: "illo" },
         pl: { nom: "illi", gen: "illorum", dat: "illis", acc: "illos", abl: "illis" } },
    f: { sg: { nom: "illa", gen: "illius", dat: "illi", acc: "illam", abl: "illa" },
         pl: { nom: "illae", gen: "illarum", dat: "illis", acc: "illas", abl: "illis" } },
    n: { sg: { nom: "illud", gen: "illius", dat: "illi", acc: "illud", abl: "illo" },
         pl: { nom: "illa", gen: "illorum", dat: "illis", acc: "illa", abl: "illis" } },
  },
  "qui": { // qui, quae, quod — relative/interrogative "who/which"
    m: { sg: { nom: "qui", gen: "cuius", dat: "cui", acc: "quem", abl: "quo" },
         pl: { nom: "qui", gen: "quorum", dat: "quibus", acc: "quos", abl: "quibus" } },
    f: { sg: { nom: "quae", gen: "cuius", dat: "cui", acc: "quam", abl: "qua" },
         pl: { nom: "quae", gen: "quarum", dat: "quibus", acc: "quas", abl: "quibus" } },
    n: { sg: { nom: "quod", gen: "cuius", dat: "cui", acc: "quod", abl: "quo" },
         pl: { nom: "quae", gen: "quorum", dat: "quibus", acc: "quae", abl: "quibus" } },
  },
  "ipse": { // ipse, ipsa, ipsum — "himself/herself/itself"
    m: { sg: { nom: "ipse", gen: "ipsius", dat: "ipsi", acc: "ipsum", abl: "ipso" },
         pl: { nom: "ipsi", gen: "ipsorum", dat: "ipsis", acc: "ipsos", abl: "ipsis" } },
    f: { sg: { nom: "ipsa", gen: "ipsius", dat: "ipsi", acc: "ipsam", abl: "ipsa" },
         pl: { nom: "ipsae", gen: "ipsarum", dat: "ipsis", acc: "ipsas", abl: "ipsis" } },
    n: { sg: { nom: "ipsum", gen: "ipsius", dat: "ipsi", acc: "ipsum", abl: "ipso" },
         pl: { nom: "ipsa", gen: "ipsorum", dat: "ipsis", acc: "ipsa", abl: "ipsis" } },
  },
  "idem": { // idem, eadem, idem — "the same"
    m: { sg: { nom: "idem", gen: "eiusdem", dat: "eidem", acc: "eundem", abl: "eodem" },
         pl: { nom: "eidem", gen: "eorundem", dat: "eisdem", acc: "eosdem", abl: "eisdem" } },
    f: { sg: { nom: "eadem", gen: "eiusdem", dat: "eidem", acc: "eandem", abl: "eadem" },
         pl: { nom: "eaedem", gen: "earundem", dat: "eisdem", acc: "easdem", abl: "eisdem" } },
    n: { sg: { nom: "idem", gen: "eiusdem", dat: "eidem", acc: "idem", abl: "eodem" },
         pl: { nom: "eadem", gen: "eorundem", dat: "eisdem", acc: "eadem", abl: "eisdem" } },
  },
};

function declinePronoun(lemma, kase, number, gender) {
  const paradigm = PRONOUN_PARADIGMS[lemma];
  if (!paradigm) throw new Error(`No pronoun paradigm for "${lemma}"`);
  return paradigm[gender][number][kase];
}

// ---- verb conjugation (present active indicative, 3rd person only) --------
// We only ever need 3rd person for sentence-building, so that's all this
// engine produces. entry: { lemma, conj, principalParts: [p1,p2,p3,p4] }

const IRREGULAR_VERBS = {
  "sum": { sg: "est", pl: "sunt" },
  "possum": { sg: "potest", pl: "possunt" },
  "eo": { sg: "it", pl: "eunt" },
  "volo": { sg: "vult", pl: "volunt" },
  "nolo": { sg: "non vult", pl: "nolunt" },
  "fero": { sg: "fert", pl: "ferunt" },
  "fio": { sg: "fit", pl: "fiunt" },
  "exeo": { sg: "exit", pl: "exeunt" },
  "abeo": { sg: "abit", pl: "abeunt" },
  "redeo": { sg: "redit", pl: "redeunt" },
};

function conjugatePresent3(entry, number) {
  if (IRREGULAR_VERBS[entry.lemma]) return IRREGULAR_VERBS[entry.lemma][number];

  const infinitive = entry.principalParts[1];
  let stem, thirdSg, thirdPl;
  switch (entry.conj) {
    case "1": stem = stripEnding(infinitive, "are"); thirdSg = stem + "at"; thirdPl = stem + "ant"; break;
    case "2": stem = stripEnding(infinitive, "ere"); thirdSg = stem + "et"; thirdPl = stem + "ent"; break;
    case "3": stem = stripEnding(infinitive, "ere"); thirdSg = stem + "it"; thirdPl = stem + "unt"; break;
    case "3io": stem = stripEnding(infinitive, "ere"); thirdSg = stem + "it"; thirdPl = stem + "iunt"; break;
    case "4": stem = stripEnding(infinitive, "ire"); thirdSg = stem + "it"; thirdPl = stem + "iunt"; break;
    default: throw new Error(`Unknown conjugation "${entry.conj}" for "${entry.lemma}"`);
  }
  return number === "sg" ? thirdSg : thirdPl;
}

// ---- exports (both CommonJS for tests and window global for the browser) --

const Morphology = {
  CASES, NUMBERS, GENDERS,
  declineNoun, declineAdjective, declinePronoun, conjugatePresent3,
  PRONOUN_PARADIGMS, IRREGULAR_VERBS,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = Morphology;
}
if (typeof window !== "undefined") {
  window.Morphology = Morphology;
}

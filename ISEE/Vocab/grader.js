// ---------------------------------------------------------------------------
// Lenient definition grader.
//
// Kids won't reproduce a dictionary definition word-for-word, so instead of
// string matching we compare *meaningful words*: both the answer and the
// definition are lowercased, stripped of filler words ("to", "a", "something"),
// stemmed ("hated" -> "hat", "hate" -> "hat"), and matched with typo tolerance
// and a small synonym list ("mad" ~ "angry"). Word order doesn't matter.
//
// Definitions are often lists of alternatives ("sly, witty, often smart..."),
// so we score against each comma/semicolon-separated phrase and take the best.
//
// Returns { grade: "mostly" | "somewhat" | "miss", matched: [definition words hit] }
// Works in the browser (window.Grader) and Node (module.exports) for testing.
// ---------------------------------------------------------------------------

(function () {
  const STOP = new Set(`a an the to of or and in on at by for with as from into onto upon over
    that this these those be is are was were being been am it its it's itself
    something someone somebody somewhat one ones person people thing things stuff
    very much more most usually often especially etc particular particularly some any
    not no without do does did doing done have has had having get gets got
    can could will would should may might must which who whom what when where how
    like such so too also just only than then there their they them he she his her
    you your we our i me my state quality act way kind sort type
    noun verb adjective adverb`.split(/\s+/));

  // Each group is a set of words treated as the same meaning. A word may
  // appear in more than one group.
  const SYNONYM_GROUPS = `
    big large huge enormous giant gigantic massive vast great colossal
    small little tiny minor
    happy glad joyful cheerful joy jolly delighted pleased
    sad unhappy sorrow sorrowful gloomy miserable upset depressed down blue
    angry mad furious rage anger annoyed irritated
    scared afraid fear frightened terrified fearful
    fast quick quickly rapid speedy swift hurry hurried
    smart clever intelligent wise bright brainy
    dumb stupid foolish silly
    mean cruel unkind nasty merciless ruthless
    nice kind friendly pleasant
    hate dislike loathe detest despise abhor
    love adore
    strong powerful sturdy tough
    weak feeble frail
    tired sleepy exhausted weary
    shy timid bashful
    brave courageous bold fearless daring
    calm peaceful quiet tranquil serene relaxed
    loud noisy
    hard difficult
    easy simple
    start begin initiate
    end stop finish cease quit
    help aid assist
    hide conceal cover
    show display reveal
    say tell state declare announce speak
    make create build
    break smash shatter
    look see watch observe view
    real genuine true authentic actual
    fake false phony counterfeit
    old ancient
    new fresh novel
    dangerous harmful hazardous deadly unsafe risky damaging
    safe secure protected
    clean spotless pure
    dirty filthy
    strange weird odd unusual peculiar
    normal ordinary common usual typical regular
    important significant crucial essential necessary needed vital
    praise compliment
    steal rob
    give donate
    argue fight quarrel disagree
    think ponder consider reflect
    plenty lot lots many plentiful abundant
    short brief shorten
    long lengthen extend
    change alter modify adjust
    agree accept approve
    deny refuse reject decline
    trick fool deceive con mislead delude
    join combine merge unite connect attach
    separate split divide
    shake tremble shiver quiver
    sure certain
    unclear vague confusing obscure ambiguous
    confused puzzled bewildered perplexed
    rude impolite
    proud arrogant conceited snobby
    skilled skillful talented expert
    honest truthful sincere frank
    mix jumble
    job work occupation career
    money cash
    rule govern control
    stubborn obstinate
    funny humorous comical
    lonely alone
    goal aim purpose target
    tease mock
    animal creature organism
    hole pit gap
    idle lazy slow
    harmless gentle
    hungry starving famished
    jealous envious
    honest genuine real
    hidden covered concealed
    boring dull tedious ordinary common
    respect admire regard honor look
    force compel make pressure
    slow delay hinder prevent block stop
    direct straightforward straight blunt outspoken frank candid upfront
    clear obvious plain evident apparent
    careful cautious watchful alert
    careless reckless rash hasty
    praise compliment applaud admire
    criticize scold blame rebuke
    worry anxious nervous uneasy concern
    sure confident certain positive
    doubt uncertain unsure suspicious
    tidy neat organized orderly
    messy disorderly chaotic sloppy
    ask question inquire request
    answer reply respond retort
    trust believe faith
    rich wealthy prosperous
    poor needy broke
    gentle soft mild tender
    rough harsh coarse
    bright shiny glowing gleaming shine sparkle
    dark gloomy dim murky
    wet damp soggy soak
    hot warm heat
    cold chilly cool freezing
    eat devour consume
    talk chat speak conversation
    walk stroll wander roam
    run dash sprint rush
    sharp pointed keen
    loyal faithful devoted dedicated
    lie deceive dishonest
    free release liberate
    lucky fortunate
    wise sage knowledgeable
    fair just equal equitable
    useful helpful handy practical
    useless pointless worthless futile
    whole complete entire total
    part piece portion fraction
    group crowd bunch collection
    hurt injure harm wound pain
    fix repair mend restore
    save rescue protect preserve
    remove delete eliminate erase
    copy imitate mimic
    sneaky sly crafty cunning tricky
    nosy curious
    greedy selfish
    generous giving charitable
    quiet silent still hush
    noisy loud rowdy
    grumpy cranky irritable moody
    excited thrilled eager enthusiastic
    bored uninterested indifferent
    famous wellknown celebrated renowned known
    secret hidden private
    weird odd bizarre
    tiny miniature minute
    lots plenty heaps
    always forever eternal endless permanent
    never rarely seldom
    heavy weighty
    light weightless
    shrink decrease reduce lessen diminish
    grow increase expand enlarge
    smell odor scent
    friendly amiable sociable outgoing
    sleep rest nap doze
    bad evil wicked
    good fine excellent
    holy sacred religious divine
    calm composed collected relaxed`;

  // stem -> Set of group ids
  const SYNONYMS = new Map();

  function stem(w) {
    w = w.replace(/'s$/, "");
    if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
    else if (w.length > 4 && w.endsWith("ied")) w = w.slice(0, -3) + "y";
    else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.length > 5 && w.endsWith("ness")) w = w.slice(0, -4);
    else if (w.length > 6 && w.endsWith("ment")) w = w.slice(0, -4);
    else if (w.length > 4 && w.endsWith("ly")) w = w.slice(0, -2);
    else if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) w = w.slice(0, -1);
    if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
    // doubled final consonant left by stripping (stopped -> stopp -> stop)
    if (w.length > 3 && /([bdfgmnprt])\1$/.test(w)) w = w.slice(0, -1);
    return w;
  }

  SYNONYM_GROUPS.trim().split("\n").forEach((line, i) => {
    line.trim().split(/\s+/).forEach((word) => {
      const k = stem(word);
      if (!SYNONYMS.has(k)) SYNONYMS.set(k, new Set());
      SYNONYMS.get(k).add(i);
    });
  });

  // The word bank doubles as a thesaurus: a definition phrase that is a single
  // word ("candid: sincere, frank") is a synonym of the vocab word, so each
  // entry's one-word phrases join it in a synonym group.
  function addWordBankSynonyms(rows) {
    let id = SYNONYM_GROUPS.trim().split("\n").length;
    for (const [word, , , def] of rows) {
      const singles = definitionPhrases(def).filter((p) => p.length === 1).map((p) => p[0]);
      if (!singles.length) continue;
      for (const w of [stem(word.toLowerCase()), ...singles]) {
        if (!SYNONYMS.has(w)) SYNONYMS.set(w, new Set());
        SYNONYMS.get(w).add(id);
      }
      id++;
    }
    groupCache.clear();
  }

  // "not harmful" / "not careful" -> "harmless" / "careless", so negations
  // compare as one word instead of matching the un-negated word.
  function foldNegation(text) {
    return text.toLowerCase().replace(/\b(?:not|non)\s+([a-z]+?)(?:ful)?\b/g, (_, w) => stem(w) + "less");
  }

  function contentWords(text) {
    return foldNegation(text)
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z'\s-]/g, " ")
      .split(/[\s-]+/)
      .map((w) => w.replace(/^'+|'+$/g, ""))
      .filter((w) => w && !STOP.has(w))
      .map(stem)
      .filter((w) => w.length > 1);
  }

  function editDistance(a, b) {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
    return dp[a.length][b.length];
  }

  // Same word family: exact, one stem starts the other ("inform"/
  // "information"), or a one-letter typo on longer words.
  function sameFamily(a, b) {
    if (a === b) return true;
    const [s, l] = a.length <= b.length ? [a, b] : [b, a];
    if (s.length >= 4 && l.startsWith(s)) return true;
    return Math.min(a.length, b.length) >= 5 && editDistance(a, b) <= 1;
  }

  // Synonym groups for a word, including groups of its word family (so
  // "doubtful" picks up the group listing "doubt").
  const groupCache = new Map();
  function groupsOf(w) {
    if (!groupCache.has(w)) {
      const groups = new Set();
      for (const [k, ids] of SYNONYMS) {
        if (k === w || (k.length >= 4 && w.length >= 4 && sameFamily(k, w))) ids.forEach((id) => groups.add(id));
      }
      groupCache.set(w, groups);
    }
    return groupCache.get(w);
  }

  function wordsMatch(a, b) {
    if (sameFamily(a, b)) return true;
    const ga = groupsOf(a), gb = groupsOf(b);
    return [...ga].some((g) => gb.has(g));
  }

  // Split a definition into alternative phrases: by ";" and ",", dropping
  // embedded part-of-speech labels like "or, verb - to attach".
  function definitionPhrases(definition) {
    return definition
      .replace(/\b(noun|verb|adjective|adverb)\s*-\s*/g, "")
      .split(/[;,:]/)
      .map(contentWords)
      .filter((p) => p.length);
  }

  // entry: { word, def, extra? } where extra is a ";"-separated list of
  // additional accepted answers (synonyms.js).
  function grade(answer, entry) {
    const vocabStem = stem(entry.word.toLowerCase());
    // Using the vocab word itself (or its family) as the answer earns nothing.
    const words = contentWords(answer);
    // also try adjacent words joined, so "straight forward" = "straightforward"
    const joined = words.slice(1).map((w, i) => stem(words[i] + w));
    const given = [...new Set([...words, ...joined])].filter((w) => !sameFamily(w, vocabStem));
    if (!given.length) return { grade: "miss", matched: [] };

    const defPhrases = definitionPhrases(entry.def);
    const phrases = [...defPhrases, ...(entry.extra ? definitionPhrases(entry.extra) : [])];
    const allDefWords = [...new Set(phrases.flat())];
    const hit = (dw) => given.some((g) => wordsMatch(g, dw));
    const matched = allDefWords.filter(hit);
    const defWords = [...new Set(defPhrases.flat())];

    let bestCoverage = 0;
    for (const p of phrases) {
      const uniq = [...new Set(p)];
      bestCoverage = Math.max(bestCoverage, uniq.filter(hit).length / uniq.length);
    }
    const overall = defWords.filter(hit).length / defWords.length;

    // A short answer whose every word lands ("combine" for "to join two
    // things together") is a good paraphrase even if coverage is low.
    const plain = words.filter((w) => !sameFamily(w, vocabStem));
    const answerAllHits = plain.length > 0 && plain.length <= 2 &&
      plain.every((g) => allDefWords.some((dw) => wordsMatch(g, dw)));

    // A known synonym of the vocab word itself ("hard" for "difficult").
    const synonymOfWord = given.some((g) => wordsMatch(g, vocabStem));

    let g = "miss";
    if (bestCoverage >= 0.6 || overall >= 0.4 || matched.length >= 3 || answerAllHits || synonymOfWord) g = "mostly";
    else if (matched.length >= 1) g = "somewhat";
    return { grade: g, matched };
  }

  const Grader = { grade, contentWords, stem, addWordBankSynonyms };
  if (typeof module !== "undefined" && module.exports) module.exports = Grader;
  if (typeof window !== "undefined") {
    window.Grader = Grader;
    if (window.WORD_BANK) addWordBankSynonyms(window.WORD_BANK);
  }
})();

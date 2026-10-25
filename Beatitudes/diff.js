// ---------------------------------------------------------------------------
// Word-by-word comparison of a recited answer against the correct text, like
// an inline git diff: words in both are "same", words left out are "missing",
// words that shouldn't be there are "extra".
//
// Comparison ignores case and punctuation, and forgives common speech-to-text
// slips: homophones ("there's" for "theirs") and compound words split in two
// ("peace makers" for "peacemakers").
// Works in the browser (window.WordDiff) and Node (for testing).
// ---------------------------------------------------------------------------

(function () {
  // what speech-to-text often hears -> the word in the Beatitudes
  const SOUNDS_LIKE = {
    there: "theirs", their: "theirs", "their's": "theirs",
    blest: "blessed",
    morn: "mourn", morne: "mourn",
    meak: "meek",
    piece: "peace",
    suns: "sons",
    shell: "shall",
    "heaven's": "heaven",
    "righteousness's": "righteousness",
  };

  // one spoken word heard for two written ones: "theirs is" -> "there's"
  const EXPANDS = { "there's": ["theirs", "is"], theres: ["theirs", "is"] };

  function norm(word) {
    const w = word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, "").replace(/^'+|'+$/g, "");
    return SOUNDS_LIKE[w] || w;
  }

  // Split text into { show, key } tokens (show = as written, key = compared)
  function tokens(text) {
    return text.split(/\s+/).filter(Boolean).flatMap((w) => {
      const raw = w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, "");
      if (EXPANDS[raw]) return EXPANDS[raw].map((key, i) => ({ show: i ? "" : w, key }));
      return [{ show: w, key: norm(w) }];
    }).filter((t) => t.key);
  }

  // Merge two spoken words when together they make one expected word:
  // "peace makers" -> "peacemakers".
  function mergeSplitWords(said, expectedKeys) {
    const out = [];
    for (let i = 0; i < said.length; i++) {
      const next = said[i + 1];
      if (next && !expectedKeys.has(said[i].key) && expectedKeys.has(said[i].key + next.key)) {
        out.push({ show: `${said[i].show} ${next.show}`, key: said[i].key + next.key });
        i++;
      } else {
        out.push(said[i]);
      }
    }
    return out;
  }

  // Returns { parts: [{ type: "same"|"missing"|"extra", text }], same, missing, extra, total }
  function diff(correctText, answerText) {
    const want = tokens(correctText);
    const said = mergeSplitWords(tokens(answerText), new Set(want.map((t) => t.key)));

    // longest common subsequence table
    const n = want.length, m = said.length;
    const L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i][j] = want[i].key === said[j].key ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      }
    }

    const parts = [];
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && want[i].key === said[j].key) {
        parts.push({ type: "same", text: want[i].show }); i++; j++;
      } else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) {
        parts.push({ type: "extra", text: said[j].show }); j++;
      } else {
        parts.push({ type: "missing", text: want[i].show }); i++;
      }
    }
    const count = (t) => parts.filter((p) => p.type === t).length;
    return { parts, same: count("same"), missing: count("missing"), extra: count("extra"), total: n };
  }

  const WordDiff = { diff, norm };
  if (typeof module !== "undefined" && module.exports) module.exports = WordDiff;
  if (typeof window !== "undefined") window.WordDiff = WordDiff;
})();

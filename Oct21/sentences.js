// Quiz sentences and answer key.
//   words: the sentence split into tappable words (punctuation stays attached)
//   subject / verb / object: indexes into words that should be circled /
//     underlined / bracketed. A phrase like "necesse est" or
//     "tunicam et togam" lists every word in it.
//   translation: shown under Andy's own translation for him to compare.
window.SENTENCES = [
  {
    words: ["Omnia", "statim", "parare", "necesse", "est", "quod", "nos", "hodie", "Romam", "redimus."],
    subject: [6],
    verb: [2, 3, 4, 9],
    object: [0],
    translation: "It is necessary to prepare everything immediately because we are returning to Rome today.",
  },
  {
    words: ["Intrat", "igitur", "cubiculum", "Marci."],
    subject: [],
    verb: [0],
    object: [2],
    translation: "Therefore, she enters the room of Marcus.",
  },
  {
    words: ["Celeriter", "tunicam", "et", "togam", "induit", "et", "brevi", "tempore", "e", "cubiculo", "currit."],
    subject: [],
    verb: [4, 10],
    object: [1, 2, 3],
    translation: "Quickly he puts on his tunic and toga and in a short time runs out of the bedroom.",
  },
  {
    words: ["“Ego", "non", "surgo,”", "inquit,", "“quod", "Romam", "redire", "nolo.”"],
    subject: [0],
    verb: [1, 2, 3, 6, 7],
    object: [],
    translation: "“I'm not getting up,” he says, “because I don't want to return to Rome.”",
  },
  {
    words: ["Cur", "nondum", "tunicam", "et", "togam", "induis,", "moleste", "puer?"],
    subject: [],
    verb: [5],
    object: [2, 3, 4],
    translation: "Why do you not yet put on your tunic and toga, annoying boy?",
  },
];

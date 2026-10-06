#!/usr/bin/env python3
"""
Builds lib/word_bank.csv from the ROWS list below.

This script is the "source of truth" generator — if you need to fix a typo
or add a word, you can either edit the ROWS list here and re-run this
script, OR just edit lib/word_bank.csv directly by hand (it's a plain CSV,
openable in Excel/Numbers/Google Sheets). Either way works; this script
just exists so corrections can be made in readable Python dicts instead of
raw CSV if you prefer.

Column meanings:
  lesson           - chapter number (1-10) the word is first taught in
  lemma            - citation/dictionary form: nominative singular for
                     nouns/adjectives/pronouns, 1st person singular present
                     for verbs, as-is for everything else (indeclinables,
                     fixed phrases)
  pos              - noun | verb | adjective | pronoun | adverb |
                     conjunction | interjection | phrase
  english          - meaning(s), separated by "; " if more than one
  gender           - m | f | n (nouns/adjectives/pronouns only; blank = n/a
                     or not graded in Mode 2)
  declension       - 1-5 for nouns; blank for adjectives (adjectives are
                     assumed 1st/2nd pattern if "genitive" is filled in)
  genitive         - genitive singular (nouns), or masc. genitive singular
                     (1st/2nd adjectives) -- this is what the inflection
                     engine derives every other form from. Blank = not
                     declinable by the engine (excluded from Mode 2).
  conj             - 1 | 2 | 3 | 3io | 4 | irregular (verbs only)
  principal_parts  - 4 principal parts separated by " ; " (verbs only)
  notes            - free text: flags, irregularities, source confidence
"""

import csv
import io
import json

ROWS = [
    # ---- Chapter 1: "Two Roman Girls" ----
    dict(lesson=1, lemma="puella", pos="noun", english="girl", gender="f", declension=1, genitive="puellae"),
    dict(lesson=1, lemma="villa", pos="noun", english="house; villa", gender="f", declension=1, genitive="villae"),
    dict(lesson=1, lemma="villa rustica", pos="phrase", english="country house and farm", notes="fixed phrase, not declined by the app"),
    dict(lesson=1, lemma="vicinus", pos="adjective", english="neighboring; (as noun) neighbor", genitive="vicini", notes="textbook shows fem. form 'vicina' agreeing with puella"),
    dict(lesson=1, lemma="laetus", pos="adjective", english="happy", genitive="laeti", notes="textbook shows fem. form 'laeta'"),
    dict(lesson=1, lemma="alter", pos="adjective", english="other; second", genitive="alteri", notes="irregular gen/dat sg: alterius/alteri; textbook shows fem. form 'altera'"),
    dict(lesson=1, lemma="qui", pos="pronoun", english="who; which", gender="f", genitive="n/a", notes="relative pronoun qui/quae/quod; textbook shows fem. form 'quae'"),
    dict(lesson=1, lemma="habito", pos="verb", english="live; dwell", conj="1", principal_parts="habito;habitare;habitavi;habitatum"),
    dict(lesson=1, lemma="sedeo", pos="verb", english="sit", conj="2", principal_parts="sedeo;sedere;sedi;sessum"),
    dict(lesson=1, lemma="lego", pos="verb", english="read; gather; choose", conj="3", principal_parts="lego;legere;legi;lectum"),
    dict(lesson=1, lemma="scribo", pos="verb", english="write", conj="3", principal_parts="scribo;scribere;scripsi;scriptum"),
    dict(lesson=1, lemma="etiam", pos="adverb", english="also"),
    dict(lesson=1, lemma="iam", pos="adverb", english="now"),
    dict(lesson=1, lemma="ubi", pos="adverb", english="where"),
    dict(lesson=1, lemma="et", pos="conjunction", english="and"),
    dict(lesson=1, lemma="quod", pos="conjunction", english="because"),
    dict(lesson=1, lemma="dum", pos="conjunction", english="while"),
    dict(lesson=1, lemma="aestate", pos="phrase", english="in the summer", notes="fixed ablative idiom (aestas)"),
    dict(lesson=1, lemma="sub arbore", pos="phrase", english="under a tree"),
    dict(lesson=1, lemma="nomine", pos="phrase", english="by name; named", notes="fixed ablative idiom (nomen)"),
    dict(lesson=1, lemma="ecce", pos="interjection", english="look!"),

    # ---- Chapter 2: "A Summer Afternoon" ----
    dict(lesson=2, lemma="amica", pos="noun", english="friend (female)", gender="f", declension=1, genitive="amicae", notes="textbook form shown: 'amicae' (plural, friends)"),
    dict(lesson=2, lemma="sum", pos="verb", english="am; be", conj="irregular", notes="textbook form shown: 'sunt' (they are)"),
    dict(lesson=2, lemma="ambulo", pos="verb", english="walk", conj="1", principal_parts="ambulo;ambulare;ambulavi;ambulatum"),
    dict(lesson=2, lemma="curro", pos="verb", english="run", conj="3", principal_parts="curro;currere;cucurri;cursum"),
    dict(lesson=2, lemma="defessus", pos="adjective", english="tired", genitive="defessi", notes="textbook shows fem. form 'defessa'"),
    dict(lesson=2, lemma="strenuus", pos="adjective", english="active; energetic", genitive="strenui", notes="textbook shows fem. form 'strenua'"),
    dict(lesson=2, lemma="is", pos="pronoun", english="he; she; it (gen. his/her/its)", gender="m", genitive="n/a", notes="textbook form shown: 'eius' (genitive)"),
    dict(lesson=2, lemma="quoque", pos="adverb", english="also"),
    dict(lesson=2, lemma="hodie", pos="adverb", english="today"),
    dict(lesson=2, lemma="tandem", pos="adverb", english="at last"),
    dict(lesson=2, lemma="lente", pos="adverb", english="slowly"),
    dict(lesson=2, lemma="saepe", pos="adverb", english="often"),
    dict(lesson=2, lemma="sed", pos="conjunction", english="but"),
    dict(lesson=2, lemma="in agris", pos="phrase", english="in the fields"),
    dict(lesson=2, lemma="ex agris", pos="phrase", english="from/out of the fields"),
    dict(lesson=2, lemma="ad villam rusticam", pos="phrase", english="to/toward the country house and farm"),
    dict(lesson=2, lemma="brevi tempore", pos="phrase", english="in a short time; soon"),
    dict(lesson=2, lemma="non iam", pos="phrase", english="no longer"),
    dict(lesson=2, lemma="quid faciunt?", pos="phrase", english="what are they doing?"),

    # ---- Chapter 3: "In the Garden" ----
    dict(lesson=3, lemma="puer", pos="noun", english="boy", gender="m", declension=2, genitive="pueri"),
    dict(lesson=3, lemma="vir", pos="noun", english="man", gender="m", declension=2, genitive="viri"),
    dict(lesson=3, lemma="servus", pos="noun", english="slave", gender="m", declension=2, genitive="servi", notes="single-source (appeared on one of two flashcard sources checked) - double check"),
    dict(lesson=3, lemma="idem", pos="pronoun", english="the same", gender="f", genitive="n/a", notes="textbook shows fem. form 'eadem'"),
    dict(lesson=3, lemma="multus", pos="adjective", english="much; many", genitive="multi"),
    dict(lesson=3, lemma="solus", pos="adjective", english="alone", genitive="soli", notes="irregular gen/dat sg: solius/soli"),
    dict(lesson=3, lemma="iratus", pos="adjective", english="angry", genitive="irati"),
    dict(lesson=3, lemma="clamo", pos="verb", english="shout", conj="1", principal_parts="clamo;clamare;clamavi;clamatum"),
    dict(lesson=3, lemma="rideo", pos="verb", english="laugh; smile", conj="2", principal_parts="rideo;ridere;risi;risum"),
    dict(lesson=3, lemma="laboro", pos="verb", english="work", conj="1", principal_parts="laboro;laborare;laboravi;laboratum"),
    dict(lesson=3, lemma="cado", pos="verb", english="fall", conj="3", principal_parts="cado;cadere;cecidi;casum"),
    dict(lesson=3, lemma="gemo", pos="verb", english="groan", conj="3", principal_parts="gemo;gemere;gemui;gemitum"),
    dict(lesson=3, lemma="subito", pos="adverb", english="suddenly"),
    dict(lesson=3, lemma="minime", pos="adverb", english="no!", notes="single-source - double check"),
    dict(lesson=3, lemma="in horto", pos="phrase", english="in the garden"),
    dict(lesson=3, lemma="in villis rusticis", pos="phrase", english="in the country houses"),
    dict(lesson=3, lemma="in piscinam", pos="phrase", english="into the fishpond"),
    dict(lesson=3, lemma="abite molesti", pos="phrase", english="go away, you pests!"),
    dict(lesson=3, lemma="ita vero", pos="phrase", english="yes!", notes="single-source - double check"),

    # ---- Chapter 4: "Show-Off!" ----
    dict(lesson=4, lemma="molestus", pos="adjective", english="troublesome; annoying", genitive="molesti"),
    dict(lesson=4, lemma="magnus", pos="adjective", english="big; great", genitive="magni"),
    dict(lesson=4, lemma="sollicitus", pos="adjective", english="anxious; worried", genitive="solliciti", notes="textbook shows fem. form 'sollicita'"),
    dict(lesson=4, lemma="infirmus", pos="adjective", english="weak; shaky", genitive="infirmi"),
    dict(lesson=4, lemma="vox", pos="noun", english="voice", gender="f", declension=3, genitive="vocis"),
    dict(lesson=4, lemma="ramus", pos="noun", english="branch", gender="m", declension=2, genitive="rami"),
    dict(lesson=4, lemma="fragor", pos="noun", english="crash; noise", gender="m", declension=3, genitive="fragoris"),
    dict(lesson=4, lemma="tu", pos="pronoun", english="you (singular)", notes="personal pronoun, no grammatical gender - excluded from Mode 2; textbook forms shown: 'tu' and 'te'"),
    dict(lesson=4, lemma="nihil", pos="pronoun", english="nothing", notes="indeclinable - excluded from Mode 2"),
    dict(lesson=4, lemma="vexo", pos="verb", english="annoy", conj="1", principal_parts="vexo;vexare;vexavi;vexatum"),
    dict(lesson=4, lemma="amo", pos="verb", english="like; love", conj="1", principal_parts="amo;amare;amavi;amatum"),
    dict(lesson=4, lemma="dormio", pos="verb", english="sleep", conj="4", principal_parts="dormio;dormire;dormivi;dormitum"),
    dict(lesson=4, lemma="conspicio", pos="verb", english="catch sight of", conj="3io", principal_parts="conspicio;conspicere;conspexi;conspectum"),
    dict(lesson=4, lemma="ascendo", pos="verb", english="climb", conj="3", principal_parts="ascendo;ascendere;ascendi;ascensum"),
    dict(lesson=4, lemma="audio", pos="verb", english="hear; listen (to)", conj="4", principal_parts="audio;audire;audivi;auditum"),
    dict(lesson=4, lemma="video", pos="verb", english="see", conj="2", principal_parts="video;videre;vidi;visum"),
    dict(lesson=4, lemma="terreo", pos="verb", english="frighten", conj="2", principal_parts="terreo;terrere;terrui;territum"),
    dict(lesson=4, lemma="caveo", pos="verb", english="beware; be careful", conj="2", principal_parts="caveo;cavere;cavi;cautum", notes="textbook form shown: 'cave' (imperative)"),
    dict(lesson=4, lemma="appropinquo", pos="verb", english="approach", conj="1", principal_parts="appropinquo;appropinquare;appropinquavi;appropinquatum"),
    dict(lesson=4, lemma="semper", pos="adverb", english="always"),
    dict(lesson=4, lemma="tum", pos="adverb", english="at that moment; then"),
    dict(lesson=4, lemma="furtim", pos="adverb", english="stealthily"),
    dict(lesson=4, lemma="quo", pos="adverb", english="where...to?"),
    dict(lesson=4, lemma="igitur", pos="conjunction", english="therefore"),
    dict(lesson=4, lemma="magna voce", pos="phrase", english="in a loud voice"),
    dict(lesson=4, lemma="descende sexte", pos="phrase", english="come down, Sextus!"),
    dict(lesson=4, lemma="qualis", pos="phrase", english="what sort of...?", notes="interrogative adjective, 3rd decl. pattern not implemented - excluded from Mode 2"),

    # ---- Chapter 5: "Marcus to the Rescue" ----
    dict(lesson=5, lemma="dies", pos="noun", english="day", gender="m", declension=5, genitive="diei"),
    dict(lesson=5, lemma="silva", pos="noun", english="forest; woods", gender="f", declension=1, genitive="silvae"),
    dict(lesson=5, lemma="rivus", pos="noun", english="stream", gender="m", declension=2, genitive="rivi"),
    dict(lesson=5, lemma="lupus", pos="noun", english="wolf", gender="m", declension=2, genitive="lupi"),
    dict(lesson=5, lemma="clamor", pos="noun", english="shout; shouting", gender="m", declension=3, genitive="clamoris"),
    dict(lesson=5, lemma="calidus", pos="adjective", english="warm", genitive="calidi"),
    dict(lesson=5, lemma="frigidus", pos="adjective", english="cool; cold", genitive="frigidi"),
    dict(lesson=5, lemma="ignavus", pos="adjective", english="cowardly; lazy", genitive="ignavi"),
    dict(lesson=5, lemma="temerarius", pos="adjective", english="rash; reckless", genitive="temerarii"),
    dict(lesson=5, lemma="perterritus", pos="adjective", english="frightened; terrified", genitive="perterriti"),
    dict(lesson=5, lemma="salvus", pos="adjective", english="safe", genitive="salvi"),
    dict(lesson=5, lemma="ego", pos="pronoun", english="I; me", notes="personal pronoun, no grammatical gender - excluded from Mode 2"),
    dict(lesson=5, lemma="erro", pos="verb", english="wander", conj="1", principal_parts="erro;errare;erravi;erratum"),
    dict(lesson=5, lemma="respondeo", pos="verb", english="reply; respond", conj="2", principal_parts="respondeo;respondere;respondi;responsum"),
    dict(lesson=5, lemma="peto", pos="verb", english="seek; look for; attack", conj="3", principal_parts="peto;petere;petivi;petitum"),
    dict(lesson=5, lemma="arripio", pos="verb", english="grab hold of; snatch", conj="3io", principal_parts="arripio;arripere;arripui;arreptum"),
    dict(lesson=5, lemma="repello", pos="verb", english="drive off", conj="3", principal_parts="repello;repellere;reppuli;repulsum"),
    dict(lesson=5, lemma="advenio", pos="verb", english="arrive; reach", conj="4", principal_parts="advenio;advenire;adveni;adventum"),
    dict(lesson=5, lemma="excipio", pos="verb", english="welcome; receive", conj="3io", principal_parts="excipio;excipere;excepi;exceptum"),
    dict(lesson=5, lemma="timeo", pos="verb", english="fear; be afraid", conj="2", principal_parts="timeo;timere;timui;-"),
    dict(lesson=5, lemma="volo", pos="verb", english="wish; want", conj="irregular", notes="textbook form shown: 'vult'"),
    dict(lesson=5, lemma="nolo", pos="verb", english="not wish; refuse", conj="irregular"),
    dict(lesson=5, lemma="paro", pos="verb", english="prepare; get ready", conj="1", principal_parts="paro;parare;paravi;paratum"),
    dict(lesson=5, lemma="possum", pos="verb", english="be able; can", conj="irregular", notes="textbook form shown: 'potest'"),
    dict(lesson=5, lemma="exeo", pos="verb", english="go out", conj="irregular"),
    dict(lesson=5, lemma="si", pos="conjunction", english="if"),
    dict(lesson=5, lemma="neque", pos="conjunction", english="neither...nor (neque...neque); and...not"),
    dict(lesson=5, lemma="prope", pos="preposition", english="near (+ acc.)"),
    dict(lesson=5, lemma="ex", pos="preposition", english="out of; from (+ abl.)", notes="appears as 'e' before consonants"),
    dict(lesson=5, lemma="ibi", pos="adverb", english="there"),
    dict(lesson=5, lemma="adhuc", pos="adverb", english="still"),
    dict(lesson=5, lemma="ferte auxilium", pos="phrase", english="bring help!"),

    # ---- Chapter 6: "Early in the Day" ----
    dict(lesson=6, lemma="pater", pos="noun", english="father", gender="m", declension=3, genitive="patris"),
    dict(lesson=6, lemma="mater", pos="noun", english="mother", gender="f", declension=3, genitive="matris"),
    dict(lesson=6, lemma="ancilla", pos="noun", english="slave-woman; maidservant", gender="f", declension=1, genitive="ancillae"),
    dict(lesson=6, lemma="cibus", pos="noun", english="food", gender="m", declension=2, genitive="cibi"),
    dict(lesson=6, lemma="aqua", pos="noun", english="water", gender="f", declension=1, genitive="aquae"),
    dict(lesson=6, lemma="omnis", pos="adjective", english="all; every", notes="3rd decl. 2-termination adjective pattern not implemented - excluded from Mode 2/3"),
    dict(lesson=6, lemma="ipse", pos="pronoun", english="himself; herself; itself (emphatic)", gender="f", genitive="n/a", notes="textbook shows fem. form 'ipsa'"),
    dict(lesson=6, lemma="lucet", pos="verb", english="it is light; it is day", notes="impersonal verb - excluded from Mode 3 (no normal subject)"),
    dict(lesson=6, lemma="surgo", pos="verb", english="get up; rise", conj="3", principal_parts="surgo;surgere;surrexi;surrectum"),
    dict(lesson=6, lemma="observo", pos="verb", english="watch; observe", conj="1", principal_parts="observo;observare;observavi;observatum"),
    dict(lesson=6, lemma="purgo", pos="verb", english="clean", conj="1", principal_parts="purgo;purgare;purgavi;purgatum"),
    dict(lesson=6, lemma="coquo", pos="verb", english="cook", conj="3", principal_parts="coquo;coquere;coxi;coctum"),
    dict(lesson=6, lemma="porto", pos="verb", english="carry", conj="1", principal_parts="porto;portare;portavi;portatum"),
    dict(lesson=6, lemma="reprehendo", pos="verb", english="blame; scold", conj="3", principal_parts="reprehendo;reprehendere;reprehendi;reprehensum"),
    dict(lesson=6, lemma="doceo", pos="verb", english="teach", conj="2", principal_parts="doceo;docere;docui;doctum"),
    dict(lesson=6, lemma="curo", pos="verb", english="look after; take care of", conj="1", principal_parts="curo;curare;curavi;curatum"),
    dict(lesson=6, lemma="adiuvo", pos="verb", english="help", conj="1", principal_parts="adiuvo;adiuvare;adiuvi;adiutum"),
    dict(lesson=6, lemma="per", pos="preposition", english="through (+ acc.)"),
    dict(lesson=6, lemma="nondum", pos="adverb", english="not yet"),
    dict(lesson=6, lemma="tamen", pos="adverb", english="however"),
    dict(lesson=6, lemma="mox", pos="adverb", english="soon; presently"),
    dict(lesson=6, lemma="strenue", pos="adverb", english="strenuously; hard"),
    dict(lesson=6, lemma="nunc", pos="adverb", english="now"),
    dict(lesson=6, lemma="lanam trahunt", pos="phrase", english="they spin wool"),
    dict(lesson=6, lemma="omnia quae", pos="phrase", english="everything that"),
    dict(lesson=6, lemma="necesse est", pos="phrase", english="it is necessary"),

    # ---- Chapter 7: "Bad News" ----
    dict(lesson=7, lemma="nuntius", pos="noun", english="messenger", gender="m", declension=2, genitive="nuntii"),
    dict(lesson=7, lemma="princeps", pos="noun", english="emperor; prince; chieftain", gender="m", declension=3, genitive="principis"),
    dict(lesson=7, lemma="occupatus", pos="adjective", english="busy", genitive="occupati"),
    dict(lesson=7, lemma="meus", pos="adjective", english="my", genitive="mei"),
    dict(lesson=7, lemma="specto", pos="verb", english="watch; look at", conj="1", principal_parts="specto;spectare;spectavi;spectatum"),
    dict(lesson=7, lemma="venio", pos="verb", english="come", conj="4", principal_parts="venio;venire;veni;ventum"),
    dict(lesson=7, lemma="saluto", pos="verb", english="greet", conj="1", principal_parts="saluto;salutare;salutavi;salutatum"),
    dict(lesson=7, lemma="duco", pos="verb", english="lead; take", conj="3", principal_parts="duco;ducere;duxi;ductum"),
    dict(lesson=7, lemma="trado", pos="verb", english="hand over", conj="3", principal_parts="trado;tradere;tradidi;traditum"),
    dict(lesson=7, lemma="revoco", pos="verb", english="recall; call back", conj="1", principal_parts="revoco;revocare;revocavi;revocatum"),
    dict(lesson=7, lemma="consulo", pos="verb", english="consult", conj="3", principal_parts="consulo;consulere;consului;consultum"),
    dict(lesson=7, lemma="redeo", pos="verb", english="return; go back", conj="irregular"),
    dict(lesson=7, lemma="eo", pos="verb", english="go", conj="irregular", notes="textbook form shown: 'ire' (infinitive)"),
    dict(lesson=7, lemma="inquit", pos="verb", english="(he/she) says; said", notes="defective verb, limited forms only - excluded from Mode 3"),
    dict(lesson=7, lemma="salve", pos="interjection", english="greetings! hello!"),
    dict(lesson=7, lemma="eheu", pos="interjection", english="alas! oh no!"),
    dict(lesson=7, lemma="euge", pos="interjection", english="hurray!"),
    dict(lesson=7, lemma="ad urbem", pos="phrase", english="to the city"),

    # ---- Chapter 8: "Getting Up Early" ----
    dict(lesson=8, lemma="cubiculum", pos="noun", english="room; bedroom", gender="n", declension=2, genitive="cubiculi", notes="neuter - excluded from Mode 2/3 (2-gender design)"),
    dict(lesson=8, lemma="tempus", pos="noun", english="time", gender="n", declension=3, genitive="temporis", notes="neuter - excluded from Mode 2/3 (2-gender design)"),
    dict(lesson=8, lemma="vos", pos="pronoun", english="you (plural)", notes="personal pronoun, no grammatical gender - excluded from Mode 2"),
    dict(lesson=8, lemma="nos", pos="pronoun", english="we; us", notes="personal pronoun, no grammatical gender - excluded from Mode 2"),
    dict(lesson=8, lemma="excito", pos="verb", english="rouse; wake (someone) up", conj="1", principal_parts="excito;excitare;excitavi;excitatum"),
    dict(lesson=8, lemma="intro", pos="verb", english="enter", conj="1", principal_parts="intro;intrare;intravi;intratum"),
    dict(lesson=8, lemma="induo", pos="verb", english="put on", conj="3", principal_parts="induo;induere;indui;indutum"),
    dict(lesson=8, lemma="deinde", pos="adverb", english="then; next"),
    dict(lesson=8, lemma="celeriter", pos="adverb", english="quickly"),
    dict(lesson=8, lemma="iterum", pos="adverb", english="again; a second time"),
    dict(lesson=8, lemma="age", pos="interjection", english="come on!"),

    # ---- Chapter 9: "Goodbye" ----
    dict(lesson=9, lemma="ianitor", pos="noun", english="doorkeeper", gender="m", declension=3, genitive="ianitoris"),
    dict(lesson=9, lemma="nullus", pos="adjective", english="no; none", genitive="nulli", notes="irregular gen/dat sg: nullius/nulli; textbook form shown: 'nulli'"),
    dict(lesson=9, lemma="semisomnus", pos="adjective", english="half-asleep", genitive="semisomni", notes="textbook shows fem. form 'semisomna'"),
    dict(lesson=9, lemma="miser", pos="adjective", english="unhappy; miserable", genitive="miseri", notes="textbook shows fem. form 'misera'"),
    dict(lesson=9, lemma="tuus", pos="adjective", english="your (singular)", genitive="tui"),
    dict(lesson=9, lemma="nemo", pos="pronoun", english="no one", notes="irregular/suppletive, paradigm not implemented - excluded from Mode 2"),
    dict(lesson=9, lemma="taceo", pos="verb", english="be quiet; be silent", conj="2", principal_parts="taceo;tacere;tacui;tacitum", notes="textbook form shown: 'Tace!' (imperative)"),
    dict(lesson=9, lemma="tempto", pos="verb", english="try", conj="1", principal_parts="tempto;temptare;temptavi;temptatum"),
    dict(lesson=9, lemma="discedo", pos="verb", english="go away; depart", conj="3", principal_parts="discedo;discedere;discessi;discessum"),
    dict(lesson=9, lemma="nescio", pos="verb", english="know not; not know; don't know", conj="4", principal_parts="nescio;nescire;nescivi;nescitum", notes="gloss ordered 'know not' so Mode 3's mechanical verb-conjugation lands on the right head word"),
    dict(lesson=9, lemma="lacrimo", pos="verb", english="weep; cry", conj="1", principal_parts="lacrimo;lacrimare;lacrimavi;lacrimatum"),
    dict(lesson=9, lemma="maneo", pos="verb", english="remain; stay", conj="2", principal_parts="maneo;manere;mansi;mansum"),
    dict(lesson=9, lemma="mitto", pos="verb", english="send", conj="3", principal_parts="mitto;mittere;misi;missum"),
    dict(lesson=9, lemma="promitto", pos="verb", english="promise", conj="3", principal_parts="promitto;promittere;promisi;promissum"),
    dict(lesson=9, lemma="teneo", pos="verb", english="hold", conj="2", principal_parts="teneo;tenere;tenui;tentum"),
    dict(lesson=9, lemma="abeo", pos="verb", english="go away", conj="irregular"),
    dict(lesson=9, lemma="hic", pos="adverb", english="here"),
    dict(lesson=9, lemma="tacite", pos="adverb", english="silently"),
    dict(lesson=9, lemma="simul", pos="adverb", english="together; at the same time"),
    dict(lesson=9, lemma="vale", pos="interjection", english="goodbye! farewell!"),
    dict(lesson=9, lemma="ad ianuam", pos="phrase", english="at/to the door"),
    dict(lesson=9, lemma="mecum", pos="phrase", english="with me"),
    dict(lesson=9, lemma="vos omnes", pos="phrase", english="all of you"),
    dict(lesson=9, lemma="secunda hora", pos="phrase", english="at the second hour"),
    dict(lesson=9, lemma="o me miseram", pos="phrase", english="poor me!", notes="sources disagree on 'miserum' vs 'miseram'; 'miseram' (fem.) fits the speaker in context"),
    dict(lesson=9, lemma="complexu", pos="phrase", english="in an embrace"),
    dict(lesson=9, lemma="alii alii", pos="phrase", english="some...others"),

    # ---- Chapter 10: "Departure" ----
    dict(lesson=10, lemma="cista", pos="noun", english="trunk; chest", gender="f", declension=1, genitive="cistae"),
    dict(lesson=10, lemma="iter", pos="noun", english="road; journey", gender="n", declension=3, genitive="itineris", notes="neuter - excluded from Mode 2/3 (2-gender design)"),
    dict(lesson=10, lemma="liberi", pos="noun", english="children", gender="m", notes="plural-only (plurale tantum) - excluded from Mode 2 (no meaningful singular)"),
    dict(lesson=10, lemma="via", pos="noun", english="road; way", gender="f", declension=1, genitive="viae"),
    dict(lesson=10, lemma="baculum", pos="noun", english="stick", gender="n", declension=2, genitive="baculi", notes="neuter - excluded from Mode 2/3 (2-gender design)"),
    dict(lesson=10, lemma="raeda", pos="noun", english="carriage; wagon", gender="f", declension=1, genitive="raedae"),
    dict(lesson=10, lemma="raedarius", pos="noun", english="carriage-driver; coachman", gender="m", declension=2, genitive="raedarii"),
    dict(lesson=10, lemma="equus", pos="noun", english="horse", gender="m", declension=2, genitive="equi"),
    dict(lesson=10, lemma="alius", pos="adjective", english="another; other", genitive="alii", notes="irregular: gen sg 'alius', dat sg 'alii', neut nom/acc sg 'aliud'"),
    dict(lesson=10, lemma="scelestus", pos="adjective", english="wicked", genitive="scelesti"),
    dict(lesson=10, lemma="paratus", pos="adjective", english="ready; prepared", genitive="parati"),
    dict(lesson=10, lemma="quis", pos="pronoun", english="who? (interrogative)", notes="interrogative paradigm not implemented - excluded from Mode 2"),
    dict(lesson=10, lemma="gero", pos="verb", english="wear; carry", conj="3", principal_parts="gero;gerere;gessi;gestum"),
    dict(lesson=10, lemma="iubeo", pos="verb", english="order", conj="2", principal_parts="iubeo;iubere;iussi;iussum"),
    dict(lesson=10, lemma="pono", pos="verb", english="put; place", conj="3", principal_parts="pono;ponere;posui;positum"),
    dict(lesson=10, lemma="sto", pos="verb", english="stand", conj="1", principal_parts="sto;stare;steti;statum"),
    dict(lesson=10, lemma="habeo", pos="verb", english="have; hold", conj="2", principal_parts="habeo;habere;habui;habitum"),
    dict(lesson=10, lemma="incito", pos="verb", english="spur on; urge on", conj="1", principal_parts="incito;incitare;incitavi;incitatum"),
    dict(lesson=10, lemma="iacio", pos="verb", english="throw; hurl", conj="3io", principal_parts="iacio;iacere;ieci;iactum"),
    dict(lesson=10, lemma="interea", pos="adverb", english="meanwhile"),
    dict(lesson=10, lemma="cras", pos="adverb", english="tomorrow"),
    dict(lesson=10, lemma="cur", pos="adverb", english="why?", notes="lower confidence - from search-snippet synthesis only, not independently fetched"),
    dict(lesson=10, lemma="quid", pos="adverb", english="what?", notes="lower confidence - from search-snippet synthesis only, not independently fetched"),
    dict(lesson=10, lemma="servus quidam", pos="phrase", english="a certain slave"),
    dict(lesson=10, lemma="eo ipso tempore", pos="phrase", english="at that very moment"),
]

FIELDS = ["lesson", "lemma", "pos", "english", "gender", "declension",
          "genitive", "conj", "principal_parts", "splice_ok", "transitive", "notes"]

# Verbs that grammatically take a direct (accusative) object. Everything
# else defaults to intransitive and never gets an object attached in Mode 3
# - e.g. "sto" (stand), "appropinquo" (approaches, but governs dative, not
# accusative), "sum" (copula) would otherwise produce ungrammatical Latin
# like "stat amicam" ("stands a friend").
TRANSITIVE_VERBS = {
    "lego", "scribo", "video", "audio", "amo", "vexo", "terreo", "conspicio",
    "peto", "arripio", "repello", "excipio", "timeo", "paro", "observo",
    "purgo", "coquo", "porto", "reprehendo", "doceo", "curo", "adiuvo",
    "specto", "saluto", "duco", "trado", "revoco", "consulo", "excito",
    "intro", "induo", "mitto", "promitto", "teneo", "gero", "iubeo", "pono",
    "habeo", "incito", "iacio", "ascendo", "nescio", "tempto",
}

for _row in ROWS:
    if _row.get("pos") == "verb" and _row["lemma"] in TRANSITIVE_VERBS:
        _row["transitive"] = "yes"

# Phrases safe to splice verbatim into a Mode 3 sentence as a self-contained
# adverbial (prepositional/time/manner phrase). Everything else of pos=phrase
# is a dialogue fragment, imperative, or needs its own clause, and is left
# out of sentence generation (still fine for Mode 1).
SPLICE_OK_PHRASES = {
    "sub arbore", "aestate", "in agris", "ex agris", "ad villam rusticam",
    "brevi tempore", "non iam", "in horto", "in villis rusticis", "in piscinam",
    "magna voce", "ad ianuam", "mecum", "secunda hora", "complexu",
    "eo ipso tempore", "ad urbem",
}

# Adverbs safe to tack onto a generated statement. Interrogatives (ubi, quo,
# cur, quid - "where/where to/why/what") only make sense in a question, and
# "minime" is a one-word dialogue answer ("no!") - none of these work spliced
# into a declarative sentence, so they're left out (still fine for Mode 1).
SPLICE_OK_ADVERBS = {
    "etiam", "iam", "subito", "semper", "tum", "furtim", "quoque", "hodie",
    "tandem", "lente", "saepe", "nondum", "tamen", "mox", "strenue", "nunc",
    "deinde", "celeriter", "iterum", "tacite", "simul", "interea", "cras",
    "adhuc", "ibi", "hic",
}

for _row in ROWS:
    if _row.get("pos") == "phrase" and _row["lemma"] in SPLICE_OK_PHRASES:
        _row["splice_ok"] = "yes"
    if _row.get("pos") == "adverb" and _row["lemma"] in SPLICE_OK_ADVERBS:
        _row["splice_ok"] = "yes"

buf = io.StringIO()
writer = csv.DictWriter(buf, fieldnames=FIELDS, restval="")
writer.writeheader()
for row in ROWS:
    writer.writerow(row)
csv_text = buf.getvalue()

with open("lib/word_bank.csv", "w", newline="", encoding="utf-8") as f:
    f.write(csv_text)

# Also emit an embeddable JS copy, since opening index.html directly via
# file:// blocks fetch() of sibling files. The app uses this as its
# zero-setup default; editing word_bank.csv and using the in-app "Load CSV"
# button overrides it without needing to re-run this script.
with open("lib/word_bank_data.js", "w", encoding="utf-8") as f:
    f.write("// Auto-generated by build_wordbank.py from lib/word_bank.csv — do not hand-edit.\n")
    f.write("window.WORD_BANK_CSV_DEFAULT = " + json.dumps(csv_text) + ";\n")

print(f"Wrote {len(ROWS)} rows to lib/word_bank.csv and lib/word_bank_data.js")

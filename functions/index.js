/**
 * Firebase Functions for Content Moderation using Perspective API + Custom Blacklist
 * Moderates both messages and tasks
 */

const {setGlobalOptions} = require("firebase-functions/v2/options");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const fetch = require("node-fetch");

// Initialize Firebase Admin SDK
initializeApp();

// Limit concurrency
setGlobalOptions({maxInstances: 10});

/**
 * Perspective API Key
 */
const PERSPECTIVE_API_KEY = "perspectiveAPI key here";

/**
 * Custom blacklist of offensive words
 */
// Hate group / extremist / neo-Nazi related terms
const HATE_GROUP_TERMS = [
  "alt-right", "white nationalist", "white supremacist", "neo-nazi", "nazi", "ku klux klan", "kkk",
  "stormfront", "blood and soil", "heil hitler", "88", "14 words", "14/88", "skrewdriver", "identity evropa",
  "american nazi party", "national socialist", "nsdap", "rdp", "racist", "racism", "holocaust denier",
  "jews must die", "kill the jews", "zionist", "zionist occupation", "white power", "white pride", "white separatist",
  "racist skinhead", "racist nazi", "ethnonationalist", "far-right", "white genocide", "swastika", "iron cross",
  "pepe the frog", "frogs", "black sun", "schutzstaffel", "ss", "sieg heil", "heil", "adolf hitler", "hitler",
  "gas the jews", "jew hater", "holohoax", "boogaloo", "boogaloo boys", "boog", "proud boys", "proud boy", "stormtrooper",
  "kekistan", "kek", "alt-lite", "racist militia", "neo-confederate", "neo confederate", "hate group", "hate groups",
  "racist terrorist", "terrorist militia", "blood and iron", "white youth", "white revolution", "racial purity",
  "racial supremacy", "race war", "racewar", "racial cleansing", "white separatism", "white nationalist party",
  "ethnic cleansing", "kike hater", "jew killer", "jewish conspiracy", "jew conspiracy", "holocaust revisionist",
  "racialist", "supremacist", "racist nazi skinhead", "nazi skinhead", "white rebel", "hakenkreuz", "crossed circle",
  "kkk clan", "klan", "klan member", "klan hood", "klan hoods", "klan robes", "klan rally", "white knights", "white brotherhood",
  "ethno-state", "racial state", "racial homeland", "nationalist front", "national front", "nordic front", "aryan nation",
  "aryan brotherhood", "national alliance", "neo nazi party", "fascist", "fascism", "far right extremist", "far-right extremist",
  "neo-nazi skinhead", "neo-nazi militia", "ethnic nationalist", "racial nationalist", "racial supremacist", "national socialist germany",
];
const BLACKLIST = [
  // General profanity
  "fuck", "fucker", "fucking", "shit", "crap", "bastard", "asshole", "dick", "pussy", "cunt", "cock",
  "bitch", "slut", "whore", "twat", "bollocks", "arse", "damn", "bugger", "wanker", "fuk", "fuking", "sh1t",
  "b1tch", "c0ck", "d1ck", "puss1", "slut", "wh0re", "cunt", "t1ts", "fuker", "f4gg0t", "n1gger", "n1gga",

  // Homophobic / transphobic slurs
  "faggot", "fag", "dyke", "tranny", "queer", "shemale", "homo", "lezbo", "fairy", "poof", "maricon", "pansy",
  "sissy", "fruit", "he-she", "trap", "chaz", "shim", "fagtard", "faggy", "fagster", "dykey", "lesbo", "lez",

  // Racial / ethnic slurs
  "nigger", "nigga", "chink", "gook", "spic", "kike", "coon", "jap", "paki", "raghead", "sandnigger", "towelhead",
  "zipperhead", "wetback", "gypsy", "gyppie", "gyppo", "wog", "wop", "coonass", "kraut", "dago", "hebe",
  "slant", "slopehead", "beaner", "cholo", "chinkie", "oriental", "chinkster", "chinky", "niglet", "niggress",
  "chonga", "spiko", "spik", "nip", "japster", "japhead", "paki-boy", "paki-girl", "raghead-boy", "raghead-girl",

  // Sexist / misogynist terms
  "bimbo", "slut", "whore", "gold-digger", "trollop", "skank", "chick", "hoes", "tramp", "ladyboy", "slapper",
  "trashy", "hussy", "bitchy", "gold digger", "skanky", "slutty", "slapper", "broads", "broad", "dyke-bag",
  "slutbag", "twatface", "twatty", "cumdump", "fucktoy", "hole", "meatbag", "pussylicker", "pussylips", "vaginadick",

  // Ableist terms
  "retard", "moron", "idiot", "imbecile", "cripple", "spaz", "lame", "dumbass", "nutjob", "psycho", "freak", "loser",
  "dummy", "simpleton", "dunce", "dope", "nincompoop", "twit", "moronic", "mental", "handicapped", "mongoloid",
  "gimp", "spastic", "retarded", "retardation", "dullard", "numpty", "halfwit", "dimwit", "bonehead", "blockhead",
  "airhead", "dingbat", "numbskull", "scatterbrain", "twaddle", "loony", "loon", "fruitcake", "flaky", "slowpoke",

  // Religious slurs
  "kafir", "heathen", "infidel", "blasphemer", "heretic", "apostate", "godless", "unbeliever", "idolater", "pagans",
  "satanist", "devil worshiper", "antichrist", "false prophet", "blasphemy", "demon worship", "demon", "satan", "shaitan",

  // Sexual / body references
  "jizz", "cum", "dildo", "vagina", "penis", "ass", "boobs", "tits", "cock", "ballsack", "prick", "clit", "piss", "slobber",
  "muff", "cocksucker", "jizm", "semen", "ejaculate", "orgasm", "fuckhole", "shitpipe", "cunnilingus", "fellatio", "assfucker",
  "asslick", "fistfuck", "gokkun", "handjob", "blowjob", "titfuck", "boobjob", "anal", "assholelicker", "pussylicker",

  // Violent / threatening terms
  "kill yourself", "die", "murder", "stab", "shoot", "hang", "bomb", "terrorist", "assassinate", "rape", "molest",
  "choke", "lynch", "slaughter", "decapitate", "maim", "torture", "kill", "massacre", "executed", "bloodbath",
  "destroy", "wipe out", "annihilate", "killin", "assault", "attack", "threat", "terror", "terrorize", "terrorism",

  // Obfuscated / leetspeak variants
  "f4gg0t", "n1gger", "n1gga", "sh1t", "b1tch", "c0ck", "d1ck", "puss1", "slut", "wh0re", "cunt", "t1ts", "fuk", "fuker",
  "fuking", "a55hole", "a55", "d1k", "p1ss", "b1tchez", "bast4rd", "c0ckhead", "c0ckface", "sh1thead", "faggy", "dyk3",
  "l3zbo", "slutty", "sl4g", "t1t", "c0ck4", "b00bs", "bo0bs", "b00bie", "j1zz", "p3nis", "v4gina", "d1ldo", "an4l",

  // Common slang / misc
  "hoe", "slag", "asshat", "jackass", "douche", "prick", "twit", "wimp", "tosser", "git", "scumbag", "shithead", "tool",
  "paki", "coon", "freakshow", "loserface", "retardface", "nutcase", "psychohead", "blowjobface", "dickhead", "twatwaffle",
  "assclown", "shitsack", "cockface", "cuntface", "bollocksface", "fuckface", "pussface", "bitchface", "slutface",
  "niggerface", "dykeface", "faggotface", "homoface", "queerface", "jewface", "kikeface", "spicface", "chinkface",

  // Extended list to reach 1000+ terms (more combinations, variants, plurals, suffixes, prefixes)
  "fuckers", "fucks", "fucked", "fuckingbitch", "shithead", "shitty", "asswipe", "asswipes", "dickweed", "dickhead",
  "cockhead", "cockweed", "pussypass", "pussyhole", "cuntish", "cuntface", "slutbag", "slutbags", "whorebag", "whores",
  "fagtard", "fagtards", "dykes", "dykess", "trannies", "trannyboy", "trannygirl", "faggots", "faggotty", "nigglet",
  "nigglets", "spics", "spiko", "spik", "japs", "jappo", "paki-boy", "paki-girl", "ragheads", "raghead-boy", "raghead-girl",
  "krauts", "dagos", "wops", "wogs", "beaners", "cholos", "gooks", "zipperheads", "towelheads", "wetbacks", "hebes", "slants",
  "orientals", "mongoloids", "retards", "morons", "imbeciles", "psychos", "losers", "dummies", "twats", "twatface", "bimbos",
  "skanks", "slappers", "tramps", "hussies", "freaks", "nuts", "loons", "loony", "fruitcakes", "flakies", "slowpokes",
  "airheads", "dingbats", "numpties", "scatterbrains", "dullards", "halfwits", "dimwits", "boneheads", "blockheads", "idiots",
  "moronface", "dumbasses", "dumbassface", "freakshowface", "loserface", "psychohead", "assholeface", "bastardface",
  "shitface", "shitbag", "shitbags", "cocksuckerface", "cockface", "clitface", "vaginaface", "penisface", "boobface",
  "titsface", "assface", "asswipeface", "assclownface", "fuckface", "fagface", "niggerface", "dykeface", "trannyface",
  "slutface", "whoreface", "twatface", "bitchface", "cuntface", "slutbagface", "hoe-face", "slagface", "wankerface",
  "prickface", "toolface", "jackassface", "twatwaffleface", "shitheadface", "doucheface", "shitpipeface", "fukface",
  "c0ckface", "b1tchface", "sh1thead", "asshatface", "d1ckface", "pussypassface", "c0ckweedface", "faggyface", "dyk3face",
  "l3zboface", "n1ggerface", "n1ggaface", "sh1tfaced", "b1tchfaced", "f4gg0tface", "sh1theadface", "fukerface", "twatface",
  "assholeish", "bastardish", "shitbagish", "prickish", "dickish", "cockish", "pussyish", "cuntish", "slutish", "whoreish",
  "faggotish", "niggerish", "dykeish", "trannyish", "moronish", "retardish", "idiotish", "dumbassish", "psychoish",
  "loserish", "bitchish", "hoeish", "slagish", "wankerish", "toolish", "jackassish", "twatwaffleish", "shitheadish",
  "doucheish", "fukish", "c0ckish", "b1tchish", "sh1theadish", "asshatish", "d1ckish", "pussypassish", "faggyish", "dyk3ish",
  "l3zboish", "n1ggerish", "n1ggaish", "sh1tfacedish", "b1tchfacedish", "f4gg0tish", "sh1theadish", "fukerish",
  HATE_GROUP_TERMS,
];


/**
 * Check if text contains any blacklisted words
 * @param {string} text
 * @return {boolean}
 */
function containsBlacklistedWord(text) {
  const lower = text.toLowerCase();
  return BLACKLIST.some((word) => lower.includes(word));
}

/**
 * Check text with Perspective API
 * @param {string} text - Text to moderate
 * @return {Promise<{ flagged: boolean, scores: Object }>}
 */
async function moderateContent(text) {
  try {
    const url =
      "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=" +
      PERSPECTIVE_API_KEY;

    const body = {
      comment: {text},
      languages: ["en"],
      requestedAttributes: {
        TOXICITY: {},
        SEVERE_TOXICITY: {},
        INSULT: {},
        THREAT: {},
        PROFANITY: {},
        SEXUALLY_EXPLICIT: {},
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Perspective API Error:", errText);
      return {flagged: false, scores: {}};
    }

    const result = await response.json();
    const scores = {};
    if (result.attributeScores) {
      const attrs = result.attributeScores;
      for (const attr in attrs) {
        if (attrs[attr] && attrs[attr].summaryScore && attrs[attr].summaryScore.value !== undefined) {
          scores[attr] = attrs[attr].summaryScore.value;
        }
      }
    }

    const flagged = Object.values(scores).some((score) => score > 0.8);
    return {flagged, scores};
  } catch (err) {
    console.error("Error moderating content:", err);
    return {flagged: false, scores: {}};
  }
}

/**
 * Process moderation: deletes document if flagged or contains blacklisted word
 * @param {FirebaseFirestore.DocumentSnapshot} snap
 * @param {string} text
 * @param {string} label
 */
async function processModeration(snap, text, label) {
  if (!text || !text.trim()) return;

  console.log(`Checking ${label}:`, text);

  // Check blacklist first
  if (containsBlacklistedWord(text)) {
    console.log(`⚠️ ${label} contains blacklisted word — deleting ${snap.id}`);
    await snap.ref.delete();
    return;
  }

  // Check Perspective API
  const moderation = await moderateContent(text);

  if (moderation.flagged) {
    console.log(`⚠️ ${label} flagged by Perspective API — deleting ${snap.id}`);
    await snap.ref.delete();
  } else {
    await snap.ref.update({
      flagged: false,
      moderationScores: moderation.scores,
    });
    console.log(`✅ ${label} safe`);
  }
}

/**
 * Cloud Function: Moderate Messages
 */
exports.moderateMessages = onDocumentCreated(
    "messages/{messageId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const messageData = snap.data();
      const text = ((messageData && messageData.text) ? messageData.text : "").toLowerCase();

      await processModeration(snap, text, "Message");
    },
);

/**
 * Cloud Function: Moderate Tasks
 */
exports.moderateTasks = onDocumentCreated(
    "tasks/{taskId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const taskData = snap.data();
      const title = (taskData && taskData.title) ? taskData.title : "";
      const desc = (taskData && taskData.description) ? taskData.description : "";
      const text = `${title} ${desc}`.trim();
      await processModeration(snap, text, "Task");
    },
);

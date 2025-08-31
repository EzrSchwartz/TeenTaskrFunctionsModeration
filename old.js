/**
 * Firebase Functions: Moderate Tasks and Messages with Perspective API
 */

const {setGlobalOptions} = require("firebase-functions/v2/options");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const fetch = require("node-fetch"); // Ensure node-fetch v2 is installed

// Initialize Firebase Admin
initializeApp();

// Concurrency limit
setGlobalOptions({maxInstances: 10});

// Perspective API Key
const PERSPECTIVE_API_KEY =
  "AIzaSyA0222nB3f9jsfJ9O3LFnEf5b0Cxo_W-lE";

/**
 * Send text to Perspective API for moderation
 * @param {string} text
 * @return {Promise<{flagged: boolean, scores: Object}>}
 */
async function moderateContent(text) {
  try {
    const url =
      "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?" +
      `key=${PERSPECTIVE_API_KEY}`;

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
      for (const attr in result.attributeScores) {
        if (
          Object.prototype.hasOwnProperty.call(result.attributeScores, attr)
        ) {
          scores[attr] =
            result.attributeScores[attr].summaryScore.value || 0;
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
 * Handle moderation of a Firestore document.
 *
 * @param {*} snap
 * @param {string} text
 * @param {string} label
 * @return {Promise<void>}
 */
async function processModeration(snap, text, label) {
  if (!text.trim()) {
    console.log(`No text to check for ${label}`);
    return;
  }

  console.log(`Checking ${label}:`, text);
  const moderation = await moderateContent(text);

  if (moderation.flagged) {
    console.log(`⚠️ ${label} flagged — deleting ${snap.id}`);
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
 * Moderate Messages
 */
exports.moderateMessages = onDocumentCreated(
    "messages/{messageId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const data = snap.data();
      const text = (data && data.text) ? data.text : "";

      await processModeration(snap, text, "Message");
    },
);

/**
 * Moderate Tasks
 */
exports.moderateTasks = onDocumentCreated(
    "tasks/{taskId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const data = snap.data();
      const title = (data && data.title) ? data.title : "";
      const desc = (data && data.description) ? data.description : "";
      const text = `${title} ${desc}`.trim();

      await processModeration(snap, text, "Task");
    },
);


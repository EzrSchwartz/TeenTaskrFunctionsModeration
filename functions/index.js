/**
 * Firebase Functions for Content Moderation using Perspective API
 * Moderates both messages and tasks
 */

const {setGlobalOptions} = require("firebase-functions/v2/options");
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
// const {getFirestore} = require("firebase-admin/firestore");
const fetch = require("node-fetch");

// Initialize Firebase Admin SDK
initializeApp();
// const db = getFirestore();

// Limit concurrency
setGlobalOptions({maxInstances: 10});

/**
 * Perspective API Key
 */
const PERSPECTIVE_API_KEY = "AIzaSyA-cdZObqRImZo6mUrmS6edmaeTqwn_wyA";

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
      comment: {text: text},
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
        if (
          attrs[attr] &&
          attrs[attr].summaryScore &&
          attrs[attr].summaryScore.value !== undefined
        ) {
          scores[attr] = attrs[attr].summaryScore.value;
        }
      }
    }

    let flagged = false;
    for (const key in scores) {
      if (scores[key] > 0.8) {
        flagged = true;
        break;
      }
    }

    return {flagged: flagged, scores: scores};
  } catch (err) {
    console.error("Error moderating content:", err);
    return {flagged: false, scores: {}};
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
      if (!messageData) return;

      let text = "";
      if (messageData.text) {
        text = messageData.text;
      }

      console.log("Checking message:", text);

      const moderation = await moderateContent(text);

      const updateData = {
        flagged: moderation.flagged,
        moderationScores: moderation.scores,
      };

      await snap.ref.update(updateData);

      console.log(
      moderation.flagged ? "⚠️ Message flagged" : "✅ Message safe",
      );
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
      if (!taskData) return;

      let text = "";
      if (taskData.title) {
        text = taskData.title;
      }

      if (taskData.description) {
        text += " " + taskData.description;
      }

      console.log("Checking task:", text);

      const moderation = await moderateContent(text);

      const updateData = {
        flagged: moderation.flagged,
        moderationScores: moderation.scores,
      };

      await snap.ref.update(updateData);

      console.log(moderation.flagged ? "⚠️ Task flagged" : "✅ Task safe");
    },
);

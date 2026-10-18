const geminiClient = require('./geminiClient');
const { reviewCodeWithGemini } = require('./aiReviewer');

/**
 * Re:Code Gemini AI Service
 * Export canonical review engine, prompt builder, and structured schemas
 */
module.exports = {
  reviewCodeWithGemini,
  getGeminiClient: geminiClient.getGeminiClient,
  buildReviewPrompt: geminiClient.buildReviewPrompt,
  DEFAULT_GEMINI_MODEL: geminiClient.DEFAULT_GEMINI_MODEL,
  RECODE_SYSTEM_INSTRUCTION: geminiClient.RECODE_SYSTEM_INSTRUCTION,
  FINDINGS_JSON_SCHEMA: geminiClient.FINDINGS_JSON_SCHEMA,
};

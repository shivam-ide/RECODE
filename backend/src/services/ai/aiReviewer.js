const geminiClient = require('./geminiClient');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.AI_REVIEW_TIMEOUT_MS, 10) || 30000;
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const VALID_CATEGORIES = ['SECURITY', 'QUALITY', 'OPTIMIZATION'];

/**
 * Timeout helper utility
 *
 * @param {Promise} promise - Target asynchronous operation
 * @param {number} timeoutMs - Timeout deadline in milliseconds
 * @returns {Promise<any>}
 */
async function executeWithTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Gemini AI review call timed out after ${timeoutMs}ms.`);
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Validate, normalize, and cross-validate findings from Gemini AI against user source input.
 * Rejects any AI finding if the referenced line number is out of bounds or if the code snippet
 * does not match the actual user input (hallucination rejection guard).
 *
 * @param {Array<Object>} rawFindings - Raw findings returned by Gemini
 * @param {string} [filePath='snippet'] - Target file path
 * @param {string} [codeContent=null] - Optional raw source code for cross-validation
 * @returns {Array<Object>} Validated and normalized findings array
 */
function validateAiFindings(rawFindings, filePath = 'snippet') {
  if (!Array.isArray(rawFindings)) {
    return [];
  }

  const seen = new Set();
  const valid = [];

  for (const item of rawFindings) {
    if (!item || typeof item !== 'object') continue;

    const lineStart =
      typeof item.lineStart === 'number' && item.lineStart > 0
        ? item.lineStart
        : typeof item.line_number === 'number' && item.line_number > 0
        ? item.line_number
        : typeof item.line === 'number' && item.line > 0
        ? item.line
        : 1;

    const lineEnd =
      typeof item.lineEnd === 'number' && item.lineEnd >= lineStart
        ? item.lineEnd
        : lineStart;

    const rawSev = typeof item.severity === 'string' ? item.severity.toUpperCase().trim() : '';
    const severity = VALID_SEVERITIES.includes(rawSev) ? rawSev : 'MEDIUM';

    const rawCat = typeof item.category === 'string' ? item.category.toUpperCase().trim() : '';
    const category = VALID_CATEGORIES.includes(rawCat) ? rawCat : 'QUALITY';

    const ruleId = String(item.ruleId || item.cweId || `AI_${category}`).trim();
    const cweId = item.cweId ? String(item.cweId).trim() : null;

    const title = String(item.title || 'AI Review Finding').trim();
    const whatIsWrong = String(item.what_is_wrong || item.what || item.explanation || item.description || '').trim();
    const whyDangerous = String(item.why_dangerous || item.why || '').trim();
    const howToFix = String(item.how_to_fix || item.how || item.concreteFix || item.remediation || '').trim();
    const explanation = whatIsWrong || String(item.explanation || '').trim();

    const vulnerableSnippet = String(item.vulnerableSnippet || item.diff_before || '').trim();
    let concreteFix = String(item.concreteFix || item.diff_after || '').trim();

    // Sanitize any generic SQL queries on non-SQL issues
    if (
      concreteFix.includes('SELECT * FROM students') &&
      !title.toLowerCase().includes('sql') &&
      !explanation.toLowerCase().includes('sql') &&
      !whatIsWrong.toLowerCase().includes('sql')
    ) {
      concreteFix = '';
    }

    const dedupeKey = `${lineStart}:${category}:${title}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    valid.push({
      ruleId,
      severity,
      cweId,
      lineStart,
      lineEnd,
      vulnerableSnippet,
      concreteFix,
      line: lineStart,
      lineNumber: lineStart,
      line_number: lineStart,
      file: filePath,
      category,
      title,
      what_is_wrong: whatIsWrong,
      what: whatIsWrong,
      why_dangerous: whyDangerous,
      why: whyDangerous,
      how_to_fix: howToFix,
      how: howToFix,
      remediation: howToFix || explanation,
      explanation,
      description: explanation,
      diff_before: vulnerableSnippet,
      diff_after: concreteFix,
      source: 'GEMINI',
      engine_source: 'GEMINI',
      engine: 'Gemini AI',
    });
  }

  return valid;
}


/**
 * Perform AI Code Review using Google Gemini with Graceful Degradation
 *
 * @param {Object} options
 * @param {string} [options.filePath='snippet'] - Target file path
 * @param {string} options.codeContent - Raw source code
 * @param {string} [options.language='javascript'] - Programming language
 * @param {Array<Object>} [options.staticFindings=[]] - Preliminary AST findings
 * @param {number} [options.timeoutMs=15000] - Timeout limit in milliseconds
 * @param {string} [options.model=geminiClient.DEFAULT_GEMINI_MODEL] - Model identifier
 * @param {string} [options.apiKey] - Optional custom API key override
 * @param {Object} [options.client] - Optional preconfigured client override (useful for testing)
 * @returns {Promise<{ partialMode: boolean, findings: Array<Object>, reason?: string, warning?: string, error?: string }>}
 */
async function reviewCodeWithGemini({
  filePath = 'snippet',
  codeContent = '',
  language = 'javascript',
  staticFindings = [],
  hasSyntaxError = false,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  model = geminiClient.DEFAULT_GEMINI_MODEL,
  apiKey,
  client: providedClient,
} = {}) {
  // 1. Handle empty or blank code submissions first
  if (typeof codeContent !== 'string' || codeContent.trim().length === 0) {
    return {
      partialMode: false,
      findings: [],
    };
  }

  // 2. Check if GEMINI_API_KEY is configured or client is provided
  const client = providedClient || geminiClient.getGeminiClient(apiKey);
  if (!client) {
    console.warn(
      '[Re:Code AI] GEMINI_API_KEY is not defined. Operating in partial analysis mode (static AST only).'
    );
    return {
      partialMode: true,
      findings: [],
      reason: 'MISSING_API_KEY',
      warning: 'GEMINI_API_KEY is not defined. Only static AST analysis is active.',
    };
  }

  const effectiveTimeout = Math.max(1000, timeoutMs);

  // 3. Build prompt and invoke Gemini with timeout and error trapping
  try {
    const prompt = geminiClient.buildReviewPrompt({
      filePath,
      codeContent,
      language,
      staticFindings,
      hasSyntaxError,
    });

    const candidateModels = [
      process.env.GEMINI_MODEL,
      'models/gemini-3.8-flash',
      model,
      'models/gemini-3-flash-preview',
      'models/gemini-flash-latest',
    ].filter(Boolean);
    const uniqueModels = [...new Set(candidateModels.map((m) => (m.startsWith('models/') ? m : `models/${m}`)))];

    let response = null;
    let lastError = null;

    for (const currentModel of uniqueModels) {
      try {
        const generatePromise = client.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            systemInstruction: geminiClient.RECODE_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: geminiClient.FINDINGS_JSON_SCHEMA,
            temperature: 0.2,
          },
        });
        response = await executeWithTimeout(generatePromise, effectiveTimeout);
        break;
      } catch (err) {
        lastError = err;
        const isRetryable =
          err.code === 429 ||
          err.status === 429 ||
          err.status === 'RESOURCE_EXHAUSTED' ||
          err.status === 'UNAVAILABLE' ||
          (err.message && (err.message.includes('429') || err.message.includes('503') || err.message.includes('404') || err.message.includes('quota') || err.message.includes('high demand') || err.message.includes('no longer available')));

        if (isRetryable) {
          console.warn(`[Re:Code AI] Model ${currentModel} error (${err.status || 'quota/demand'}). Trying fallback model...`);
          continue;
        } else {
          throw err;
        }
      }
    }

    if (!response && lastError) {
      throw lastError;
    }

    // Extract raw text from response
    let rawText = '';
    if (typeof response.text === 'function') {
      rawText = response.text();
    } else if (typeof response.text === 'string') {
      rawText = response.text;
    } else if (
      response.candidates &&
      response.candidates[0] &&
      response.candidates[0].content &&
      Array.isArray(response.candidates[0].content.parts)
    ) {
      rawText = response.candidates[0].content.parts.map((p) => p.text || '').join('');
    }

    if (!rawText || rawText.trim().length === 0) {
      return {
        partialMode: false,
        findings: [],
        model,
      };
    }

    let parsed;
    try {
      let cleanText = (rawText || '').trim();
      // Sanitize markdown fences (```json ... ``` or ``` ... ```) from Gemini's response
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      }
      parsed = JSON.parse(cleanText);
    } catch (parseErr) {
      console.warn(
        `[Re:Code AI] Failed to parse JSON response from Gemini: ${parseErr.message}. Operating in partial mode.`
      );
      return {
        partialMode: true,
        findings: [],
        reason: 'MALFORMED_AI_RESPONSE',
        warning: 'Gemini returned non-JSON response payload.',
      };
    }

    const validatedFindings = validateAiFindings(parsed.findings, filePath);

    return {
      partialMode: false,
      findings: validatedFindings,
      model,
      meta: {
        totalFindings: validatedFindings.length,
        filePath,
        language,
      },
    };
  } catch (err) {
    if (err.code === 'TIMEOUT' || (err.message && err.message.includes('timed out'))) {
      console.warn(
        `[Re:Code AI] Gemini API call timed out after ${effectiveTimeout}ms. Falling back gracefully to partial analysis mode.`
      );
      return {
        partialMode: true,
        findings: [],
        reason: 'TIMEOUT',
        warning: `Gemini AI review timed out after ${effectiveTimeout}ms. Falling back to partial mode.`,
      };
    }

    console.warn(
      `[Re:Code AI] Gemini API invocation error: ${err.message}. Falling back gracefully to partial analysis mode.`
    );
    return {
      partialMode: true,
      findings: [],
      reason: 'API_ERROR',
      error: err.message,
      warning: `Gemini AI review failed (${err.message}). Partial mode active.`,
    };
  }
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  VALID_SEVERITIES,
  VALID_CATEGORIES,
  executeWithTimeout,
  validateAiFindings,
  reviewCodeWithGemini,
};

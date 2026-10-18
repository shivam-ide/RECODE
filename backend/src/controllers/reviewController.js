const { executeReviewPipeline } = require('../services/orchestrator');
const {
  getReviewById,
  getReviewHistory,
  deleteReviewById,
} = require('../services/persistence/reviewRepository');
const { generateReviewPdf } = require('../services/reports/pdfGenerator');
const { generateSuggestedReadme } = require('../services/reports/readmeGenerator');
const { successResponse } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

/**
 * Controller: Run Automated Code Review Pipeline
 *
 * Accepts either:
 * 1. Direct code snippet (pasted code + language)
 * 2. Public GitHub repository URL
 *
 * Executes the 7-step analysis pipeline and returns the canonical review results payload.
 *
 * @route POST /api/v1/reviews/run
 * @access Public (Guest & Authenticated)
 */
async function runCodeReview(req, res, next) {
  try {
    const {
      source_type,
      sourceType,
      payload,
      content,
      code,
      url,
      repo_url,
      repoUrl,
      language,
      project_name,
      projectName,
      branch,
      guest_session_id,
      guestSessionId,
      userId,
      options,
    } = req.body || {};

    const effectiveUserId = req.user?.id || req.headers['x-user-id'] || userId || null;

    // Strict priority: If user is authenticated, guestSessionId must be null
    const effectiveGuestSessionId = effectiveUserId
      ? null
      : (guest_session_id ||
         guestSessionId ||
         req.headers['x-guest-session-id'] ||
         require('crypto').randomUUID());

    const result = await executeReviewPipeline({
      sourceType: sourceType || source_type,
      payload,
      content,
      code,
      url,
      repo_url,
      repoUrl,
      language,
      projectName: projectName || project_name,
      branch,
      guestSessionId: effectiveGuestSessionId,
      userId: effectiveUserId,
      options,
    });

    return successResponse(
      res,
      200,
      result,
      'Code review pipeline executed successfully.'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Stored Review Details by ID
 *
 * @route GET /api/v1/reviews/:id
 * @access Public (Guest with x-guest-session-id or Authenticated)
 */
async function getReviewDetails(req, res, next) {
  try {
    const { id } = req.params;
    const isExplicitGuest = req.headers['x-is-guest'] === 'true';
    const userId = isExplicitGuest ? null : (req.user?.id || req.headers['x-user-id'] || null);
    const guestSessionId = (!userId || isExplicitGuest)
      ? (req.headers['x-guest-session-id'] ||
         req.query.guestSessionId ||
         req.query.guest_session_id ||
         null)
      : null;

    const review = await getReviewById(id, { userId, guestSessionId });
    if (!review) {
      throw new AppError(`Review with ID '${id}' not found or access denied.`, 404);
    }

    return successResponse(res, 200, review, 'Review retrieved successfully.');
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Review History for User or Guest Session
 *
 * @route GET /api/v1/reviews/history
 * @access Public (Guest with x-guest-session-id or Authenticated)
 */
async function getReviewHistoryController(req, res, next) {
  try {
    const isExplicitGuest = req.headers['x-is-guest'] === 'true';

    // If explicit guest request, strictly ignore any authenticated user
    const userId = isExplicitGuest ? null : (req.user?.id || req.headers['x-user-id'] || null);

    // If user is authenticated, guestSessionId is null; otherwise use guest session id
    const guestSessionId = (!userId || isExplicitGuest)
      ? (req.headers['x-guest-session-id'] ||
         req.query.guestSessionId ||
         req.query.guest_session_id ||
         null)
      : null;

    const history = await getReviewHistory({
      userId,
      guestSessionId,
      accessToken: req.token,
    });

    return successResponse(
      res,
      200,
      history,
      'Review history retrieved successfully.'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Delete Review by ID
 *
 * @route DELETE /api/v1/reviews/:id
 * @access Public (Subject to ownership check)
 */
async function deleteReview(req, res, next) {
  try {
    const { id } = req.params;
    const guestSessionId =
      req.headers['x-guest-session-id'] ||
      req.query.guestSessionId ||
      req.query.guest_session_id ||
      null;
    const userId = req.user?.id || req.headers['x-user-id'] || null;

    const deleted = await deleteReviewById(id, { userId, guestSessionId });
    if (!deleted) {
      throw new AppError(
        `Review with ID '${id}' not found or deletion failed.`,
        404
      );
    }

    return successResponse(
      res,
      200,
      { id, deleted: true },
      'Review deleted successfully.'
    );
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Download Review PDF Audit Report
 *
 * @route GET /api/v1/reviews/:id/pdf
 * @access Public (Subject to ownership check)
 */
async function downloadReviewPdf(req, res, next) {
  try {
    const { id } = req.params;
    const guestSessionId =
      req.headers['x-guest-session-id'] ||
      req.query.guestSessionId ||
      req.query.guest_session_id ||
      null;
    const userId = req.user?.id || req.headers['x-user-id'] || null;

    const review = await getReviewById(id, { userId, guestSessionId });
    if (!review) {
      throw new AppError(`Review with ID '${id}' not found.`, 404);
    }

    const pdfBuffer = await generateReviewPdf(review);

    const safeName = (review.project_name || 'project')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .toLowerCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="recode_audit_${safeName}_${id.slice(0, 8)}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Download Suggested README Markdown
 *
 * @route GET /api/v1/reviews/:id/readme
 * @access Public (Subject to ownership check)
 */
async function downloadReviewReadme(req, res, next) {
  try {
    const { id } = req.params;
    const guestSessionId =
      req.headers['x-guest-session-id'] ||
      req.query.guestSessionId ||
      req.query.guest_session_id ||
      null;
    const userId = req.user?.id || req.headers['x-user-id'] || null;

    const review = await getReviewById(id, { userId, guestSessionId });
    if (!review) {
      throw new AppError(`Review with ID '${id}' not found.`, 404);
    }

    const readmeMarkdown = generateSuggestedReadme(review);

    const safeName = (review.project_name || 'project')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="README_${safeName}.md"`
    );

    return res.send(readmeMarkdown);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  runCodeReview,
  runReview: runCodeReview,
  getReviewDetails,
  getReviewHistoryController,
  deleteReview,
  downloadReviewPdf,
  downloadReviewReadme,
};




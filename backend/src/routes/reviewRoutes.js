const express = require('express');
const { optionalAuth } = require('../middleware/authMiddleware');
const {
  runCodeReview,
  getReviewDetails,
  getReviewHistoryController,
  deleteReview,
  downloadReviewPdf,
  downloadReviewReadme,
} = require('../controllers/reviewController');

const router = express.Router();

// Apply optionalAuth across review routes to populate req.user from Bearer token
router.use(optionalAuth);

/**
 * @route   POST /api/v1/reviews/run
 * @desc    Execute the complete 7-step code review pipeline (AST + Gemini AI)
 * @access  Public (Guest with x-guest-session-id or Authenticated)
 */
router.post('/run', runCodeReview);
router.post('/analyze', runCodeReview);
router.post('/', runCodeReview);

/**
 * @route   GET /api/v1/reviews/history
 * @desc    Retrieve historical review audit sessions for current user or guest
 * @access  Public (Guest with x-guest-session-id or Authenticated)
 */
router.get('/history', getReviewHistoryController);

/**
 * @route   GET /api/v1/reviews/:id/pdf
 * @desc    Generate and download formal PDF code review audit report
 * @access  Public (Subject to RLS/ownership)
 */
router.get('/:id/pdf', downloadReviewPdf);

/**
 * @route   GET /api/v1/reviews/:id/readme
 * @desc    Generate and download suggested project README markdown
 * @access  Public (Subject to RLS/ownership)
 */
router.get('/:id/readme', downloadReviewReadme);

/**
 * @route   GET /api/v1/reviews/:id
 * @desc    Retrieve persisted code review with joined files and issues
 * @access  Public (Subject to RLS/ownership)
 */
router.get('/:id', getReviewDetails);

/**
 * @route   DELETE /api/v1/reviews/:id
 * @desc    Delete audit review session by ID
 * @access  Public (Subject to RLS/ownership)
 */
router.delete('/:id', deleteReview);

module.exports = router;



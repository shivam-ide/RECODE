const express = require('express');
const { validateSubmissionPayload } = require('../controllers/submissionController');

const router = express.Router();

/**
 * @route   POST /api/v1/submissions/validate
 * @desc    Validate direct code snippet or public GitHub repository payload
 * @access  Public (Guest & Authenticated)
 */
router.post('/validate', validateSubmissionPayload);

module.exports = router;

const { validateDirectSnippet, validateGitHubUrl } = require('../utils/validators');
const { resolveDnsAndValidate } = require('../middleware/security');
const { successResponse } = require('../utils/apiResponse');
const AppError = require('../utils/AppError');

/**
 * Controller: Validate Code Submission Payload
 * Validates direct code snippets (character count, language support, size limits)
 * or public GitHub repository URLs (SSRF prevention, hostname constraint, format check).
 *
 * @route POST /api/v1/submissions/validate
 */
async function validateSubmissionPayload(req, res, next) {
  try {
    const {
      source_type,
      sourceType,
      content,
      language,
      project_name,
      projectName,
      url,
      repo_url,
      repoUrl,
    } = req.body || {};

    const effectiveSourceType = (source_type || sourceType || '').trim().toLowerCase();
    const effectiveProjectName = project_name || projectName;

    if (!effectiveSourceType) {
      throw new AppError(
        "Missing required 'source_type' field. Must be either 'direct' or 'github'.",
        400,
        { field: 'source_type', allowed: ['direct', 'github'] }
      );
    }

    if (effectiveSourceType === 'direct') {
      const validated = validateDirectSnippet(content, language, effectiveProjectName);
      return successResponse(
        res,
        200,
        {
          isValid: true,
          valid: true,
          sourceType: 'direct',
          language: validated.language,
          projectName: validated.projectName,
          characterCount: validated.characterCount,
          linesCount: validated.linesCount,
          parserReady: true,
        },
        'Direct code snippet validated successfully. Parser ready for AST analysis.'
      );
    }

    if (effectiveSourceType === 'github') {
      const targetUrl = url || repo_url || repoUrl;
      const validated = validateGitHubUrl(targetUrl);

      // Comprehensive SSRF Shield: Resolve DNS hostnames before proceeding
      await resolveDnsAndValidate(new URL(validated.url).hostname);
      return successResponse(
        res,
        200,
        {
          isValid: true,
          valid: true,
          sourceType: 'github',
          url: validated.url,
          owner: validated.owner,
          repo: validated.repo,
          projectName: effectiveProjectName || validated.projectName,
          characterCount: null, // Computed upon repository clone / tarball ingestion
          parserReady: true,
        },
        'GitHub repository URL validated successfully. Target verified safe for AST ingestion.'
      );
    }

    throw new AppError(
      `Invalid source_type '${effectiveSourceType}'. Expected 'direct' or 'github'.`,
      400,
      { field: 'source_type', received: effectiveSourceType, allowed: ['direct', 'github'] }
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateSubmissionPayload,
};

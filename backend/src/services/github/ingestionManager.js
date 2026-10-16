const {
  fetchRepoTree,
  filterCandidateFiles,
  fetchFileRawContent,
} = require('./githubService');
const AppError = require('../../utils/AppError');

/**
 * Ingestion Manager: Fetches, filters, retrieves, and normalizes GitHub repository code files
 * into the standardized Re:Code AST analysis schema:
 * [{ path: "src/auth.js", language: "javascript", content: "...", lines: 120 }]
 *
 * @param {Object} options
 * @param {string} options.owner - GitHub repository owner
 * @param {string} options.repo - GitHub repository name
 * @param {string} [options.branch='main'] - Git branch or commit ref
 * @param {number} [options.concurrency=5] - Maximum parallel file content fetches
 * @returns {Promise<{ files: Array<{ path: string, language: string, content: string, lines: number }>, summary: Object }>}
 */
async function ingestRepository({ owner, repo, branch = 'main', concurrency = 5 } = {}) {
  if (!owner || !repo) {
    throw new AppError('Repository owner and name are required for ingestion.', 400);
  }

  // 1. Fetch Git tree
  const treeData = await fetchRepoTree(owner, repo, branch);

  // 2. Filter candidates and enforce resource limits (<= 50 files, <= 10MB)
  const candidateFiles = filterCandidateFiles(treeData.tree);

  // 3. Concurrently fetch raw file contents in controlled batches
  const normalizedFiles = [];
  const batchSize = Math.max(1, concurrency);

  for (let i = 0; i < candidateFiles.length; i += batchSize) {
    const batch = candidateFiles.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (file) => {
        const rawContent = await fetchFileRawContent(
          owner,
          repo,
          file.path,
          treeData.branch || branch || 'main',
          file.sha
        );

        const lines = rawContent.split(/\r\n|\r|\n/).length;

        return {
          path: file.path,
          language: file.language,
          content: rawContent,
          lines,
        };
      })
    );

    normalizedFiles.push(...batchResults);
  }

  // 4. Compute telemetry and summary metrics
  const languageBreakdown = {};
  let totalLines = 0;
  let totalBytes = 0;

  for (const file of normalizedFiles) {
    languageBreakdown[file.language] = (languageBreakdown[file.language] || 0) + 1;
    totalLines += file.lines;
    totalBytes += Buffer.byteLength(file.content, 'utf8');
  }

  return {
    files: normalizedFiles,
    summary: {
      projectName: `${owner}/${repo}`,
      owner,
      repo,
      branch: treeData.branch,
      commitSha: treeData.sha,
      totalFiles: normalizedFiles.length,
      totalLines,
      totalBytes,
      languages: Object.keys(languageBreakdown),
      languageBreakdown,
    },
  };
}

module.exports = {
  ingestRepository,
};

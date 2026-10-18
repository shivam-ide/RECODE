/**
 * Re-exporting unified GitHub ingestion and traversal engine from services/ingestion/githubIngestion.js
 */
const githubIngestion = require('../ingestion/githubIngestion');

module.exports = {
  ...githubIngestion,
};

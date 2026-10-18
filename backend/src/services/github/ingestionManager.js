/**
 * Re-exporting unified GitHub repository ingestion manager from services/ingestion/githubIngestion.js
 */
const { ingestRepository } = require('../ingestion/githubIngestion');

module.exports = {
  ingestRepository,
};

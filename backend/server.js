const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration from recode-app root .env or local .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const { validateEnvironment } = require('./src/config/envValidator');

// Run startup integrity check
const envReport = validateEnvironment();
if (envReport.warnings.length > 0) {
  envReport.warnings.forEach((warn) => console.warn(`[Re:Code Config Warning] ${warn}`));
}

if (envReport.partialMode) {
  console.log('[Re:Code Status] Running in Partial Analysis Mode (Deterministic AST only).');
} else {
  console.log('[Re:Code Status] Full Dual-Engine Mode Active (AST Static + Gemini AI).');
}

const app = require('./src/app');

const PORT = envReport.config.port || process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Re:Code Backend] Server operational on port ${PORT} (Environment: ${process.env.NODE_ENV || 'development'})`);
  console.log(`[Re:Code Backend] Health probe available at http://localhost:${PORT}/api/v1/health`);
});

module.exports = server;

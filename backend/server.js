const path = require('path');
const dotenv = require('dotenv');

// Load environment configuration from recode-app root .env or local .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`[Re:Code Backend] Server operational on port ${PORT} (Environment: ${process.env.NODE_ENV || 'development'})`);
  console.log(`[Re:Code Backend] Health probe available at http://localhost:${PORT}/api/v1/health`);
});

module.exports = server;

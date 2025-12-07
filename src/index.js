// api/src/bot-polling.js

require('dotenv').config();
const { startPollingBot } = require('./bot-polling');

const USE_POLLING = (process.env.USE_POLLING || 'true') === 'true';

if (USE_POLLING) {
  startPollingBot();
} else {
  console.log('USE_POLLING=false → expected to run in webhook environment (Vercel).');
  console.log('Deploy the project to Vercel; webhook endpoint is /api/webhook.');
}

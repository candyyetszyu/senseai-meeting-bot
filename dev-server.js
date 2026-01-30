/**
 * Development server for local testing
 * Run with: npm run dev
 */

require('dotenv').config();

const express = require('express');
const config = require('./config');
const { handleWebhook } = require('./handler');
const scheduler = require('./services/scheduler');

const app = express();
const port = config.server.port;

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SenseAI Assistant',
    timestamp: new Date().toISOString(),
  });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    // For URL verification, wait for result
    if (req.body.type === 'url_verification') {
      const result = await handleWebhook(req.body);
      return res.json(result);
    }
    
    // For all other events, ALWAYS respond immediately with success
    // This prevents Lark from retrying even if processing fails
    res.json({ success: true });
    
    // Process webhook asynchronously (fire and forget)
    handleWebhook(req.body).catch(error => {
      console.error('Async webhook processing error:', error);
    });
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    // Still return 200 to prevent Lark from retrying
    // Only log the error for debugging
    if (!res.headersSent) {
      res.json({ success: true });
    }
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 SenseAI Assistant is running on http://localhost:${port}`);
  console.log(`📡 Webhook URL: http://localhost:${port}/webhook`);
  console.log('\n💡 For local testing, use ngrok or similar to expose this server:');
  console.log(`   ngrok http ${port}`);
});

/**
 * Development server for local testing
 * Run with: npm run dev
 */

const express = require('express');
const config = require('./config');
const { handleWebhook } = require('./handler');

const app = express();
const port = config.server.port;

// Parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Lark Meeting Bot',
    timestamp: new Date().toISOString(),
  });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  try {
    console.log('Received webhook:', JSON.stringify(req.body, null, 2));
    
    const result = await handleWebhook(req.body);
    
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Lark Meeting Bot is running on http://localhost:${port}`);
  console.log(`📡 Webhook URL: http://localhost:${port}/webhook`);
  console.log('\n💡 For local testing, use ngrok or similar to expose this server:');
  console.log(`   ngrok http ${port}`);
});

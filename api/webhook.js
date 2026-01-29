/**
 * Vercel serverless function for webhook handling
 * Deployed at: /api/webhook
 */

const { handleWebhook } = require('../handler');

module.exports = async (req, res) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // For URL verification, wait for result
    if (req.body.type === 'url_verification') {
      const result = await handleWebhook(req.body);
      return res.status(200).json(result);
    }
    
    // For all other events, ALWAYS respond immediately with success
    // This prevents Lark from retrying even if processing fails
    res.status(200).json({ success: true });
    
    // Process webhook asynchronously (fire and forget)
    handleWebhook(req.body).catch(error => {
      console.error('Async webhook processing error:', error);
    });
  } catch (error) {
    console.error('Webhook endpoint error:', error);
    // Still return 200 to prevent Lark from retrying
    // Only log the error for debugging
    if (!res.headersSent) {
      return res.status(200).json({ success: true });
    }
  }
};

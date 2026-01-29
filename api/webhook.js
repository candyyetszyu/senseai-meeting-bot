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
    const result = await handleWebhook(req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({
      error: error.message,
    });
  }
};

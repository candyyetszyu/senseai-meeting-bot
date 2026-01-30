/**
 * Webhook Handler - Entry point for all Lark webhook events
 */

const { handleMessageEvent } = require('./messageRouter');

/**
 * Main webhook handler function
 * Entry point for all Lark webhook events
 * @param {object} event - Lark webhook event
 * @returns {Promise<object>}
 */
async function handleWebhook(event) {
  try {
    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      return {
        challenge: event.challenge,
      };
    }

    // Handle message events
    if (event.header?.event_type === 'im.message.receive_v1') {
      await handleMessageEvent(event);
      return { success: true };
    }

    // Handle other event types as needed
    console.log('Unhandled event type:', event.header?.event_type || event.type);
    return { success: true };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      error: error.message,
    };
  }
}

module.exports = {
  handleWebhook,
};

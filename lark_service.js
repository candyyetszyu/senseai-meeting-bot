/**
 * Lark Service - Main Lark API integration point
 * Uses modular services for specific functionality
 */

const larkMessaging = require('./services/larkMessaging');
const larkBitable = require('./services/larkBitable');

// Initialize Bitable service with messaging service
larkBitable.setMessaging(larkMessaging);

// Re-export all lark service methods for backward compatibility
module.exports = {
  // Messaging methods
  getAccessToken: larkMessaging.getAccessToken.bind(larkMessaging),
  apiRequest: larkMessaging.apiRequest.bind(larkMessaging),
  sendMessage: larkMessaging.sendMessage.bind(larkMessaging),
  replyMessage: larkMessaging.replyMessage.bind(larkMessaging),
  getMessageReplies: larkMessaging.getMessageReplies.bind(larkMessaging),
  createCardMessage: larkMessaging.createCardMessage.bind(larkMessaging),

  // Bitable methods
  addThought: larkBitable.addThought.bind(larkBitable),
  getRecentThoughts: larkBitable.getRecentThoughts.bind(larkBitable),
  getAllThoughts: larkBitable.getAllThoughts.bind(larkBitable),
};
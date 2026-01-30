/**
 * Main webhook handler for Lark Meeting Bot
 * Uses modular handlers for specific functionality
 */

const { handleWebhook } = require('./handlers/webhook');

module.exports = {
  handleWebhook,
};
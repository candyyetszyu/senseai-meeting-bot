/**
 * Main webhook handler for SenseAI Assistant
 * Uses modular handlers for specific functionality
 */

const { handleWebhook } = require('./handlers/webhook');

module.exports = {
  handleWebhook,
};
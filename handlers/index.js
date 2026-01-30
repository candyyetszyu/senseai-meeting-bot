/**
 * Handlers aggregator
 */

const webhook = require('./webhook');
const messageRouter = require('./messageRouter');
const commandHandler = require('./commandHandler');
const mentionHandler = require('./mentionHandler');

module.exports = {
  ...webhook,
  ...messageRouter,
  ...commandHandler,
  ...mentionHandler,
};

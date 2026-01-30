/**
 * Configuration Aggregator
 * Combines all config modules into a single export
 */

// Load environment variables first
require('dotenv').config();

const lark = require('./lark');
const ai = require('./ai');
const app = require('./app');
const templates = require('./templates');

module.exports = {
  ...lark,
  ...ai,
  ...app,
  ...templates,
};

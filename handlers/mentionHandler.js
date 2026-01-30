/**
 * Mention Handler - Detects when the bot is mentioned
 */

const { replaceMentionPlaceholders, extractRichText } = require('../utils/textProcessor');

/**
 * Check if bot is mentioned in the message
 * @param {Array} mentions - Array of mention objects
 * @param {string} text - Message text
 * @param {object} content - Parsed message content
 * @returns {boolean}
 */
function isBotMentioned(mentions, text, content) {
  if (!mentions || mentions.length === 0) {
    return false;
  }

  for (const mention of mentions) {
    // Method 1: Check mention.id.app_id (bot mentions)
    if (mention.id && mention.id.app_id) {
      console.log('✅ Bot detected via mention.id.app_id:', mention.id.app_id);
      return true;
    }

    // Method 2: Check if user_id is empty (bot indicator)
    if (mention.id && mention.id.user_id === '') {
      console.log('✅ Bot detected via empty user_id (bot indicator)');
      return true;
    }

    // Method 3: Check mention name matches bot name pattern
    if (mention.name && (mention.name.toLowerCase().includes('bot') ||
                         mention.name.toLowerCase().includes('meeting') ||
                         mention.name === 'Meeting Group')) {
      console.log('✅ Bot detected via name pattern:', mention.name);
      return true;
    }

    // Method 4: Check if mention key appears in content.text
    if (mention.key && content.text?.includes(mention.key)) {
      console.log('✅ Bot detected via mention key in content.text');
      return true;
    }

    // Method 5: Check if text variable contains the mention key
    if (mention.key && text?.includes(mention.key)) {
      console.log('✅ Bot detected via mention key in text variable');
      return true;
    }
  }

  // Fallback: If mentions exist but no text, assume bot mention
  if (mentions.length > 0 && (!text || text.trim().length === 0)) {
    console.log('⚠️  No text content but mentions exist - assuming bot mention');
    return true;
  }

  return false;
}

/**
 * Extract thought text from message
 * @param {object} content - Parsed message content
 * @param {string} text - Raw text
 * @param {Array} mentions - Mention objects
 * @returns {string}
 */
function extractThoughtText(content, text, mentions) {
  // Try multiple sources for text
  let thoughtText = content.text || text || '';

  if (!thoughtText && content) {
    try {
      const rawContent = JSON.parse(JSON.stringify(content));
      thoughtText = rawContent.text || rawContent.content || rawContent.post || '';
      console.log('📝 Extracted text from alternate fields:', {
        type: typeof thoughtText,
        isArray: Array.isArray(thoughtText),
        length: thoughtText?.length,
        value: thoughtText
      });
    } catch (e) {}
  }

  // Handle rich text format (array of text elements)
  if (Array.isArray(thoughtText)) {
    console.log('📝 Converting rich text array to plain text');
    thoughtText = extractRichText(thoughtText);
    console.log('📝 Converted rich text to plain text:', {
      length: thoughtText.length,
      preview: thoughtText.substring(0, 100)
    });
  }

  // Ensure it's a string
  if (typeof thoughtText !== 'string') {
    thoughtText = String(thoughtText || '');
  }

  // Replace @mention placeholders
  thoughtText = replaceMentionPlaceholders(thoughtText, mentions);

  // Remove bot's @mention from text
  for (const mention of mentions) {
    if (mention.id && (mention.id.app_id || mention.id.user_id === '')) {
      if (mention.key && thoughtText) {
        thoughtText = thoughtText.replace(new RegExp(`@${mention.name}`, 'g'), '').trim();
      }
    }
  }

  return thoughtText;
}

module.exports = {
  isBotMentioned,
  extractThoughtText,
};

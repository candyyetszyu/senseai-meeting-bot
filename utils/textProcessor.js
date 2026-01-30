/**
 * Text processing utilities
 */

/**
 * Replace @mention placeholders with actual names
 * @param {string} text - Text with @_user_1, @_user_2 placeholders
 * @param {Array} mentions - Array of mention objects with key and name
 * @returns {string} - Text with actual @names
 */
function replaceMentionPlaceholders(text, mentions) {
  if (!text || !mentions || mentions.length === 0) {
    return text;
  }

  let result = text;
  for (const mention of mentions) {
    if (mention.key && mention.name) {
      result = result.replace(new RegExp(mention.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `@${mention.name}`);
    }
  }

  return result;
}

/**
 * Extract text from rich text array format
 * @param {Array} richText - Rich text array
 * @returns {string} - Plain text
 */
function extractRichText(richText) {
  if (!Array.isArray(richText)) {
    return String(richText || '');
  }

  // Helper function to extract text recursively from nested arrays/objects
  const extractText = (element) => {
    if (typeof element === 'string') {
      return element;
    } else if (Array.isArray(element)) {
      return element.map(extractText).join('');
    } else if (element && typeof element === 'object') {
      return element.text || element.content || '';
    }
    return '';
  };

  return richText
    .map(extractText)
    .filter(line => line.trim().length > 0)
    .join('\n')
    .trim();
}

module.exports = {
  replaceMentionPlaceholders,
  extractRichText,
};

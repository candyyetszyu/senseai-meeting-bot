/**
 * Markdown stripping utilities
 */

/**
 * Strip markdown formatting from text for Lark compatibility
 * @param {string} text - Text with markdown
 * @returns {string} - Clean text
 */
function stripMarkdown(text) {
  if (!text) return '';

  return text
    .replace(/^###+\s+/gm, '')      // Remove headers
    .replace(/\*\*/g, '')           // Remove bold
    .replace(/\*/g, '')             // Remove italic
    .replace(/`/g, '')              // Remove code
    .replace(/---/g, '')            // Remove horizontal rules
    .replace(/\n{2,}/g, '\n\n');    // 2+ blank lines become 1 line
}

/**
 * Extract author from Bitable Author field
 * @param {any} authorField - Author field from Bitable
 * @returns {string} - Author name
 */
function extractAuthor(authorField) {
  if (!authorField) return 'Unknown';

  if (Array.isArray(authorField) && authorField.length > 0) {
    return authorField[0].name || authorField[0].en_name || authorField[0].id || 'Unknown';
  }

  if (typeof authorField === 'string') {
    return authorField;
  }

  return 'Unknown';
}

module.exports = {
  stripMarkdown,
  extractAuthor,
};

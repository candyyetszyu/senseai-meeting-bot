/**
 * Helper utilities for SenseAI Assistant
 */

/**
 * Parse command from message text
 * @param {string} text - Message text
 * @returns {object} - { command, args }
 */
function parseCommand(text) {
  if (!text || !text.startsWith('/')) {
    return { command: null, args: [] };
  }

  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  return { command, args };
}

/**
 * Extract meeting ID from various formats
 * @param {string} text - Text containing meeting ID
 * @returns {string|null} - Meeting ID or null
 */
function extractMeetingId(text) {
  const match = text.match(/(?:meeting[_-])?(\w+)/i);
  return match ? match[1] : null;
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} - Formatted date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Generate meeting summary for list view
 * @param {object} meeting - Meeting record
 * @returns {string} - Formatted summary
 */
function formatMeetingSummary(meeting) {
  const status = meeting.status || 'pending';
  const emoji = {
    pending: '⏳',
    processing: '🔄',
    completed: '✅',
    error: '❌',
  }[status] || '📝';

  const date = meeting.created_time
    ? formatDate(meeting.created_time)
    : 'Unknown date';

  return `${emoji} ${meeting.title || 'Untitled Meeting'} - ${date}`;
}

/**
 * Truncate text to specified length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Validate transcript content
 * @param {string} transcript - Meeting transcript
 * @returns {boolean} - Whether transcript is valid
 */
function isValidTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return false;
  }

  const trimmed = transcript.trim();
  return trimmed.length >= 50;
}

/**
 * Extract meeting title from transcript
 * @param {string} transcript - Meeting transcript
 * @returns {string|null} - Extracted title or null
 */
function extractMeetingTitle(transcript) {
  if (!transcript) {
    return null;
  }

  const lines = transcript.trim().split('\n');
  const firstLine = lines[0].trim();

  if (firstLine.length < 100 && !firstLine.includes(':')) {
    return firstLine;
  }

  const titlePatterns = [
    /^(?:meeting|call|session|sync)[:\s]+(.+)/i,
    /^(.+?)\s+meeting/i,
    /^(.+?)\s+\d{4}-\d{2}-\d{2}/,
  ];

  for (const pattern of titlePatterns) {
    const match = firstLine.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return truncate(firstLine, 50);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} - Promise that resolves after sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in ms
 * @returns {Promise} - Result of function
 */
async function retry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Retry attempt ${i + 1} after ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Safe JSON parse with fallback
 * @param {string} jsonString - JSON string to parse
 * @param {any} defaultValue - Default value if parse fails
 * @returns {any} - Parsed object or default value
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}

module.exports = {
  parseCommand,
  extractMeetingId,
  extractMeetingTitle,
  formatDate,
  formatMeetingSummary,
  truncate,
  isValidTranscript,
  sleep,
  retry,
  safeJsonParse,
};

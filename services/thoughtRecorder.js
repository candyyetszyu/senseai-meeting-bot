/**
 * Thought Recorder Service - Handles recording thoughts from mentions and replies
 */

const larkBitable = require('./larkBitable');
const larkMessaging = require('./larkMessaging');
const config = require('../config');

/**
 * Classify meeting context based on text content
 * @param {string} text - Thought text
 * @returns {string} - Meeting context classification
 */
function classifyMeetingContext(text) {
  // Check for daily report keywords (case-insensitive variations)
  const dailyReportPatterns = [
    /daily\s+report/i,
    /Daily\s+report/i,
    /Daily\s+Report/i,
    /daily\s+Report/i,
  ];

  const isDailyReport = dailyReportPatterns.some(pattern => pattern.test(text));

  if (isDailyReport) {
    return '(Daily Report)';
  }

  return 'General Discussion';
}

/**
 * Unified handler for recording thoughts
 * @param {string} text - Thought text
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {object} event - Lark event object
 */
async function recordThought(text, chatId, messageId, event) {
  try {
    const sender = event?.event?.sender;
    const senderId = sender?.sender_id;

    const userId = senderId?.open_id || senderId?.user_id;
    const userIdType = senderId?.open_id ? 'open_id' : 'user_id';

    console.log('📝 Recording thought with user ID:', userId);

    // Classify the meeting context based on text content
    const meetingContext = classifyMeetingContext(text);

    console.log('📋 Meeting context classified as:', meetingContext);

    await larkBitable.addThought(text, null, meetingContext, userId, userIdType);

    await larkMessaging.replyMessage(
      messageId,
      `💭 Thought recorded!${meetingContext !== 'General Discussion' ? `\n📌 Context: ${meetingContext}` : ''}

📋 Use /thoughts to see latest ${config.thoughts.displayLimit}
🧠 Use /summarize for AI summary of all thoughts`
    );
  } catch (error) {
    console.error('Handle thought recording error:', error);
    await larkMessaging.replyMessage(
      messageId,
      '💭 Thought noted! (Bitable storage may not be configured properly)'
    );
  }
}

/**
 * Handle replies to bot messages
 * @param {string} parentMessageId - Parent message ID
 * @param {string} text - Reply text
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {object} event - Lark event
 */
async function handleReply(parentMessageId, text, chatId, messageId, event) {
  await recordThought(text, chatId, messageId, event);
}

/**
 * Handle @mention of bot
 * @param {string} text - Mention text
 * @param {string} chatId - Chat ID
 * @param {string} messageId - Message ID
 * @param {object} event - Lark event
 */
async function handleMention(text, chatId, messageId, event) {
  await recordThought(text, chatId, messageId, event);
}

module.exports = {
  recordThought,
  handleReply,
  handleMention,
};

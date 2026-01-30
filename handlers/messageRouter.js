/**
 * Message Router - Routes incoming messages to appropriate handlers
 */

const { parseCommand } = require('../utils/helpers');
const { isBotMentioned, extractThoughtText } = require('./mentionHandler');
const { handleCommand } = require('./commandHandler');
const { handleReply, handleMention } = require('../services/thoughtRecorder');
const { tryAcquireLock, releaseLock } = require('../services/lockManager');
const larkService = require('../lark_service');

/**
 * Handle incoming message events
 * @param {object} event - Lark event object
 */
async function handleMessageEvent(event) {
  const message = event.event.message;
  const messageId = message?.message_id;
  const chatId = message?.chat_id;
  const eventId = event.header?.event_id;

  const lockKey = eventId || messageId;
  if (!tryAcquireLock(lockKey)) {
    console.log(`⏭️  Skipping duplicate webhook: eventId=${eventId}, messageId=${messageId}`);
    return;
  }

  try {
    let text = '';
    try {
      text = JSON.parse(message?.content || '{}').text || '';
    } catch (e) {}

    const { command } = parseCommand(text);
    console.log(`📥 Processing: messageId=${messageId}, chatId=${chatId}, command=${command}`);

    const sender = event.event.sender;

    // Ignore bot's own messages
    if (sender.sender_type === 'app') {
      return;
    }

    const { command: cmd, args } = parseCommand(text);

    if (cmd) {
      await handleCommand(cmd, args, chatId, messageId);
    } else if (message.parent_id) {
      // Handle replies to bot messages
      const mentions = message.mentions || [];
      await handleReply(message.parent_id, text, chatId, messageId, event);
    } else if (message.mentions && message.mentions.length > 0) {
      // Check if bot is mentioned
      const content = JSON.parse(message.content);
      const mentions = message.mentions || [];

      console.log('📝 Message with mentions detected:', {
        hasContentText: !!content.text,
        textLength: (content.text || text).length,
        mentionsCount: mentions.length,
        mentionKeys: mentions.map(m => m.key),
      });

      if (isBotMentioned(mentions, text, content)) {
        const thoughtText = extractThoughtText(content, text, mentions);

        console.log('💭 Recording thought:', {
          originalLength: (content.text || text).length,
          afterCleanup: thoughtText.length,
          hasContent: !!thoughtText,
        });

        if (thoughtText && thoughtText.trim().length > 0) {
          await handleMention(thoughtText, chatId, messageId, event);
        } else {
          console.log('⚠️  Skipped: no text content after removing mentions');
          await larkService.replyMessage(
            messageId,
            '💭 Got your mention! But there was no message content to record.\n\n💡 Tip: Add some text with your @mention to record a thought.'
          );
        }
      } else {
        console.log('ℹ️  Bot not mentioned, treating as potential transcript');
      }
    } else {
      console.log('ℹ️  No command, mention, or reply - ignoring message');
    }
  } finally {
    releaseLock(lockKey);
  }
}

module.exports = {
  handleMessageEvent,
};

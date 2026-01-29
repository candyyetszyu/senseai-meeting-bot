/**
 * Main webhook handler for Lark Meeting Bot
 * Handles incoming events and coordinates between services
 */

const larkService = require('./lark_service');
const aiService = require('./ai_service');
const utils = require('./utils');
const config = require('./config');
const fs = require('fs');
const path = require('path');

// Deduplication: Use file-based lock for webhook processing
const LOCK_DIR = path.join(__dirname, '.locks');
const LOCK_TTL_MS = 5000;

// Ensure lock directory exists
if (!fs.existsSync(LOCK_DIR)) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

/**
 * Try to acquire a lock for a message ID
 * Returns true if lock acquired (should process), false if already locked (skip)
 */
function tryAcquireLock(messageId) {
  const lockFile = path.join(LOCK_DIR, `${messageId}.lock`);
  try {
    // Try to create lock file atomically-ish
    if (fs.existsSync(lockFile)) {
      // Check if lock is stale
      const stats = fs.statSync(lockFile);
      if (Date.now() - stats.mtimeMs < LOCK_TTL_MS) {
        return false; // Lock is still valid
      }
      // Lock is stale, remove it
      fs.unlinkSync(lockFile);
    }
    // Create lock file
    fs.writeFileSync(lockFile, String(Date.now()));
    return true;
  } catch (e) {
    return true; // If error, just process
  }
}

/**
 * Release lock for a message ID
 */
function releaseLock(messageId) {
  const lockFile = path.join(LOCK_DIR, `${messageId}.lock`);
  try {
    fs.unlinkSync(lockFile);
  } catch (e) {}
}

/**
 * Cleanup stale locks periodically
 */
setInterval(() => {
  try {
    const files = fs.readdirSync(LOCK_DIR);
    const now = Date.now();
    for (const file of files) {
      if (!file.endsWith('.lock')) continue;
      const filePath = path.join(LOCK_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > LOCK_TTL_MS * 2) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (e) {}
}, 30000);

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
      // Replace @_user_1 with @Vincent Cheng
      result = result.replace(new RegExp(mention.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `@${mention.name}`);
    }
  }
  
  return result;
}

/**
 * Main webhook handler function
 * This is the entry point for all Lark webhook events
 */
async function handleWebhook(event) {
  try {
    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      return {
        challenge: event.challenge,
      };
    }

    // Handle message events
    if (event.header?.event_type === 'im.message.receive_v1') {
      await handleMessageEvent(event);
      return { success: true };
    }

    // Handle other event types as needed
    console.log('Unhandled event type:', event.header?.event_type || event.type);
    return { success: true };
  } catch (error) {
    console.error('Webhook handler error:', error);
    return {
      error: error.message,
    };
  }
}

/**
 * Handle incoming message events
 */
async function handleMessageEvent(event) {
  const message = event.event.message;
  const messageId = message?.message_id;
  const chatId = message?.chat_id;
  const eventId = event.header?.event_id;

  // Deduplication: Use event_id first (more reliable), fallback to messageId
  const lockKey = eventId || messageId;
  if (!tryAcquireLock(lockKey)) {
    console.log(`⏭️  Skipping duplicate webhook: eventId=${eventId}, messageId=${messageId}`);
    return;
  }

  try {
    // Parse content for command detection
    let text = '';
    try {
      text = JSON.parse(message?.content || '{}').text || '';
    } catch (e) {}

    const { command } = utils.parseCommand(text);
    console.log(`📥 Processing: messageId=${messageId}, chatId=${chatId}, command=${command}`);

    // Store event globally for access in other handlers
    currentEvent = event;
    
    const sender = event.event.sender;
    
    // Ignore bot's own messages
    if (sender.sender_type === 'app') {
      return;
    }

    // Handle commands
    const { command: cmd, args } = utils.parseCommand(text);
    
    if (cmd) {
      await handleCommand(cmd, args, chatId, messageId);
    } else if (message.parent_id) {
    // Handle replies to bot messages (for adding thoughts)
    // Replace @mention placeholders with actual names
    const mentions = message.mentions || [];
    const textWithNames = replaceMentionPlaceholders(text, mentions);
    await handleReply(message.parent_id, textWithNames, chatId, messageId, event);
  } else if (message.mentions && message.mentions.length > 0) {
    // Check if bot is mentioned - store as thought
    const content = JSON.parse(message.content);
    const mentions = message.mentions || [];
    let isBotMentioned = false;
    
    console.log('📝 Message with mentions detected:', {
      hasContentText: !!content.text,
      textLength: (content.text || text).length,
      mentionsCount: mentions.length,
      mentionKeys: mentions.map(m => m.key),
      mentions: JSON.stringify(mentions, null, 2), // Full mention objects for debugging
    });
    
    // Check if any mention is the bot
    // Try multiple detection methods since Lark message formats vary
    for (const mention of mentions) {
      // Method 1: Check mention.id structure for bot mentions (most reliable)
      // Bot mentions have id.app_id, user mentions have id.user_id
      if (mention.id && mention.id.app_id) {
        isBotMentioned = true;
        console.log('✅ Bot detected via mention.id.app_id:', mention.id.app_id);
        break;
      }
      // Method 2: Check if user_id is empty (bots often have empty user_id)
      if (mention.id && mention.id.user_id === '') {
        isBotMentioned = true;
        console.log('✅ Bot detected via empty user_id (bot indicator)');
        break;
      }
      // Method 3: Check mention name matches bot name pattern
      if (mention.name && (mention.name.toLowerCase().includes('bot') || 
                           mention.name.toLowerCase().includes('meeting') ||
                           mention.name === 'Meeting Group')) {
        isBotMentioned = true;
        console.log('✅ Bot detected via name pattern:', mention.name);
        break;
      }
      // Method 4: Check if mention key appears in text (fallback)
      if (mention.key && content.text?.includes(mention.key)) {
        isBotMentioned = true;
        console.log('✅ Bot detected via mention key in content.text');
        break;
      }
      // Method 5: Check if text variable contains the mention key (fallback)
      if (mention.key && text?.includes(mention.key)) {
        isBotMentioned = true;
        console.log('✅ Bot detected via mention key in text variable');
        break;
      }
    }
    
    // Fallback: If we have mentions but couldn't detect via above methods,
    // and the message has no meaningful text, assume it's meant for the bot
    // (This handles cases where Lark doesn't provide text content)
    if (!isBotMentioned && mentions.length > 0 && (!text || text.trim().length === 0)) {
      console.log('⚠️  No text content but mentions exist - assuming bot mention');
      isBotMentioned = true;
    }
    
    if (isBotMentioned) {
      // Extract text - try multiple sources since Lark message formats vary
      let thoughtText = content.text || text || '';
      
      // If still no text, check if message.content has the raw text
      if (!thoughtText && message.content) {
        try {
          const rawContent = JSON.parse(message.content);
          // Try different possible text fields
          thoughtText = rawContent.text || rawContent.content || rawContent.post || '';
          console.log('📝 Extracted text from alternate fields:', { 
            type: typeof thoughtText,
            isArray: Array.isArray(thoughtText),
            length: thoughtText?.length,
            value: thoughtText 
          });
        } catch (e) {
          // Content already parsed, ignore
        }
      }
      
      // Handle rich text format (array of text elements)
      if (Array.isArray(thoughtText)) {
        console.log('📝 Converting rich text array to plain text');
        
        // Helper function to extract text recursively from nested arrays/objects
        const extractText = (element) => {
          if (typeof element === 'string') {
            return element;
          } else if (Array.isArray(element)) {
            // Nested array - recursively extract from each element
            return element.map(extractText).join('');
          } else if (element && typeof element === 'object') {
            // Rich text element: { text: "content", ... } or { tag: "text", text: "content" }
            return element.text || element.content || '';
          }
          return '';
        };
        
        // Extract text from all nested arrays and join with newlines
        thoughtText = thoughtText
          .map(extractText)
          .filter(line => line.trim().length > 0)
          .join('\n')
          .trim();
          
        console.log('📝 Converted rich text to plain text:', { 
          length: thoughtText.length,
          preview: thoughtText.substring(0, 100)
        });
      }
      
      // Ensure thoughtText is a string
      if (typeof thoughtText !== 'string') {
        console.log('⚠️  thoughtText is not a string, converting:', typeof thoughtText);
        thoughtText = String(thoughtText || '');
      }
      
      // Replace @mention placeholders with actual names
      thoughtText = replaceMentionPlaceholders(thoughtText, mentions);
      
      // Remove the bot's @mention from the text (keep other mentions)
      for (const mention of mentions) {
        // Only remove if it's the bot mention (has app_id or empty user_id)
        if (mention.id && (mention.id.app_id || mention.id.user_id === '')) {
          if (mention.key && thoughtText) {
            thoughtText = thoughtText.replace(new RegExp(`@${mention.name}`, 'g'), '').trim();
          }
        }
      }
      
      console.log('💭 Recording thought:', {
        originalLength: (content.text || text).length,
        afterCleanup: thoughtText.length,
        hasContent: !!thoughtText,
      });
      
      // Record thought regardless of length (even if 50+ characters)
      if (thoughtText && thoughtText.trim().length > 0) {
        await handleMention(thoughtText, chatId, messageId, event);
      } else {
        console.log('⚠️  Skipped: no text content after removing mentions');
        // Even if there's no text, acknowledge the mention
        await larkService.replyMessage(
          messageId,
          '💭 Got your mention! But there was no message content to record.\n\n💡 Tip: Add some text with your @mention to record a thought.'
        );
      }
    } else {
      console.log('ℹ️  Bot not mentioned, treating as potential transcript');
      // Handle regular messages (potential transcripts)
      await handleTranscript(text, chatId, messageId);
    }
  } else {
    // Handle regular messages (potential transcripts)
    await handleTranscript(text, chatId, messageId);
  }
  } finally {
    // Always release the lock using the same key
    releaseLock(lockKey);
  }
}

// Store event for access in other handlers
let currentEvent = null;

/**
 * Handle bot commands
 */
async function handleCommand(command, args, chatId, messageId) {
  try {
    switch (command) {
      case '/meetings':
        await handleListMeetings(chatId, messageId);
        break;

      case '/meeting':
        // Everything after /meeting is the transcript
        const transcript = args.join(' ');
        if (transcript.trim().length > 0) {
          await handleMeetingSummary(transcript, chatId, messageId);
        } else {
          await larkService.replyMessage(
            messageId,
            'Please provide a meeting transcript. Usage: /meeting <transcript>'
          );
        }
        break;

      case '/template':
        if (args.length > 0) {
          const showExample = args.length > 1 && args[1].toLowerCase() === 'example';
          await handleSetTemplate(args[0], chatId, messageId, showExample);
        } else {
          await handleListTemplates(chatId, messageId);
        }
        break;

      case '/thoughts':
        await handleGetThoughts(chatId, messageId);
        break;

      case '/summarize':
      case '/summary':
        await handleSummarizeThoughts(chatId, messageId);
        break;

      case '/help':
        await handleHelp(chatId, messageId);
        break;

      default:
        await larkService.replyMessage(
          messageId,
          `Unknown command: ${command}. Type /help for available commands.`
        );
    }
  } catch (error) {
    console.error('Command handler error:', error);
    await larkService.replyMessage(
      messageId,
      `Error processing command: ${error.message}`
    );
  }
}

/**
 * Handle /meetings command - List recent meetings
 */
async function handleListMeetings(chatId, messageId) {
  try {
    const meetings = await larkService.listMeetingDocuments(10);
    const cardMessage = larkService.createMeetingListCard(meetings);
    
    await larkService.sendMessage(chatId, cardMessage.card, 'interactive');
  } catch (error) {
    console.error('List meetings error:', error);
    await larkService.replyMessage(messageId, 'Failed to fetch meetings.');
  }
}

/**
 * Handle /meeting <id> command - Get specific meeting
 */
async function handleGetMeeting(documentId, chatId, messageId) {
  try {
    const doc = await larkService.getDocumentMetadata(documentId);
    
    const title = doc.title || 'Untitled Meeting';
    const url = `https://larksuite.com/docx/${documentId}`;
    
    let response = `${title}\n\n📄 View Document: ${url}`;
    
    await larkService.replyMessage(messageId, response);
  } catch (error) {
    console.error('Get meeting error:', error);
    await larkService.replyMessage(messageId, 'Meeting document not found.');
  }
}

/**
 * Handle /template command - Set or list templates
 */
async function handleSetTemplate(templateName, chatId, messageId, showExample = false) {
  const template = config.templates[templateName.toLowerCase()];
  
  if (template) {
    // Check if user wants to see example
    if (showExample && template.exampleTranscript) {
      const exampleMessage = `📋 ${template.name} - Example

📝 Example Input:
${utils.truncate(template.exampleTranscript, 500)}

✅ Example Output:
${utils.truncate(template.exampleOutput, 500)}

Usage: Send /template ${templateName} then send your transcript.`;
      
      await larkService.replyMessage(messageId, exampleMessage);
    } else {
      // Store template preference for this chat (in-memory for now)
      // In production, you'd store this in a database or cache
      await larkService.replyMessage(
        messageId,
        `✅ Template set to: ${template.name}

📝 Next transcript will use this template.

💡 Tip: Send /template ${templateName} example to see an example.`
      );
    }
  } else {
    await larkService.replyMessage(
      messageId,
      `❌ Template "${templateName}" not found.

Use /template to see available templates.`
    );
  }
}

/**
 * Handle /template command without args - List available templates
 */
async function handleListTemplates(chatId, messageId) {
  const templateList = Object.entries(config.templates)
    .map(([key, template]) => {
      let info = `📋 ${key} - ${template.name}`;
      if (template.exampleTranscript) {
        info += ` (has example)`;
      }
      return info;
    })
    .join('\n');
  
  const message = `📚 Available Templates:

${templateList}

Usage: /template <name>
Example: /template daily-standup

💡 Send /template <name> example to see an example`;
  await larkService.replyMessage(messageId, message);
}

/**
 * Handle /meeting command - Summarize transcript and send to group
 */
async function handleMeetingSummary(transcript, chatId, messageId) {
  try {
    // Generate AI summary
    const notes = await aiService.generateNotes(transcript, 'general');
    
    // Strip markdown and normalize whitespace
    const cleanNotes = notes
      .replace(/^###+\s+/gm, '')      // Remove headers
      .replace(/\*\*/g, '')           // Remove bold
      .replace(/\*/g, '')             // Remove italic
      .replace(/`/g, '')              // Remove code
      .replace(/---/g, '')            // Remove horizontal rules
      .replace(/\n{2,}/g, '\n\n');    // 2+ blank lines become 1 line
    
    await larkService.replyMessage(
      messageId,
      `📋 Meeting Summary:

${cleanNotes}`
    );
  } catch (error) {
    console.error('Meeting summary error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to generate summary: ${error.message}`
    );
  }
}

/**
 * Handle /thoughts command - View latest thoughts
 */
async function handleGetThoughts(chatId, messageId) {
  try {
    const thoughts = await larkService.getRecentThoughts(config.thoughts.displayLimit);
    
    if (thoughts.length === 0) {
      await larkService.replyMessage(
        messageId,
        `💭 No thoughts recorded yet.

💡 Reply to bot messages to add thoughts!`
      );
      return;
    }
    
    // Format thoughts as a list
    const thoughtsList = thoughts.map((record, index) => {
      const fields = record.fields;
      const thought = fields.Thought || '';
      
      // Author field is a Person field (array of user objects)
      let author = 'Unknown';
      if (fields['Author']) {
        if (Array.isArray(fields['Author']) && fields['Author'].length > 0) {
          // Person field - extract name from user object
          author = fields['Author'][0].name || fields['Author'][0].en_name || fields['Author'][0].id || 'Unknown';
        } else if (typeof fields['Author'] === 'string') {
          // Old records might still have text
          author = fields['Author'];
        }
      }
      
      const context = fields['Meeting Context'] || '';
      
      // Debug: log the record to see what fields are available
      console.log('Thought record:', JSON.stringify(record, null, 2));
      
      // Try multiple possible field names for created time (including "Date")
      const createdTime = fields['Created Time'] || fields['Date'] || fields['创建时间'] || fields.created_time || null;
      
      // Format timestamp if available
      let timeStr = '';
      if (createdTime && typeof createdTime === 'number') {
        const date = new Date(createdTime);
        timeStr = ` - ${date.toLocaleString()}`;
      } else if (createdTime && typeof createdTime === 'string') {
        // If it's a string, show it as is
        timeStr = ` - ${createdTime}`;
      } else {
        // No timestamp available
        timeStr = ' - {No timestamp}';
      }
      
      return `${index + 1}. ${author}${context ? ` (${context})` : ''}${timeStr}\n   ${thought}`;
    }).join('\n\n');
    
    await larkService.replyMessage(
      messageId,
      `💭 Latest ${config.thoughts.displayLimit} Thoughts:

${thoughtsList}

---

💡 Use /summarize to get AI summary of ALL thoughts`
    );
  } catch (error) {
    console.error('Get thoughts error:', error);
    await larkService.replyMessage(messageId, '❌ Failed to retrieve thoughts. Make sure Bitable is configured.');
  }
}

/**
 * Handle /summarize command - AI summarize all thoughts
 */
async function handleSummarizeThoughts(chatId, messageId) {
  try {
    await larkService.replyMessage(
      messageId,
      '🤔 Analyzing all thoughts and generating summary...'
    );

    const allThoughts = await larkService.getAllThoughts(100);
    
    if (allThoughts.length === 0) {
      await larkService.replyMessage(
        messageId,
        `💭 No thoughts recorded yet.

💡 Reply to bot messages to add thoughts!`
      );
      return;
    }
    
    // Extract thought texts for AI summarization
    const thoughtTexts = allThoughts.map(record => {
      const fields = record.fields;
      
      // Author field is a Person field (array of user objects)
      let author = 'Unknown';
      if (fields['Author']) {
        if (Array.isArray(fields['Author']) && fields['Author'].length > 0) {
          // Person field - extract name from user object
          author = fields['Author'][0].name || fields['Author'][0].en_name || fields['Author'][0].id || 'Unknown';
        } else if (typeof fields['Author'] === 'string') {
          // Old records might still have text
          author = fields['Author'];
        }
      }
      
      const thought = fields.Thought || '';
      const context = fields['Meeting Context'] || '';
      
      return `${author}${context ? ` (${context})` : ''}: ${thought}`;
    });
    
    // Use AI to summarize all thoughts (strip markdown for Lark compatibility)
    const rawSummary = await aiService.summarizeThoughts(thoughtTexts);
    const summary = rawSummary
      .replace(/^###+\s+/gm, '')  // Remove headers
      .replace(/\*\*/g, '')       // Remove bold
      .replace(/\*/g, '')         // Remove italic
      .replace(/`/g, '')          // Remove code
      .replace(/---/g, '');       // Remove horizontal rules
    
    await larkService.replyMessage(
      messageId,
      `🧠 AI Summary of All Thoughts (${allThoughts.length} total):

${summary}

---

💡 Use /thoughts to see latest ${config.thoughts.displayLimit} thoughts`
    );
  } catch (error) {
    console.error('Summarize thoughts error:', error);
    await larkService.replyMessage(
      messageId,
      '❌ Failed to generate summary. Make sure Bitable is configured.'
    );
  }
}

/**
 * Handle /help command
 */
async function handleHelp(chatId, messageId) {
  const helpText = `🤖 Lark Meeting Bot - Commands

📝 Meeting Notes:
• Send a meeting transcript (50+ characters) to generate AI notes
• Reply to bot messages OR @mention the bot to add your thoughts

📋 Commands:
• /meeting <transcript> - Summarize meeting and send to group (no doc created)
• /template - List available templates
• /template <name> - Set note template
• /template <name> example - See template example
• /thoughts - View latest ${config.thoughts.displayLimit} thoughts
• /summarize - AI summary of ALL thoughts
• /help - Show this help message

🎯 Available Templates:
• daily-standup - Team standup format
• brainstorming - Ideation & features
• kickoff - Project kickoff format
• retrospective - Sprint retro format
• general - Standard meeting notes

📖 Example Usage:
1. Send just the transcript → Creates meeting doc in Lark wiki
2. Use /meeting <transcript> → Sends summary directly to chat
3. Reply to bot message OR @mention the bot to add thoughts
4. Use /thoughts to see latest ${config.thoughts.displayLimit} with timestamps

💡 Tips:
• /meeting - Quick summary in chat, no document created
• Just send transcript → Creates full document in Lark
• All meeting docs are editable by you`;

  await larkService.replyMessage(messageId, helpText);
}

/**
 * Unified handler for recording thoughts (used by both replies and @mentions)
 */
async function handleThoughtRecording(text, chatId, messageId, event) {
  try {
    // Get sender info from event
    const sender = event?.event?.sender;
    const senderId = sender?.sender_id;
    
    // Extract user ID for Created By field
    const userId = senderId?.open_id || senderId?.user_id;
    const userIdType = senderId?.open_id ? 'open_id' : 'user_id';
    
    console.log('📝 Recording thought with user ID:', userId);

    // Use generic context for thoughts
    const meetingContext = 'General Discussion';

    // Store thought in Bitable - pass userId for "Created By" field
    await larkService.addThought(text, null, meetingContext, userId, userIdType);

    // Acknowledge the thought with consistent messaging
    await larkService.replyMessage(
      messageId,
      `💭 Thought recorded!

📋 Use /thoughts to see latest ${config.thoughts.displayLimit}
🧠 Use /summarize for AI summary of all thoughts`
    );
  } catch (error) {
    console.error('Handle thought recording error:', error);
    await larkService.replyMessage(
      messageId,
      '💭 Thought noted! (Bitable storage may not be configured properly)'
    );
  }
}

/**
 * Handle replies to bot messages (for adding thoughts)
 */
async function handleReply(parentMessageId, text, chatId, messageId, event) {
  await handleThoughtRecording(text, chatId, messageId, event);
}

/**
 * Handle @mention of bot (store as thought)
 */
async function handleMention(text, chatId, messageId, event) {
  await handleThoughtRecording(text, chatId, messageId, event);
}

/**
 * Handle potential meeting transcript
 */
/*
async function handleTranscript(text, chatId, messageId) {
  // Validate if this looks like a transcript
  if (!utils.isValidTranscript(text)) {
    // Too short, probably not a transcript - ignore silently
    return;
  }

  // Document creation temporarily disabled
  // Only /meeting command sends summaries to chat
  await larkService.replyMessage(
    messageId,
    `📝 Transcript received (${text.length} characters).

Use /meeting <transcript> to get a summary in chat.`
  );
}
*/

module.exports = {
  handleWebhook,
};

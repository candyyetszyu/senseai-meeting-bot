/**
 * Main webhook handler for Lark Meeting Bot
 * Handles incoming events and coordinates between services
 */

const larkService = require('./lark_service');
const aiService = require('./ai_service');
const utils = require('./utils');
const config = require('./config');

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
  // Store event globally for access in other handlers
  currentEvent = event;
  
  const message = event.event.message;
  const sender = event.event.sender;
  
  // Ignore bot's own messages
  if (sender.sender_type === 'app') {
    return;
  }

  const messageId = message.message_id;
  const chatId = message.chat_id;
  
  // Parse message content
  let text = '';
  try {
    const content = JSON.parse(message.content);
    text = content.text || '';
  } catch (error) {
    console.error('Failed to parse message content:', error);
    return;
  }

  // Handle commands
  const { command, args } = utils.parseCommand(text);
  
  if (command) {
    await handleCommand(command, args, chatId, messageId);
  } else if (message.parent_id) {
    // Handle replies to bot messages (for adding thoughts)
    await handleReply(message.parent_id, text, chatId, messageId, event);
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
      
      // Remove @mention keys from the text
      for (const mention of mentions) {
        if (mention.key && thoughtText) {
          thoughtText = thoughtText.replace(mention.key, '').trim();
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
    
    // Strip markdown
    const cleanNotes = notes
      .replace(/^###+\s+/gm, '')      // Remove headers
      .replace(/\*\*/g, '')           // Remove bold
      .replace(/\*/g, '')             // Remove italic
      .replace(/`/g, '')              // Remove code
      .replace(/---/g, '');           // Remove horizontal rules
    
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
 * Handle /thoughts command - View latest 5 thoughts
 */
async function handleGetThoughts(chatId, messageId) {
  try {
    const thoughts = await larkService.getRecentThoughts(15);
    
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
      const author = fields.Author || 'Unknown';
      const context = fields['Meeting Context'] || '';
      
      // Debug: log the record to see what fields are available
      console.log('Thought record:', JSON.stringify(record, null, 2));
      
      // Try multiple possible field names for created time
      const createdTime = fields['Created Time'] || fields['创建时间'] || fields.created_time || record.record_id;
      
      // Format timestamp if available
      let timeStr = '';
      if (createdTime && typeof createdTime === 'number') {
        const date = new Date(createdTime);
        timeStr = ` - ${date.toLocaleString()}`;
      } else if (createdTime) {
        // If it's not a number, just show it as is
        timeStr = ` - ${createdTime}`;
      }
      
      return `${index + 1}. ${author}${context ? ` (${context})` : ''}${timeStr}\n   ${thought}`;
    }).join('\n\n');
    
    await larkService.replyMessage(
      messageId,
      `💭 Latest 15 Thoughts:

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
      const author = fields.Author || 'Unknown';
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

💡 Use /thoughts to see latest 15 thoughts`
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
• /thoughts - View latest 5 thoughts
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
4. Use /thoughts to see latest 5 with timestamps

💡 Tips:
• /meeting - Quick summary in chat, no document created
• Just send transcript → Creates full document in Lark
• All meeting docs are editable by you`;

  await larkService.replyMessage(messageId, helpText);
}

/**
 * Handle replies to bot messages (for adding thoughts)
 */
async function handleReply(parentMessageId, text, chatId, messageId, event) {
  try {
    // Get sender info from event
    const sender = event?.event?.sender;
    const userId = sender?.sender_id?.user_id;
    
    // Get actual user name from Lark API
    let authorName = 'Anonymous';
    if (userId) {
      const userInfo = await larkService.getUserInfo(userId);
      authorName = userInfo?.name || userId;
    }
    
    // Try to get meeting context from parent message
    // For now, we'll use a generic context
    const meetingContext = 'General Discussion';
    
    // Store thought in Bitable (Created Time is auto-filled by Bitable)
    await larkService.addThought(text, authorName, meetingContext);
    
    // Acknowledge the thought
    await larkService.replyMessage(
      messageId,
      `💭 Thought recorded!

📋 Use /thoughts to see latest 5
🧠 Use /summarize for AI summary of all thoughts`
    );
  } catch (error) {
    console.error('Handle reply error:', error);
    await larkService.replyMessage(
      messageId,
      '💭 Thought noted! (Bitable storage may not be configured)'
    );
  }
}

/**
 * Handle @mention of bot (store as thought)
 */
async function handleMention(text, chatId, messageId, event) {
  try {
    // Get sender info from event
    const sender = event?.event?.sender;
    const userId = sender?.sender_id?.user_id;
    
    // Get actual user name from Lark API
    let authorName = 'Anonymous';
    if (userId) {
      const userInfo = await larkService.getUserInfo(userId);
      authorName = userInfo?.name || userId;
    }
    
    // Use generic context for @mentions
    const meetingContext = 'General Discussion';
    
    // Store thought in Bitable (Created Time is auto-filled by Bitable)
    await larkService.addThought(text, authorName, meetingContext);
    
    // Acknowledge the thought
    await larkService.replyMessage(
      messageId,
      `💭 Thought recorded!

📋 Use /thoughts to see latest 15
🧠 Use /summarize for AI summary of all thoughts`
    );
  } catch (error) {
    console.error('Handle mention error:', error);
    await larkService.replyMessage(
      messageId,
      '💭 Thought noted! (Bitable storage may not be configured)'
    );
  }
}

/**
 * Handle potential meeting transcript
 */
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

module.exports = {
  handleWebhook,
};

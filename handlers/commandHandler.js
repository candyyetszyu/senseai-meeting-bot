/**
 * Command Handler - Handles all /command processing
 */

const larkService = require('../lark_service');
const aiService = require('../ai_service');
const config = require('../config');
const { stripMarkdown, extractAuthor } = require('../utils/markdownStripper');
const utils = require('../utils');
const scheduler = require('../services/scheduler');

/**
 * Handle /meetings command
 */
async function handleListMeetings(chatId, messageId) {
  try {
    const meetings = await larkService.getRecentMeetings(10);

    if (meetings.length === 0) {
      await larkService.replyMessage(
        messageId,
        `📋 No meetings recorded yet.

💡 Use /record <transcript> to record and summarize meetings.`
      );
      return;
    }

    const meetingsList = meetings.map((record, index) => {
      const fields = record.fields;
      const title = fields['Meeting Title'] || 'Untitled Meeting';
      const notes = fields['Meeting Notes'] || '';
      const transcript = fields['Transcript'] || '';
      const attendees = fields['Attendees'] || '';
      
      // Get creation time
      const createdTime = fields['Created Time'] || fields['Date'] || fields['创建时间'] || record.created_time || null;
      let timeStr = '';
      
      if (createdTime && typeof createdTime === 'number') {
        const date = new Date(createdTime);
        timeStr = ` - ${date.toLocaleDateString()}`;
      } else if (createdTime && typeof createdTime === 'string') {
        timeStr = ` - ${createdTime}`;
      }

      // Preview of notes (first 120 chars to leave room for attendees)
      const notesPreview = utils.truncate(notes, 120);
      const attendeesInfo = attendees ? `\n👥 ${attendees}` : '';
      
      return `${index + 1}. 📋 ${title}${timeStr}${attendeesInfo}
📝 ${notesPreview}
📊 Transcript: ${transcript.length} chars`;
    }).join('\n\n');

    await larkService.replyMessage(
      messageId,
      `📋 Recent Meetings (${meetings.length}):

${meetingsList}

---

💡 Use /record <transcript> to add new meetings`
    );
  } catch (error) {
    console.error('List meetings error:', error);
    await larkService.replyMessage(
      messageId, 
      '❌ Failed to retrieve meetings. Make sure meeting storage is configured.'
    );
  }
}

/**
 * Handle /template command
 */
async function handleSetTemplate(templateName, chatId, messageId, showExample = false) {
  const template = config.templates[templateName.toLowerCase()];

  if (template) {
    if (showExample && template.exampleTranscript) {
      const exampleMessage = `📋 ${template.name} - Example

📝 Example Input:
${utils.truncate(template.exampleTranscript, 500)}

✅ Example Output:
${utils.truncate(template.exampleOutput, 500)}

Usage: Send /template ${templateName} then send your transcript.`;

      await larkService.replyMessage(messageId, exampleMessage);
    } else {
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
 * Handle /template without args - List templates
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
 * Extract attendees from transcript
 * @param {string} transcript - Meeting transcript
 * @param {string} notes - Generated meeting notes
 * @returns {string} - Comma-separated list of attendees
 */
function extractAttendees(transcript, notes) {
  const attendeeSet = new Set();
  
  // Method 1: Look for "Name:" patterns in transcript
  const speakerMatches = transcript.match(/^([A-Z][a-zA-Z\s]+):/gm);
  if (speakerMatches) {
    speakerMatches.forEach(match => {
      const name = match.replace(':', '').trim();
      if (name.length > 1 && name.length < 30) {
        attendeeSet.add(name);
      }
    });
  }
  
  // Method 2: Look for "Attendees:" section in notes
  const attendeesMatch = notes.match(/Attendees?[:\s]+([^\n\r]+)/i);
  if (attendeesMatch) {
    const attendeesList = attendeesMatch[1];
    // Split by common delimiters and clean up
    const names = attendeesList.split(/[,;]|\sand\s/).map(name => 
      name.trim().replace(/^[-•]\s*/, '')
    );
    names.forEach(name => {
      if (name.length > 1 && name.length < 30) {
        attendeeSet.add(name);
      }
    });
  }
  
  // Method 3: Look for common patterns like "Alice, Bob, Charlie"
  const namePatterns = [
    /(?:with|including|participants?[:\s]+)([A-Z][a-zA-Z]+(?:,\s*[A-Z][a-zA-Z]+)*)/gi,
    /([A-Z][a-zA-Z]+)(?:,\s*([A-Z][a-zA-Z]+))*(?:\s+(?:and|&)\s+([A-Z][a-zA-Z]+))?/g
  ];
  
  namePatterns.forEach(pattern => {
    const matches = transcript.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const names = match.split(/[,&]|\sand\s/).map(n => n.trim());
        names.forEach(name => {
          // Clean up common prefixes
          name = name.replace(/^(?:with|including|participants?)[:\s]*/i, '').trim();
          if (name.length > 1 && name.length < 30 && /^[A-Z][a-zA-Z\s]*$/.test(name)) {
            attendeeSet.add(name);
          }
        });
      });
    }
  });
  
  return Array.from(attendeeSet).join(', ');
}

/**
 * Extract meeting title from transcript
 * @param {string} transcript - Meeting transcript
 * @returns {string} - Meeting title
 */
function extractMeetingTitle(transcript) {
  // Look for common meeting title patterns
  const titlePatterns = [
    /^(.+?)\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/m, // "Title - Date" format
    /^(?:meeting|call|session)[:\s]+(.+)/im,   // "Meeting: Title" format
    /^(.+?)\s+meeting/im,                      // "Title Meeting" format
    /^([^\n\r:]{10,60})/m                      // First line if reasonable length
  ];
  
  for (const pattern of titlePatterns) {
    const match = transcript.match(pattern);
    if (match && match[1]) {
      const title = match[1].trim();
      if (title.length > 5 && title.length < 100) {
        return title;
      }
    }
  }
  
  // Fallback to date-based title
  return `Meeting - ${new Date().toLocaleDateString()}`;
}

/**
 * Handle /record command - Summarize transcript and save to storage
 */
async function handleMeetingSummary(transcript, chatId, messageId) {
  try {
    const notes = await aiService.generateNotes(transcript, 'general');
    const cleanNotes = stripMarkdown(notes);

    // Extract attendees and meeting title
    const attendees = extractAttendees(transcript, cleanNotes);
    const meetingTitle = extractMeetingTitle(transcript);

    // Try to save to meeting storage table
    try {
      await larkService.addMeetingRecord(
        transcript,
        cleanNotes,
        meetingTitle,
        attendees
      );
      console.log('✅ Meeting record saved to storage');
      console.log('📋 Extracted attendees:', attendees);
      console.log('📋 Meeting title:', meetingTitle);
    } catch (storageError) {
      console.warn('⚠️ Failed to save meeting to storage:', storageError.message);
      // Continue even if storage fails
    }

    const attendeesInfo = attendees ? `\n👥 Attendees: ${attendees}` : '';

    await larkService.replyMessage(
      messageId,
      `📋 Meeting Summary:

${cleanNotes}

---

✅ Meeting saved to storage${attendeesInfo}`
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
 * Handle /thoughts command
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

    const thoughtsList = thoughts.map((record, index) => {
      const fields = record.fields;
      const thought = fields.Thought || '';
      const author = extractAuthor(fields['Author']);
      const context = fields['Meeting Context'] || '';

      const createdTime = fields['Created Time'] || fields['Date'] || fields['创建时间'] || fields.created_time || null;
      let timeStr = '';

      if (createdTime && typeof createdTime === 'number') {
        const date = new Date(createdTime);
        timeStr = ` - ${date.toLocaleString()}`;
      } else if (createdTime && typeof createdTime === 'string') {
        timeStr = ` - ${createdTime}`;
      } else {
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
 * Handle /summarize command
 * Summarizes thoughts from previous day to current date
 */
async function handleSummarizeThoughts(chatId, messageId) {
  try {
    await larkService.replyMessage(
      messageId,
      '🤔 Analyzing thoughts from yesterday to today...'
    );

    // Get thoughts since yesterday (same logic as auto-summary)
    const thoughts = await scheduler.getThoughtsSinceYesterday();

    if (thoughts.length === 0) {
      await larkService.replyMessage(
        messageId,
        `💭 No thoughts recorded since yesterday.

💡 Reply to bot messages to add thoughts!`
      );
      return;
    }

    const thoughtTexts = thoughts.map(record => {
      const fields = record.fields;
      const author = extractAuthor(fields['Author']);
      const thought = fields.Thought || '';
      const context = fields['Meeting Context'] || '';

      return `${author}${context ? ` (${context})` : ''}: ${thought}`;
    });

    const rawSummary = await aiService.summarizeThoughts(thoughtTexts);
    const summary = stripMarkdown(rawSummary);

    await larkService.replyMessage(
      messageId,
      `🧠 AI Summary (Yesterday to Today):

📊 Analyzed ${thoughts.length} thought(s)

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
 * Handle /general command
 */
async function handleGeneral(question, chatId, messageId) {
  try {
    await larkService.replyMessage(messageId, '🤔 Thinking...');

    const response = await aiService.generate(
      'You are SenseAI Assistant, a helpful AI assistant. Provide clear, concise answers.',
      question
    );

    const cleanResponse = stripMarkdown(response);

    await larkService.replyMessage(
      messageId,
      `💡 Answer:

${cleanResponse}`
    );
  } catch (error) {
    console.error('General AI error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to get answer: ${error.message}`
    );
  }
}

/**
 * Handle /autosummary command
 */
async function handleAutoSummary(args, chatId, messageId) {
  try {
    if (args.length === 0) {
      const status = scheduler.getStatus();
      const statusText = status.enabled 
        ? `✅ Auto-summary is ENABLED\n📍 Target chat: ${status.chatId}\n⏰ Runs daily at 8:00 AM HKT (Hong Kong Time)`
        : `❌ Auto-summary is DISABLED`;

      await larkService.replyMessage(
        messageId,
        `🤖 Auto-Summary Status:

${statusText}

💡 Usage:
• /autosummary on - Enable auto-summary in this chat
• /autosummary off - Disable auto-summary
• /autosummary status - Check current status`
      );
      return;
    }

    const subcommand = args[0].toLowerCase();

    switch (subcommand) {
      case 'on':
      case 'enable':
        scheduler.enableAutoSummary(chatId);
        await larkService.replyMessage(
          messageId,
          `✅ Auto-summary ENABLED

📍 This chat will receive daily summaries at 8:00 AM HKT
📊 Summarizes thoughts from previous day to current date
🔧 Use /autosummary off to disable`
        );
        break;

      case 'off':
      case 'disable':
        scheduler.disableAutoSummary();
        await larkService.replyMessage(
          messageId,
          `❌ Auto-summary DISABLED

💡 Use /autosummary on to re-enable`
        );
        break;

      case 'status':
        const status = scheduler.getStatus();
        const statusText = status.enabled 
          ? `✅ ENABLED\n📍 Chat: ${status.chatId}\n⏰ Daily at 8:00 AM HKT (Hong Kong Time)`
          : `❌ DISABLED`;

        await larkService.replyMessage(
          messageId,
          `🤖 Auto-Summary Status:

${statusText}`
        );
        break;

      default:
        await larkService.replyMessage(
          messageId,
          `❌ Unknown subcommand: ${subcommand}

💡 Usage:
• /autosummary on - Enable
• /autosummary off - Disable  
• /autosummary status - Check status`
        );
    }
  } catch (error) {
    console.error('Auto-summary command error:', error);
    await larkService.replyMessage(
      messageId,
      `❌ Failed to update auto-summary: ${error.message}`
    );
  }
}

/**
 * Handle /help command
 */
async function handleHelp(chatId, messageId) {
  const helpText = `🤖 SenseAI Assistant - Commands

📝 Thoughts:
• Reply to bot messages OR @mention the bot to add your thoughts
• Mention "daily report" in your thought → auto-tagged as (Daily Report)

📋 Commands:
• /general <question> - Ask AI any question
• /record <transcript> - Summarize meeting and save to storage
• /meetings - List recent meetings
• /template - List available templates
• /template <name> - Set note template
• /template <name> example - See template example
• /thoughts - View latest ${config.thoughts.displayLimit} thoughts
• /summarize - AI summary from yesterday to today
• /autosummary on - Enable daily 8AM (HKT) auto-summary
• /autosummary off - Disable auto-summary
• /autosummary status - Check auto-summary status
• /help - Show this help message

🎯 Available Templates:
• daily-standup - Team standup format
• brainstorming - Ideation & features
• kickoff - Project kickoff format
• retrospective - Sprint retro format
• general - Standard meeting notes

💡 Tips:
• /autosummary on - Get daily summaries at 8AM Hong Kong Time
• Thoughts with "daily report" → auto-tagged as (Daily Report)
• /record saves both transcript and notes to Bitable`;

  await larkService.replyMessage(messageId, helpText);
}

/**
 * Main command dispatcher
 */
async function handleCommand(command, args, chatId, messageId) {
  try {
    switch (command) {
      case '/meetings':
        await handleListMeetings(chatId, messageId);
        break;

      case '/record':
        const transcript = args.join(' ');
        if (transcript.trim().length > 0) {
          await handleMeetingSummary(transcript, chatId, messageId);
        } else {
          await larkService.replyMessage(
            messageId,
            'Please provide a meeting transcript. Usage: /record <transcript>'
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

      case '/autosummary':
        await handleAutoSummary(args, chatId, messageId);
        break;

      case '/help':
        await handleHelp(chatId, messageId);
        break;

      case '/general':
        const question = args.join(' ');
        if (question.trim().length > 0) {
          await handleGeneral(question, chatId, messageId);
        } else {
          await larkService.replyMessage(
            messageId,
            'Please provide a question. Usage: /general <question>'
          );
        }
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

module.exports = {
  handleCommand,
  handleListMeetings,
  handleSetTemplate,
  handleListTemplates,
  handleMeetingSummary,
  handleGetThoughts,
  handleSummarizeThoughts,
  handleAutoSummary,
  handleGeneral,
  handleHelp,
};

# 🤖 Lark Meeting Bot

A serverless Lark bot that automatically converts meeting transcripts into structured, AI-generated notes. Features team thoughts tracking, intelligent summarization, and scheduled meeting management.

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- Lark (Feishu) account with admin access
- OpenAI API key OR HuggingFace token

### 2. Create Lark App

1. Go to [Lark Developer Console](https://open.larksuite.com/app)
2. Create a new app
3. Enable the following permissions:
   - `im:message` - Send and receive messages
   - `im:message.group_at_msg` - Receive group @ messages
   - `docx:document` - Create and edit documents
   - `wiki:wiki` - (Optional) Access wiki spaces
4. Enable event subscriptions:
   - `im.message.receive_v1` - Receive messages
5. Copy your `App ID` and `App Secret`

### 3. Set Up Bitable for Thoughts (Required for /thoughts feature)

Create a Bitable to store team thoughts:

1. **Create Bitable:**
   - In Lark, click "+" → "Bitable"
   - Name: "Meeting Bot Data"

2. **Create "Thoughts" table with columns:**
   - `Thought` (Multi-line Text)
   - `Author` (Text)
   - `Meeting Context` (Text)
   - `Created Time` (Created Time - auto)

3. **Get credentials:**
   - Bitable App Token from URL: `https://xxx.larksuite.com/base/{APP_TOKEN}`
   - Table ID from table settings

4. **Grant bot access:**
   - Share Bitable with bot ("Can Edit" permission)

**See [documentation/BITABLE_SETUP.md](documentation/BITABLE_SETUP.md) for detailed instructions!**

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment

Create a `.env` file:

```env
# Lark App Credentials
LARK_APP_ID=your_app_id_here
LARK_APP_SECRET=your_app_secret_here

# Lark Bitable for Thoughts (REQUIRED for /thoughts feature)
LARK_BITABLE_APP_TOKEN=your_bitable_app_token_here
LARK_THOUGHTS_TABLE_ID=your_thoughts_table_id_here

# Lark Templates Document (OPTIONAL)
LARK_TEMPLATES_DOC_TOKEN=your_templates_doc_token_here

# AI Service Configuration
OPENAI_API_KEY=your_openai_api_key_here
# OR
HUGGINGFACE_API_TOKEN=your_huggingface_token_here

# AI Provider (openai or huggingface)
AI_PROVIDER=openai

# Server Configuration (for local development)
PORT=3000
```

### 6. Local Development

```bash
npm run dev
```

The server will start at `http://localhost:3000`

For local testing with Lark webhooks, use [ngrok](https://ngrok.com/):

```bash
ngrok http 3000
```

Copy the ngrok URL and set it as your webhook URL in Lark Developer Console:
`https://your-ngrok-url.ngrok.io/webhook`

### 7. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Then deploy to production
vercel --prod
```

Update webhook URL in Lark Console to: `https://your-app.vercel.app/webhook`

## 🛠️ Project Structure

```
lark-meeting-bot/
├── handler.js              # Webhook handler + main logic
├── lark_service.js         # Lark API (messaging, documents)
├── ai_service.js           # OpenAI + HuggingFace integration
├── utils.js                # Helper functions
├── config.js               # Environment configuration
├── dev-server.js           # Local development server
├── api/
│   └── webhook.js          # Vercel serverless function
├── handlers/               # Message and command handlers
│   ├── index.js
│   ├── commandHandler.js
│   ├── mentionHandler.js
│   ├── messageRouter.js
│   └── webhook.js
├── services/               # Business logic services
│   ├── larkBitable.js      # Bitable operations for thoughts
│   ├── larkMessaging.js    # Lark message sending
│   ├── lockManager.js      # Distributed locking for concurrency
│   ├── meetingStorage.js   # Meeting data persistence
│   ├── scheduler.js        # Cron-based meeting scheduler
│   └── thoughtRecorder.js  # Thoughts recording logic
├── config/                 # Configuration files
│   ├── index.js
│   ├── ai.js               # AI configuration
│   ├── app.js              # App configuration
│   ├── lark.js             # Lark API configuration
│   └── templates.js        # Meeting note templates
├── utils/                  # Utility modules
│   ├── index.js
│   ├── helpers.js
│   ├── markdownStripper.js
│   └── textProcessor.js
├── documentation/          # Setup and feature guides
│   ├── BITABLE_SETUP.md
│   ├── SETUP_GUIDE.md
│   └── THOUGHTS_FEATURE.md
├── package.json
├── vercel.json             # Vercel deployment config
├── .env.example
└── README.md
```

## 🔧 Configuration

### AI Providers

**OpenAI (Recommended)**:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

**HuggingFace**:
```env
AI_PROVIDER=huggingface
HUGGINGFACE_API_TOKEN=hf_...
```

### Custom Templates

Edit `config/templates.js` to add or modify templates:

```javascript
templates: {
  'custom-template': {
    name: 'Custom Template',
    prompt: 'Your custom prompt here...',
    exampleTranscript: '...',
    exampleOutput: '...',
  },
}
```

## 📚 API Reference

### Lark APIs Used

- [Bot Development Guide](https://open.larksuite.com/document/client-docs/bot-v3/bot-overview)
- [Event Subscription](https://open.larksuite.com/document/ukTMukTMukTM/uUTNz4SN1MjL1UzM)
- [Message API](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/im-v1/message/create)
- [Docx API](https://open.larksuite.com/document/ukTMukTMukTM/uUDN04SN0QjL1QDN)
- [Bitable API](https://open.larksuite.com/document/server-docs/docs/bitable-v1/bitable-overview)

### AI APIs

- [OpenAI API](https://platform.openai.com/docs)
- [HuggingFace Inference API](https://huggingface.co/inference)

## 🐛 Troubleshooting

### Bot doesn't respond to messages

1. Check webhook URL is correct in Lark Console
2. Verify event subscriptions are enabled
3. Check bot has required permissions
4. Review logs for errors

### AI generation fails

1. Verify API key is correct
2. Check API quota/limits
3. Try different AI provider
4. Check transcript length (some models have limits)

### Bitable errors

1. Verify Bitable App Token and Table ID
2. Check bot has bitable permissions
3. Ensure table field names match configuration

### Scheduled meetings not triggering

1. Ensure the server is running (not serverless)
2. Check cron scheduler is active
3. Verify meeting time configuration

## 🚢 Deployment Options

### Vercel (Recommended)

```bash
vercel --prod
```

Set environment variables in Vercel dashboard.

**Note:** Scheduled meetings require a persistent server. For serverless deployment, use an external scheduler (e.g., GitHub Actions, cron-job.org) to trigger meeting reminders.

### Traditional Server

Run with PM2:

```bash
npm install -g pm2
pm2 start dev-server.js --name lark-meeting-bot
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🤝 Contributing

Contributions welcome! Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT License - feel free to use this project however you'd like!

## 🙏 Acknowledgments

- Built with [Lark Open Platform](https://open.larksuite.com/)
- AI powered by [OpenAI](https://openai.com/) and [HuggingFace](https://huggingface.co/)
- Deployed on [Vercel](https://vercel.com/)

## 💡 Tips

- Keep transcripts clear and structured for best AI results
- Use templates appropriate to your meeting type
- Encourage team to reply with thoughts for collaborative notes
- Review and edit generated documents as needed
- Set up proper error monitoring in production
- Use `/summarize` weekly to track team sentiment and priorities
# 📋 Step-by-Step Setup Guide

This guide will walk you through setting up the Lark Meeting Bot from scratch.

## Step 1: Create Lark Application (15 minutes)

### 1.1 Create the App

1. Go to https://open.larksuite.com/app
2. Click "Create Application"
3. Choose "Custom App"
4. Fill in:
   - App Name: "Meeting Bot"
   - Description: "AI-powered meeting notes generator"
   - Icon: Upload an icon (optional)
5. Click "Create"

### 1.2 Configure Permissions

1. Go to "Permissions & Scopes" in your app settings
2. Add the following scopes:
   - **Messages**:
     - `im:message` - Send messages
     - `im:message:send_as_bot` - Send as bot
   - **Group Chat**:
     - `im:message.group_at_msg` - Receive @ mentions
     - `im:message.group_at_msg:readonly` - Read @ mentions
   - **Documents**:
     - `docx:document` - Create and edit documents
     - `docx:document:readonly` - Read documents
   - **Drive** (required for permissions):
     - `drive:drive` - Manage document permissions
     - `drive:drive.readonly` - Read document metadata
   - **Contact**:
     - `contact:contact.base:readonly` - Read user basic info (for author names)
   - **Bitable**:
     - `bitable:app` - Access Bitable for thoughts storage
   - **Wiki** (optional, if using wiki spaces):
     - `wiki:wiki` - Access wiki spaces
     - `wiki:wiki:readonly` - Read wiki spaces
3. Click "Save"

### 1.3 Get Credentials

1. Go to "Credentials & Basic Info"
2. Copy these values:
   - **App ID**: `cli_xxxxxxxxxxxxx`
   - **App Secret**: Click "Show" and copy
3. Save these for later!

## Step 2: Create Document Storage (5 minutes)

### 2.1 Create Three Main Documents

Create three documents to organize your meeting data:

1. **In Lark, create the first document:**
   - Click "+" → "Document" (or "Wiki")
   - Name it: "📄 Meeting Transcripts"
   - Click "Create"

2. **Create the second document:**
   - Click "+" → "Document" (or "Wiki")
   - Name it: "📝 Meeting Notes"
   - Click "Create"

3. **Create the third document:**
   - Click "+" → "Document" (or "Wiki")
   - Name it: "📋 Meeting Templates"
   - Click "Create"

### 2.2 Get Document Tokens

For each of the three documents:

1. Open the document
2. Copy the URL from your browser:
   ```
   https://your-workspace.larksuite.com/docx/ABC123def456
   ```
   The `ABC123def456` part is your **Document Token**

3. Save these three tokens:
   - **Transcripts Doc Token**: for "Meeting Transcripts" document
   - **Notes Doc Token**: for "Meeting Notes" document
   - **Templates Doc Token**: for "Meeting Templates" document

### 2.3 Grant Bot Access

For each of the three documents:

1. Open the document
2. Click the **"Share"** button (top-right)
3. Search for your bot by app name
4. Add the bot with **"Can Edit"** permission
5. Click "Confirm"

## Step 3: Get AI API Key (5 minutes)

### Option A: OpenAI (Recommended)

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Name it: "Lark Meeting Bot"
4. Copy the key (starts with `sk-...`)
5. **Important**: Save it now - you won't see it again!

### Option B: HuggingFace (Free Alternative)

1. Go to https://huggingface.co/settings/tokens
2. Click "New token"
3. Name it: "Lark Meeting Bot"
4. Select "Read" access
5. Copy the token (starts with `hf_...`)

## Step 4: Local Setup (10 minutes)

### 4.1 Clone and Install

```bash
cd lark-meeting-bot
npm install
```

### 4.2 Configure Environment

1. Copy `ENV_TEMPLATE.txt` to `.env`:
   ```bash
   cp ENV_TEMPLATE.txt .env
   ```

2. Edit `.env` with your credentials:
   ```env
   LARK_APP_ID=cli_xxxxxxxxxxxxx
   LARK_APP_SECRET=your_secret_here
   OPENAI_API_KEY=sk-...
   AI_PROVIDER=openai
   PORT=3000
   
   # Bitable for thoughts (required for /thoughts feature)
   LARK_BITABLE_APP_TOKEN=your_bitable_token
   LARK_THOUGHTS_TABLE_ID=your_table_id
   ```

**Note on Document Organization:**
- Meeting notes are created as standalone documents with AI-generated content
- You can manually organize them into folders in Lark
- Lark doesn't support automatic subdocument creation under regular documents

### 4.3 Initialize Template Examples (⚠️ NOT RECOMMENDED)

**Skip this step!** Templates work from `config.js` automatically.

~~```bash
npm run init-templates  # DON'T RUN - creates view-only docs
```~~

**Why skip it:**
- ❌ Creates bot-owned documents (you can't edit them)
- ❌ Templates already work from code (`config.js`)
- ✅ No setup needed - just use `/template <name>`

**If you want template examples:**
1. Create your own document in Lark
2. Copy examples from `TEMPLATES.md`
3. You'll own it and can edit it!

### 4.4 Test Locally

```bash
npm run dev
```

You should see:
```
🚀 Lark Meeting Bot is running on http://localhost:3000
📡 Webhook URL: http://localhost:3000/webhook
```

## Step 5: Expose Webhook (5 minutes)

### 5.1 Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### 5.2 Start ngrok

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

## Step 6: Configure Webhook in Lark (10 minutes)

### 6.1 Generate Webhook Verification Token (Optional)

**Note:** Lark Developer Console requires a verification token, but your code doesn't validate it. You can use **any value** you want.

```bash
# Option 1: Generate a random secure token
openssl rand -hex 32

# Option 2: Use a simple value (works fine)
# Just use: my-webhook-token-123
```

### 6.2 Add Token to .env

Add the token to your `.env` file (any value works):

```env
# Simple value works fine:
WEBHOOK_VERIFICATION_TOKEN=my-webhook-token-123

# Or use a generated token:
# WEBHOOK_VERIFICATION_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 6.3 Set Webhook URL in Lark

1. Go to your app in Lark Developer Console
2. Click "Event Subscriptions"
3. Enable event subscriptions
4. Set:
   - **Request URL:** `https://abc123.ngrok.io/webhook`
   - **Verification Token:** Paste the **SAME** token from your `.env` file (can be any value, just needs to match)
5. Click **Save**
6. Lark will send a verification request - if the token matches, verification will succeed automatically

### 6.2 Subscribe to Events

1. Click "Add Events"
2. Select:
   - `im.message.receive_v1` - Receive messages
3. Click "Save"

### 6.3 Publish App

1. Go to "Version Management & Release"
2. Create a new version
3. Fill in version info
4. Submit for review (or use in test environment)

## Step 7: Test the Bot (5 minutes)

### 7.1 Add Bot to Chat

1. In Lark, create a new group chat
2. Add the bot (search by app name)
3. Or send a direct message to the bot

### 7.2 Test Commands

Try these commands:

```
/help
```

```
/template
```

```
/meetings
```

### 7.3 Test Transcript Processing

Send a meeting transcript (50+ characters):

```
Team meeting 2024-01-29

Alice: We need to finalize the Q1 roadmap
Bob: I agree. Let's prioritize the user dashboard
Alice: Sounds good. I'll create the mockups by Friday
Bob: I'll handle the backend APIs
Charlie: I'll coordinate with the design team

Action items:
- Alice: Create mockups (Due: Friday)
- Bob: Develop backend APIs
- Charlie: Coordinate with design team
```

The bot should:
1. Reply with "🔄 Processing..."
2. Generate notes
3. Create a Lark document
4. Share the document link

## Step 8: Deploy to Production (15 minutes)

### 8.1 Install Vercel CLI

```bash
npm i -g vercel
```

### 8.2 Deploy

```bash
vercel
```

Follow the prompts:
- Link to existing project? No
- Project name: lark-meeting-bot
- Directory: ./
- Override settings? No

### 8.3 Set Environment Variables

In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add all variables from your `.env` file
3. Set for "Production" environment

### 8.4 Deploy to Production

```bash
vercel --prod
```

Copy the production URL (e.g., `https://lark-meeting-bot.vercel.app`)

### 8.5 Update Webhook URL

1. Go to Lark Developer Console
2. Update webhook URL to: `https://lark-meeting-bot.vercel.app/webhook`
3. Save and verify

## 🎉 You're Done!

Your bot is now live! Try these next steps:

1. **Test in production**: Send a message to your bot
2. **Customize templates**: Edit `config.js` to add custom templates
3. **Monitor logs**: Check Vercel logs for any issues
4. **Share with team**: Add bot to team group chats

## 🆘 Troubleshooting

### Bot doesn't respond

- Check webhook URL is correct
- Verify ngrok/Vercel is running
- Check logs for errors
- Ensure bot has permissions

### "Failed to get access token"

- Verify App ID and App Secret
- Check they're not exposed (shouldn't have spaces/newlines)
- Regenerate App Secret if needed

### "Document creation error"

- Verify all three Document Tokens are correct
- Check bot has "Can Edit" permission on all three documents
- Ensure documents exist and are accessible

### "AI generation failed"

- Check API key is valid
- Verify you have API credits/quota
- Try different AI provider
- Check API service status

## 📞 Need Help?

- Check `README.md` for more details
- Review Lark API docs: https://open.larksuite.com/document
- Check server logs for error messages

---

Happy bot building! 🤖

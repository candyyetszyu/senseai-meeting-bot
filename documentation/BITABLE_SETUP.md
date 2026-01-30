# 📊 Bitable Setup for Thoughts Feature

This guide shows you how to set up Lark Bitable to store team thoughts.

## 🎯 What This Enables

- **Store all thoughts** in a structured database with timestamps
- **`/thoughts`** - View latest 5 thoughts with author names and times
- **`/summarize`** - AI generates summary from ALL thoughts
- **Two ways to add:** Reply to bot messages OR @mention the bot
- **Searchable** - Find thoughts by author, date, or content
- **No limits** - Store unlimited thoughts over time

---

## 📋 Quick Setup (5 minutes)

### Step 1: Create Bitable

1. **In Lark, click "+" → "Bitable"**
2. **Name it:** "Meeting Bot Data"
3. **Click "Create"**

### Step 2: Create Thoughts Table

1. **Click the default table** (or create new table)
2. **Rename it to:** "Thoughts"
3. **Add these columns:**

| Column Name | Type | Settings |
|------------|------|----------|
| Thought | Multi-line Text | Required |
| Author | Single-line Text | Required |
| Meeting Context | Single-line Text | Optional |
| Created Time | Created Time | Auto-fill (do not modify) |

**How to add columns:**
- Click "+" next to existing columns
- Choose column type
- Name the column exactly as shown above

### Step 3: Get Credentials

#### A. Get Bitable App Token

1. **Look at your Bitable URL:**
   ```
   https://your-workspace.larksuite.com/base/ABC123def456
   ```
   The `ABC123def456` part is your **Bitable App Token**

2. **Copy it** - you'll need this for `.env`

#### B. Get Table ID

1. **Click on the "Thoughts" table**
2. **Click "..." menu → "Copy table link"**
   ```
   https://your-workspace.larksuite.com/base/ABC123def456?table=tblXXXXXXXXXXX
   ```
   The `tblXXXXXXXXXXX` part is your **Table ID**

3. **Copy it** - you'll need this for `.env`

### Step 4: Grant Bot Access

1. **In Bitable, click "Share" button** (top-right)
2. **Search for your bot** (by app name)
3. **Add bot with "Can Edit" permission**
4. **Click "Confirm"**

### Step 5: Update .env File

Add these two lines to your `.env` file:

```env
LARK_BITABLE_APP_TOKEN=ABC123def456
LARK_THOUGHTS_TABLE_ID=tblXXXXXXXXXXX
```

### Step 6: Restart Bot

```bash
# Stop the bot (Ctrl+C)
npm run dev
```

---

## ✅ Test It!

### Add a Thought

**Option 1: Reply to bot message**
1. **Send a transcript** to the bot
2. **Reply to bot's response:** "Great summary! Let's add dark mode"
3. **Bot responds:** "💭 Thought recorded!"

**Option 2: @Mention the bot**
1. **@mention the bot** in any message: "@Meeting Group This is a great idea"
2. **Bot responds:** "💭 Thought recorded!"

### View Latest Thoughts

```
/thoughts
```

**Bot shows:**
```
💭 Latest 5 Thoughts:

1. **user_xyz** (General Discussion)
   Great summary! Let's add dark mode

2. **user_abc** (Team Meeting)
   We should prioritize mobile responsiveness

...
```

### Get AI Summary

```
/summarize
```

**Bot responds:**
```
🧠 AI Summary of All Thoughts (12 total):

The team has raised several important considerations:

1. Feature Priorities:
   - Dark mode implementation
   - Mobile responsiveness
   - Performance optimization

2. Process Improvements:
   - Better meeting scheduling
   - More focused standups

3. Technical Considerations:
   - Database optimization needed
   - API rate limiting concerns

Key themes: UX improvements, process efficiency, technical debt
```

---

## 📊 Bitable Table Structure

Your Bitable will look like this:

| Thought | Author | Meeting Context | Created Time |
|---------|--------|----------------|--------------|
| Let's add dark mode | user_xyz | General Discussion | 2026-01-29 10:30 |
| Focus on mobile | user_abc | Team Meeting | 2026-01-29 11:15 |
| Performance is key | user_def | Brainstorming | 2026-01-29 14:20 |

You can:
- **Sort** by date or author
- **Filter** by meeting context
- **Search** for specific keywords
- **Export** to Excel/CSV
- **Add views** for different perspectives

---

## 🎯 How It Works

### When You Reply to Bot

```
User: [Replies to bot] "We should add dark mode"
  ↓
Bot stores in Bitable:
  - Thought: "We should add dark mode"
  - Author: "user_xyz"
  - Meeting Context: "General Discussion"
  - Created Time: Auto-filled
  ↓
Bot replies: "💭 Thought recorded!"
```

### When You Use /thoughts

```
User: /thoughts
  ↓
Bot queries Bitable:
  - Get latest 5 thoughts
  - Sort by Created Time DESC
  ↓
Bot displays formatted list
```

### When You Use /summarize

```
User: /summarize
  ↓
Bot queries Bitable:
  - Get all thoughts (up to 100)
  - Extract thought texts
  ↓
Send to OpenAI/HuggingFace:
  - "Summarize these team thoughts..."
  ↓
Bot displays AI-generated summary
```

---

## 🔧 Customization

### Add More Columns

Want to track more info? Add columns like:

- **Priority** (Single Select: High, Medium, Low)
- **Category** (Single Select: Feature, Bug, Process)
- **Status** (Single Select: New, Reviewed, Implemented)
- **Tags** (Text)

Update `lark_service.js` to save these fields!

### Change Thought Limit

Edit `handler.js`:

```javascript
// Show more thoughts
await larkService.getRecentThoughts(10); // Was 5

// Summarize more thoughts
await larkService.getAllThoughts(200); // Was 100
```

### Add Filters

Modify the query to filter by:
- Date range
- Specific author
- Meeting context
- Custom fields

---

## 💡 Pro Tips

### Tip 1: Create Views in Bitable

Create filtered views for:
- "This Week's Thoughts"
- "High Priority Items"
- "By Meeting Context"

### Tip 2: Export Reports

Export Bitable data to:
- Share with stakeholders
- Create presentations
- Track trends over time

### Tip 3: Use with Templates

Different meeting templates = different contexts:
- Daily Standup thoughts
- Brainstorming ideas
- Retro feedback

### Tip 4: Regular Summaries

Schedule weekly `/summarize` to:
- Review team insights
- Identify patterns
- Track sentiment

---

## ❓ FAQ

**Q: Do I need Bitable for meeting notes?**
A: No! Meeting notes are stored as Lark documents. Bitable is only for thoughts.

**Q: What if I don't set up Bitable?**
A: Thoughts feature won't work, but meeting notes will work fine.

**Q: Can I use the free Bitable plan?**
A: Yes! The free plan is sufficient for thoughts storage.

**Q: How many thoughts can I store?**
A: Bitable free plan supports thousands of rows - more than enough!

**Q: Can I delete thoughts?**
A: Yes! Open Bitable and delete rows like any database.

**Q: Can multiple bots share one Bitable?**
A: Yes, but create separate tables for each bot.

---

## 🆘 Troubleshooting

### "Bitable not configured"

**Problem:** Bot can't access Bitable
**Solution:**
1. Check `.env` has correct tokens
2. Verify bot has "Can Edit" permission on Bitable
3. Restart the bot

### "Failed to add thought"

**Problem:** Column names don't match
**Solution:**
- Column names must be EXACT:
  - `Thought` (not "thought" or "Thoughts")
  - `Author` (not "author" or "User")
  - `Meeting Context` (not "Context" or "Meeting")

### "No thoughts found"

**Problem:** Table is empty
**Solution:**
- Reply to bot messages to add thoughts
- Check you're using the correct table ID

### Thoughts not appearing in /thoughts

**Problem:** Query might be failing
**Solution:**
1. Check Bitable permissions
2. Verify table ID is correct
3. Look at bot logs for errors

---

## 📚 Related Docs

- [STORAGE.md](STORAGE.md) - Overall storage architecture
- [SETUP_GUIDE.md](SETUP_GUIDE.md) - Complete setup guide
- [README.md](README.md) - General documentation

---

**Ready to track team insights!** 🧠

# Bitable Debug Guide

## Issues Fixed

### 1. Duplicate Message Processing
**Problem**: Webhooks were processed twice because the server took too long to respond to Lark
**Solution**: 
- Server now responds immediately with `{ success: true }`
- Processing happens asynchronously in the background
- Better deduplication using `event_id` instead of just `message_id`

### 2. Author Name Shows User ID
**Problem**: `getUserInfo()` was failing to retrieve actual user names
**Solution**: 
- Fixed API call to include `user_id_type=user_id` parameter
- Added fallback to multiple name fields (name, en_name, zh_cn_name)
- Added detailed logging to debug user info retrieval

### 3. No Creation Date for Thoughts
**Problem**: Bitable "Created Time" field was empty
**Solution**: 
- Manually set timestamp using `Date.now()` when creating thought
- Added logging to debug what Bitable returns

## How to Test

### Step 1: Restart the Server
```bash
# In your terminal, press Ctrl+C if server is running
npm run dev
```

### Step 2: Test Duplicate Fix
1. Send `/summary` in Lark
2. Check terminal - should only show ONE "Processing" message
3. Bot should reply only once

### Step 3: Test Author Name
1. @mention the bot with some text
2. Check terminal for this log:
   ```
   ✅ Got user info: { userId: 'xxx', name: 'Your Name', ... }
   ```
3. Use `/thoughts` command
4. Should show your actual name, not user ID

### Step 4: Test Creation Date
1. Add a new thought by @mentioning the bot
2. Check terminal for:
   ```
   ✅ Thought added to Bitable: { author: 'Your Name', timestamp: 1234567890 }
   ```
3. Use `/thoughts` command
4. Should show timestamp like "1/29/2026, 10:30:00 AM"

## Debugging Bitable Fields

The Bitable table should have these fields:

| Field Name | Type | Description |
|------------|------|-------------|
| Thought | Text | The thought content |
| Author | Text | User's name |
| Meeting Context | Text | Context/topic |
| Created Time | Number | Timestamp (milliseconds) |

### Check Your Bitable Setup

1. Open your Bitable app in Lark
2. Go to the "Thoughts" table
3. Verify field names match exactly (case-sensitive!)
4. "Created Time" should be type **Number** (not Date, not Formula)

### If Created Time Still Shows {Empty}

The field might not exist or have wrong type. Options:

**Option A: Create the field manually**
1. In Bitable, click "+" to add new field
2. Name: `Created Time` (exact match)
3. Type: **Number**
4. Save

**Option B: Use a different field name**
If your Bitable uses a different field name, update `lark_service.js`:

```javascript
// In addThought function, change:
'Created Time': Date.now(),
// To match your field name:
'Timestamp': Date.now(),  // or whatever your field is called
```

## Common Issues

### Issue: Still seeing duplicate messages
- Make sure you restarted the server after the code changes
- Check that ngrok/tunnel hasn't changed URL
- Verify webhook URL in Lark admin is correct

### Issue: Author still shows user_id
- Check if bot has permission to read user info
- In Lark admin, enable "Get User Info" permission
- Terminal should show "✅ Got user info" log

### Issue: Creation date shows {Empty}
- Bitable field must be type "Number", not "Date"
- Field name must match exactly: "Created Time"
- Check terminal for "✅ Thought added to Bitable" log

## Logs to Watch For

### Good Logs (Everything Working)
```
✅ Got user info: { userId: '3c58fc15', name: 'John Doe' }
✅ Thought added to Bitable: { author: 'John Doe', timestamp: 1769694490000 }
📊 Retrieved 5 thoughts from Bitable
```

### Bad Logs (Something Wrong)
```
❌ Get user info error: ...
❌ Add thought error: ...
⏭️  Skipping duplicate webhook: ...  (if you see this twice for same event_id)
```

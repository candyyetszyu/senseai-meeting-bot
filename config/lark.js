/**
 * Lark App Configuration
 */
module.exports = {
  lark: {
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    // Bitable for storing thoughts (required for thoughts feature)
    bitableAppToken: process.env.LARK_BITABLE_APP_TOKEN,
    thoughtsTableId: process.env.LARK_THOUGHTS_TABLE_ID,
    verificationToken: process.env.WEBHOOK_VERIFICATION_TOKEN,
  },
};

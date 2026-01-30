/**
 * App Configuration
 */
module.exports = {
  // Thoughts Feature Configuration
  thoughts: {
    displayLimit: 15, // Number of thoughts to show in /thoughts command
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
  },
};

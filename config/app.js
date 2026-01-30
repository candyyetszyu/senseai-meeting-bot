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
    // In Docker/production, use 0.0.0.0 so the app is reachable from outside the container
    host: process.env.HOST || '0.0.0.0',
  },
};

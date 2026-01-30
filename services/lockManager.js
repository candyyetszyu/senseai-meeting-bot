/**
 * Lock Manager - Handles webhook deduplication using file-based locks
 */

const fs = require('fs');
const path = require('path');

const LOCK_DIR = path.join(__dirname, '..', '.locks');
const LOCK_TTL_MS = 5000;

// Ensure lock directory exists
if (!fs.existsSync(LOCK_DIR)) {
  fs.mkdirSync(LOCK_DIR, { recursive: true });
}

/**
 * Try to acquire a lock for a message ID
 * Returns true if lock acquired (should process), false if already locked (skip)
 * @param {string} lockKey - Lock key (messageId or eventId)
 * @returns {boolean}
 */
function tryAcquireLock(lockKey) {
  const lockFile = path.join(LOCK_DIR, `${lockKey}.lock`);
  try {
    if (fs.existsSync(lockFile)) {
      const stats = fs.statSync(lockFile);
      if (Date.now() - stats.mtimeMs < LOCK_TTL_MS) {
        return false;
      }
      fs.unlinkSync(lockFile);
    }
    fs.writeFileSync(lockFile, String(Date.now()));
    return true;
  } catch (e) {
    return true;
  }
}

/**
 * Release lock for a message ID
 * @param {string} lockKey - Lock key
 */
function releaseLock(lockKey) {
  const lockFile = path.join(LOCK_DIR, `${lockKey}.lock`);
  try {
    fs.unlinkSync(lockFile);
  } catch (e) {}
}

/**
 * Cleanup stale locks periodically
 */
function startLockCleanup(intervalMs = 30000) {
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
  }, intervalMs);
}

module.exports = {
  tryAcquireLock,
  releaseLock,
  startLockCleanup,
};

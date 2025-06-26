/**
 * Timestamp utility functions
 */

/**
 * Returns the current timestamp in ISO format
 * @returns {string} ISO timestamp string
 */
function getTimestamp() {
  return new Date().toISOString();
}

module.exports = {
  getTimestamp
};

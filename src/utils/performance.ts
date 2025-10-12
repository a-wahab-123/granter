/**
 * Get current timestamp in milliseconds
 * Uses performance.now() if available (more precise), otherwise Date.now()
 * @internal
 */
export const now = (() => {
  // Check if performance.now() is available
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return () => performance.now();
  }
  // Fallback to Date.now()
  return () => Date.now();
})();


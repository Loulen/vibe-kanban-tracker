/**
 * Content script entry point for vibe-kanban tracker
 * Initializes URL parsing and event listeners
 */

import { parseVibeKanbanUrl } from './url-parser';
import { initializeEventListeners, getCurrentRoute } from './event-listeners';

// Log initialization with parsed route info
const initialRoute = parseVibeKanbanUrl(window.location.href);
console.log('[vibe-tracker] Content script loaded:', {
  url: window.location.href,
  route: initialRoute,
});

// Initialize all event listeners
initializeEventListeners();

// Export for potential use by other modules
export { parseVibeKanbanUrl, getCurrentRoute };

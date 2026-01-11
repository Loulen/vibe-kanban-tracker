/**
 * Global test setup for Vitest
 * Sets up mocks for webextension-polyfill and other browser APIs
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { createBrowserMock } from './mocks/browser-mock';

// Create a fresh browser mock for each test
let mockBrowser: ReturnType<typeof createBrowserMock>;

// Set up global chrome object (required by webextension-polyfill)
(globalThis as Record<string, unknown>).chrome = {
  runtime: { id: 'test-extension-id' },
};

// Mock webextension-polyfill
vi.mock('webextension-polyfill', () => {
  return {
    default: createBrowserMock(),
  };
});

beforeEach(() => {
  // Reset timers
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2025-01-11T12:00:00Z'));

  // Create fresh browser mock
  mockBrowser = createBrowserMock();

  // Reset all mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// Export for use in tests
export { mockBrowser };

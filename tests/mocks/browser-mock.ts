/**
 * Mock for webextension-polyfill browser API
 * Provides a complete mock of the browser object for testing
 */

import { vi } from 'vitest';

export interface MockBrowser {
  runtime: {
    id: string;
    sendMessage: ReturnType<typeof vi.fn>;
    onMessage: {
      addListener: ReturnType<typeof vi.fn>;
      removeListener: ReturnType<typeof vi.fn>;
      hasListener: ReturnType<typeof vi.fn>;
    };
  };
  storage: {
    local: {
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
      clear: ReturnType<typeof vi.fn>;
    };
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };
}

export function createBrowserMock(): MockBrowser {
  return {
    runtime: {
      id: 'test-extension-id',
      sendMessage: vi.fn().mockResolvedValue({ received: true }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
        hasListener: vi.fn().mockReturnValue(false),
      },
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue({ received: true }),
    },
  };
}

/**
 * Create a mock that tracks message listeners
 * Useful for integration tests that need to simulate message passing
 */
export function createBrowserMockWithMessageTracking(): MockBrowser & {
  simulateMessage: (message: unknown) => Promise<unknown>;
} {
  const listeners: Array<(message: unknown) => Promise<unknown>> = [];

  const mock = createBrowserMock();

  mock.runtime.onMessage.addListener = vi.fn((listener) => {
    listeners.push(listener);
  });

  return {
    ...mock,
    simulateMessage: async (message: unknown) => {
      const results = await Promise.all(
        listeners.map((listener) => listener(message))
      );
      return results[results.length - 1];
    },
  };
}

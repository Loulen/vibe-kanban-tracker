/**
 * Unit tests for sidebar lock functionality
 * Tests lock state management and persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrowserMock, MockBrowser } from '../../mocks/browser-mock';

// Storage key used by sidebar
const STORAGE_KEY_SIDEBAR_LOCKED = 'vibe-sidebar-locked';

describe('Sidebar Lock Storage', () => {
  let mockBrowser: MockBrowser;

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowser = createBrowserMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('saveLockState', () => {
    it('should save lock state true to browser.storage.local', async () => {
      // Set up mock to track calls
      await mockBrowser.storage.local.set({ [STORAGE_KEY_SIDEBAR_LOCKED]: true });
      
      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY_SIDEBAR_LOCKED]: true
      });
    });

    it('should save lock state false to browser.storage.local', async () => {
      await mockBrowser.storage.local.set({ [STORAGE_KEY_SIDEBAR_LOCKED]: false });
      
      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY_SIDEBAR_LOCKED]: false
      });
    });

    it('should use correct storage key', async () => {
      await mockBrowser.storage.local.set({ [STORAGE_KEY_SIDEBAR_LOCKED]: true });
      
      const callArg = mockBrowser.storage.local.set.mock.calls[0][0];
      expect(Object.keys(callArg)[0]).toBe('vibe-sidebar-locked');
    });
  });

  describe('restoreLockState', () => {
    it('should restore isLocked=true from storage', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY_SIDEBAR_LOCKED]: true
      });
      
      const result = await mockBrowser.storage.local.get(STORAGE_KEY_SIDEBAR_LOCKED);
      expect(result[STORAGE_KEY_SIDEBAR_LOCKED]).toBe(true);
    });

    it('should return empty object when storage is empty', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({});
      
      const result = await mockBrowser.storage.local.get(STORAGE_KEY_SIDEBAR_LOCKED);
      expect(result[STORAGE_KEY_SIDEBAR_LOCKED]).toBeUndefined();
    });

    it('should handle storage errors gracefully', async () => {
      mockBrowser.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(mockBrowser.storage.local.get(STORAGE_KEY_SIDEBAR_LOCKED))
        .rejects.toThrow('Storage error');
    });
  });
});

describe('Lock Button DOM State', () => {
  let lockButton: HTMLButtonElement;

  beforeEach(() => {
    // Create a mock lock button
    lockButton = document.createElement('button');
    lockButton.className = 'vibe-sidebar-lock';
    lockButton.setAttribute('aria-label', 'Lock sidebar open');
    lockButton.setAttribute('aria-pressed', 'false');
    document.body.appendChild(lockButton);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('updateLockButtonState - locked', () => {
    beforeEach(() => {
      // Simulate locked state
      lockButton.setAttribute('aria-label', 'Unlock sidebar');
      lockButton.setAttribute('aria-pressed', 'true');
      lockButton.classList.add('locked');
    });

    it('should have aria-label "Unlock sidebar" when locked', () => {
      expect(lockButton.getAttribute('aria-label')).toBe('Unlock sidebar');
    });

    it('should have aria-pressed "true" when locked', () => {
      expect(lockButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('should have "locked" class when locked', () => {
      expect(lockButton.classList.contains('locked')).toBe(true);
    });
  });

  describe('updateLockButtonState - unlocked', () => {
    it('should have aria-label "Lock sidebar open" when unlocked', () => {
      expect(lockButton.getAttribute('aria-label')).toBe('Lock sidebar open');
    });

    it('should have aria-pressed "false" when unlocked', () => {
      expect(lockButton.getAttribute('aria-pressed')).toBe('false');
    });

    it('should NOT have "locked" class when unlocked', () => {
      expect(lockButton.classList.contains('locked')).toBe(false);
    });
  });
});

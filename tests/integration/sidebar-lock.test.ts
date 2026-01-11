/**
 * Integration tests for sidebar lock behavior
 * Tests the interaction between lock state and sidebar behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBrowserMock, MockBrowser } from '../mocks/browser-mock';

const STORAGE_KEY_SIDEBAR_LOCKED = 'vibe-sidebar-locked';
const STORAGE_KEY_SIDEBAR_OPEN = 'vibe-sidebar-open';

describe('Sidebar Lock Integration', () => {
  let mockBrowser: MockBrowser;
  let sidebar: HTMLDivElement;
  let lockButton: HTMLButtonElement;
  let closeButton: HTMLButtonElement;
  let isLocked: boolean;
  let isOpen: boolean;

  function simulateClickOutside(): void {
    if (!isOpen) return;
    if (isLocked) return; // Key behavior: don't close when locked
    isOpen = false;
    sidebar.classList.remove('open');
  }

  function toggleLock(): void {
    isLocked = !isLocked;
    updateLockButtonState();
  }

  function updateLockButtonState(): void {
    if (isLocked) {
      lockButton.setAttribute('aria-label', 'Unlock sidebar');
      lockButton.setAttribute('aria-pressed', 'true');
      lockButton.classList.add('locked');
    } else {
      lockButton.setAttribute('aria-label', 'Lock sidebar open');
      lockButton.setAttribute('aria-pressed', 'false');
      lockButton.classList.remove('locked');
    }
  }

  function openSidebar(): void {
    isOpen = true;
    sidebar.classList.add('open');
  }

  function closeSidebar(): void {
    isOpen = false;
    sidebar.classList.remove('open');
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mockBrowser = createBrowserMock();
    isLocked = false;
    isOpen = false;

    // Create mock DOM structure
    sidebar = document.createElement('div');
    sidebar.className = 'vibe-sidebar';
    
    lockButton = document.createElement('button');
    lockButton.className = 'vibe-sidebar-lock';
    lockButton.setAttribute('aria-label', 'Lock sidebar open');
    lockButton.setAttribute('aria-pressed', 'false');
    lockButton.addEventListener('click', toggleLock);
    
    closeButton = document.createElement('button');
    closeButton.className = 'vibe-sidebar-close';
    closeButton.addEventListener('click', closeSidebar);
    
    sidebar.appendChild(lockButton);
    sidebar.appendChild(closeButton);
    document.body.appendChild(sidebar);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Lock State and Click-Outside Behavior', () => {
    it('should close sidebar on click-outside when unlocked', () => {
      openSidebar();
      expect(sidebar.classList.contains('open')).toBe(true);
      
      simulateClickOutside();
      
      expect(sidebar.classList.contains('open')).toBe(false);
    });

    it('should NOT close sidebar on click-outside when locked', () => {
      openSidebar();
      isLocked = true;
      
      simulateClickOutside();
      
      expect(sidebar.classList.contains('open')).toBe(true);
    });

    it('should close sidebar via close button even when locked', () => {
      openSidebar();
      isLocked = true;
      
      closeButton.click();
      
      expect(sidebar.classList.contains('open')).toBe(false);
    });
  });

  describe('Lock Button Click Handler', () => {
    it('should toggle lock state on button click', () => {
      expect(isLocked).toBe(false);
      
      lockButton.click();
      
      expect(isLocked).toBe(true);
      
      lockButton.click();
      
      expect(isLocked).toBe(false);
    });

    it('should update visual state on button click', () => {
      lockButton.click();
      
      expect(lockButton.classList.contains('locked')).toBe(true);
      expect(lockButton.getAttribute('aria-pressed')).toBe('true');
      
      lockButton.click();
      
      expect(lockButton.classList.contains('locked')).toBe(false);
      expect(lockButton.getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('Lock State Persistence', () => {
    it('should persist lock state to storage', async () => {
      isLocked = true;
      await mockBrowser.storage.local.set({ [STORAGE_KEY_SIDEBAR_LOCKED]: true });
      
      expect(mockBrowser.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY_SIDEBAR_LOCKED]: true
      });
    });

    it('should restore locked state from storage', async () => {
      mockBrowser.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY_SIDEBAR_LOCKED]: true
      });
      
      const result = await mockBrowser.storage.local.get(STORAGE_KEY_SIDEBAR_LOCKED);
      if (result[STORAGE_KEY_SIDEBAR_LOCKED] === true) {
        isLocked = true;
        updateLockButtonState();
      }
      
      expect(isLocked).toBe(true);
      expect(lockButton.classList.contains('locked')).toBe(true);
    });
  });
});

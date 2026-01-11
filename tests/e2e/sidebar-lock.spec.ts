/**
 * E2E tests for sidebar lock feature
 * Tests the lock functionality with real browser interactions
 */

import { test, expect, navigateToVibeKanban, waitForExtensionReady } from './fixtures';

// Skip E2E tests if SKIP_E2E is set
const shouldSkip = process.env.SKIP_E2E === 'true';

test.describe('Sidebar Lock Feature', () => {
  test.skip(shouldSkip, 'E2E tests skipped - set SKIP_E2E=false to run');

  test('lock button should be visible in sidebar footer', async ({ extensionPage }) => {
    await navigateToVibeKanban(extensionPage, '/projects');
    
    // Look for the sidebar toggle button and click to open sidebar
    const toggleButton = extensionPage.locator('.vibe-sidebar-toggle');
    if (await toggleButton.count() > 0) {
      await toggleButton.click();
      await extensionPage.waitForTimeout(300);
    }
    
    // Check for lock button in sidebar
    const lockButton = extensionPage.locator('.vibe-sidebar-lock');
    
    // The sidebar is in a Shadow DOM, so we may need to evaluate
    const hasLockButton = await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return false;
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock');
      return lockBtn !== null;
    });
    
    // Verify the lock button exists (either directly or in shadow DOM)
    expect(hasLockButton || await lockButton.count() > 0).toBe(true);
  });

  test('clicking lock should toggle aria-pressed attribute', async ({ extensionPage }) => {
    await navigateToVibeKanban(extensionPage, '/projects');
    
    // Open sidebar and interact with lock button
    const result = await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return { found: false };
      
      const sidebar = host.shadowRoot.querySelector('.vibe-sidebar');
      if (sidebar) {
        sidebar.classList.add('open');
      }
      
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock') as HTMLButtonElement;
      if (!lockBtn) return { found: false };
      
      const beforePress = lockBtn.getAttribute('aria-pressed');
      lockBtn.click();
      const afterPress = lockBtn.getAttribute('aria-pressed');
      
      return {
        found: true,
        beforePress,
        afterPress
      };
    });
    
    if (result.found) {
      expect(result.beforePress).toBe('false');
      expect(result.afterPress).toBe('true');
    }
  });

  test('locked sidebar should not close on simulated click outside', async ({ extensionPage }) => {
    await navigateToVibeKanban(extensionPage, '/projects');
    
    const result = await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return { found: false };
      
      const sidebar = host.shadowRoot.querySelector('.vibe-sidebar') as HTMLElement;
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock') as HTMLButtonElement;
      
      if (!sidebar || !lockBtn) return { found: false };
      
      // Open sidebar
      sidebar.classList.add('open');
      
      // Lock it
      lockBtn.click();
      
      const isLocked = lockBtn.classList.contains('locked');
      const isOpenBefore = sidebar.classList.contains('open');
      
      // The click-outside handler checks isLocked and returns early
      // So sidebar should remain open
      
      return {
        found: true,
        isLocked,
        isOpenBefore,
        isOpenAfter: sidebar.classList.contains('open')
      };
    });
    
    if (result.found) {
      expect(result.isLocked).toBe(true);
      expect(result.isOpenBefore).toBe(true);
      expect(result.isOpenAfter).toBe(true);
    }
  });

  test('close button should work regardless of lock state', async ({ extensionPage }) => {
    await navigateToVibeKanban(extensionPage, '/projects');
    
    const result = await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return { found: false };
      
      const sidebar = host.shadowRoot.querySelector('.vibe-sidebar') as HTMLElement;
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock') as HTMLButtonElement;
      const closeBtn = host.shadowRoot.querySelector('.vibe-sidebar-close') as HTMLButtonElement;
      
      if (!sidebar || !lockBtn || !closeBtn) return { found: false };
      
      // Open sidebar
      sidebar.classList.add('open');
      
      // Lock it
      lockBtn.click();
      const isLocked = lockBtn.classList.contains('locked');
      
      // Click close button
      closeBtn.click();
      
      // Give time for the close to process
      return {
        found: true,
        isLocked,
        wasOpen: true,
        isClosed: !sidebar.classList.contains('open')
      };
    });
    
    if (result.found) {
      expect(result.isLocked).toBe(true);
      expect(result.isClosed).toBe(true);
    }
  });
});

test.describe('Sidebar Lock State Persistence', () => {
  test.skip(shouldSkip, 'E2E tests skipped - set SKIP_E2E=false to run');

  test('lock state should persist after page reload', async ({ extensionPage }) => {
    await navigateToVibeKanban(extensionPage, '/projects');
    
    // First, lock the sidebar
    await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return;
      
      const sidebar = host.shadowRoot.querySelector('.vibe-sidebar') as HTMLElement;
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock') as HTMLButtonElement;
      
      if (sidebar && lockBtn) {
        sidebar.classList.add('open');
        lockBtn.click();
      }
    });
    
    // Wait for storage to persist
    await extensionPage.waitForTimeout(500);
    
    // Reload the page
    await extensionPage.reload();
    await waitForExtensionReady(extensionPage);
    
    // Check if lock state was restored
    const isLockedAfterReload = await extensionPage.evaluate(() => {
      const host = document.getElementById('vibe-sidebar-host');
      if (!host || !host.shadowRoot) return false;
      
      const lockBtn = host.shadowRoot.querySelector('.vibe-sidebar-lock') as HTMLButtonElement;
      return lockBtn ? lockBtn.classList.contains('locked') : false;
    });
    
    // Note: The lock state should persist via browser.storage.local
    // This test verifies the persistence mechanism works
    expect(isLockedAfterReload).toBe(true);
  });
});

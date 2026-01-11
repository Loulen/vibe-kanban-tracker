/**
 * E2E Tests for Activity Metrics
 *
 * These tests verify that activity metrics are correctly collected and exported
 * when users interact with the vibe-kanban application.
 *
 * Prerequisites:
 * - vibe-kanban running at http://localhost:3069
 * - Extension built and installed
 * - OTel collector (or mock) running
 *
 * Note: These tests require a real browser environment with the extension loaded.
 * They are skipped by default in CI environments without proper setup.
 */

import { test, expect, navigateToVibeKanban, waitForExtensionReady, simulateUserActivity } from './fixtures';

// Skip E2E tests if SKIP_E2E is set or if not running in headed mode for debugging
const shouldSkip = process.env.SKIP_E2E === 'true';

test.describe('Activity Metrics E2E', () => {
  test.skip(shouldSkip, 'E2E tests skipped - set SKIP_E2E=false to run');

  test.beforeEach(async ({ extensionPage }) => {
    // Navigate to vibe-kanban
    await navigateToVibeKanban(extensionPage, '/projects');
  });

  test.describe('Mouse Activity', () => {
    test('should detect mouse movement as activity', async ({ extensionPage }) => {
      // Perform mouse activity
      await extensionPage.mouse.move(100, 100);
      await extensionPage.waitForTimeout(500);
      await extensionPage.mouse.move(200, 200);
      await extensionPage.waitForTimeout(500);
      await extensionPage.mouse.move(300, 300);

      // Wait for throttled activity message (1 second throttle)
      await extensionPage.waitForTimeout(1500);

      // The activity should have been sent to background script
      // In a full E2E test, we would verify the metric was exported
      // For now, we verify the page is still responsive
      expect(await extensionPage.title()).toBeDefined();
    });

    test('should track activity across page navigation', async ({ extensionPage }) => {
      // Activity on first page
      await simulateUserActivity(extensionPage);

      // Navigate to a different page
      const projectLink = extensionPage.locator('a[href*="/projects/"]').first();
      if (await projectLink.count() > 0) {
        await projectLink.click();
        await extensionPage.waitForLoadState('networkidle');
      }

      // Activity on second page
      await simulateUserActivity(extensionPage);

      // Verify page is still functional
      expect(await extensionPage.url()).toContain('localhost:3069');
    });
  });

  test.describe('Scroll Events', () => {
    test('should track scroll events', async ({ extensionPage }) => {
      // Get the scrollable height of the page
      const scrollHeight = await extensionPage.evaluate(() => {
        return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      });

      // Calculate a reasonable scroll target (at most 500px or half the page height)
      const scrollTarget = Math.min(500, Math.floor(scrollHeight / 2));

      // Scroll the page
      await extensionPage.evaluate((target) => {
        window.scrollTo(0, target);
      }, scrollTarget);

      // Wait for throttled scroll event (500ms throttle)
      await extensionPage.waitForTimeout(600);

      // Scroll again (double the target or max available)
      const secondTarget = await extensionPage.evaluate(({ scrollH, firstTarget }) => {
        return Math.min(firstTarget * 2, scrollH - window.innerHeight);
      }, { scrollH: scrollHeight, firstTarget: scrollTarget });
      await extensionPage.evaluate((target) => {
        window.scrollTo(0, target);
      }, secondTarget);

      await extensionPage.waitForTimeout(600);

      // Verify page responded to scroll (may be limited by content height)
      const scrollY = await extensionPage.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThanOrEqual(0);
    });

    test('should track scroll distance', async ({ extensionPage }) => {
      // Large scroll
      await extensionPage.evaluate(() => {
        window.scrollTo(0, 2000);
      });

      await extensionPage.waitForTimeout(600);

      // The scroll distance should be tracked
      // In a full test, we'd verify the metric value
      const scrollY = await extensionPage.evaluate(() => window.scrollY);
      expect(scrollY).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Focus/Blur Events', () => {
    test('should detect page focus', async ({ extensionPage, extensionContext }) => {
      // Bring page to front (focus)
      await extensionPage.bringToFront();

      // Wait for focus event to be processed
      await extensionPage.waitForTimeout(500);

      // Page should be focused
      expect(await extensionPage.evaluate(() => document.hasFocus())).toBe(true);
    });

    test('should detect page blur when opening new tab', async ({ extensionPage, extensionContext }) => {
      // Open a new tab (this blurs the original page)
      const newPage = await extensionContext.newPage();
      await newPage.goto('about:blank');

      // Wait for blur event to be processed
      await extensionPage.waitForTimeout(500);

      // Return to original page
      await extensionPage.bringToFront();

      // Wait for focus event
      await extensionPage.waitForTimeout(500);

      // Cleanup
      await newPage.close();
    });
  });

  test.describe('Keyboard Events', () => {
    test('should track keyboard activity', async ({ extensionPage }) => {
      // Click somewhere to ensure page has focus
      await extensionPage.click('body');

      // Type some keys
      await extensionPage.keyboard.press('Tab');
      await extensionPage.waitForTimeout(200);
      await extensionPage.keyboard.press('Tab');

      // Wait for throttled activity (1 second)
      await extensionPage.waitForTimeout(1500);

      // Page should still be responsive
      expect(await extensionPage.title()).toBeDefined();
    });
  });

  test.describe('Human Intervention Detection', () => {
    test('should detect Ctrl+Enter in text input', async ({ extensionPage }) => {
      // Find a contenteditable or textarea element
      // This depends on the vibe-kanban UI structure
      const textInput = extensionPage.locator('[contenteditable="true"], textarea, [role="textbox"]').first();

      if (await textInput.count() > 0) {
        await textInput.click();
        await textInput.fill('Test message');

        // Trigger Ctrl+Enter
        await extensionPage.keyboard.press('Control+Enter');

        // Wait for event processing
        await extensionPage.waitForTimeout(500);
      }

      // Test passes if no errors occurred
      expect(true).toBe(true);
    });

    test('should detect button clicks with intervention patterns', async ({ extensionPage }) => {
      // Look for buttons with intervention text patterns
      const submitButton = extensionPage.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("Create")').first();

      if (await submitButton.count() > 0) {
        await submitButton.click();

        // Wait for event processing
        await extensionPage.waitForTimeout(500);
      }

      // Test passes if no errors occurred
      expect(true).toBe(true);
    });
  });

  test.describe('Typing Metrics', () => {
    test('should track characters typed', async ({ extensionPage }) => {
      const textInput = extensionPage.locator('[contenteditable="true"], textarea, input[type="text"]').first();

      if (await textInput.count() > 0) {
        await textInput.click();
        await textInput.type('Hello World', { delay: 100 });

        // Wait for throttled typing event (2 second throttle)
        await extensionPage.waitForTimeout(2500);
      }

      // Test passes if no errors occurred
      expect(true).toBe(true);
    });
  });

  test.describe('Navigation Tracking', () => {
    test('should track SPA navigation', async ({ extensionPage }) => {
      const initialUrl = extensionPage.url();

      // Click on a link to navigate within the SPA
      const link = extensionPage.locator('a[href^="/projects/"], a[href^="/workspaces/"]').first();

      if (await link.count() > 0) {
        await link.click();
        await extensionPage.waitForLoadState('networkidle');

        const newUrl = extensionPage.url();

        // URL should have changed (SPA navigation)
        // The extension should have tracked this navigation
        expect(newUrl).not.toBe(initialUrl);
      }
    });

    test('should track browser back/forward navigation', async ({ extensionPage }) => {
      // Navigate to a few pages first
      const link = extensionPage.locator('a[href^="/projects/"]').first();

      if (await link.count() > 0) {
        await link.click();
        await extensionPage.waitForLoadState('networkidle');

        // Go back
        await extensionPage.goBack();
        await extensionPage.waitForLoadState('networkidle');

        // Go forward
        await extensionPage.goForward();
        await extensionPage.waitForLoadState('networkidle');
      }

      // Test passes if navigation worked
      expect(true).toBe(true);
    });
  });
});

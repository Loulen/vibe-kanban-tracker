/**
 * Event listeners for tracking user activity in vibe-kanban
 */

import browser from 'webextension-polyfill';
import { parseVibeKanbanUrl, type ParsedRoute } from './url-parser';
import type {
  ActivityMessage,
  ScrollMessage,
  FocusMessage,
  BlurMessage,
  NavigationMessage,
  HumanInterventionMessage,
} from '../shared/types';

// Throttle intervals in milliseconds
const ACTIVITY_THROTTLE_MS = 1000;
const SCROLL_THROTTLE_MS = 500;

// Current route state
let currentRoute: ParsedRoute = parseVibeKanbanUrl(window.location.href);

/**
 * Creates a throttled version of a function
 * @param fn - Function to throttle
 * @param delay - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function throttled(...args: Parameters<T>): void {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      fn(...args);
    } else if (!timeoutId) {
      // Schedule a call at the end of the throttle period
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        timeoutId = null;
        fn(...args);
      }, delay - timeSinceLastCall);
    }
  };
}

/**
 * Get current route
 */
export function getCurrentRoute(): ParsedRoute {
  return currentRoute;
}

/**
 * Send message to background script
 */
async function sendMessage(
  message: ActivityMessage | ScrollMessage | FocusMessage | BlurMessage | NavigationMessage | HumanInterventionMessage
): Promise<void> {
  try {
    await browser.runtime.sendMessage(message);
  } catch (error) {
    // Extension context may be invalidated, log and continue
    console.debug('[vibe-tracker] Failed to send message:', error);
  }
}

/**
 * Setup activity listeners (mousemove, keydown)
 * Throttled to 1 second
 */
export function setupActivityListeners(): void {
  const handleMouseMove = throttle(() => {
    const message: ActivityMessage = {
      type: 'ACTIVITY',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
        activityType: 'mouse',
      },
    };
    sendMessage(message);
  }, ACTIVITY_THROTTLE_MS);

  const handleKeyDown = throttle(() => {
    const message: ActivityMessage = {
      type: 'ACTIVITY',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
        activityType: 'keyboard',
      },
    };
    sendMessage(message);
  }, ACTIVITY_THROTTLE_MS);

  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('keydown', handleKeyDown, { passive: true });
}

/**
 * Setup scroll listener
 * Throttled to 500ms
 */
export function setupScrollListener(): void {
  const handleScroll = throttle(() => {
    const scrollPosition = window.scrollY;
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercentage = documentHeight > 0 ? (scrollPosition / documentHeight) * 100 : 0;

    const message: ScrollMessage = {
      type: 'SCROLL',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
        scrollPosition,
        scrollPercentage: Math.round(scrollPercentage * 100) / 100,
      },
    };
    sendMessage(message);
  }, SCROLL_THROTTLE_MS);

  document.addEventListener('scroll', handleScroll, { passive: true });
}

/**
 * Setup focus/blur/visibility listeners
 */
export function setupFocusListeners(): void {
  const handleFocus = (): void => {
    const message: FocusMessage = {
      type: 'FOCUS',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
      },
    };
    sendMessage(message);
  };

  const handleBlur = (): void => {
    const message: BlurMessage = {
      type: 'BLUR',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
      },
    };
    sendMessage(message);
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      handleFocus();
    } else {
      handleBlur();
    }
  };

  window.addEventListener('focus', handleFocus);
  window.addEventListener('blur', handleBlur);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Setup human intervention detection
 * Detects:
 * - Cmd+Enter / Ctrl+Enter in contenteditable elements
 * - Click on buttons containing "Create Workspace", "Send", "Start"
 */
export function setupHumanInterventionListeners(): void {
  // Keyboard shortcut detection (Cmd+Enter / Ctrl+Enter)
  const handleKeyboardShortcut = (event: KeyboardEvent): void => {
    // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      const target = event.target as HTMLElement;

      // Check if the target is a contenteditable element or role="textbox"
      const isContentEditable =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true' ||
        target.getAttribute('role') === 'textbox' ||
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text');

      if (isContentEditable) {
        const message: HumanInterventionMessage = {
          type: 'HUMAN_INTERVENTION',
          payload: {
            route: currentRoute,
            timestamp: Date.now(),
            triggerType: 'keyboard_shortcut',
          },
        };
        sendMessage(message);
      }
    }
  };

  // Button click detection
  const handleButtonClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;

    // Find the closest button element (handles clicks on button children)
    const button = target.closest('button') as HTMLButtonElement | null;
    if (!button) return;

    // Get button text content
    const buttonText = button.textContent?.trim() || '';

    // Check if button text matches intervention patterns
    const interventionPatterns = ['Create Workspace', 'Send', 'Start'];
    const isIntervention = interventionPatterns.some((pattern) =>
      buttonText.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isIntervention) {
      const message: HumanInterventionMessage = {
        type: 'HUMAN_INTERVENTION',
        payload: {
          route: currentRoute,
          timestamp: Date.now(),
          triggerType: 'button_click',
          buttonText,
        },
      };
      sendMessage(message);
    }
  };

  document.addEventListener('keydown', handleKeyboardShortcut);
  document.addEventListener('click', handleButtonClick);
}

/**
 * Setup navigation listener for SPA route changes
 * Uses popstate event and also monitors pushState/replaceState
 */
export function setupNavigationListener(): void {
  const handleNavigation = (): void => {
    const previousRoute = currentRoute;
    const newRoute = parseVibeKanbanUrl(window.location.href);

    // Only send message if route actually changed
    if (
      previousRoute.type !== newRoute.type ||
      previousRoute.workspaceId !== newRoute.workspaceId ||
      previousRoute.projectId !== newRoute.projectId ||
      previousRoute.taskId !== newRoute.taskId ||
      previousRoute.view !== newRoute.view
    ) {
      currentRoute = newRoute;

      const message: NavigationMessage = {
        type: 'NAVIGATION',
        payload: {
          route: currentRoute,
          timestamp: Date.now(),
          previousRoute,
        },
      };
      sendMessage(message);
    }
  };

  // Listen for browser back/forward navigation
  window.addEventListener('popstate', handleNavigation);

  // Intercept pushState and replaceState for SPA navigation
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args) {
    originalPushState(...args);
    handleNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState(...args);
    handleNavigation();
  };
}

/**
 * Initialize all event listeners
 */
export function initializeEventListeners(): void {
  setupActivityListeners();
  setupScrollListener();
  setupFocusListeners();
  setupHumanInterventionListeners();
  setupNavigationListener();

  // Send initial focus message if page is visible
  if (document.visibilityState === 'visible') {
    const message: FocusMessage = {
      type: 'FOCUS',
      payload: {
        route: currentRoute,
        timestamp: Date.now(),
      },
    };
    sendMessage(message);
  }
}

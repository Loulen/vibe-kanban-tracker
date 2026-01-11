/**
 * Event listeners for tracking user activity in vibe-kanban
 */

import browser from 'webextension-polyfill';
import { parseVibeKanbanUrl, type ParsedRoute } from './url-parser';
import { ensureToggleButtonInjected } from './sidebar/sidebar';
import type {
  ActivityMessage,
  ScrollMessage,
  FocusMessage,
  BlurMessage,
  NavigationMessage,
  HumanInterventionMessage,
  TypingMessage,
  MessageSentMessage,
} from '../shared/types';

// Throttle intervals in milliseconds
const ACTIVITY_THROTTLE_MS = 1000;
const SCROLL_THROTTLE_MS = 500;
const TYPING_THROTTLE_MS = 2000;

// Current route state
let currentRoute: ParsedRoute = parseVibeKanbanUrl(window.location.href);

// Track accumulated characters typed since last report
let charactersTypedSinceLastReport = 0;

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
  message: ActivityMessage | ScrollMessage | FocusMessage | BlurMessage | NavigationMessage | HumanInterventionMessage | TypingMessage | MessageSentMessage
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
 * Get text content from an input element
 */
function getInputTextContent(element: HTMLElement): string {
  if (element.tagName === 'TEXTAREA') {
    return (element as HTMLTextAreaElement).value;
  }
  if (element.tagName === 'INPUT') {
    return (element as HTMLInputElement).value;
  }
  // For contenteditable elements
  return element.textContent || element.innerText || '';
}

/**
 * Find the active text input element on the page
 */
function findActiveTextInput(): HTMLElement | null {
  const activeElement = document.activeElement as HTMLElement;
  if (!activeElement) return null;

  // Check if active element is a text input
  if (
    activeElement.isContentEditable ||
    activeElement.getAttribute('contenteditable') === 'true' ||
    activeElement.getAttribute('role') === 'textbox' ||
    activeElement.tagName === 'TEXTAREA' ||
    (activeElement.tagName === 'INPUT' && (activeElement as HTMLInputElement).type === 'text')
  ) {
    return activeElement;
  }

  // Search for contenteditable elements within the active element
  const contentEditable = activeElement.querySelector('[contenteditable="true"], [role="textbox"], textarea');
  return contentEditable as HTMLElement | null;
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
      console.log('[vibe-tracker] Ctrl/Cmd+Enter detected, target:', target.tagName, target.getAttribute('role'), target.isContentEditable);

      // Check if the target is a contenteditable element or role="textbox"
      const isContentEditable =
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true' ||
        target.getAttribute('role') === 'textbox' ||
        target.tagName === 'TEXTAREA' ||
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text');

      if (isContentEditable) {
        // Get the message content before it gets cleared
        const messageContent = getInputTextContent(target);
        const messageLength = messageContent.length;

        console.log('[vibe-tracker] Human intervention detected via keyboard shortcut, message length:', messageLength);

        // Send human intervention message
        const hiMessage: HumanInterventionMessage = {
          type: 'HUMAN_INTERVENTION',
          payload: {
            route: currentRoute,
            timestamp: Date.now(),
            triggerType: 'keyboard_shortcut',
          },
        };
        sendMessage(hiMessage);

        // Send message sent event with length
        if (messageLength > 0) {
          const msMessage: MessageSentMessage = {
            type: 'MESSAGE_SENT',
            payload: {
              route: currentRoute,
              timestamp: Date.now(),
              messageLength,
              triggerType: 'keyboard_shortcut',
            },
          };
          sendMessage(msMessage);
        }
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

    // Log all button clicks for debugging
    console.log('[vibe-tracker] Button clicked:', buttonText);

    // Check if button text matches intervention patterns
    // Extended patterns to catch more submission actions
    const interventionPatterns = ['Create Workspace', 'Send', 'Start', 'Submit', 'Run', 'Execute', 'Launch', 'Deploy', 'Save', 'Confirm', 'OK', 'Yes', 'Continue', 'Next', 'Done', 'Apply', 'Create'];
    const isIntervention = interventionPatterns.some((pattern) =>
      buttonText.toLowerCase().includes(pattern.toLowerCase())
    );

    if (isIntervention) {
      // Try to find the text input and get its content
      const textInput = findActiveTextInput();
      const messageContent = textInput ? getInputTextContent(textInput) : '';
      const messageLength = messageContent.length;

      console.log('[vibe-tracker] Human intervention detected via button:', buttonText, 'message length:', messageLength);

      // Send human intervention message
      const hiMessage: HumanInterventionMessage = {
        type: 'HUMAN_INTERVENTION',
        payload: {
          route: currentRoute,
          timestamp: Date.now(),
          triggerType: 'button_click',
          buttonText,
        },
      };
      sendMessage(hiMessage);

      // Send message sent event with length (if we found content)
      if (messageLength > 0) {
        const msMessage: MessageSentMessage = {
          type: 'MESSAGE_SENT',
          payload: {
            route: currentRoute,
            timestamp: Date.now(),
            messageLength,
            triggerType: 'button_click',
          },
        };
        sendMessage(msMessage);
      }
    }
  };

  document.addEventListener('keydown', handleKeyboardShortcut);
  document.addEventListener('click', handleButtonClick);
}

/**
 * Setup typing tracker
 * Counts characters typed and reports periodically
 */
export function setupTypingTracker(): void {
  const sendTypingReport = throttle(() => {
    if (charactersTypedSinceLastReport > 0) {
      console.log('[vibe-tracker] Reporting characters typed:', charactersTypedSinceLastReport);
      const message: TypingMessage = {
        type: 'TYPING',
        payload: {
          route: currentRoute,
          timestamp: Date.now(),
          characterCount: charactersTypedSinceLastReport,
        },
      };
      sendMessage(message);
      charactersTypedSinceLastReport = 0;
    }
  }, TYPING_THROTTLE_MS);

  const handleInput = (event: Event): void => {
    const target = event.target as HTMLElement;

    // Only track input in text fields
    const isTextInput =
      target.isContentEditable ||
      target.getAttribute('contenteditable') === 'true' ||
      target.getAttribute('role') === 'textbox' ||
      target.tagName === 'TEXTAREA' ||
      (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text');

    if (isTextInput && event instanceof InputEvent) {
      // Count characters added (data is the inserted text)
      const charsAdded = event.data?.length || 0;
      if (charsAdded > 0) {
        charactersTypedSinceLastReport += charsAdded;
        sendTypingReport();
      }
    }
  };

  // Use input event for real-time character tracking
  document.addEventListener('input', handleInput, { passive: true });
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

      // Re-inject toggle button after navigation
      // The function handles duplicate prevention internally
      ensureToggleButtonInjected();
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
  setupTypingTracker();

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

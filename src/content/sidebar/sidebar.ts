/**
 * Sidebar container component for displaying active tasks
 * Uses Shadow DOM for style isolation from the host page
 */

import browser from 'webextension-polyfill';
import type { ActiveTasksResponse, ActiveTaskItem } from '../../shared/sidebar-messages';
import { createTaskCard } from './task-card';
import sidebarStyles from './sidebar.css';

// Constants
const STORAGE_KEY_SIDEBAR_OPEN = 'vibe-sidebar-open';
const STORAGE_KEY_SIDEBAR_LOCKED = 'vibe-sidebar-locked';
const REFRESH_INTERVAL_MS = 10000; // 10 seconds

// SVG icons
const TOGGLE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
</svg>`;

const CLOSE_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
</svg>`;

const EMPTY_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z"/>
</svg>`;

const ERROR_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
</svg>`;

const LOCK_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
</svg>`;

const UNLOCK_ICON = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/>
</svg>`;

// UI state
interface SidebarElements {
  host: HTMLDivElement;
  shadowRoot: ShadowRoot;
  sidebar: HTMLDivElement;
  content: HTMLDivElement;
  lastUpdated: HTMLSpanElement;
  toggleButton: HTMLButtonElement;
  lockButton: HTMLButtonElement;
}

// Module state
let elements: SidebarElements | null = null;
let refreshIntervalId: ReturnType<typeof setInterval> | null = null;
let isOpen = false;
let lastError: string | null = null;
let isLocked = false;

/**
 * Escapes HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Creates the shadow DOM structure for the sidebar
 */
function createShadowStructure(): SidebarElements {
  // Create host element
  const host = document.createElement('div');
  host.id = 'vibe-sidebar-host';

  // Attach closed shadow root for style isolation
  const shadowRoot = host.attachShadow({ mode: 'closed' });

  // Inject CSS
  const styleElement = document.createElement('style');
  styleElement.textContent = sidebarStyles;
  shadowRoot.appendChild(styleElement);

  // Create sidebar container
  const sidebar = document.createElement('div');
  sidebar.className = 'vibe-sidebar';

  // Create header
  const header = document.createElement('div');
  header.className = 'vibe-sidebar-header';

  const title = document.createElement('h2');
  title.className = 'vibe-sidebar-title';
  title.textContent = 'Active Tasks';

  const closeButton = document.createElement('button');
  closeButton.className = 'vibe-sidebar-close';
  closeButton.innerHTML = CLOSE_ICON;
  closeButton.setAttribute('aria-label', 'Close sidebar');
  closeButton.addEventListener('click', () => {
    closeSidebar();
  });

  header.appendChild(title);
  header.appendChild(closeButton);

  // Create content area
  const content = document.createElement('div');
  content.className = 'vibe-sidebar-content';

  // Create footer
  const footer = document.createElement('div');
  footer.className = 'vibe-sidebar-footer';

  const lastUpdated = document.createElement('span');
  lastUpdated.className = 'vibe-last-updated';
  lastUpdated.textContent = 'Last updated: --:--:--';

  // Create lock button
  const lockButton = document.createElement('button');
  lockButton.className = 'vibe-sidebar-lock';
  lockButton.innerHTML = UNLOCK_ICON;
  lockButton.setAttribute('aria-label', 'Lock sidebar open');
  lockButton.setAttribute('aria-pressed', 'false');
  lockButton.addEventListener('click', () => {
    toggleLock();
  });

  footer.appendChild(lastUpdated);
  footer.appendChild(lockButton);

  // Assemble sidebar
  sidebar.appendChild(header);
  sidebar.appendChild(content);
  sidebar.appendChild(footer);
  shadowRoot.appendChild(sidebar);

  // Create toggle button (will be injected into header separately)
  const toggleButton = document.createElement('button');
  toggleButton.className = 'vibe-sidebar-toggle';
  toggleButton.innerHTML = TOGGLE_ICON;
  toggleButton.setAttribute('aria-label', 'Toggle active tasks sidebar');
  toggleButton.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    margin-right: 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    transition: background-color 200ms ease-out;
  `;
  toggleButton.addEventListener('mouseenter', () => {
    toggleButton.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
  });
  toggleButton.addEventListener('mouseleave', () => {
    toggleButton.style.backgroundColor = 'transparent';
  });
  toggleButton.addEventListener('click', () => {
    toggleSidebar();
  });

  return {
    host,
    shadowRoot,
    sidebar,
    content,
    lastUpdated,
    toggleButton,
    lockButton,
  };
}

/**
 * Renders the loading state
 */
function renderLoadingState(content: HTMLDivElement): void {
  content.innerHTML = `
    <div class="vibe-loading-state">
      <div class="vibe-loading-spinner"></div>
      <div class="vibe-loading-message">Loading tasks...</div>
    </div>
  `;
}

/**
 * Renders the empty state
 */
function renderEmptyState(content: HTMLDivElement): void {
  content.innerHTML = `
    <div class="vibe-empty-state">
      <div class="vibe-empty-state-icon">${EMPTY_ICON}</div>
      <div class="vibe-empty-state-message">No active tasks</div>
    </div>
  `;
}

/**
 * Renders the error state with retry button
 */
function renderErrorState(content: HTMLDivElement, errorMessage: string): void {
  content.innerHTML = `
    <div class="vibe-error-state">
      <div class="vibe-error-icon">${ERROR_ICON}</div>
      <div class="vibe-error-message">Failed to load tasks</div>
      <div class="vibe-error-details">${escapeHtml(errorMessage)}</div>
      <button class="vibe-retry-button">Retry</button>
    </div>
  `;

  // Attach retry handler
  const retryButton = content.querySelector('.vibe-retry-button');
  if (retryButton) {
    retryButton.addEventListener('click', () => {
      fetchAndRenderTasks();
    });
  }
}

/**
 * Renders the tasks list
 */
function renderTasks(content: HTMLDivElement, tasks: ActiveTaskItem[]): void {
  content.innerHTML = '';

  const taskList = document.createElement('div');
  taskList.className = 'vibe-task-list';

  for (const task of tasks) {
    const card = createTaskCard(task);
    taskList.appendChild(card);
  }

  content.appendChild(taskList);
}

/**
 * Updates the last updated timestamp
 */
function updateLastUpdatedTimestamp(): void {
  if (!elements) return;

  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  elements.lastUpdated.textContent = `Last updated: ${timeString}`;
}

/**
 * Fetches active tasks from the background script
 */
async function fetchActiveTasks(): Promise<ActiveTasksResponse> {
  try {
    const response = await browser.runtime.sendMessage({ type: 'GET_ACTIVE_TASKS' });
    return response as ActiveTasksResponse;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[vibe-tracker] Failed to fetch active tasks:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetches tasks and renders the appropriate state
 */
async function fetchAndRenderTasks(): Promise<void> {
  if (!elements) return;

  console.log('[vibe-tracker] Fetching active tasks...');

  // Show loading state
  renderLoadingState(elements.content);

  const response = await fetchActiveTasks();

  if (!response.success) {
    lastError = response.error || 'Unknown error';
    console.error('[vibe-tracker] Error fetching tasks:', lastError);
    renderErrorState(elements.content, lastError);
    return;
  }

  const tasks = response.tasks || [];
  console.log('[vibe-tracker] Fetched', tasks.length, 'active tasks');

  if (tasks.length === 0) {
    renderEmptyState(elements.content);
  } else {
    renderTasks(elements.content, tasks);
  }

  updateLastUpdatedTimestamp();
  lastError = null;
}

/**
 * Opens the sidebar
 */
function openSidebar(): void {
  if (!elements || isOpen) return;

  isOpen = true;
  elements.sidebar.classList.add('open');
  saveSidebarState(true);
  console.log('[vibe-tracker] Sidebar opened');
}

/**
 * Closes the sidebar
 */
function closeSidebar(): void {
  if (!elements || !isOpen) return;

  isOpen = false;
  elements.sidebar.classList.remove('open');
  saveSidebarState(false);
  console.log('[vibe-tracker] Sidebar closed');
}

/**
 * Toggles the sidebar open/closed state
 */
function toggleSidebar(): void {
  if (isOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

/**
 * Saves the sidebar open state to storage
 */
async function saveSidebarState(open: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_SIDEBAR_OPEN]: open });
  } catch (error) {
    console.error('[vibe-tracker] Failed to save sidebar state:', error);
  }
}

/**
 * Restores the sidebar state from storage
 */
async function restoreSidebarState(): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SIDEBAR_OPEN);
    const storedState = result[STORAGE_KEY_SIDEBAR_OPEN];
    if (storedState === true) {
      openSidebar();
    }
  } catch (error) {
    console.error('[vibe-tracker] Failed to restore sidebar state:', error);
  }
}

/**
 * Toggles the lock state of the sidebar
 */
function toggleLock(): void {
  if (!elements) return;

  isLocked = !isLocked;
  updateLockButtonState();
  saveLockState(isLocked);
  console.log('[vibe-tracker] Sidebar lock:', isLocked ? 'locked' : 'unlocked');
}

/**
 * Updates the lock button's visual state
 */
function updateLockButtonState(): void {
  if (!elements) return;

  if (isLocked) {
    elements.lockButton.innerHTML = LOCK_ICON;
    elements.lockButton.setAttribute('aria-label', 'Unlock sidebar');
    elements.lockButton.setAttribute('aria-pressed', 'true');
    elements.lockButton.classList.add('locked');
  } else {
    elements.lockButton.innerHTML = UNLOCK_ICON;
    elements.lockButton.setAttribute('aria-label', 'Lock sidebar open');
    elements.lockButton.setAttribute('aria-pressed', 'false');
    elements.lockButton.classList.remove('locked');
  }
}

/**
 * Saves the lock state to storage
 */
async function saveLockState(locked: boolean): Promise<void> {
  try {
    await browser.storage.local.set({ [STORAGE_KEY_SIDEBAR_LOCKED]: locked });
  } catch (error) {
    console.error('[vibe-tracker] Failed to save lock state:', error);
  }
}

/**
 * Restores the lock state from storage
 */
async function restoreLockState(): Promise<void> {
  try {
    const result = await browser.storage.local.get(STORAGE_KEY_SIDEBAR_LOCKED);
    const storedState = result[STORAGE_KEY_SIDEBAR_LOCKED];
    if (storedState === true) {
      isLocked = true;
      updateLockButtonState();
    }
  } catch (error) {
    console.error('[vibe-tracker] Failed to restore lock state:', error);
  }
}

/**
 * Injects the toggle button into the vibe-kanban header
 * Prevents duplicates by checking if already injected
 */
function injectToggleButton(): boolean {
  if (!elements) return false;

  // Prevent duplicate injection - check if our button is already in the DOM
  if (document.body.contains(elements.toggleButton)) {
    console.log('[vibe-tracker] Toggle button already exists in DOM, skipping injection');
    return true;
  }

  const logoLink = document.querySelector('a[href="/projects"]');
  const headerContainer = logoLink?.parentElement;

  if (headerContainer && logoLink) {
    headerContainer.insertBefore(elements.toggleButton, logoLink);
    console.log('[vibe-tracker] Toggle button injected into header');
    return true;
  }

  console.warn('[vibe-tracker] Could not find header container for toggle button');
  return false;
}

/**
 * Ensures the toggle button is present in the header
 * Safe to call multiple times - handles duplicate prevention internally
 * Called after SPA navigation to re-inject if needed
 */
export function ensureToggleButtonInjected(): void {
  if (!elements) {
    console.warn('[vibe-tracker] Sidebar not initialized, cannot inject toggle button');
    return;
  }

  // Use requestAnimationFrame to ensure DOM is ready after navigation
  requestAnimationFrame(() => {
    const injected = injectToggleButton();
    if (!injected) {
      // Retry once after a short delay if the header isn't ready yet
      setTimeout(() => {
        injectToggleButton();
      }, 100);
    }
  });
}

/**
 * Starts the auto-refresh interval
 */
function startAutoRefresh(): void {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
  }

  refreshIntervalId = setInterval(() => {
    console.log('[vibe-tracker] Auto-refreshing tasks...');
    fetchAndRenderTasks();
  }, REFRESH_INTERVAL_MS);

  console.log('[vibe-tracker] Auto-refresh started (every', REFRESH_INTERVAL_MS / 1000, 'seconds)');
}

/**
 * Stops the auto-refresh interval
 */
function stopAutoRefresh(): void {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId);
    refreshIntervalId = null;
    console.log('[vibe-tracker] Auto-refresh stopped');
  }
}

/**
 * Cleans up resources on page unload
 */
function cleanup(): void {
  stopAutoRefresh();

  if (elements) {
    elements.host.remove();
    elements.toggleButton.remove();
    elements = null;
  }

  console.log('[vibe-tracker] Sidebar cleanup complete');
}

/**
 * Sets up a MutationObserver to detect when the header is re-rendered
 * This handles edge cases where the SPA re-renders without a navigation event
 */
function setupHeaderObserver(): void {
  const observer = new MutationObserver(() => {
    // Check if our toggle button was removed from the DOM
    if (elements && !document.body.contains(elements.toggleButton)) {
      console.log('[vibe-tracker] Toggle button removed from DOM, attempting re-injection');
      // Debounce re-injection to avoid rapid-fire calls during DOM updates
      setTimeout(() => {
        injectToggleButton();
      }, 50);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[vibe-tracker] Header observer initialized');
}

/**
 * Initializes the sidebar component
 * Called from content/index.ts
 */
export function initializeSidebar(): void {
  console.log('[vibe-tracker] Initializing sidebar...');

  // Create the shadow DOM structure
  elements = createShadowStructure();

  // Append the host element to the document body
  document.body.appendChild(elements.host);

  // Inject toggle button into header
  // Use a small delay to ensure the page has fully rendered
  setTimeout(() => {
    if (!injectToggleButton()) {
      // Retry after a longer delay if first attempt fails
      setTimeout(injectToggleButton, 1000);
    }
  }, 100);

  // Setup header observer to handle SPA re-renders
  setupHeaderObserver();

  // Click outside to close sidebar
  document.addEventListener('click', (event: MouseEvent) => {
    if (!isOpen || !elements) return;

    // Don't close if sidebar is locked
    if (isLocked) return;

    const target = event.target as Node;

    // Check if click is outside sidebar (Shadow DOM host) and toggle button
    const isOutsideSidebar = !elements.host.contains(target);
    const isOutsideToggle = !elements.toggleButton.contains(target);

    if (isOutsideSidebar && isOutsideToggle) {
      closeSidebar();
    }
  });

  // Restore sidebar state from storage
  restoreSidebarState();

  // Restore lock state from storage
  restoreLockState();

  // Fetch tasks on initialization
  fetchAndRenderTasks();

  // Start auto-refresh
  startAutoRefresh();

  // Set up cleanup on page unload
  window.addEventListener('beforeunload', cleanup);

  console.log('[vibe-tracker] Sidebar initialization complete');
}

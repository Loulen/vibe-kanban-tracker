/**
 * Task card component for displaying individual tasks in the sidebar
 */

import type { ActiveTaskItem, ActiveTaskStatus } from '../../shared/sidebar-messages';

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param text - The text to escape
 * @returns The escaped text safe for HTML insertion
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Maps task status to human-readable badge text
 * @param status - The task status
 * @returns Human-readable status text
 */
function getStatusBadgeText(status: ActiveTaskStatus): string {
  switch (status) {
    case 'inprogress':
      return 'In Progress';
    case 'inreview':
      return 'In Review';
    default:
      return status;
  }
}

/**
 * Creates a task card element for displaying in the sidebar
 * @param task - The task data to display
 * @returns HTMLElement representing the task card
 */
export function createTaskCard(task: ActiveTaskItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'vibe-task-card';
  card.tabIndex = 0;
  
  // Escape all user-provided content to prevent XSS
  const escapedTitle = escapeHtml(task.taskTitle);
  const escapedProjectName = escapeHtml(task.projectName);
  const escapedStatus = escapeHtml(task.status);
  const statusBadgeText = escapeHtml(getStatusBadgeText(task.status));
  
  card.innerHTML = `
    <div class="vibe-task-status-dot ${escapedStatus}"></div>
    <div class="vibe-task-content">
      <div class="vibe-task-title">${escapedTitle}</div>
      <div class="vibe-task-project">${escapedProjectName}</div>
    </div>
    <div class="vibe-task-badge vibe-task-badge--${escapedStatus}">
      ${statusBadgeText}
    </div>
  `;
  
  // Click handler for navigation
  card.addEventListener('click', () => {
    // Build URL with optional attempt
    let url = `/projects/${task.projectId}/tasks/${task.taskId}`;
    if (task.latestAttemptId) {
      url += `/attempts/${task.latestAttemptId}`;
    }
    window.location.href = url;
  });
  
  // Keyboard accessibility - Enter key triggers click
  card.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Build URL with optional attempt
      let url = `/projects/${task.projectId}/tasks/${task.taskId}`;
      if (task.latestAttemptId) {
        url += `/attempts/${task.latestAttemptId}`;
      }
      window.location.href = url;
    }
  });
  
  return card;
}

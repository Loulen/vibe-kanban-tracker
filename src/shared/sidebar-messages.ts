/**
 * Sidebar message types for sidebar-background communication
 */

// Status values for active tasks (restricted subset, not full TaskStatus)
export type ActiveTaskStatus = 'inprogress' | 'inreview';

// Individual task with project info
export interface ActiveTaskItem {
  taskId: string;
  taskTitle: string;
  projectId: string;
  projectName: string;
  status: ActiveTaskStatus;
  latestAttemptId?: string;  // Optional: ID of the latest attempt, if any
}

// Request message to get active tasks
export interface GetActiveTasksMessage {
  type: 'GET_ACTIVE_TASKS';
}

// Response from background with active tasks
export interface ActiveTasksResponse {
  success: boolean;
  tasks?: ActiveTaskItem[];
  error?: string;
}

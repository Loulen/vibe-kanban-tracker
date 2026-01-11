/**
 * API Client for vibe-kanban tracker
 * Fetches project and task data from the vibe-kanban API
 */

import { VIBE_KANBAN_API_URL } from '../shared/constants';

/**
 * Project from the vibe-kanban API
 */
export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

/**
 * Task from the vibe-kanban API
 */
export interface Task {
  id: string;
  title: string;
  status: 'todo' | 'inprogress' | 'inreview' | 'done' | 'cancelled';
  created_at: string;
  updated_at: string;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
}

/**
 * Task attempt from the vibe-kanban API
 */
export interface TaskAttempt {
  id: string;
  task_id: string;
  branch: string;
  created_at: string;
  updated_at: string;
}

/**
 * API response for /api/projects endpoint
 * Actual format: {success: true, data: [...], error_data: null, message: null}
 */
interface ProjectsResponse {
  success: boolean;
  data: Project[];
  error_data: unknown;
  message: string | null;
}

/**
 * API response for /api/tasks endpoint
 * Actual format: {success: true, data: [...], error_data: null, message: null}
 */
interface TasksResponse {
  success: boolean;
  data: Task[];
  error_data: unknown;
  message: string | null;
}

/**
 * API response for /api/task-attempts endpoint
 * Actual format: {success: true, data: [...], error_data: null, message: null}
 */
interface TaskAttemptsResponse {
  success: boolean;
  data: TaskAttempt[];
  error_data: unknown;
  message: string | null;
}

/**
 * HTTP client for the vibe-kanban API
 * Provides typed methods to fetch projects and tasks with error handling
 */
export class VibeKanbanApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = VIBE_KANBAN_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch all projects from the API
   * Returns empty array on error
   */
  async fetchProjects(): Promise<Project[]> {
    try {
      const response = await fetch(this.baseUrl + '/api/projects', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(
          '[vibe-tracker] Failed to fetch projects: HTTP ' + response.status
        );
        return [];
      }

      const data: ProjectsResponse = await response.json();
      if (!data.success || !data.data) {
        console.error('[vibe-tracker] API returned error for projects:', data.message);
        return [];
      }
      console.log('[vibe-tracker] Fetched ' + data.data.length + ' projects');
      return data.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[vibe-tracker] Failed to fetch projects:', message);
      return [];
    }
  }

  /**
   * Fetch all tasks for a specific project
   * Returns empty array on error
   */
  async fetchProjectTasks(projectId: string): Promise<Task[]> {
    try {
      const response = await fetch(
        this.baseUrl + '/api/tasks?project_id=' + encodeURIComponent(projectId),
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(
          '[vibe-tracker] Failed to fetch tasks for project ' +
            projectId +
            ': HTTP ' +
            response.status
        );
        return [];
      }

      const data: TasksResponse = await response.json();
      if (!data.success || !data.data) {
        console.error('[vibe-tracker] API returned error for tasks:', data.message);
        return [];
      }
      console.log(
        '[vibe-tracker] Fetched ' + data.data.length + ' tasks for project ' + projectId
      );
      return data.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '[vibe-tracker] Failed to fetch tasks for project ' + projectId + ':',
        message
      );
      return [];
    }
  }

  /**
   * Fetch all attempts for a specific task
   * Returns empty array on error
   */
  async fetchTaskAttempts(taskId: string): Promise<TaskAttempt[]> {
    try {
      const response = await fetch(
        this.baseUrl + '/api/task-attempts?task_id=' + encodeURIComponent(taskId),
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(
          '[vibe-tracker] Failed to fetch attempts for task ' +
            taskId +
            ': HTTP ' +
            response.status
        );
        return [];
      }

      const data: TaskAttemptsResponse = await response.json();
      if (!data.success || !data.data) {
        console.error('[vibe-tracker] API returned error for task attempts:', data.message);
        return [];
      }
      console.log(
        '[vibe-tracker] Fetched ' + data.data.length + ' attempts for task ' + taskId
      );
      return data.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '[vibe-tracker] Failed to fetch attempts for task ' + taskId + ':',
        message
      );
      return [];
    }
  }
}

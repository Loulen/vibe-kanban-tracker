/**
 * API Metrics Collector for vibe-kanban tracker
 * Fetches project and task data from the API and generates metrics
 */

import type { MetricRecord } from './metrics-collector';
import type { VibeKanbanApiClient, Project, Task } from './api-client';
import type { ProjectNameCache } from './project-name-cache';

/**
 * Calculate age in hours from a timestamp string
 * @param createdAt - ISO timestamp string
 * @returns Age in hours
 */
function calculateAgeHours(createdAt: string): number {
  const ageMs = Date.now() - Date.parse(createdAt);
  return ageMs / (1000 * 60 * 60);
}

/**
 * Collector that fetches data from the vibe-kanban API
 * and generates gauge metrics for projects and tasks
 */
export class ApiMetricsCollector {
  private apiClient: VibeKanbanApiClient;
  private projectNameCache: ProjectNameCache;

  constructor(apiClient: VibeKanbanApiClient, projectNameCache: ProjectNameCache) {
    this.apiClient = apiClient;
    this.projectNameCache = projectNameCache;
  }

  /**
   * Collect all API-based metrics
   * @param machineId - The machine ID to include in metric attributes
   * @returns Array of MetricRecord for export
   */
  async collect(machineId: string): Promise<MetricRecord[]> {
    const metrics: MetricRecord[] = [];
    const timestamp = Date.now();

    console.log('[vibe-tracker] Starting API metrics collection');

    try {
      // Fetch all projects
      const projects = await this.apiClient.fetchProjects();

      if (projects.length === 0) {
        console.log('[vibe-tracker] No projects found, skipping API metrics');
        return [];
      }

      // Update project name cache
      this.projectNameCache.clear();
      for (const project of projects) {
        this.projectNameCache.set(project.id, project.name);
      }
      console.log('[vibe-tracker] Updated project name cache with ' + projects.length + ' projects');

      // Generate projects.count metric
      metrics.push({
        name: 'vibe_kanban.projects.count',
        type: 'gauge',
        value: projects.length,
        timestamp,
        attributes: {
          machine_id: machineId,
        },
      });

      // Generate projects.age_hours metrics for each project
      for (const project of projects) {
        metrics.push({
          name: 'vibe_kanban.projects.age_hours',
          type: 'gauge',
          value: calculateAgeHours(project.created_at),
          timestamp,
          attributes: {
            machine_id: machineId,
            project_id: project.id,
            project_name: project.name,
          },
        });
      }

      // Fetch tasks for all projects and generate task metrics
      for (const project of projects) {
        const taskMetrics = await this.collectTaskMetrics(
          project,
          machineId,
          timestamp
        );
        metrics.push(...taskMetrics);
      }

      console.log('[vibe-tracker] API metrics collection complete: ' + metrics.length + ' metrics');
      return metrics;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[vibe-tracker] API metrics collection failed:', message);
      // Return partial results (whatever we collected before the error)
      return metrics;
    }
  }

  /**
   * Collect task-related metrics for a single project
   */
  private async collectTaskMetrics(
    project: Project,
    machineId: string,
    timestamp: number
  ): Promise<MetricRecord[]> {
    const metrics: MetricRecord[] = [];

    try {
      const tasks = await this.apiClient.fetchProjectTasks(project.id);

      // Group tasks by status
      const tasksByStatus = this.groupTasksByStatus(tasks);

      // Generate tasks.count metrics for each status
      for (const [status, statusTasks] of Object.entries(tasksByStatus)) {
        metrics.push({
          name: 'vibe_kanban.tasks.count',
          type: 'gauge',
          value: statusTasks.length,
          timestamp,
          attributes: {
            machine_id: machineId,
            project_id: project.id,
            project_name: project.name,
            status,
          },
        });

        // Calculate average age for tasks in this status
        if (statusTasks.length > 0) {
          const totalAgeHours = statusTasks.reduce(
            (sum, task) => sum + calculateAgeHours(task.created_at),
            0
          );
          const averageAgeHours = totalAgeHours / statusTasks.length;

          metrics.push({
            name: 'vibe_kanban.tasks.age_hours',
            type: 'gauge',
            value: averageAgeHours,
            timestamp,
            attributes: {
              machine_id: machineId,
              project_id: project.id,
              project_name: project.name,
              status,
            },
          });
        }
      }

      // Count tasks with failed attempts
      const failedAttemptCount = tasks.filter(
        (task) => task.last_attempt_failed
      ).length;
      metrics.push({
        name: 'vibe_kanban.tasks.failed_attempts',
        type: 'gauge',
        value: failedAttemptCount,
        timestamp,
        attributes: {
          machine_id: machineId,
          project_id: project.id,
          project_name: project.name,
        },
      });

      // Count tasks with active attempts
      const activeAttemptCount = tasks.filter(
        (task) => task.has_in_progress_attempt
      ).length;
      metrics.push({
        name: 'vibe_kanban.tasks.active_attempts',
        type: 'gauge',
        value: activeAttemptCount,
        timestamp,
        attributes: {
          machine_id: machineId,
          project_id: project.id,
          project_name: project.name,
        },
      });

      return metrics;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(
        '[vibe-tracker] Failed to collect task metrics for project ' +
          project.id +
          ':',
        message
      );
      // Return empty array for this project, but don't fail entirely
      return [];
    }
  }

  /**
   * Group tasks by their status
   */
  private groupTasksByStatus(
    tasks: Task[]
  ): Record<string, Task[]> {
    const groups: Record<string, Task[]> = {};

    for (const task of tasks) {
      if (!groups[task.status]) {
        groups[task.status] = [];
      }
      groups[task.status].push(task);
    }

    return groups;
  }
}

/**
 * Project Name Cache for vibe-kanban tracker
 * In-memory cache that maps project UUIDs to human-readable names
 * Refreshed by ApiMetricsCollector during each polling cycle
 */

export class ProjectNameCache {
  private cache: Map<string, string> = new Map();

  /**
   * Set a project name in the cache
   * @param projectId - The project UUID
   * @param name - The human-readable project name
   */
  set(projectId: string, name: string): void {
    this.cache.set(projectId, name);
  }

  /**
   * Get a project name from the cache
   * @param projectId - The project UUID
   * @returns The project name, or undefined if not cached
   */
  get(projectId: string): string | undefined {
    return this.cache.get(projectId);
  }

  /**
   * Get all cached project name mappings
   * @returns A new Map containing all project ID to name mappings
   */
  getAll(): Map<string, string> {
    return new Map(this.cache);
  }

  /**
   * Clear all cached project names
   * Called before refreshing the cache with new data
   */
  clear(): void {
    this.cache.clear();
  }
}

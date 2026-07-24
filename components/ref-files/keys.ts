export const PROJECTS_QUERY_KEY = ["projects"] as const;
export const ACTIVE_PROJECT_QUERY_KEY = ["projects", "active"] as const;

export function businessProfileQueryKey(projectId: string) {
  return ["projects", projectId, "business-profile"] as const;
}

export function docsQueryKey(projectId: string) {
  return ["projects", projectId, "docs"] as const;
}

export function docQueryKey(projectId: string, docId: string) {
  return ["projects", projectId, "docs", docId] as const;
}

export function customersQueryKey(projectId: string) {
  return ["projects", projectId, "customers"] as const;
}

export function assetsQueryKey(projectId: string) {
  return ["projects", projectId, "assets"] as const;
}

export function memoriesQueryKey(projectId: string) {
  return ["projects", projectId, "memories"] as const;
}

export function pipelineColumnsQueryKey(projectId: string) {
  return ["projects", projectId, "pipeline-columns"] as const;
}

export function workItemsQueryKey(projectId: string) {
  return ["projects", projectId, "work-items"] as const;
}

export function rosterTasksQueryKey(projectId: string) {
  return ["projects", projectId, "roster", "tasks"] as const;
}

export function rosterEmailsQueryKey(projectId: string) {
  return ["projects", projectId, "roster", "emails"] as const;
}

export function rosterRunsQueryKey(projectId: string) {
  return ["projects", projectId, "roster", "runs"] as const;
}

export function rosterJobsQueryKey(projectId: string) {
  return ["projects", projectId, "roster", "jobs"] as const;
}

export function memoryKeysQueryKey(projectId: string) {
  return ["projects", projectId, "memory-keys"] as const;
}

export function chatThreadsQueryKey(projectId: string) {
  return ["projects", projectId, "chat", "threads"] as const;
}

export function chatThreadQueryKey(projectId: string, threadId: string) {
  return ["projects", projectId, "chat", "threads", threadId] as const;
}

export function chatEventsQueryKey(projectId: string, threadId: string) {
  return [
    "projects",
    projectId,
    "chat",
    "threads",
    threadId,
    "events",
  ] as const;
}

export function chatSessionQueryKey(projectId: string, threadId: string) {
  return [
    "projects",
    projectId,
    "chat",
    "threads",
    threadId,
    "session",
  ] as const;
}

export function isProjectScopedQueryKey(queryKey: readonly unknown[]) {
  return (
    queryKey.length >= 3 &&
    queryKey[0] === "projects" &&
    typeof queryKey[1] === "string"
  );
}

export function isPersistableDashboardQueryKey(queryKey: readonly unknown[]) {
  return isProjectScopedQueryKey(queryKey);
}

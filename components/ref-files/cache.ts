"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { ACTIVE_PROJECT_QUERY_KEY, PROJECTS_QUERY_KEY } from "@/lib/query/keys";

type Entity = {
  readonly id: string;
};

export function setQueryListData<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  items: readonly T[],
) {
  queryClient.setQueryData<T[]>(queryKey, [...items]);
}

export function upsertQueryListItem<T extends Entity>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  item: T,
  options: { readonly prepend?: boolean } = {},
) {
  queryClient.setQueryData<T[]>(queryKey, (current = []) => {
    const existingIndex = current.findIndex((entry) => entry.id === item.id);

    if (existingIndex >= 0) {
      return current.map((entry) => (entry.id === item.id ? item : entry));
    }

    return options.prepend === false ? [...current, item] : [item, ...current];
  });
}

export function replaceQueryListItem<T extends Entity>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  item: T,
) {
  queryClient.setQueryData<T[]>(queryKey, (current = []) =>
    current.map((entry) => (entry.id === item.id ? item : entry)),
  );
}

export function removeQueryListItem(
  queryClient: QueryClient,
  queryKey: QueryKey,
  itemId: string,
) {
  queryClient.setQueryData<Entity[]>(queryKey, (current = []) =>
    current.filter((entry) => entry.id !== itemId),
  );
}

export function removeProjectScopedQueries(
  queryClient: QueryClient,
  projectId: string,
) {
  queryClient.removeQueries({
    predicate: (query) =>
      query.queryKey[0] === "projects" && query.queryKey[1] === projectId,
  });
}

export function removeCachedProject(queryClient: QueryClient, projectId: string) {
  removeQueryListItem(queryClient, PROJECTS_QUERY_KEY, projectId);
  removeProjectScopedQueries(queryClient, projectId);
  queryClient.removeQueries({ queryKey: ACTIVE_PROJECT_QUERY_KEY });
}

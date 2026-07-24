import "server-only";

import { cache } from "react";
import { createAdminClient } from "@eva/supabase/admin";
import { createClient } from "@eva/supabase/server";
import { requireUser } from "@/lib/supabase/user";
import {
  PROJECT_ASSETS_BUCKET,
  isUsableProject,
  slugify,
} from "@eva/core/projects";
import { replaceKnowledgeChunks } from "@/lib/knowledge";
import { toJson } from "@eva/supabase/json";

export type Project = {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly logo_storage_path: string | null;
  readonly name: string;
  readonly profile_id: string;
  readonly status: string;
  readonly updated_at: string;
};

export type ProjectDoc = {
  readonly archived_at: string | null;
  readonly content: string;
  readonly created_at: string;
  readonly id: string;
  readonly project_id: string;
  readonly slug: string;
  readonly status: string;
  readonly tags: string[];
  readonly title: string;
  readonly updated_at: string;
};

export type ProjectCustomer = {
  readonly archived_at: string | null;
  readonly email: string | null;
  readonly id: string;
  readonly name: string;
  readonly notes: string | null;
  readonly phone: string | null;
  readonly phone_country: string | null;
  readonly status: string;
  readonly tags: string[];
  readonly type: string;
  readonly updated_at: string;
  readonly website: string | null;
};

export type ProjectAsset = {
  readonly archived_at: string | null;
  readonly description: string | null;
  readonly extraction_error: string | null;
  readonly filename: string;
  readonly id: string;
  readonly mime_type: string | null;
  readonly size_bytes: number;
  readonly status: string;
  readonly storage_path: string;
  readonly tags: string[];
  readonly updated_at: string;
};

export type ProjectMemory = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly key: string;
  readonly kind: string;
  readonly updated_at: string;
  readonly value: string;
};

export type ProjectMemoryKey = {
  readonly archived_at: string | null;
  readonly category: string;
  readonly default_kind: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_active: boolean;
  readonly key: string;
  readonly label: string;
  readonly sort_order: number;
  readonly updated_at: string;
};

export type ProjectPipelineColumn = {
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly description: string | null;
  readonly id: string;
  readonly is_default: boolean;
  readonly key: string;
  readonly project_id: string;
  readonly sort_order: number;
  readonly title: string;
  readonly updated_at: string;
};

export type ProjectWorkItemLink = {
  readonly id: string;
  readonly label: string | null;
  readonly project_id: string;
  readonly resource_id: string;
  readonly resource_type: string;
  readonly work_item_id: string;
};

export type ProjectWorkItem = {
  readonly archived_at: string | null;
  readonly attended_at: string | null;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly created_by_type: string;
  readonly description: string | null;
  readonly dismissed_at: string | null;
  readonly due_at: string | null;
  readonly id: string;
  readonly kind: string;
  readonly links?: readonly ProjectWorkItemLink[];
  readonly metadata: Record<string, unknown>;
  readonly position: number;
  readonly priority: string;
  readonly project_id: string;
  readonly rank_score: number;
  readonly reason: string | null;
  readonly source: string;
  readonly stage_id: string | null;
  readonly status: string;
  readonly superseded_by: string | null;
  readonly title: string;
  readonly updated_at: string;
};

export type AgentThread = {
  readonly archived_at: string | null;
  readonly continuation_token: string | null;
  readonly created_at: string;
  readonly eve_session_id: string | null;
  readonly id: string;
  readonly metadata: Record<string, unknown>;
  readonly project_id: string;
  readonly status: string;
  readonly stream_index: number;
  readonly title: string | null;
  readonly updated_at: string;
};

export type AgentEvent = {
  readonly event: unknown;
  readonly event_index: number;
  readonly event_type: string;
  readonly id: number;
  readonly thread_id: string;
};

export type ProjectScope = {
  readonly profileId: string;
  readonly projectId: string;
};

export const DEFAULT_PIPELINE_COLUMNS = [
  { key: "inbox", sort_order: 0, title: "Inbox" },
  { key: "planned", sort_order: 1, title: "Planned" },
  { key: "in_progress", sort_order: 2, title: "In Progress" },
  { key: "waiting", sort_order: 3, title: "Waiting" },
  { key: "done", sort_order: 4, title: "Done" },
] as const;

export async function getAuthedSupabase() {
  const user = await requireUser();
  const supabase = await createClient();

  return { supabase, user };
}

export const listProjects = cache(async () => {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as Project[];
});

export async function getProject(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("profile_id", user.id)
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as Project | null;
}

export async function requireProject(projectId: string) {
  const project = await getProject(projectId);

  if (!project || !isUsableProject(project)) {
    return null;
  }

  return project;
}

export async function verifyProjectOwnership(input: {
  readonly profileId: string;
  readonly projectId: string;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("projects")
    .select("id, name, description, status")
    .eq("profile_id", input.profileId)
    .eq("id", input.projectId)
    .maybeSingle();

  if (!data || !isUsableProject(data)) {
    return null;
  }

  return data;
}

export async function getBusinessProfile(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_business_profiles")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function listProjectDocs(
  projectId: string,
  options: { readonly includeArchived?: boolean } = {},
) {
  const { supabase, user } = await getAuthedSupabase();
  let query = supabase
    .from("project_docs")
    .select("id, project_id, title, slug, content, status, tags, archived_at, created_at, updated_at")
    .eq("profile_id", user.id)
    .eq("project_id", projectId);

  if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query.order("updated_at", {
    ascending: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectDoc[];
}

export async function getProjectDoc(projectId: string, docId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_docs")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .eq("id", docId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as ProjectDoc | null;
}

export async function listCustomers(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectCustomer[];
}

export async function listAssets(
  projectId: string,
  options: { readonly includeArchived?: boolean } = {},
) {
  const { supabase, user } = await getAuthedSupabase();
  let query = supabase
    .from("assets")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectAsset[];
}

export async function listMemories(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_memories")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectMemory[];
}

export async function ensureProjectPipelineColumns(input: {
  readonly profileId: string;
  readonly projectId: string;
}) {
  const { supabase } = await getAuthedSupabase();
  const { error } = await supabase.from("project_pipeline_columns").upsert(
    DEFAULT_PIPELINE_COLUMNS.map((column) => ({
      is_default: true,
      key: column.key,
      profile_id: input.profileId,
      project_id: input.projectId,
      sort_order: column.sort_order,
      title: column.title,
    })),
    { onConflict: "profile_id,project_id,key" },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function listProjectPipelineColumns(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  let { data, error } = await supabase
    .from("project_pipeline_columns")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    await ensureProjectPipelineColumns({
      profileId: user.id,
      projectId,
    });
    const result = await supabase
      .from("project_pipeline_columns")
      .select("*")
      .eq("profile_id", user.id)
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

    data = result.data;
    error = result.error;

    if (error) {
      throw new Error(error.message);
    }
  }

  return (data ?? []) as ProjectPipelineColumn[];
}

export async function listProjectWorkItems(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_work_items")
    .select(
      "id, project_id, stage_id, title, description, kind, source, status, priority, rank_score, due_at, position, reason, metadata, created_by_type, created_at, updated_at, attended_at, completed_at, dismissed_at, archived_at, superseded_by, links:project_work_item_links(id, project_id, work_item_id, resource_type, resource_id, label)",
    )
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .is("archived_at", null)
    .order("rank_score", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectWorkItem[];
}

export async function listMemoryKeys(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("project_memory_keys")
    .select("*")
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProjectMemoryKey[];
}

export async function listAgentThreads(projectId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("agent_threads")
    .select(
      "id, project_id, title, eve_session_id, continuation_token, stream_index, status, metadata, created_at, updated_at, archived_at",
    )
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AgentThread[];
}

export async function getAgentThread(projectId: string, threadId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("agent_threads")
    .select(
      "id, project_id, title, eve_session_id, continuation_token, stream_index, status, metadata, created_at, updated_at, archived_at",
    )
    .eq("profile_id", user.id)
    .eq("project_id", projectId)
    .eq("id", threadId)
    .neq("status", "archived")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as AgentThread | null;
}

export async function listAgentThreadEvents(threadId: string) {
  const { supabase, user } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("agent_events")
    .select("id, thread_id, event_index, event_type, event")
    .eq("profile_id", user.id)
    .eq("thread_id", threadId)
    .order("event_index", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AgentEvent[];
}

export async function logProjectActivity(input: {
  readonly actorId?: string | null;
  readonly actorType: "agent" | "system" | "user";
  readonly details?: Record<string, unknown>;
  readonly eventType: string;
  readonly profileId: string;
  readonly projectId: string;
  readonly resourceId?: string | null;
  readonly resourceType?: string | null;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("project_activity").insert({
    actor_id: input.actorId ?? null,
    actor_type: input.actorType,
    details: toJson(input.details ?? {}),
    event_type: input.eventType,
    profile_id: input.profileId,
    project_id: input.projectId,
    resource_id: input.resourceId ?? null,
    resource_type: input.resourceType ?? null,
  });
}

export async function createRevision(input: {
  readonly actorId: string;
  readonly actorType: "agent" | "system" | "user";
  readonly content: string;
  readonly docId: string;
  readonly profileId: string;
  readonly projectId: string;
  readonly summary?: string | null;
  readonly title: string;
}) {
  const supabase = createAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("project_doc_revisions").insert({
    actor_id: input.actorId,
    actor_type: input.actorType,
    content: input.content,
    doc_id: input.docId,
    profile_id: input.profileId,
    project_id: input.projectId,
    summary: input.summary ?? null,
    title: input.title,
  });
}

export async function createUniqueDocSlug(input: {
  readonly profileId: string;
  readonly projectId: string;
  readonly title: string;
}) {
  const supabase = createAdminClient();
  const base = slugify(input.title) || "untitled-doc";

  if (!supabase) {
    return base;
  }

  for (let index = 0; index < 50; index += 1) {
    const slug = index === 0 ? base : `${base}-${index + 1}`;
    const { data } = await supabase
      .from("project_docs")
      .select("id")
      .eq("profile_id", input.profileId)
      .eq("project_id", input.projectId)
      .eq("slug", slug)
      .maybeSingle();

    if (!data) {
      return slug;
    }
  }

  return `${base}-${Date.now()}`;
}

export async function indexDoc(scope: ProjectScope, doc: { readonly content: string; readonly id: string; readonly title: string }) {
  await replaceKnowledgeChunks({
    metadata: { title: doc.title },
    scope,
    sourceId: doc.id,
    sourceType: "doc",
    text: `${doc.title}\n\n${doc.content}`,
  });
}

export async function indexCustomer(scope: ProjectScope, customer: { readonly id: string; readonly name: string; readonly notes: string | null }) {
  await replaceKnowledgeChunks({
    metadata: { name: customer.name },
    scope,
    sourceId: customer.id,
    sourceType: "customer",
    text: `${customer.name}\n\n${customer.notes ?? ""}`,
  });
}

export async function indexMemory(scope: ProjectScope, memory: { readonly id: string; readonly key: string; readonly value: string }) {
  await replaceKnowledgeChunks({
    metadata: { key: memory.key },
    scope,
    sourceId: memory.id,
    sourceType: "memory",
    text: `${memory.key}: ${memory.value}`,
  });
}

export async function indexAsset(scope: ProjectScope, asset: { readonly extractedText: string; readonly filename: string; readonly id: string }) {
  await replaceKnowledgeChunks({
    metadata: { filename: asset.filename },
    scope,
    sourceId: asset.id,
    sourceType: "asset",
    text: asset.extractedText,
  });
}

export async function createSignedAssetUrl(storagePath: string) {
  const { supabase } = await getAuthedSupabase();
  const storageClient = createAdminClient() ?? supabase;
  const { data, error } = await storageClient.storage
    .from(PROJECT_ASSETS_BUCKET)
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function attendWorkItemAction(formData: FormData) {
  return runProjectAction<ProjectWorkItem>(async () => {
    const { supabase, user } = await getAuthedSupabase();
    const project = await requireActionProject();
    const projectId = project.id;
    const itemId = asString(formData.get("itemId"));

    if (!itemId) {
      throw new Error("Choose a suggestion to attend.");
    }

    const inboxColumnId = await requirePipelineColumn({
      key: "inbox",
      profileId: user.id,
      projectId,
      supabase,
    });
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("project_work_items")
      .update({
        attended_at: now,
        stage_id: inboxColumnId,
        status: "accepted",
      })
      .eq("profile_id", user.id)
      .eq("project_id", projectId)
      .eq("id", itemId)
      .in("status", ["suggested", "accepted", "in_progress"])
      .select(WORK_ITEM_FIELDS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logProjectActivity({
      actorId: user.id,
      actorType: "user",
      eventType: "work_item.attended",
      profileId: user.id,
      projectId,
      resourceId: itemId,
      resourceType: "work_item",
    });

    revalidatePath("/dashboard");
    return actionSuccess("Suggestion attended.", { data: data as ProjectWorkItem });
  });
}

export async function completeWorkItemAction(formData: FormData) {
  return runProjectAction<ProjectWorkItem>(async () => {
    const { supabase, user } = await getAuthedSupabase();
    const project = await requireActionProject();
    const projectId = project.id;
    const itemId = asString(formData.get("itemId"));

    if (!itemId) {
      throw new Error("Choose a work item to complete.");
    }

    const doneColumnId = await requirePipelineColumn({
      key: "done",
      profileId: user.id,
      projectId,
      supabase,
    });
    const { data, error } = await supabase
      .from("project_work_items")
      .update({
        completed_at: new Date().toISOString(),
        stage_id: doneColumnId,
        status: "completed",
      })
      .eq("profile_id", user.id)
      .eq("project_id", projectId)
      .eq("id", itemId)
      .select(WORK_ITEM_FIELDS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logProjectActivity({
      actorId: user.id,
      actorType: "user",
      eventType: "work_item.completed",
      profileId: user.id,
      projectId,
      resourceId: itemId,
      resourceType: "work_item",
    });

    revalidatePath("/dashboard");
    return actionSuccess("Work item completed.", { data: data as ProjectWorkItem });
  });
}

export async function dismissWorkItemAction(formData: FormData) {
  return runProjectAction<ProjectWorkItem>(async () => {
    const { supabase, user } = await getAuthedSupabase();
    const project = await requireActionProject();
    const projectId = project.id;
    const itemId = asString(formData.get("itemId"));

    if (!itemId) {
      throw new Error("Choose a work item to dismiss.");
    }

    const { data, error } = await supabase
      .from("project_work_items")
      .update({
        dismissed_at: new Date().toISOString(),
        status: "dismissed",
      })
      .eq("profile_id", user.id)
      .eq("project_id", projectId)
      .eq("id", itemId)
      .select(WORK_ITEM_FIELDS)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    await logProjectActivity({
      actorId: user.id,
      actorType: "user",
      eventType: "work_item.dismissed",
      profileId: user.id,
      projectId,
      resourceId: itemId,
      resourceType: "work_item",
    });

    revalidatePath("/dashboard");
    return actionSuccess("Work item dismissed.", { data: data as ProjectWorkItem });
  });
}

export async function reorderWorkItemsAction(formData: FormData) {
  return runProjectAction<ProjectWorkItem[]>(async () => {
    const { supabase, user } = await getAuthedSupabase();
    const project = await requireActionProject();
    const projectId = project.id;
    const columns = parseReorderPayload(formData.get("columns"));
    const stageIds = columns.map((column) => column.stageId);
    const itemIds = columns.flatMap((column) => column.itemIds);

    if (!stageIds.length) {
      throw new Error("Board columns are required.");
    }

    const { data: validColumns, error: columnsError } = await supabase
      .from("project_pipeline_columns")
      .select("id")
      .eq("profile_id", user.id)
      .eq("project_id", projectId)
      .in("id", stageIds);

    if (columnsError) {
      throw new Error(columnsError.message);
    }

    if ((validColumns ?? []).length !== new Set(stageIds).size) {
      throw new Error("Board column is not valid.");
    }

    const updates = columns.flatMap((column) =>
      column.itemIds.map((itemId, position) => ({
        itemId,
        position,
        stageId: column.stageId,
      })),
    );

    for (const update of updates) {
      const { error } = await supabase
        .from("project_work_items")
        .update({
          position: update.position,
          stage_id: update.stageId,
        })
        .eq("profile_id", user.id)
        .eq("project_id", projectId)
        .eq("id", update.itemId);

      if (error) {
        throw new Error(error.message);
      }
    }

    const { data, error } = itemIds.length
      ? await supabase
          .from("project_work_items")
          .select(WORK_ITEM_FIELDS)
          .eq("profile_id", user.id)
          .eq("project_id", projectId)
          .in("id", itemIds)
      : { data: [], error: null };

    if (error) {
      throw new Error(error.message);
    }

    await logProjectActivity({
      actorId: user.id,
      actorType: "user",
      details: { itemCount: itemIds.length },
      eventType: "work_item.reordered",
      profileId: user.id,
      projectId,
      resourceType: "work_item",
    });

    revalidatePath("/dashboard");
    return actionSuccess("Pipeline updated.", {
      data: (data ?? []) as ProjectWorkItem[],
    });
  });
}

export async function createRosterTaskAction(formData: FormData) {
  return runProjectAction<ProjectRosterTask>(async () => {
    const project = await requireActionProject();
    const task = await createProjectRosterTask({
      deliveryConfig: parseRosterDeliveryConfig(formData),
      enabled: parseBooleanInput(formData.get("enabled"), true),
      jobType: "project_checkup",
      metadata: { tags: parseRosterTags(formData.get("tags")) },
      projectId: project.id,
      scheduleConfig: parseRosterSchedule(formData),
      taskConfig: parseRosterTaskConfig(formData),
      timezone: asString(formData.get("timezone")) || "UTC",
      title: asString(formData.get("title")) || "Project checkup",
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess("Roster task created.", { data: task });
  });
}

export async function updateRosterTaskAction(formData: FormData) {
  return runProjectAction<ProjectRosterTask>(async () => {
    const project = await requireActionProject();
    const taskId = asString(formData.get("taskId"));

    if (!taskId) {
      throw new Error("Roster task id is required.");
    }

    const task = await updateProjectRosterTask({
      deliveryConfig: parseRosterDeliveryConfig(formData),
      enabled: parseBooleanInput(formData.get("enabled"), false),
      jobType: "project_checkup",
      metadata: { tags: parseRosterTags(formData.get("tags")) },
      projectId: project.id,
      scheduleConfig: parseRosterSchedule(formData),
      taskConfig: parseRosterTaskConfig(formData),
      taskId,
      timezone: asString(formData.get("timezone")) || "UTC",
      title: asString(formData.get("title")) || "Project checkup",
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess("Roster task updated.", { data: task });
  });
}

export async function moveRosterTaskAction(formData: FormData) {
  return runProjectAction<ProjectRosterTask>(async () => {
    const project = await requireActionProject();
    const taskId = asString(formData.get("taskId"));
    const dayOfWeek = parseInteger(formData.get("dayOfWeek"), 1);
    const localTime = asString(formData.get("localTime"));

    if (!taskId || !localTime) {
      throw new Error("Roster task id and schedule time are required.");
    }

    const task = await updateProjectRosterTask({
      projectId: project.id,
      scheduleConfig: {
        version: 1,
        kind: "weekly",
        day_of_week: dayOfWeek,
        local_time: localTime,
      },
      taskId,
      timezone: asString(formData.get("timezone")) || undefined,
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess("Roster task rescheduled.", { data: task });
  });
}

export async function toggleRosterTaskEnabledAction(formData: FormData) {
  return runProjectAction<ProjectRosterTask>(async () => {
    const project = await requireActionProject();
    const taskId = asString(formData.get("taskId"));
    const enabled = parseBooleanInput(formData.get("enabled"), false);

    if (!taskId) {
      throw new Error("Roster task id is required.");
    }

    const task = await updateProjectRosterTask({
      enabled,
      projectId: project.id,
      taskId,
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess(enabled ? "Roster task resumed." : "Roster task paused.", {
      data: task,
    });
  });
}

export async function deleteRosterTaskAction(formData: FormData) {
  return runProjectAction<ProjectRosterTask>(async () => {
    const project = await requireActionProject();
    const taskId = asString(formData.get("taskId"));

    if (!taskId) {
      throw new Error("Roster task id is required.");
    }

    const task = await deleteProjectRosterTask({
      projectId: project.id,
      taskId,
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess("Roster task deleted.", { data: task });
  });
}

export async function runRosterTaskNowAction(formData: FormData) {
  return runProjectAction<{
    job: ProjectAgentJob;
    run: ProjectAutomationRun;
    task: ProjectRosterTask;
  }>(async () => {
    const project = await requireActionProject();
    const taskId = asString(formData.get("taskId"));

    if (!taskId) {
      throw new Error("Roster task id is required.");
    }

    const result = await enqueueProjectRosterTaskNow({
      projectId: project.id,
      taskId,
    });

    revalidatePath("/dashboard/roster");
    return actionSuccess("Roster task queued.", { data: result });
  });
}

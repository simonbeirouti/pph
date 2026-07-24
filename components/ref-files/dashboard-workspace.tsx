"use client";

import { move } from "@dnd-kit/helpers";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightIcon,
  CheckIcon,
  XIcon,
} from "@eva/ui/components/icons";
import * as React from "react";
import {
  attendWorkItemAction,
  completeWorkItemAction,
  dismissWorkItemAction,
  reorderWorkItemsAction,
} from "@/app/dashboard/project-actions";
import { LocalizedDate } from "@/components/localized-date";
import { Button } from "@eva/ui/components/button";
import { useActionMutation } from "@/hooks/use-action-mutation";
import type {
  ProjectPipelineColumn,
  ProjectWorkItem,
} from "@/lib/project-data";
import {
  pipelineColumnsQueryKey,
  workItemsQueryKey,
} from "@/lib/query/keys";
import { cn } from "@eva/ui/lib/utils";
import { toast } from "@eva/ui/components/sonner";

type BoardItems = Record<string, ProjectWorkItem[]>;

const ACTIVE_STATUSES = new Set(["suggested", "accepted", "in_progress"]);
const PIPELINE_STATUSES = new Set(["accepted", "in_progress", "completed"]);
const TODAY_STATUSES = new Set(["accepted", "in_progress"]);
const PRIORITY_LABELS: Record<string, string> = {
  high: "High",
  low: "Low",
  normal: "Normal",
  urgent: "Urgent",
};

function byPipelinePosition(a: ProjectWorkItem, b: ProjectWorkItem) {
  return a.position - b.position || b.updated_at.localeCompare(a.updated_at);
}

function byAttentionRank(a: ProjectWorkItem, b: ProjectWorkItem) {
  return (
    b.rank_score - a.rank_score ||
    priorityRank(b.priority) - priorityRank(a.priority) ||
    dueRank(a) - dueRank(b) ||
    b.updated_at.localeCompare(a.updated_at)
  );
}

function priorityRank(priority: string) {
  if (priority === "urgent") return 3;
  if (priority === "high") return 2;
  if (priority === "normal") return 1;
  return 0;
}

function dueRank(item: ProjectWorkItem) {
  return item.due_at ? new Date(item.due_at).getTime() : Number.MAX_SAFE_INTEGER;
}

function isDueToday(item: ProjectWorkItem) {
  if (!item.due_at) return false;
  const due = new Date(item.due_at);
  const now = new Date();

  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

function initialBoard(
  columns: readonly ProjectPipelineColumn[],
  items: readonly ProjectWorkItem[],
) {
  const board = Object.fromEntries(
    columns.map((column) => [column.id, [] as ProjectWorkItem[]]),
  ) as BoardItems;
  const fallbackColumn = columns[0]?.id;

  for (const item of items) {
    if (!PIPELINE_STATUSES.has(item.status)) {
      continue;
    }

    const columnId = item.stage_id && board[item.stage_id] ? item.stage_id : fallbackColumn;

    if (columnId) {
      board[columnId].push(item);
    }
  }

  for (const columnId of Object.keys(board)) {
    board[columnId].sort(byPipelinePosition);
  }

  return board;
}

function flattenBoard(board: BoardItems) {
  return Object.values(board).flat();
}

function mergeWorkItem(items: readonly ProjectWorkItem[], item: ProjectWorkItem) {
  const found = items.some((current) => current.id === item.id);

  if (!found) {
    return [item, ...items];
  }

  return items.map((current) => (current.id === item.id ? item : current));
}

function visibleAttentionItems(items: readonly ProjectWorkItem[]) {
  return items
    .filter((item) => ACTIVE_STATUSES.has(item.status))
    .sort(byAttentionRank);
}

function visibleTodayItems(items: readonly ProjectWorkItem[]) {
  return items
    .filter(
      (item) =>
        TODAY_STATUSES.has(item.status) ||
        isDueToday(item) ||
        item.priority === "urgent",
    )
    .sort(byAttentionRank)
    .slice(0, 8);
}

export function DashboardWorkspace({
  columns,
  initialItems,
  projectId,
}: {
  readonly columns: readonly ProjectPipelineColumn[];
  readonly initialItems: readonly ProjectWorkItem[];
  readonly projectId: string;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = React.useState(() => [...initialItems]);
  const [board, setBoard] = React.useState(() => initialBoard(columns, initialItems));
  const previousBoardRef = React.useRef(board);
  const boardRef = React.useRef(board);
  const reorderRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    const nextItems = [...initialItems];
    const nextBoard = initialBoard(columns, nextItems);
    setItems(nextItems);
    boardRef.current = nextBoard;
    setBoard(nextBoard);
    queryClient.setQueryData(workItemsQueryKey(projectId), nextItems);
    queryClient.setQueryData(pipelineColumnsQueryKey(projectId), [...columns]);
  }, [columns, initialItems, projectId, queryClient]);

  const replaceItem = React.useCallback(
    (item: ProjectWorkItem) => {
      setItems((current) => {
        const next = mergeWorkItem(current, item);
        queryClient.setQueryData(workItemsQueryKey(projectId), next);
        return next;
      });
      const nextBoard = initialBoard(
        columns,
        mergeWorkItem(flattenBoard(boardRef.current), item),
      );
      boardRef.current = nextBoard;
      setBoard(nextBoard);
    },
    [columns, projectId, queryClient],
  );

  const attendMutation = useActionMutation<ProjectWorkItem>({
    action: attendWorkItemAction,
    loadingMessage: "Attending suggestion...",
    onSuccess: (result) => {
      if (result.data) replaceItem(result.data);
    },
  });
  const completeMutation = useActionMutation<ProjectWorkItem>({
    action: completeWorkItemAction,
    loadingMessage: "Completing work item...",
    onSuccess: (result) => {
      if (result.data) replaceItem(result.data);
    },
  });
  const dismissMutation = useActionMutation<ProjectWorkItem>({
    action: dismissWorkItemAction,
    loadingMessage: "Dismissing work item...",
    onSuccess: (result) => {
      if (result.data) replaceItem(result.data);
    },
  });
  const attentionItems = visibleAttentionItems(items);
  const todayItems = visibleTodayItems(items);

  function runItemAction(
    action: "attend" | "complete" | "dismiss",
    itemId: string,
  ) {
    const formData = new FormData();
    formData.set("itemId", itemId);

    if (action === "attend") void attendMutation.run(formData);
    if (action === "complete") void completeMutation.run(formData);
    if (action === "dismiss") void dismissMutation.run(formData);
  }

  function commitBoard(nextBoard: BoardItems) {
    boardRef.current = nextBoard;
    setBoard(nextBoard);
  }

  async function persistBoard(nextBoard: BoardItems, rollbackBoard: BoardItems) {
    const formData = new FormData();
    const requestId = reorderRequestIdRef.current + 1;
    reorderRequestIdRef.current = requestId;

    formData.set(
      "columns",
      JSON.stringify(
        Object.fromEntries(
          columns.map((column) => [
            column.id,
            (nextBoard[column.id] ?? []).map((item) => item.id),
          ]),
        ),
      ),
    );

    let result: Awaited<ReturnType<typeof reorderWorkItemsAction>>;

    try {
      result = await reorderWorkItemsAction(formData);
    } catch {
      if (requestId !== reorderRequestIdRef.current) {
        return;
      }

      boardRef.current = rollbackBoard;
      setBoard(rollbackBoard);
      toast.error("Could not save work-item order.");
      return;
    }

    if (requestId !== reorderRequestIdRef.current) {
      return;
    }

    if (!result.ok) {
      boardRef.current = rollbackBoard;
      setBoard(rollbackBoard);
      toast.error(result.message);
      return;
    }

    if (!result.data) {
      return;
    }

    setItems((current) => {
      const byId = new Map(result.data!.map((item) => [item.id, item]));
      const next = current.map((item) => byId.get(item.id) ?? item);
      queryClient.setQueryData(workItemsQueryKey(projectId), next);
      return next;
    });
  }

  return (
    <div className="grid min-h-0 gap-6 lg:h-full lg:grid-rows-[auto_minmax(0,1fr)]">
      <div className="grid gap-4 lg:grid-cols-3">
        <section
          aria-label="Next best actions"
          className="grid h-72 min-h-0 grid-rows-[auto_1fr] gap-2 lg:col-span-2"
        >
          <div>
            <h2 className="font-medium">Next best actions</h2>
            <p className="text-muted-foreground text-xs">
              Ranked highest to lowest
            </p>
          </div>
          <div className="min-h-0 overflow-y-auto pr-1">
            {attentionItems.length ? (
              <div className="grid gap-2 pb-1">
                {attentionItems.map((item) => (
                  <WorkItemRow
                    item={item}
                    key={item.id}
                    onAttend={() => runItemAction("attend", item.id)}
                    onComplete={() => runItemAction("complete", item.id)}
                    onDismiss={() => runItemAction("dismiss", item.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No ranked actions yet"
                text="Suggestions from eva will stay here until they are attended, completed, dismissed, or superseded."
              />
            )}
          </div>
        </section>

        <section
          aria-label="Today"
          className="grid h-72 min-h-0 grid-rows-[auto_1fr] gap-2"
        >
          <div>
            <h2 className="font-medium">Today</h2>
            <p className="text-muted-foreground text-xs">
              Due, urgent, and in motion
            </p>
          </div>
          <div className="min-h-0 overflow-y-auto pr-1">
            {todayItems.length ? (
              <div className="grid gap-2 pb-1">
                {todayItems.map((item) => (
                  <TodayItem
                    item={item}
                    key={item.id}
                    onComplete={() => runItemAction("complete", item.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Nothing needs today’s attention"
                text="Accepted, in-progress, urgent, and due-today work will collect here."
              />
            )}
          </div>
        </section>
      </div>

      <section
        aria-label="Pipeline"
        className="grid min-h-0 gap-3 lg:grid-rows-[auto_minmax(0,1fr)]"
      >
        <div>
          <h2 className="font-medium">Pipeline</h2>
          <p className="text-muted-foreground text-sm">
            Move accepted work through the project board.
          </p>
        </div>
        <DragDropProvider
          onDragStart={() => {
            previousBoardRef.current = boardRef.current;
          }}
          onDragOver={(event) => {
            const { source } = event.operation;
            if (source?.type !== "work-item") return;
            commitBoard(move(boardRef.current, event) as BoardItems);
          }}
          onDragEnd={(event) => {
            const { source } = event.operation;

            if (event.canceled) {
              commitBoard(previousBoardRef.current);
              return;
            }

            if (source?.type === "work-item") {
              void persistBoard(boardRef.current, previousBoardRef.current);
            }
          }}
        >
          <div className="min-h-0 overflow-x-auto pb-2 lg:h-full">
            <div className="grid min-h-[420px] min-w-[960px] grid-cols-5 gap-3 lg:h-full">
              {columns.map((column) => (
                <PipelineColumn
                  column={column}
                  items={board[column.id] ?? []}
                  key={column.id}
                  onComplete={(itemId) => runItemAction("complete", itemId)}
                />
              ))}
            </div>
          </div>
        </DragDropProvider>
      </section>
    </div>
  );
}

function WorkItemRow({
  item,
  onAttend,
  onComplete,
  onDismiss,
}: {
  readonly item: ProjectWorkItem;
  readonly onAttend: () => void;
  readonly onComplete: () => void;
  readonly onDismiss: () => void;
}) {
  return (
    <div className="rounded-md border bg-card/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-sm">{item.title}</h3>
            <Priority priority={item.priority} />
          </div>
          {item.reason ? (
            <p className="mt-1 text-muted-foreground text-xs">{item.reason}</p>
          ) : null}
          {item.description ? (
            <p className="mt-2 line-clamp-2 text-sm">{item.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label={`Attend ${item.title}`}
            onClick={onAttend}
            size="sm"
            type="button"
          >
            <ArrowRightIcon className="size-4" />
            Attend
          </Button>
          <Button
            aria-label={`Complete ${item.title}`}
            onClick={onComplete}
            size="icon"
            type="button"
            variant="outline"
          >
            <CheckIcon className="size-4" />
          </Button>
          <Button
            aria-label={`Dismiss ${item.title}`}
            onClick={onDismiss}
            size="icon"
            type="button"
            variant="ghost"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function TodayItem({
  item,
  onComplete,
}: {
  readonly item: ProjectWorkItem;
  readonly onComplete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border bg-card/80 p-3 shadow-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-sm">{item.title}</h3>
          <Priority priority={item.priority} />
        </div>
        <p className="mt-1 text-muted-foreground text-xs">
          {item.due_at ? (
            <LocalizedDate
              options={{
                day: "numeric",
                month: "short",
                year: "numeric",
              }}
              value={item.due_at}
            />
          ) : (
            item.status
          )}
        </p>
      </div>
      <Button
        aria-label={`Complete ${item.title}`}
        onClick={onComplete}
        size="icon"
        type="button"
        variant="outline"
      >
        <CheckIcon className="size-4" />
      </Button>
    </div>
  );
}

function PipelineColumn({
  column,
  items,
  onComplete,
}: {
  readonly column: ProjectPipelineColumn;
  readonly items: readonly ProjectWorkItem[];
  readonly onComplete: (itemId: string) => void;
}) {
  const { isDropTarget, ref } = useDroppable({
    accept: "work-item",
    id: column.id,
    type: "column",
  });

  return (
    <div
      aria-label={`${column.title} pipeline column`}
      className={cn(
        "flex min-h-[360px] flex-col rounded-lg border bg-muted/30 lg:min-h-0",
        isDropTarget && "border-primary bg-primary/5",
      )}
      data-drop-target={isDropTarget ? "true" : undefined}
      ref={ref}
      role="region"
    >
      <div className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="font-medium text-sm">{column.title}</h3>
        <span className="text-muted-foreground text-xs">{items.length}</span>
      </div>
      <div className="grid flex-1 content-start gap-2 p-2">
        {items.length ? (
          items.map((item, index) => (
            <PipelineCard
              columnId={column.id}
              index={index}
              item={item}
              key={item.id}
              onComplete={() => onComplete(item.id)}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed bg-background/60 p-3 text-muted-foreground text-sm">
            Drop work here.
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineCard({
  columnId,
  index,
  item,
  onComplete,
}: {
  readonly columnId: string;
  readonly index: number;
  readonly item: ProjectWorkItem;
  readonly onComplete: () => void;
}) {
  const { isDragging, ref } = useSortable({
    accept: "work-item",
    group: "project-pipeline",
    id: item.id,
    index,
    transition: null,
    type: "work-item",
  });

  return (
    <div
      aria-label={`Work item ${item.title}`}
      className={cn(
        "cursor-grab rounded-md border bg-background p-3 shadow-xs active:cursor-grabbing",
        isDragging && "opacity-70",
      )}
      data-column-id={columnId}
      data-dragging={isDragging ? "true" : undefined}
      ref={ref}
      role="article"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium text-sm">{item.title}</h4>
            <Priority priority={item.priority} />
          </div>
          {item.description ? (
            <p className="mt-1 line-clamp-3 text-muted-foreground text-xs">
              {item.description}
            </p>
          ) : null}
        </div>
        <Button
          aria-label={`Complete ${item.title}`}
          onClick={onComplete}
          onPointerDown={(event) => event.stopPropagation()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <CheckIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Priority({ priority }: { readonly priority: string }) {
  return (
    <span
      className={cn(
        "rounded-sm border px-1.5 py-0.5 text-[11px]",
        priority === "urgent" && "border-destructive/30 text-destructive",
        priority === "high" && "border-amber-300 text-amber-700",
        priority === "normal" && "text-muted-foreground",
        priority === "low" && "text-muted-foreground",
      )}
    >
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function EmptyState({
  text,
  title,
}: {
  readonly text: string;
  readonly title: string;
}) {
  return (
    <div className="flex h-full min-h-32 flex-col justify-center rounded-md px-4 text-center">
      <p className="font-medium text-sm">{title}</p>
      <p className="mt-1 text-muted-foreground text-xs">{text}</p>
    </div>
  );
}

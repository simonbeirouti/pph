"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "@eva/ui/components/sonner";
import type { ActionResult } from "@/lib/action-result";

type ActionMutationOptions<TData> = {
  readonly action: (formData: FormData) => Promise<ActionResult<TData>>;
  readonly loadingMessage: string;
  readonly onError?: (message: string) => void;
  readonly onOptimistic?: (formData: FormData) => void;
  readonly onSuccess?: (result: Extract<ActionResult<TData>, { ok: true }>) => void;
  readonly progressToast?: boolean;
  readonly refresh?: boolean;
};

export function useActionMutation<TData = unknown>({
  action,
  loadingMessage,
  onError,
  onOptimistic,
  onSuccess,
  progressToast = true,
  refresh = true,
}: ActionMutationOptions<TData>) {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);

  const run = React.useCallback(
    async (formData: FormData) => {
      if (isPending) {
        return null;
      }

      setIsPending(true);
      onOptimistic?.(formData);
      const toastId = progressToast ? toast.loading(loadingMessage) : undefined;

      try {
        const result = await action(formData);

        if (!result.ok) {
          onError?.(result.message);
          toast.error(result.message, toastId ? { id: toastId } : undefined);
          return result;
        }

        onSuccess?.(result);
        if (progressToast) {
          toast.success(result.message, { id: toastId });
        }

        if (result.redirectTo) {
          router.push(result.redirectTo);
        } else if (refresh) {
          router.refresh();
        }

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong.";
        onError?.(message);
        toast.error(message, toastId ? { id: toastId } : undefined);
        return { ok: false, message } as ActionResult<TData>;
      } finally {
        setIsPending(false);
      }
    },
    [
      action,
      isPending,
      loadingMessage,
      onError,
      onOptimistic,
      onSuccess,
      progressToast,
      refresh,
      router,
    ],
  );

  return { isPending, run };
}

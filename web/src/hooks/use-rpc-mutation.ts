import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { callRpc } from "@/lib/supabase/rpc";

type RpcMutationOptions<TResult> = {
  fn: string;
  successMessage?: string;
  onSuccess?: (result: TResult) => void;
};

export function useRpcMutation<TResult>(options: RpcMutationOptions<TResult>) {
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => callRpc<TResult>(options.fn, params),
    onSuccess: (data) => {
      if (options.successMessage) toast.success(options.successMessage);
      options.onSuccess?.(data as TResult);
    },
    onError: (error) => {
      const e = error as
        | { message?: string; error_description?: string; details?: string; hint?: string }
        | string
        | null;

      const message =
        (typeof e === "string" ? e : e?.message) ??
        (typeof e === "string" ? undefined : e?.error_description) ??
        "잠시 후 다시 시도해 주세요";

      const details = typeof e === "string" ? "" : e?.details ?? "";
      const hint = typeof e === "string" ? "" : e?.hint ?? "";

      // ✅ Next dev overlay 방지: console.error 사용하지 말 것
      if (process.env.NODE_ENV !== "production") {
        console.log("[RPC ERROR]", e);
      }

      toast.error("처리 실패", {
        description: [message, details, hint].filter(Boolean).join(" | "),
      });
    },
  });
}

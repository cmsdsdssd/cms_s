import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { callRpc } from "@/lib/supabase/rpc";

type RpcMutationOptions<TResult> = {
  fn: string;
  successMessage: string;
  onSuccess?: (result: TResult) => void;
};

export function useRpcMutation<TResult>(
  options: RpcMutationOptions<TResult>
) {
  return useMutation({
    mutationFn: (params: Record<string, unknown>) => callRpc<TResult>(options.fn, params),
    onSuccess: (data) => {
      toast.success(options.successMessage);
      options.onSuccess?.(data as TResult);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요";
      toast.error("처리 실패", { description: message });
    },
  });
}

import { useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";

import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

type AppMutationOptions<TData, TError, TVariables, TContext> = UseMutationOptions<
  TData,
  TError,
  TVariables,
  TContext
> & {
  operation: string;
  reference: string;
  successMessage?: string | false;
  invalidate?: QueryKey[];
};

export function useAppMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>({
  operation,
  reference,
  successMessage = "Your changes were saved.",
  invalidate = [],
  onSuccess,
  onError,
  ...options
}: AppMutationOptions<TData, TError, TVariables, TContext>): UseMutationResult<
  TData,
  TError,
  TVariables,
  TContext
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mutationRef = useRef<UseMutationResult<TData, TError, TVariables, TContext> | null>(null);

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await onSuccess?.(data, variables, onMutateResult, context);
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      if (successMessage) {
        toast({ title: operation, description: successMessage });
      }
    },
    onError: (error, variables, onMutateResult, context) => {
      onError?.(error, variables, onMutateResult, context);
      toast({
        title: `Couldn't ${operation.toLowerCase()}`,
        description: `Nothing was changed. Try again or contact support with reference ${reference}.`,
        variant: "destructive",
        duration: 30_000,
        action: (
          <ToastAction
            altText={`Retry ${operation}`}
            onClick={() => mutationRef.current?.mutate(variables)}
          >
            Try again
          </ToastAction>
        ),
      });
    },
  });

  mutationRef.current = mutation;
  return mutation;
}

import {
  queryOptions,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { listSubscribers, listReaders, deleteSubscriber, type ListParams } from "./api";

export const subscribersQueryOptions = (params: ListParams) =>
  queryOptions({
    queryKey: ["subscribers", params] as const,
    queryFn: ({ signal }) => listSubscribers(params, signal),
    placeholderData: keepPreviousData,
  });

export const readersQueryOptions = (params: ListParams) =>
  queryOptions({
    queryKey: ["readers", params] as const,
    queryFn: ({ signal }) => listReaders(params, signal),
    placeholderData: keepPreviousData,
  });

export const useSubscribersSuspense = (params: ListParams) =>
  useSuspenseQuery(subscribersQueryOptions(params));
export const useReadersSuspense = (params: ListParams) =>
  useSuspenseQuery(readersQueryOptions(params));

export function useDeleteSubscriber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSubscriber(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["subscribers"] }),
  });
}

import { trpc } from "@/utils/trpc";

export function useTrajectory(runId: string) {
  return trpc.trajectory.get.useQuery({ runId, format: "atif" });
}

export function useTrajectoryRefresh() {
  const utils = trpc.useUtils();
  const mutation = trpc.trajectory.refresh.useMutation({
    onSuccess: (_data, vars) => {
      void utils.trajectory.get.invalidate(vars);
    },
  });
  return mutation;
}

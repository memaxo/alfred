"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { trpc } from "@/utils/trpc";

type Team = { id: string; name: string; key: string };
type WorkflowState = {
  id: string;
  name: string;
  color: string;
  type: string;
  position: number;
};

type LinearContextValue = {
  isConnected: boolean;
  isExpired: boolean;
  isLoading: boolean;
  teams: Team[];
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  workflowStates: WorkflowState[];
  stateFilter: string | null;
  setStateFilter: (state: string | null) => void;
  refetchAll: () => void;
};

const LinearContext = createContext<LinearContextValue | null>(null);

export function LinearProvider({ children }: { children: ReactNode }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const statusQuery = trpc.linear.getStatus.useQuery();
  const teamsQuery = trpc.linear.teams.useQuery(undefined, {
    enabled: statusQuery.data?.connected === true,
  });
  const statesQuery = trpc.linear.workflowStates.useQuery(
    { teamId: selectedTeamId ?? undefined },
    { enabled: statusQuery.data?.connected === true }
  );

  const utils = trpc.useUtils();

  const refetchAll = useCallback(() => {
    utils.linear.issuesList.invalidate();
    utils.linear.boardView.invalidate();
    utils.linear.teams.invalidate();
    utils.linear.workflowStates.invalidate();
  }, [utils]);

  const value = useMemo<LinearContextValue>(
    () => ({
      isConnected: statusQuery.data?.connected === true,
      isExpired:
        statusQuery.data?.connected === true && statusQuery.data.isExpired,
      isLoading: statusQuery.isLoading,
      teams: teamsQuery.data?.teams ?? [],
      selectedTeamId,
      setSelectedTeamId,
      workflowStates: statesQuery.data?.states ?? [],
      stateFilter,
      setStateFilter,
      refetchAll,
    }),
    [
      statusQuery.data,
      statusQuery.isLoading,
      teamsQuery.data,
      selectedTeamId,
      statesQuery.data,
      stateFilter,
      refetchAll,
    ]
  );

  return (
    <LinearContext.Provider value={value}>{children}</LinearContext.Provider>
  );
}

export function useLinear() {
  const ctx = useContext(LinearContext);
  if (!ctx) {
    throw new Error("useLinear must be used within LinearProvider");
  }
  return ctx;
}

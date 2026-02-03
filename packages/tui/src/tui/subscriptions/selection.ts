export interface SelectionState {
  runId: string | null;
}

export type SelectionListener = (state: SelectionState) => void;
export type SelectionUnsubscribe = () => void;

export class SelectionStore {
  private state: SelectionState = { runId: null };
  private readonly listeners = new Set<SelectionListener>();

  get(): SelectionState {
    return { ...this.state };
  }

  getRunId(): string | null {
    return this.state.runId;
  }

  setRunId(runId: string | null): void {
    const next = runId && runId.length > 0 ? runId : null;
    if (next === this.state.runId) {
      return;
    }
    this.state = { runId: next };
    for (const listener of this.listeners) {
      try {
        listener({ ...this.state });
      } catch {
        // ignore listener errors
      }
    }
  }

  subscribe(listener: SelectionListener): SelectionUnsubscribe {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export function createSelectionStore(): SelectionStore {
  return new SelectionStore();
}

import type { EventEnvelope } from "./envelope";
import type { EventId } from "./id";

/**
 * CausalGraph builds a directed acyclic graph (DAG) of system events
 * based on their parentId links. Enables efficient causal queries.
 */
export class CausalGraph {
  private readonly events: Map<EventId, EventEnvelope> = new Map();
  private readonly children: Map<EventId, Set<EventId>> = new Map();

  constructor(events: EventEnvelope[] = []) {
    for (const event of events) {
      this.addEvent(event);
    }
  }

  /**
   * Add an event to the graph
   */
  addEvent(event: EventEnvelope): void {
    this.events.set(event.id, event);
    if (event.parentId) {
      let children = this.children.get(event.parentId);
      if (!children) {
        children = new Set();
        this.children.set(event.parentId, children);
      }
      children.add(event.id);
    }
  }

  /**
   * Get an event by its ID
   */
  getEvent(id: EventId): EventEnvelope | undefined {
    return this.events.get(id);
  }

  /**
   * Get immediate children of an event
   */
  getChildren(id: EventId): EventEnvelope[] {
    const ids = this.children.get(id);
    if (!ids) {
      return [];
    }
    return [...ids]
      .map((childId) => this.events.get(childId))
      .filter((e): e is EventEnvelope => !!e);
  }

  /**
   * Get all descendants of an event (recursive)
   */
  getDescendants(id: EventId): EventEnvelope[] {
    const results: EventEnvelope[] = [];
    const stack = [id];
    const seen = new Set<EventId>();

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId || seen.has(currentId)) {
        continue;
      }
      seen.add(currentId);

      const children = this.children.get(currentId);
      if (children) {
        for (const childId of children) {
          const event = this.events.get(childId);
          if (event) {
            results.push(event);
            stack.push(childId);
          }
        }
      }
    }

    return results;
  }

  /**
   * Get all ancestors of an event (recursive)
   */
  getAncestors(id: EventId): EventEnvelope[] {
    const results: EventEnvelope[] = [];
    let current = this.events.get(id);

    while (current?.parentId) {
      const parent = this.events.get(current.parentId);
      if (parent) {
        results.push(parent);
        current = parent;
      } else {
        break; // Parent not in graph
      }
    }

    return results;
  }

  /**
   * Get the root of the causal chain for an event
   */
  getRoot(id: EventId): EventEnvelope | undefined {
    const ancestors = this.getAncestors(id);
    return ancestors.length > 0 ? ancestors.at(-1) : this.getEvent(id);
  }
}

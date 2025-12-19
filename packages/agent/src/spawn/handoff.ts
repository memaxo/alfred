/**
 * Wave state handoff mechanism for poof-isolated agents.
 *
 * Tracks upper directories from completed waves so synthesis agents
 * can inspect and merge changes from prior waves.
 */

import type { AgentId, WaveId } from "../orchestrator/multi/spawn.js";
import type { PoofChange, PoofChangeSummary } from "./diff.js";
import {
  applyUpperLayer,
  formatChanges,
  generateDiff,
  parseUpperLayer,
  summarizeChanges,
} from "./diff.js";

/** Result of a wave agent's execution */
export type WaveAgentResult = {
  agentId: AgentId;
  upperDir: string | null;
  exitCode: number;
  timedOut: boolean;
  durationMs: number;
};

/** State of a completed wave */
export type WaveState = {
  waveId: WaveId;
  agents: Map<AgentId, WaveAgentResult>;
  startTime: number;
  endTime: number;
};

/**
 * Tracks state across waves for synthesis agent handoff.
 */
export class WaveHandoff {
  private readonly waves = new Map<WaveId, WaveState>();
  private readonly targetDir: string;

  constructor(targetDir: string) {
    this.targetDir = targetDir;
  }

  /**
   * Record a wave's completion.
   */
  recordWave(
    waveId: WaveId,
    agents: WaveAgentResult[],
    startTime: number,
    endTime: number
  ): void {
    const agentMap = new Map<AgentId, WaveAgentResult>();
    for (const agent of agents) {
      agentMap.set(agent.agentId, agent);
    }
    this.waves.set(waveId, {
      waveId,
      agents: agentMap,
      startTime,
      endTime,
    });
  }

  /**
   * Get all completed waves.
   */
  getWaves(): WaveState[] {
    return Array.from(this.waves.values());
  }

  /**
   * Get a specific wave's state.
   */
  getWave(waveId: WaveId): WaveState | undefined {
    return this.waves.get(waveId);
  }

  /**
   * Get all upper directories from prior waves.
   */
  getAllUpperDirs(): Map<AgentId, string> {
    const result = new Map<AgentId, string>();
    for (const wave of this.waves.values()) {
      for (const [agentId, agent] of wave.agents) {
        if (agent.upperDir) {
          result.set(agentId, agent.upperDir);
        }
      }
    }
    return result;
  }

  /**
   * Get changes from a specific agent's upper directory.
   */
  async getAgentChanges(agentId: AgentId): Promise<PoofChange[]> {
    for (const wave of this.waves.values()) {
      const agent = wave.agents.get(agentId);
      if (agent?.upperDir) {
        return parseUpperLayer(agent.upperDir, this.targetDir);
      }
    }
    return [];
  }

  /**
   * Get aggregated changes from all agents in a wave.
   */
  async getWaveChanges(waveId: WaveId): Promise<Map<AgentId, PoofChange[]>> {
    const result = new Map<AgentId, PoofChange[]>();
    const wave = this.waves.get(waveId);
    if (!wave) {
      return result;
    }

    for (const [agentId, agent] of wave.agents) {
      if (agent.upperDir) {
        const changes = await parseUpperLayer(agent.upperDir, this.targetDir);
        result.set(agentId, changes);
      }
    }
    return result;
  }

  /**
   * Get summary of all changes across all waves.
   */
  async getAllChangesSummary(): Promise<Map<AgentId, PoofChangeSummary>> {
    const result = new Map<AgentId, PoofChangeSummary>();
    for (const wave of this.waves.values()) {
      for (const [agentId, agent] of wave.agents) {
        if (agent.upperDir) {
          const changes = await parseUpperLayer(agent.upperDir, this.targetDir);
          result.set(agentId, summarizeChanges(changes));
        }
      }
    }
    return result;
  }

  /**
   * Generate a unified diff from a specific agent.
   */
  async getAgentDiff(agentId: AgentId): Promise<string | null> {
    for (const wave of this.waves.values()) {
      const agent = wave.agents.get(agentId);
      if (agent?.upperDir) {
        return generateDiff(agent.upperDir, this.targetDir);
      }
    }
    return null;
  }

  /**
   * Apply changes from a specific agent to the target directory.
   */
  async applyAgentChanges(agentId: AgentId): Promise<boolean> {
    for (const wave of this.waves.values()) {
      const agent = wave.agents.get(agentId);
      if (agent?.upperDir) {
        await applyUpperLayer(agent.upperDir, this.targetDir);
        return true;
      }
    }
    return false;
  }

  /**
   * Apply changes from all agents in a wave.
   * Order is not guaranteed; conflicts may occur.
   */
  async applyWaveChanges(waveId: WaveId): Promise<number> {
    const wave = this.waves.get(waveId);
    if (!wave) {
      return 0;
    }

    let applied = 0;
    for (const [_agentId, agent] of wave.agents) {
      if (agent.upperDir) {
        await applyUpperLayer(agent.upperDir, this.targetDir);
        applied++;
      }
    }
    return applied;
  }

  /**
   * Generate a report of all changes for synthesis review.
   */
  async generateSynthesisReport(): Promise<string> {
    const lines: string[] = ["# Wave Changes Report", ""];

    for (const wave of this.waves.values()) {
      const durationMs = wave.endTime - wave.startTime;
      lines.push(`## ${wave.waveId} (${durationMs}ms)`);
      lines.push("");

      for (const [agentId, agent] of wave.agents) {
        lines.push(`### Agent: ${agentId}`);
        lines.push(`- Exit code: ${agent.exitCode}`);
        lines.push(`- Duration: ${agent.durationMs}ms`);
        if (agent.timedOut) {
          lines.push("- **TIMED OUT**");
        }

        if (agent.upperDir) {
          lines.push(`- Upper dir: ${agent.upperDir}`);
          const changes = await parseUpperLayer(agent.upperDir, this.targetDir);
          if (changes.length > 0) {
            lines.push("- Changes:");
            lines.push("```");
            lines.push(formatChanges(changes));
            lines.push("```");
          } else {
            lines.push("- No changes");
          }
        } else {
          lines.push("- No upper directory (ephemeral mode)");
        }
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Detect conflicts between agents (files modified by multiple agents).
   */
  async detectConflicts(): Promise<Map<string, AgentId[]>> {
    const fileToAgents = new Map<string, AgentId[]>();

    for (const wave of this.waves.values()) {
      for (const [agentId, agent] of wave.agents) {
        if (agent.upperDir) {
          const changes = await parseUpperLayer(agent.upperDir, this.targetDir);
          for (const change of changes) {
            const existing = fileToAgents.get(change.path) ?? [];
            existing.push(agentId);
            fileToAgents.set(change.path, existing);
          }
        }
      }
    }

    // Return only files touched by multiple agents
    const conflicts = new Map<string, AgentId[]>();
    for (const [filePath, agents] of fileToAgents) {
      if (agents.length > 1) {
        conflicts.set(filePath, agents);
      }
    }
    return conflicts;
  }

  /**
   * Clear recorded wave state.
   */
  clear(): void {
    this.waves.clear();
  }
}

/**
 * Create a wave handoff tracker.
 */
export function createWaveHandoff(targetDir: string): WaveHandoff {
  return new WaveHandoff(targetDir);
}

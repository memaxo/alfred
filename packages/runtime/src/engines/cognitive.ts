/**
 * Cognitive Engine Wrapper
 *
 * Wraps pure cognitive state functions from @alfred/cognitive
 * Provides runtime context around domain functions without adding side effects
 */

import {
  type AutonomyGradient,
  type CognitiveState,
  capturing,
  type Decision,
  deciding,
  executing,
  idle,
  type Outcome,
  type Plan,
  reflecting,
  thinking,
} from "@alfred/cognitive/state";

/**
 * CognitiveEngine provides domain function wrappers
 *
 * All methods are pure - they call domain functions and return results.
 * No side effects, no persistence, no metrics.
 */
export class CognitiveEngine {
  /**
   * Transition to idle state
   */
  idle(): CognitiveState {
    return idle();
  }

  /**
   * Transition to capturing state (understanding input)
   */
  capture(input: string, conf = 0.8): CognitiveState {
    return capturing(input, conf);
  }

  /**
   * Transition to thinking state (exploring options)
   */
  think(about: string, depth = 1, traces?: string[]): CognitiveState {
    return thinking(about, depth, traces);
  }

  /**
   * Transition to deciding state (choosing option)
   */
  decide(options: Decision[], criteria?: any): CognitiveState {
    return deciding(options, criteria);
  }

  /**
   * Transition to executing state (running plan)
   */
  execute(plan: Plan, auto: AutonomyGradient): CognitiveState {
    return executing(plan, auto);
  }

  /**
   * Transition to reflecting state (analyzing outcome)
   */
  reflect(outcome: Outcome, expected: string, actual: string): CognitiveState {
    return reflecting(outcome, expected, actual);
  }
}

/**
 * CarPlay NowPlaying Remote Commands
 *
 * Handles remote control commands from CarPlay/Control Center.
 * Maps transport controls to workflow actions.
 *
 * Commands:
 * - Play/Pause: Resume/pause TTS updates
 * - Next Track: Speak current status
 * - Previous Track: Replay last update
 */

import { useCarPlayStore } from "../store";
import { speakWorkflowUpdate } from "../voice/speech";

export type RemoteCommandHandlers = {
  onSpeak: (text: string) => Promise<void>;
  onPauseUpdates: () => void;
  onResumeUpdates: () => void;
};

let handlers: RemoteCommandHandlers | null = null;
let isPaused = false;
let lastSpokenText = "";
let activeWorkflowId: string | null = null;

/**
 * Initialize remote command handlers.
 */
export function initRemoteCommands(config: RemoteCommandHandlers): void {
  handlers = config;
}

/**
 * Set the active workflow for remote commands.
 */
export function setActiveWorkflow(workflowId: string | null): void {
  activeWorkflowId = workflowId;
}

/**
 * Handle play command - resume TTS updates.
 */
export async function handlePlayCommand(): Promise<void> {
  isPaused = false;
  handlers?.onResumeUpdates();

  // Speak current status
  await speakCurrentStatus();
}

/**
 * Handle pause command - pause TTS updates.
 */
export function handlePauseCommand(): void {
  isPaused = true;
  handlers?.onPauseUpdates();
}

/**
 * Handle play/pause toggle.
 */
export async function handlePlayPauseCommand(): Promise<void> {
  if (isPaused) {
    await handlePlayCommand();
  } else {
    handlePauseCommand();
  }
}

/**
 * Handle next track command - speak current status.
 */
export async function handleNextTrackCommand(): Promise<void> {
  await speakCurrentStatus();
}

/**
 * Handle previous track command - replay last update.
 */
export async function handlePreviousTrackCommand(): Promise<void> {
  if (lastSpokenText && handlers?.onSpeak) {
    await handlers.onSpeak(lastSpokenText);
  }
}

/**
 * Check if updates are paused.
 */
export function isUpdatesPaused(): boolean {
  return isPaused;
}

/**
 * Speak a workflow update (if not paused).
 */
export async function speakUpdate(text: string): Promise<void> {
  if (isPaused) {
    return;
  }

  lastSpokenText = text;
  await handlers?.onSpeak(text);
}

/**
 * Speak current workflow status.
 */
async function speakCurrentStatus(): Promise<void> {
  if (!activeWorkflowId) {
    await handlers?.onSpeak("No active workflow.");
    return;
  }

  const store = useCarPlayStore.getState();
  const workflow = store.workflows.get(activeWorkflowId);

  if (!workflow) {
    await handlers?.onSpeak("Workflow not found.");
    return;
  }

  const statusText = speakWorkflowUpdate(workflow, "progress");
  lastSpokenText = statusText;
  await handlers?.onSpeak(statusText);
}

/**
 * Cleanup remote command handlers.
 */
export function cleanupRemoteCommands(): void {
  handlers = null;
  isPaused = false;
  lastSpokenText = "";
  activeWorkflowId = null;
}

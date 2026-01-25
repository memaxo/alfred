/**
 * CarPlay NowPlaying Info Center
 *
 * Manages NowPlayingTemplate for workflow status display.
 * Shows current workflow as "Now Playing" with buttons.
 *
 * NOTE: react-native-carplay's NowPlayingTemplate does not expose
 * MPNowPlayingInfoCenter directly. For full Now Playing metadata
 * (album art, progress bar, elapsed time), native module integration
 * would be required. This implementation provides the template UI
 * with button controls.
 *
 * Uses react-native-carplay's NowPlayingTemplate.
 */

import { NowPlayingTemplate } from "react-native-carplay";

import type { WorkflowState } from "../types";

import { useCarPlayStore } from "../store";

export interface NowPlayingConfig {
  onPlayPause?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onMorePressed?: () => void;
}

export interface NowPlayingInfo {
  workflowId: string;
  title: string;
  status: WorkflowState["status"];
  progress: number;
  currentTask?: string;
}

let currentTemplate: NowPlayingTemplate | null = null;
let currentInfo: NowPlayingInfo | null = null;
let updateInterval: ReturnType<typeof setInterval> | null = null;
let infoChangeCallback: ((info: NowPlayingInfo) => void) | null = null;

/**
 * Create and configure the NowPlaying template for a workflow.
 */
export function createNowPlayingTemplate(
  workflow: WorkflowState,
  config: NowPlayingConfig
): NowPlayingTemplate {
  const template = new NowPlayingTemplate({
    albumArtistButtonEnabled: true,
    upNextButtonEnabled: true,
    upNextButtonTitle: "Status",
    buttons: [
      {
        id: "more",
        type: "more",
      },
    ],
    onButtonPressed: ({ id }) => {
      if (id === "more") {
        config.onMorePressed?.();
      }
    },
    onUpNextButtonPressed: () => {
      config.onNextTrack?.();
    },
    onAlbumArtistButtonPressed: () => {
      config.onPreviousTrack?.();
    },
  });

  // Store initial info
  currentInfo = {
    workflowId: workflow.id,
    title: workflow.requirement,
    status: workflow.status,
    progress: workflow.progress,
    currentTask: workflow.currentTask,
  };

  currentTemplate = template;
  return template;
}

/**
 * Update NowPlaying info with current workflow state.
 * Since we can't directly update MPNowPlayingInfoCenter, this
 * stores the info locally and notifies any listeners.
 */
export function updateNowPlayingInfo(workflow: WorkflowState): void {
  currentInfo = {
    workflowId: workflow.id,
    title: workflow.requirement,
    status: workflow.status,
    progress: workflow.progress,
    currentTask: workflow.currentTask,
  };

  // Notify listeners of info change
  infoChangeCallback?.(currentInfo);
}

/**
 * Subscribe to NowPlaying info changes.
 */
export function onNowPlayingInfoChange(
  callback: (info: NowPlayingInfo) => void
): () => void {
  infoChangeCallback = callback;

  // Return unsubscribe function
  return () => {
    infoChangeCallback = null;
  };
}

/**
 * Get current NowPlaying info.
 */
export function getNowPlayingInfo(): NowPlayingInfo | null {
  return currentInfo;
}

/**
 * Start auto-updating NowPlaying info from store.
 */
export function startNowPlayingUpdates(workflowId: string): void {
  stopNowPlayingUpdates();

  // Update immediately
  const store = useCarPlayStore.getState();
  const workflow = store.workflows.get(workflowId);
  if (workflow) {
    updateNowPlayingInfo(workflow);
  }

  // Update every 5 seconds
  updateInterval = setInterval(() => {
    const store = useCarPlayStore.getState();
    const workflow = store.workflows.get(workflowId);
    if (workflow) {
      updateNowPlayingInfo(workflow);
    } else {
      // Workflow removed, stop updates
      stopNowPlayingUpdates();
    }
  }, 5000);
}

/**
 * Stop auto-updating NowPlaying info.
 */
export function stopNowPlayingUpdates(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
}

/**
 * Clear NowPlaying info and template.
 */
export function clearNowPlaying(): void {
  stopNowPlayingUpdates();
  currentTemplate = null;
  currentInfo = null;
  infoChangeCallback = null;
}

/**
 * Get the current NowPlaying template.
 */
export function getNowPlayingTemplate(): NowPlayingTemplate | null {
  return currentTemplate;
}

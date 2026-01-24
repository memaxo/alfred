import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

import { logError } from "@/lib/devlog";

export const TASK_VOICE_FLUSH = "VOICE_STREAM_FLUSH";
const MIN_INTERVAL_SECONDS = 2 * 60; // 2 minutes (reduced from 15)

let defined = false;

export function registerVoiceTasks(flush: () => Promise<void>): void {
  if (!defined) {
    TaskManager.defineTask(TASK_VOICE_FLUSH, async () => {
      try {
        await flush();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        logError("voice FlushTask", error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
    defined = true;
  }
  BackgroundFetch.registerTaskAsync(TASK_VOICE_FLUSH, {
    minimumInterval: MIN_INTERVAL_SECONDS,
    stopOnTerminate: false,
    startOnBoot: true,
  }).catch((error) => {
    logError("voice RegisterTask", error);
  });
}

export function registerQueueDrain(drainFn: () => Promise<void>): void {
  registerVoiceTasks(drainFn);
}

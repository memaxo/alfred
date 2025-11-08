import * as BackgroundFetch from "expo-background-fetch";
import * as TaskManager from "expo-task-manager";

export const TASK_VOICE_FLUSH = "VOICE_STREAM_FLUSH";
const MIN_INTERVAL_SECONDS = 15 * 60;

let defined = false;

export function registerVoiceTasks(flush: () => Promise<void>): void {
  if (!defined) {
    TaskManager.defineTask(TASK_VOICE_FLUSH, async () => {
      try {
        await flush();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch (error) {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
    defined = true;
  }
  void BackgroundFetch.registerTaskAsync(TASK_VOICE_FLUSH, {
    minimumInterval: MIN_INTERVAL_SECONDS,
    stopOnTerminate: false,
    startOnBoot: true,
  }).catch(() => {});
}

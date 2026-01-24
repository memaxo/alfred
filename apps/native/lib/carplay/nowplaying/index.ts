/**
 * CarPlay NowPlaying Module
 *
 * Provides workflow status display via NowPlayingTemplate.
 * Shows current workflow as "Now Playing" with button controls.
 */

export {
  cleanupRemoteCommands,
  handleNextTrackCommand,
  handlePauseCommand,
  handlePlayCommand,
  handlePlayPauseCommand,
  handlePreviousTrackCommand,
  initRemoteCommands,
  isUpdatesPaused,
  type RemoteCommandHandlers,
  setActiveWorkflow,
  speakUpdate,
} from "./commands";
export {
  clearNowPlaying,
  createNowPlayingTemplate,
  getNowPlayingInfo,
  getNowPlayingTemplate,
  type NowPlayingConfig,
  type NowPlayingInfo,
  onNowPlayingInfoChange,
  startNowPlayingUpdates,
  stopNowPlayingUpdates,
  updateNowPlayingInfo,
} from "./info";

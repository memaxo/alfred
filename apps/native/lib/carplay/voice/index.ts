/**
 * CarPlay Voice Module
 *
 * Voice integration for CarPlay, wiring to ALFRED's existing voice infrastructure.
 */

// Bridge to existing voice session
export {
  type CarPlayVoiceBridge,
  type CarPlayVoiceBridgeConfig,
  type CarPlayVoiceStatus,
  useCarPlayVoice,
} from "./bridge";
// Audio cues
export {
  type AudioCueType,
  playConfirmationCue,
  playCue,
  playErrorCue,
  playListeningCue,
  playNotificationCue,
} from "./cues";
// Voice command handlers
export {
  handleDecisionQuery,
  handleEscalationDecision,
  handlePlanDecision,
  handlePRDecision,
  handleStatusQuery,
  handleWorkflowControl,
  speakNextDecision,
  speakPlanDetails,
  speakPRDetails,
  speakWorkflowDetails,
  type VoiceHandlerResult,
} from "./handlers";
// Intent classification
export {
  type CarPlayIntent,
  classifyCarPlayIntent,
  getHelpText,
  type IntentClassificationResult,
} from "./intent";
// Speech generation
export {
  speakConfirmation,
  speakDecisionQueueSummary,
  speakError,
  speakEscalation,
  speakGreeting,
  speakListeningPrompt,
  speakPlanSummary,
  speakPRSummary,
  speakProcessing,
  speakWorkflowStatus,
  speakWorkflowUpdate,
} from "./speech";

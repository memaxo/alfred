export type { HonorificPreference } from "./honorific.js";
export {
  applyHonorific,
  parseHonorificPreference,
  renderHonorific,
} from "./honorific.js";

export { alfredCharacter } from "./character.js";

export type { PersonaContext, PersonaModality } from "./prompt.js";
export { buildPersonaPrompt } from "./prompt.js";

export type { TimeOfDay, TransitionKind } from "./transitions.js";
export { formatGreeting, getTransition, timeOfDayFromHour } from "./transitions.js";

export { adaptForVoice } from "./voice.js";

export type { PersonaTelemetry } from "./telemetry.js";
export { parsePersonaTelemetry, personaTelemetrySchema } from "./telemetry.js";


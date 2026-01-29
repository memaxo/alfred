import { lazy } from "@trpc/server";

import { protectedProcedure, publicProcedure, router } from "../trpc";
import { adminRouter } from "./admin";
import { agentfsRouter } from "./agentfs";
import { assistantRouter } from "./assistant";
import { attentionRouter } from "./attention";
import { bookRouter } from "./book";
import { capabilityRouter } from "./capability";
import { captureRouter } from "./capture";
import { codexRouter } from "./codex";
import { codexIntentRouter } from "./codex-intent";
import { cognitiveRouter } from "./cognitive";
import { deltaRouter } from "./delta";
import { deployRouter } from "./deploy";
import { droidsRouter } from "./droids";
import { embedRouter } from "./embed";
import { evalRouter } from "./eval";
import { focusRouter } from "./focus";
import { fsRouter } from "./fs";
import { genuiRouter } from "./genui";
import { githubRouter } from "./github";
import { graphRouter } from "./graph";
import { homeRouter } from "./home";
import { inboxRouter } from "./inbox";
import { integrationRouter } from "./integration";
import { jwksRouter } from "./jwks";
import { knowledgeRouter } from "./knowledge";
import { linearRouter } from "./linear";
import { mcpRouter } from "./mcp";
import { metricsRouter } from "./metrics";
import { noteRouter } from "./note";
import { notificationRouter } from "./notification";
import { notifyRouter } from "./notify";
import { orchestratorRouter } from "./orchestrator";
import { planRouter } from "./plan";
import { preferenceRouter } from "./preference";
import { privacyRouter } from "./privacy";
import { profileRouter } from "./profile";
import { projectRouter } from "./project";
import { receiptRouter } from "./receipt";
import { remindRouter } from "./remind";
import { reviewRouter } from "./review";
import { runtimeRouter } from "./runtime";
import { shortcutsRouter } from "./shortcuts";
import { taskRouter } from "./task";
import { terminalRouter } from "./terminal";
import { timerRouter } from "./timer";
import { tokenRouter } from "./token";
import { trajectoryRouter } from "./trajectory";
import { tuneRouter } from "./tune";
import { userRouter } from "./user";
import { visualRouter } from "./visual";
import { voiceRouter } from "./voice";
import { workingsetRouter } from "./workingset";

export const appRouter = router({
  admin: adminRouter,
  agentfs: agentfsRouter,
  assistant: assistantRouter,
  attention: attentionRouter,
  book: bookRouter,
  capture: captureRouter,
  capability: capabilityRouter,
  codex: codexRouter,
  codexIntent: codexIntentRouter,
  cognitive: cognitiveRouter,
  delta: deltaRouter,
  deploy: deployRouter,
  droid: droidsRouter,
  embed: embedRouter,
  eval: evalRouter,
  focus: focusRouter,
  fs: fsRouter,
  genui: genuiRouter,
  github: githubRouter,
  graph: graphRouter,
  healthCheck: publicProcedure.query(() => "OK"),
  home: homeRouter,
  inbox: inboxRouter,
  integration: integrationRouter,
  jwks: jwksRouter,
  knowledge: knowledgeRouter,
  linear: linearRouter,
  mcp: mcpRouter,
  metrics: metricsRouter,
  note: noteRouter,
  notification: notificationRouter,
  notify: notifyRouter,
  orchestrator: orchestratorRouter,
  plan: planRouter,
  preference: preferenceRouter,
  privacy: privacyRouter,
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  profile: profileRouter,
  project: projectRouter,
  receipt: receiptRouter,
  remind: remindRouter,
  review: reviewRouter,
  runtime: runtimeRouter,
  shortcuts: shortcutsRouter,
  task: taskRouter,
  terminal: terminalRouter,
  timer: timerRouter,
  token: tokenRouter,
  trajectory: trajectoryRouter,
  tune: tuneRouter,
  user: userRouter,
  visual: visualRouter,
  voice: voiceRouter,
  workflow: lazy(() => import("./workflow").then((m) => m.workflowRouter)),
  workingset: workingsetRouter,
});
export type AppRouter = typeof appRouter;

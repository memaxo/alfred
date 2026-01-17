import { protectedProcedure, publicProcedure, router } from "../trpc";
import { adminRouter } from "./admin";
import { agentfsRouter } from "./agentfs";
import { assistantRouter } from "./assistant";
import { bookRouter } from "./book";
import { captureRouter } from "./capture";
import { codexRouter } from "./codex";
import { codexIntentRouter } from "./codex-intent";
import { cognitiveRouter } from "./cognitive";
import { deployRouter } from "./deploy";
import { droidsRouter } from "./droids";
import { evalRouter } from "./eval";
import { fsRouter } from "./fs";
import { githubRouter } from "./github";
import { graphRouter } from "./graph";
import { homeRouter } from "./home";
import { inboxRouter } from "./inbox";
import { jwksRouter } from "./jwks";
import { knowledgeRouter } from "./knowledge";
import { linearRouter } from "./linear";
import { mcpRouter } from "./mcp";
import { metricsRouter } from "./metrics";
import { noteRouter } from "./note";
import { orchestratorRouter } from "./orchestrator";
import { planRouter } from "./plan";
import { preferenceRouter } from "./preference";
import { privacyRouter } from "./privacy";
import { profileRouter } from "./profile";
import { projectRouter } from "./project";
import { receiptRouter } from "./receipt";
import { remindRouter } from "./remind";
import { runtimeRouter } from "./runtime";
import { terminalRouter } from "./terminal";
import { timerRouter } from "./timer";
import { todoRouter } from "./todo";
import { tokenRouter } from "./token";
import { trajectoryRouter } from "./trajectory";
import { tuneRouter } from "./tune";
import { userRouter } from "./user";
import { visualRouter } from "./visual";
import { voiceRouter } from "./voice";
import { workflowRouter } from "./workflow";
import { workingsetRouter } from "./workingset";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  agentfs: agentfsRouter,
  admin: adminRouter,
  graph: graphRouter,
  home: homeRouter,
  capture: captureRouter,
  inbox: inboxRouter,
  knowledge: knowledgeRouter,
  user: userRouter,
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  todo: todoRouter,
  note: noteRouter,
  remind: remindRouter,
  timer: timerRouter,
  book: bookRouter,
  codex: codexRouter,
  codexIntent: codexIntentRouter,
  cognitive: cognitiveRouter,
  droid: droidsRouter,
  jwks: jwksRouter,
  token: tokenRouter,
  workflow: workflowRouter,
  eval: evalRouter,
  trajectory: trajectoryRouter,
  deploy: deployRouter,
  linear: linearRouter,
  metrics: metricsRouter,
  mcp: mcpRouter,
  assistant: assistantRouter,
  orchestrator: orchestratorRouter,
  plan: planRouter,
  profile: profileRouter,
  project: projectRouter,
  receipt: receiptRouter,
  preference: preferenceRouter,
  privacy: privacyRouter,
  runtime: runtimeRouter,
  visual: visualRouter,
  voice: voiceRouter,
  workingset: workingsetRouter,
  fs: fsRouter,
  github: githubRouter,
  terminal: terminalRouter,
  tune: tuneRouter,
});
export type AppRouter = typeof appRouter;

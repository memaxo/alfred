import { protectedProcedure, publicProcedure, router } from "../trpc";
import { adminRouter } from "./admin";
import { assistantRouter } from "./assistant";
import { bookRouter } from "./book";
import { codexRouter } from "./codex";
import { codexIntentRouter } from "./codex-intent";
import { cognitiveRouter } from "./cognitive";
import { deployRouter } from "./deploy";
import { droidsRouter } from "./droids";
import { evalRouter } from "./eval";
import { fsRouter } from "./fs";
import { graphRouter } from "./graph";
import { jwksRouter } from "./jwks";
import { knowledgeRouter } from "./knowledge";
import { linearRouter } from "./linear";
import { noteRouter } from "./note";
import { orchestratorRouter } from "./orchestrator";
import { planRouter } from "./plan";
import { preferenceRouter } from "./preference";
import { privacyRouter } from "./privacy";
import { profileRouter } from "./profile";
import { projectRouter } from "./project";
import { remindRouter } from "./remind";
import { terminalRouter } from "./terminal";
import { timerRouter } from "./timer";
import { todoRouter } from "./todo";
import { tokenRouter } from "./token";
import { tuneRouter } from "./tune";
import { userRouter } from "./user";
import { visualRouter } from "./visual";
import { voiceRouter } from "./voice";
import { workflowRouter } from "./workflow";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  admin: adminRouter,
  graph: graphRouter,
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
  deploy: deployRouter,
  linear: linearRouter,
  assistant: assistantRouter,
  orchestrator: orchestratorRouter,
  plan: planRouter,
  profile: profileRouter,
  project: projectRouter,
  preference: preferenceRouter,
  privacy: privacyRouter,
  visual: visualRouter,
  voice: voiceRouter,
  fs: fsRouter,
  terminal: terminalRouter,
  tune: tuneRouter,
});
export type AppRouter = typeof appRouter;

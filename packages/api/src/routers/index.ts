import { protectedProcedure, publicProcedure, router } from "../trpc";
import { assistantRouter } from "./assistant";
import { bookRouter } from "./book";
import { deployRouter } from "./deploy";
import { droidsRouter } from "./droids";
import { evalRouter } from "./eval";
import { jwksRouter } from "./jwks";
import { linearRouter } from "./linear";
import { noteRouter } from "./note";
import { orchestratorRouter } from "./orchestrator";
import { preferenceRouter } from "./preference";
import { privacyRouter } from "./privacy";
import { profileRouter } from "./profile";
import { remindRouter } from "./remind";
import { timerRouter } from "./timer";
import { todoRouter } from "./todo";
import { tokenRouter } from "./token";
import { voiceRouter } from "./voice";
import { workflowRouter } from "./workflow";
import { graphRouter } from "./graph";

export const appRouter: ReturnType<typeof router> = router({
  healthCheck: publicProcedure.query(() => "OK"),
  graph: graphRouter,
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  todo: todoRouter,
  note: noteRouter,
  remind: remindRouter,
  timer: timerRouter,
  book: bookRouter,
  droid: droidsRouter,
  jwks: jwksRouter,
  token: tokenRouter,
  workflow: workflowRouter,
  eval: evalRouter,
  deploy: deployRouter,
  linear: linearRouter,
  assistant: assistantRouter,
  orchestrator: orchestratorRouter,
  profile: profileRouter,
  preference: preferenceRouter,
  privacy: privacyRouter,
  voice: voiceRouter,
});
export type AppRouter = typeof appRouter;

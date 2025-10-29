import { protectedProcedure, publicProcedure, router } from "../index";
import { bookRouter } from "./book";
import { jwksRouter } from "./jwks";
import { noteRouter } from "./note";
import { remindRouter } from "./remind";
import { todoRouter } from "./todo";
import { timerRouter } from "./timer";
import { tokenRouter } from "./token";
import { droidsRouter } from "./droids";
import { workflowRouter } from "./workflow";
import { evalRouter } from "./eval";
import { deployRouter } from "./deploy";
import { linearRouter } from "./linear";
import { assistantRouter } from "./assistant";
import { profileRouter } from "./profile";
import { preferenceRouter } from "./preference";
import { privacyRouter } from "./privacy";

export const appRouter: ReturnType<typeof router> = router({
  healthCheck: publicProcedure.query(() => "OK"),
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
  profile: profileRouter,
  preference: preferenceRouter,
  privacy: privacyRouter,
});
export type AppRouter = typeof appRouter;

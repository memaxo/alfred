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
});
export type AppRouter = typeof appRouter;

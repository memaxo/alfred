import { protectedProcedure, publicProcedure, router } from "../index";
import { bookRouter } from "./book";
import { jwksRouter } from "./jwks";
import { noteRouter } from "./note";
import { remindRouter } from "./remind";
import { todoRouter } from "./todo";
import { timerRouter } from "./timer";
import { tokenRouter } from "./token";

export const appRouter = router({
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
  jwks: jwksRouter,
  token: tokenRouter,
});
export type AppRouter = typeof appRouter;

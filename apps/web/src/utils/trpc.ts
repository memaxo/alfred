import type { appRouter } from "@alfred/api/src/routers/index";
import { createTRPCReact } from "@trpc/react-query";

type AppRouter = typeof appRouter;

export type TRPCAppRouter = AppRouter;

export const trpc = createTRPCReact<AppRouter>();

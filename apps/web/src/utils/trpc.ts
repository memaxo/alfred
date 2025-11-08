import { createTRPCReact } from "@trpc/react-query";
import type { appRouter } from "@alfred/api/src/routers/index";

type AppRouter = typeof appRouter;

export type TRPCAppRouter = AppRouter;

export const trpc = createTRPCReact<AppRouter>();

import { auth } from "@alfred/auth";

export async function createContext({ req }: { req: Request }) {
  const session = await auth.api
    .getSession({
      headers: req.headers,
    })
    .catch(() => null);
  return {
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

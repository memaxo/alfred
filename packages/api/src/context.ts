import { auth } from "@alfred/auth";

type AuthSession = Awaited<ReturnType<(typeof auth)["api"]["getSession"]>>;

export interface Context {
  session: AuthSession | null;
  policy?: {
    obligations: string[];
  };
}

export async function createContext({ req }: { req: Request }): Promise<Context> {
  const session = await auth.api
    .getSession({
      headers: req.headers,
    })
    .catch(() => null);

  return {
    session,
  };
}

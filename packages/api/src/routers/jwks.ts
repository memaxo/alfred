import { getJWKS } from "@alfred/auth/jwks";
import { publicProcedure, router } from "../trpc";

export const jwksRouter = router({
  get: publicProcedure.query(async () => {
    return await getJWKS();
  }),
});

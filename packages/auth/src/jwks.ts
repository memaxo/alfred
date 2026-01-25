import { exportJWK, importSPKI } from "jose";

export interface JWKS {
  keys: JWK[];
}

export interface JWK {
  kty: string;
  use: string;
  kid: string;
  alg: string;
  crv: string;
  x: string;
}

/**
 * Convert the configured Ed25519 public key into a JWKS document so external
 * verifiers (tools, schedulers, enclaves) can validate issued tool tokens.
 */
export async function getJWKS(): Promise<JWKS> {
  const spki = process.env.AGENT_ED25519_PUBLIC_PEM;
  if (!spki) {
    throw new Error("AGENT_ED25519_PUBLIC_PEM is not set");
  }

  const kid = process.env.AGENT_JWK_KID || "agent-ed25519";
  const publicKey = await importSPKI(spki, "EdDSA");
  const jwk = await exportJWK(publicKey);

  return {
    keys: [
      {
        kty: "OKP",
        crv: "Ed25519",
        alg: "EdDSA",
        use: "sig",
        kid,
        x: jwk.x ?? "",
      },
    ],
  };
}

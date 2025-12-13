declare module "@better-auth/passkey" {
  import type { BetterAuthPlugin } from "better-auth";

  export type PasskeyOptions = {
    rpID: string;
    rpName: string;
    origin: string;
    authenticatorSelection?: {
      authenticatorAttachment?: "platform" | "cross-platform";
      residentKey?: "required" | "preferred" | "discouraged";
      userVerification?: "required" | "preferred" | "discouraged";
    };
    advanced?: {
      webAuthnChallengeCookie?: string;
    };
  };

  export function passkey(options: PasskeyOptions): BetterAuthPlugin;
}


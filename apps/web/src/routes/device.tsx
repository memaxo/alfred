import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/device" as any)({
  component: DeviceVerification,
});

function DeviceVerification() {
  const [userCode, setUserCode] = useState("");
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("verifying");
    try {
      // @ts-expect-error - plugin method might not be in types yet
      const { error } = await authClient.oauth2.verifyDeviceCode({
        userCode: userCode.replace("-", ""),
      });
      if (error) {
        throw error;
      }
      setStatus("success");
    } catch (_err) {
      setStatus("error");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-void text-biolum">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-white/10 bg-void-surface/40 p-8 backdrop-blur-xl">
        <h1 className="font-bold text-2xl tracking-tighter">
          ALFRED Device Login
        </h1>
        {status === "success" ? (
          <div className="space-y-4">
            <p className="text-green-400">
              ✓ Device authorized! You can close this window.
            </p>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <p className="text-biolum-dim">
              Enter the code displayed in your terminal:
            </p>
            <input
              className="w-full rounded-full border border-white/10 bg-void p-3 text-center text-2xl tracking-widest focus:border-biolum focus:outline-none"
              maxLength={9}
              onChange={(e) => {
                let val = e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "");
                if (val.length > 4) {
                  val = `${val.slice(0, 4)}-${val.slice(4, 8)}`;
                }
                setUserCode(val);
              }}
              placeholder="XXXX-XXXX"
              type="text"
              value={userCode}
            />
            {status === "error" && (
              <p className="text-center text-red-400 text-sm">
                Invalid or expired code. Please try again.
              </p>
            )}
            <button
              className="w-full rounded-full bg-biolum p-3 font-bold text-void transition-opacity hover:bg-biolum/90 disabled:opacity-50"
              disabled={
                status === "verifying" || userCode.replace("-", "").length < 8
              }
              type="submit"
            >
              {status === "verifying" ? "Verifying..." : "Authorize Device"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

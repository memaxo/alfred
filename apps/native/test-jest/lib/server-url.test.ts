import { classifyServerUrl, normalizeServerUrl } from "@/lib/server-url";

describe("server-url", () => {
  describe(normalizeServerUrl, () => {
    it("adds https scheme and strips path", () => {
      const res = normalizeServerUrl("alfred-home.example.ts.net/healthz");
      expect(res.ok).toBeTruthy();
      if (!res.ok) {
        return;
      }
      expect(res.url).toBe("https://alfred-home.example.ts.net");
    });

    it("preserves explicit http scheme", () => {
      const res = normalizeServerUrl("http://localhost:3000/");
      expect(res.ok).toBeTruthy();
      if (!res.ok) {
        return;
      }
      expect(res.url).toBe("http://localhost:3000");
    });

    it("rejects empty", () => {
      const res = normalizeServerUrl("   ");
      expect(res.ok).toBeFalsy();
    });
  });

  describe(classifyServerUrl, () => {
    it("detects .ts.net hostnames", () => {
      const c = classifyServerUrl("https://alfred-home.example.ts.net");
      expect(c.kind).toBe("tailnet-hostname");
    });

    it("detects tailnet IPv4 CGNAT", () => {
      const c = classifyServerUrl("http://100.100.10.20:3000");
      expect(c.kind).toBe("tailnet-ipv4");
    });

    it("detects non-tailnet public hostname", () => {
      const c = classifyServerUrl("https://example.com");
      expect(c.kind).toBe("non-tailnet");
    });

    it("detects Tailscale ULA IPv6 prefix", () => {
      const c = classifyServerUrl("http://[fd7a:115c:a1e0::1]:3000");
      expect(c.kind).toBe("tailnet-ipv6");
    });

    it("handles invalid URLs", () => {
      const c = classifyServerUrl("not a url");
      expect(c.kind).toBe("invalid");
    });
  });
});

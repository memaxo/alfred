import { describe, expect, it } from "bun:test";
import { buildRunArgs } from "../src/routers/deploy-helpers";

describe("deploy-helpers", () => {
  it("builds docker run args", () => {
    const args = buildRunArgs({
      image: "nginx:latest",
      name: "web",
      network: "my-net",
      ports: [
        { host: 8080, container: 80 },
        { host: 8443, container: 443 },
      ],
      env: { NODE_ENV: "production" },
      volumes: ["myvol:/data", "./local:/work"],
      cmd: 'sh -lc "echo hi"',
    });

    expect(args.slice(0, 2)).toEqual(["run", "-d"]);
    expect(args).toContain("--name");
    expect(args).toContain("web");
    expect(args).toContain("--network");
    expect(args).toContain("my-net");
    expect(args).toContain("-p");
    expect(args).toContain("8080:80");
    expect(args).toContain("8443:443");
    expect(args).toContain("-e");
    expect(args).toContain("NODE_ENV=production");
    expect(args).toContain("-v");
    expect(args).toContain("myvol:/data");
    expect(args).toContain("./local:/work");
    expect(args).toContain("nginx:latest");

    const cmdIdx = args.indexOf("nginx:latest");
    expect(args.slice(cmdIdx + 1)).toEqual(["sh", "-lc", "echo hi"]);
  });
});

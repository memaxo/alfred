import { expect, mock, test } from "bun:test";
import { mock } from "bun:test";
// Mock policy guard to bypass real token verification in tests
mock.module("@alfred/auth/token", () => ({
	requireToolScopesAndPolicy: async () => ({
		decision: { allow: true },
		claims: {
			sub: "test",
			scopes: ["proxmox.read", "proxmox.power", "proxmox.admin"],
			iat: 0,
			exp: 9999999999,
			jti: "j",
			aud: "test",
			iss: "alfred",
		},
	}),
}));
import { toolProxmox } from "./proxmox";

const origEnv = { ...process.env };

function setupEnv() {
	process.env.PROXMOX_HOST = "https://pve.local";
	process.env.PROXMOX_TOKEN_ID = "user@pam!token";
	process.env.PROXMOX_TOKEN_SECRET = "secret";
	process.env.PROXMOX_NODE = "pve";
}

function restoreEnv() {
	process.env = { ...origEnv };
}

test("lxc_create returns success", async () => {
	setupEnv();
	const fetchMock = mock(() =>
		Promise.resolve(new Response(JSON.stringify({ data: { upid: "UPID:create" } }), { status: 200 })),
	);
	// @ts-expect-error override in tests
	globalThis.fetch = fetchMock as typeof globalThis.fetch;

	const result = await toolProxmox.execute({
		input: {
			action: "lxc_create",
			vmid: 100,
			hostname: "test",
			ostemplate: "local:vztmpl/debian.tar.gz",
			rootfs: "local:8",
		},
	} as never);

	expect(result).toMatchObject({
		action: "lxc_create",
		ok: true,
		upid: "UPID:create",
	});

	restoreEnv();
});

test("lxc_status returns status", async () => {
	setupEnv();
	const fetchMock = mock(() =>
		Promise.resolve(
			new Response(JSON.stringify({ data: { status: "running", pid: 1234 } }), { status: 200 }),
		),
	);
	// @ts-expect-error override in tests
	globalThis.fetch = fetchMock as typeof globalThis.fetch;

	const result = await toolProxmox.execute({
		input: {
			action: "lxc_status",
			vmid: 100,
		},
	} as never);

	expect(result).toMatchObject({
		action: "lxc_status",
		ok: true,
		status: "running",
		pid: 1234,
	});

	restoreEnv();
});

test("missing vmid returns error", async () => {
	setupEnv();

	const result = await toolProxmox.execute({
		input: {
			action: "lxc_start",
		},
	} as never);

	expect(result).toMatchObject({
		ok: false,
		code: "validation",
		message: "Missing vmid",
	});

	restoreEnv();
});

test("vm_power with action", async () => {
	setupEnv();
	const fetchMock = mock(() =>
		Promise.resolve(new Response(JSON.stringify({ data: { upid: "UPID:power" } }), { status: 200 })),
	);
	// @ts-expect-error override in tests
	globalThis.fetch = fetchMock as typeof globalThis.fetch;

	const result = await toolProxmox.execute({
		input: {
			action: "vm_power",
			vmid: 100,
			powerAction: "start",
		},
	} as never);

	expect(result).toMatchObject({
		action: "vm_power",
		ok: true,
		upid: "UPID:power",
	});

	restoreEnv();
});

test("missing env returns error", async () => {
	delete process.env.PROXMOX_HOST;

	const result = await toolProxmox.execute({
		input: {
			action: "lxc_status",
			vmid: 100,
		},
	} as never);

	expect(result).toMatchObject({
		ok: false,
		code: "unknown",
	});

	restoreEnv();
});



/**
 * Proxmox LXC/VM Management Tool
 *
 * Supported Actions:
 * - lxc_create: Create new LXC container (scope: proxmox.admin)
 * - lxc_start: Start container (scope: proxmox.power)
 * - lxc_stop: Stop container (scope: proxmox.power)
 * - lxc_destroy: Delete container (scope: proxmox.admin)
 * - lxc_snapshot: Create snapshot (scope: proxmox.admin)
 * - lxc_rollback: Rollback to snapshot (scope: proxmox.admin)
 * - lxc_status: Get container status (scope: proxmox.read)
 * - vm_power: VM power operation (scope: proxmox.power)
 * - vm_status: Get VM status (scope: proxmox.read)
 * - task_wait: Wait for task completion (scope: proxmox.read)
 *
 * Required Environment:
 * - PROXMOX_HOST: Proxmox server hostname/IP
 * - PROXMOX_TOKEN_ID: API token ID (user@realm!tokenid)
 * - PROXMOX_TOKEN_SECRET: API token secret
 * - PROXMOX_NODE: Default node name (optional)
 */

import { z } from "zod";
import { requireToolScopesAndPolicy } from "@alfred/auth/token";
import { proxmox, type ProxmoxError } from "../../lib/proxmox";

const inputSchema = z
	.object({
		action: z.enum([
			"lxc_create",
			"lxc_start",
			"lxc_stop",
			"lxc_destroy",
			"lxc_snapshot",
			"lxc_rollback",
			"lxc_status",
			"vm_power",
			"vm_status",
			"task_wait",
		]),
		node: z.string().optional(),
		vmid: z.number().optional(),
		snapshot: z.string().optional(),
		hostname: z.string().optional(),
		ostemplate: z.string().optional(),
		rootfs: z.string().optional(),
		cores: z.number().optional(),
		memory: z.number().optional(),
		net0: z.string().optional(),
		password: z.string().optional(),
		powerAction: z.enum(["start", "stop", "reset", "shutdown", "suspend", "resume"]).optional(),
		upid: z.string().optional(),
		timeoutMs: z.number().optional(),
		authz: z.string().optional(),
	})
	.strict();

const outputSchema = z.discriminatedUnion("action", [
	z.object({ action: z.literal("lxc_create"), ok: z.literal(true), upid: z.string() }),
	z.object({ action: z.literal("lxc_start"), ok: z.literal(true), upid: z.string() }),
	z.object({ action: z.literal("lxc_stop"), ok: z.literal(true), upid: z.string() }),
	z.object({ action: z.literal("lxc_destroy"), ok: z.literal(true), upid: z.string() }),
	z.object({ action: z.literal("lxc_snapshot"), ok: z.literal(true), upid: z.string() }),
	z.object({ action: z.literal("lxc_rollback"), ok: z.literal(true), upid: z.string() }),
	z.object({
		action: z.literal("lxc_status"),
		ok: z.literal(true),
		status: z.enum(["running", "stopped", "paused"]),
		pid: z.number().optional(),
	}),
	z.object({ action: z.literal("vm_power"), ok: z.literal(true), upid: z.string() }),
	z.object({
		action: z.literal("vm_status"),
		ok: z.literal(true),
		status: z.enum(["running", "stopped", "paused"]),
	}),
	z.object({
		action: z.literal("task_wait"),
		ok: z.literal(true),
		exitstatus: z.string(),
	}),
]);

type ToolOutput = z.infer<typeof outputSchema>;
type ToolError = {
	ok: false;
	code: string;
	message: string;
	detail?: string;
};

function scopesForAction(action: string): string[] {
	switch (action) {
		case "lxc_status":
		case "vm_status":
		case "task_wait":
			return ["proxmox.read"];
		case "lxc_start":
		case "lxc_stop":
		case "vm_power":
			return ["proxmox.power"];
		case "lxc_create":
		case "lxc_destroy":
		case "lxc_snapshot":
		case "lxc_rollback":
			return ["proxmox.admin"];
		default:
			return [];
	}
}

function resourceId(input: z.infer<typeof inputSchema>): string {
	if (input.action.startsWith("vm_")) {
		return `qemu:${input.vmid ?? "unknown"}`;
	}
	if (input.action.startsWith("lxc_")) {
		return `lxc:${input.vmid ?? "unknown"}`;
	}
	if (input.action === "task_wait") {
		return `task:${input.upid ?? "unknown"}`;
	}
	return "proxmox";
}

function policyMeta(input: z.infer<typeof inputSchema>) {
	return {
		action: `proxmox.${input.action}`,
		resource: {
			kind: "proxmox",
			id: resourceId(input),
		},
	} as const;
}

function makeClient(): proxmox {
	const host = process.env.PROXMOX_HOST;
	const tokenId = process.env.PROXMOX_TOKEN_ID;
	const tokenSecret = process.env.PROXMOX_TOKEN_SECRET;

	if (!host || !tokenId || !tokenSecret) {
		throw new Error("Missing PROXMOX_HOST, PROXMOX_TOKEN_ID, or PROXMOX_TOKEN_SECRET");
	}

	const base = host.startsWith("http") ? `${host}:8006/api2/json` : `https://${host}:8006/api2/json`;

	return new proxmox({ base, tokenId, tokenSecret });
}

function errorToResponse(_action: string, err: unknown): ToolError {
	if (typeof err === "object" && err !== null && "kind" in err) {
		const pveErr = err as ProxmoxError;
		return {
			ok: false,
			code: pveErr.kind,
			message: pveErr.message,
			detail: pveErr.endpoint,
		};
	}

	return {
		ok: false,
		code: "unknown",
		message: err instanceof Error ? err.message : String(err),
	};
}

export const toolProxmox = {
	name: "proxmox",
	description: "Manage Proxmox LXC containers and VMs with lifecycle, power, and snapshot operations",
	inputSchema,
	outputSchema: z.union([
		outputSchema,
		z.object({ ok: z.literal(false), code: z.string(), message: z.string(), detail: z.string().optional() }),
	]),
	execute: async ({ input }: { input: z.infer<typeof inputSchema> }): Promise<ToolOutput | ToolError> => {
		try {
			await requireToolScopesAndPolicy(input.authz, scopesForAction(input.action), policyMeta(input));

			const client = makeClient();
			const node = input.node ?? process.env.PROXMOX_NODE;

			if (!node) {
				return {
					ok: false,
					code: "config",
					message: "No node specified and PROXMOX_NODE not set",
				};
			}

			switch (input.action) {
				case "lxc_create": {
					if (!input.vmid || !input.hostname || !input.ostemplate || !input.rootfs) {
						return {
							ok: false,
							code: "validation",
							message: "Missing required fields: vmid, hostname, ostemplate, rootfs",
						};
					}
					const result = await client.lxcCreate(node, {
						vmid: input.vmid,
						hostname: input.hostname,
						ostemplate: input.ostemplate,
						rootfs: input.rootfs,
						cores: input.cores,
						memory: input.memory,
						net0: input.net0,
						password: input.password,
					});
					return { action: "lxc_create", ok: true, upid: result.upid };
				}
				case "lxc_start": {
					if (!input.vmid) {
						return { ok: false, code: "validation", message: "Missing vmid" };
					}
					const result = await client.lxcStart(node, input.vmid);
					return { action: "lxc_start", ok: true, upid: result.upid };
				}
				case "lxc_stop": {
					if (!input.vmid) {
						return { ok: false, code: "validation", message: "Missing vmid" };
					}
					const result = await client.lxcStop(node, input.vmid);
					return { action: "lxc_stop", ok: true, upid: result.upid };
				}
				case "lxc_destroy": {
					if (!input.vmid) {
						return { ok: false, code: "validation", message: "Missing vmid" };
					}
					const result = await client.lxcDestroy(node, input.vmid);
					return { action: "lxc_destroy", ok: true, upid: result.upid };
				}
				case "lxc_snapshot": {
					if (!input.vmid || !input.snapshot) {
						return { ok: false, code: "validation", message: "Missing vmid or snapshot" };
					}
					const result = await client.lxcSnapshot(node, input.vmid, input.snapshot);
					return { action: "lxc_snapshot", ok: true, upid: result.upid };
				}
				case "lxc_rollback": {
					if (!input.vmid || !input.snapshot) {
						return { ok: false, code: "validation", message: "Missing vmid or snapshot" };
					}
					const result = await client.lxcRollback(node, input.vmid, input.snapshot);
					return { action: "lxc_rollback", ok: true, upid: result.upid };
				}
				case "lxc_status": {
					if (!input.vmid) {
						return { ok: false, code: "validation", message: "Missing vmid" };
					}
					const result = await client.lxcStatus(node, input.vmid);
					return { action: "lxc_status", ok: true, status: result.status, pid: result.pid };
				}
				case "vm_power": {
					if (!input.vmid || !input.powerAction) {
						return { ok: false, code: "validation", message: "Missing vmid or powerAction" };
					}
					const result = await client.vmPower(node, input.vmid, input.powerAction);
					return { action: "vm_power", ok: true, upid: result.upid };
				}
				case "vm_status": {
					if (!input.vmid) {
						return { ok: false, code: "validation", message: "Missing vmid" };
					}
					const result = await client.vmStatus(node, input.vmid);
					return { action: "vm_status", ok: true, status: result.status };
				}
				case "task_wait": {
					if (!input.upid) {
						return { ok: false, code: "validation", message: "Missing upid" };
					}
					const result = await client.taskWait(node, input.upid, {
						timeoutMs: input.timeoutMs,
					});
					return { action: "task_wait", ok: true, exitstatus: result.exitstatus };
				}
				default:
					return {
						ok: false,
						code: "validation",
						message: `Unknown action: ${input.action}`,
					};
			}
		} catch (err) {
			return errorToResponse(input.action, err);
		}
	},
};



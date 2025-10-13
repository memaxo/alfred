import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type PromoteDialogPayload = {
	upstream: string;
	host?: string;
};

export type PromoteDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	app: string;
	defaultHost?: string;
	onSubmit: (payload: PromoteDialogPayload) => Promise<void> | void;
	isSubmitting?: boolean;
};

function ensurePortalRoot() {
	let root = document.getElementById("alfred-dialog-root");
	if (!root) {
		root = document.createElement("div");
		root.setAttribute("id", "alfred-dialog-root");
		document.body.appendChild(root);
	}
	return root;
}

export function PromoteDialog({
	open,
	onOpenChange,
	app,
	defaultHost,
	onSubmit,
	isSubmitting = false,
}: PromoteDialogProps) {
	const [host, setHost] = useState(defaultHost ?? "");
	const [upstream, setUpstream] = useState("");
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (open) {
			setHost(defaultHost ?? "");
			setUpstream("");
			setError(null);
		}
	}, [open, defaultHost]);

	const portalRoot = useMemo(() => (typeof document !== "undefined" ? ensurePortalRoot() : null), []);

	if (!open || !portalRoot) {
		return null;
	}

	const handleClose = () => {
		if (!isSubmitting) {
			onOpenChange(false);
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		const trimmedUpstream = upstream.trim();
		if (!trimmedUpstream) {
			setError("Upstream URL is required");
			return;
		}

		try {
			// URL validation throws on invalid values
			// eslint-disable-next-line no-new
			new URL(trimmedUpstream);
		} catch {
			setError("Enter a valid URL (https://example.com)");
			return;
		}

		setError(null);
		await onSubmit({
			upstream: trimmedUpstream,
			host: host.trim() || undefined,
		});
	};

	return createPortal(
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
			<div className="w-full max-w-lg rounded-lg border border-border bg-background shadow-lg">
				<header className="border-b border-border px-6 py-4">
					<h2 className="text-lg font-semibold">Promote Deployment</h2>
					<p className="text-sm text-muted-foreground">
						Choose a production host and upstream for <strong>{app}</strong>.
					</p>
				</header>
				<form onSubmit={handleSubmit}>
					<div className="space-y-4 px-6 py-5">
						<label className="block text-sm font-medium">
							Production Host (optional)
							<Input
								className="mt-1"
								value={host}
								onChange={event => setHost(event.target.value)}
								placeholder="app.example.com"
								disabled={isSubmitting}
							/>
						</label>
						<label className="block text-sm font-medium">
							Upstream URL
							<Input
								className="mt-1"
								value={upstream}
								onChange={event => setUpstream(event.target.value)}
								placeholder="https://your-service.internal"
								required
								disabled={isSubmitting}
								type="url"
							/>
						</label>
						{error ? <p className="text-sm text-destructive">{error}</p> : null}
					</div>
					<footer className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
						<Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Promoting…" : "Promote"}
						</Button>
					</footer>
				</form>
			</div>
		</div>,
		portalRoot,
	);
}

export default PromoteDialog;

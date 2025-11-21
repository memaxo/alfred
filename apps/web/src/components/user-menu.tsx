import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { getElevatedToolToken } from "@/lib/token";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

export default function UserMenu() {
  const navigate = useNavigate();
  const [isRequestingToken, setIsRequestingToken] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  if (isPending) {
    return <Skeleton className="h-9 w-24" />;
  }

  if (!session) {
    return (
      <Button asChild variant="outline">
        <Link to="/login">Sign In</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">{session.user.name}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-card">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>{session.user.email}</DropdownMenuItem>
        {!import.meta.env.PROD && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isRequestingToken}
              onSelect={async (event) => {
                event.preventDefault();
                setIsRequestingToken(true);
                try {
                  const token = await getElevatedToolToken(["droid.exec"]);
                  await navigator.clipboard.writeText(token);
                  window.alert(
                    "Elevated token copied to clipboard (scope: droid.exec)"
                  );
                } catch (_error) {
                  // Error already handled via window.alert
                  // Errors are also caught by error boundaries
                } finally {
                  setIsRequestingToken(false);
                }
              }}
            >
              {isRequestingToken
                ? "Requesting elevated token..."
                : "Copy elevated token (dev)"}
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem asChild>
          <Button
            className="w-full"
            onClick={() => {
              authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    navigate({
                      to: "/",
                    });
                  },
                },
              });
            }}
            variant="destructive"
          >
            Sign Out
          </Button>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Button asChild className="w-full" variant="outline">
            <Link to="/mindscape">Mindscape</Link>
          </Button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/dropdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { getElevatedToolToken } from "@/lib/token";
import { ProfileDropdown } from "./ui/profile";

export function Profile() {
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
    <ProfileDropdown
      email={session.user.email}
      trigger={<Button variant="outline">{session.user.name}</Button>}
    >
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
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Button
          className="w-full"
          onClick={() => {
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => {
                  navigate({ to: "/" });
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
          <Link to="/">Mindscape</Link>
        </Button>
      </DropdownMenuItem>
    </ProfileDropdown>
  );
}

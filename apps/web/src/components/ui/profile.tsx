"use client";

import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ProfileDropdownProps = {
  trigger: ReactNode;
  label?: string;
  email?: string;
  className?: string;
  children?: ReactNode;
};

export function ProfileDropdown({
  trigger,
  label = "My Account",
  email,
  className,
  children,
}: ProfileDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className={cn("bg-card", className)}>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {email && <DropdownMenuItem>{email}</DropdownMenuItem>}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

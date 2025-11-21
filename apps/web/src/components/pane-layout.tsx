/**
 * Pane Layout Component
 *
 * Unified layout wrapper for pane components with consistent header/form structure.
 * Follows single-word naming convention and composition pattern.
 */

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type PaneLayoutProps = {
  title: string;
  description?: string;
  createForm: ReactNode;
  paneComponent: ReactNode;
  className?: string;
};

export function PaneLayout({
  title,
  description,
  createForm,
  paneComponent,
  className,
}: PaneLayoutProps) {
  return (
    <div
      className={
        className ?? "mx-auto flex w-full max-w-2xl flex-col gap-6 py-10"
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{createForm}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent {title.toLowerCase()}</CardTitle>
          {description ? (
            <CardDescription>
              Newest {title.toLowerCase()} appear first.
            </CardDescription>
          ) : null}
        </CardHeader>
        <CardContent>{paneComponent}</CardContent>
      </Card>
    </div>
  );
}

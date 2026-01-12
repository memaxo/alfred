import { ChevronRight, Home } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  separator?: React.ReactNode;
  homeHref?: string;
  className?: string;
};

export function Breadcrumb({
  items,
  separator,
  homeHref,
  className,
}: BreadcrumbProps) {
  const separatorNode = separator ?? (
    <ChevronRight className="h-4 w-4 text-biolum-faint" />
  );

  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center", className)}>
      <ol className="flex items-center gap-1">
        {homeHref && (
          <li>
            <Button
              asChild
              className="h-6 px-2 text-biolum-dim hover:text-biolum"
              size="sm"
              variant="ghost"
            >
              <a href={homeHref}>
                <Home className="h-4 w-4" />
              </a>
            </Button>
          </li>
        )}

        {homeHref && items.length > 0 && (
          <li className="flex items-center">{separatorNode}</li>
        )}

        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <React.Fragment key={index}>
              <li>
                {isLast ? (
                  <span className="font-medium text-biolum text-sm">
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Button
                    asChild
                    className="h-6 px-2 text-biolum-dim hover:text-biolum"
                    size="sm"
                    variant="ghost"
                  >
                    <a href={item.href}>{item.label}</a>
                  </Button>
                ) : item.onClick ? (
                  <Button
                    className="h-6 px-2 text-biolum-dim hover:text-biolum"
                    onClick={item.onClick}
                    size="sm"
                    variant="ghost"
                  >
                    {item.label}
                  </Button>
                ) : (
                  <span className="text-biolum-dim text-sm">{item.label}</span>
                )}
              </li>

              {!isLast && (
                <li className="flex items-center">{separatorNode}</li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

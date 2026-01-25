"use client";

import type React from "react";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { createContext, useContext } from "react";

import { cn } from "@/lib/utils";

interface DialogEnv {
  inline: boolean;
}

const DialogEnvContext = createContext<DialogEnv>({ inline: false });

export function DialogProvider({
  inline = false,
  children,
}: {
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DialogEnvContext.Provider value={{ inline }}>
      {children}
    </DialogEnvContext.Provider>
  );
}

function useDialogEnv() {
  return useContext(DialogEnvContext);
}

function Dialog({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const env = useDialogEnv();
  if (env.inline) {
    return <>{children}</>;
  }
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  const env = useDialogEnv();
  if (env.inline) {
    if (asChild) {
      return <>{children}</>;
    }
    return (
      <button data-slot="dialog-trigger" {...props}>
        {children}
      </button>
    );
  }
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  const env = useDialogEnv();
  if (env.inline) {
    return <>{children}</>;
  }
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const env = useDialogEnv();
  if (env.inline) {
    return (
      <button data-slot="dialog-close" {...props}>
        {children}
      </button>
    );
  }
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  const env = useDialogEnv();
  if (env.inline) {
    return null;
  }
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in",
        className
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "modal",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  variant?: "modal" | "drawer";
}) {
  const env = useDialogEnv();
  if (env.inline) {
    return (
      <div
        className={cn(
          variant === "drawer"
            ? "h-full w-full border-l bg-background p-4 shadow-lg"
            : "rounded-lg border bg-background p-6 shadow-lg",
          className
        )}
        data-slot="dialog-content"
      >
        {children}
        {showCloseButton && (
          <button className="sr-only" type="button">
            Close
          </button>
        )}
      </div>
    );
  }
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          variant === "drawer"
            ? "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right fixed top-0 right-0 z-50 h-screen w-full max-w-md translate-x-0 translate-y-0 overflow-y-auto border-l bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-lg"
            : "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 data-[state=closed]:animate-out data-[state=open]:animate-in sm:max-w-lg",
          className
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            data-slot="dialog-close"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  const env = useDialogEnv();
  if (env.inline) {
    return (
      <div className={cn("font-semibold text-lg leading-none", className)}>
        {props.children}
      </div>
    );
  }
  return (
    <DialogPrimitive.Title
      className={cn("font-semibold text-lg leading-none", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  const env = useDialogEnv();
  if (env.inline) {
    return (
      <p className={cn("text-muted-foreground text-sm", className)}>
        {props.children}
      </p>
    );
  }
  return (
    <DialogPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};

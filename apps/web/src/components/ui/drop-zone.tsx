import { logger } from "@alfred/logger";
import { File, FileImage, FileText, Upload, X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

export interface FileWithMeta {
  file: File;
  id: string;
  preview?: string;
}

export interface DropZoneProps {
  onDrop: (files: File[]) => void;
  onRemove?: (fileId: string) => void;
  acceptedFiles?: string[];
  maxFiles?: number;
  maxSize?: number;
  multiple?: boolean;
  value?: FileWithMeta[];
  className?: string;
  disabled?: boolean;
}

export function DropZone({
  onDrop,
  onRemove,
  acceptedFiles,
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024,
  multiple = true,
  value,
  className,
  disabled = false,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) {
        return;
      }

      const droppedFiles = [...e.dataTransfer.files];
      handleFiles(droppedFiles);
    },
    [disabled, maxFiles, maxSize]
  );

  const handleFileSelect = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = [...(e.target.files ?? [])];
      handleFiles(selectedFiles);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [maxFiles, maxSize]
  );

  const handleFiles = React.useCallback(
    (files: File[]) => {
      const validFiles: File[] = [];

      for (const file of files) {
        if (maxSize && file.size > maxSize) {
          logger.warn("dropzone_file_rejected", {
            reason: "max_size",
            fileName: file.name,
            fileSize: file.size,
            maxSize,
          });
          continue;
        }

        if (acceptedFiles && !acceptedFiles.includes(file.type)) {
          logger.warn("dropzone_file_rejected", {
            reason: "invalid_type",
            fileName: file.name,
            fileType: file.type,
            acceptedFiles,
          });
          continue;
        }

        validFiles.push(file);

        if (validFiles.length >= maxFiles) {
          break;
        }
      }

      if (validFiles.length > 0) {
        onDrop(validFiles);
      }
    },
    [maxFiles, maxSize, acceptedFiles, onDrop]
  );

  const getFileIcon = (file: File): React.ReactNode => {
    if (file.type.startsWith("image/")) {
      return <FileImage className="h-5 w-5" />;
    }
    if (file.type.startsWith("text/")) {
      return <FileText className="h-5 w-5" />;
    }
    return <File className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isFull = maxFiles && value && value.length >= maxFiles;

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed p-8 text-center transition-all",
          isDragOver
            ? "border-biolum bg-biolum/5"
            : "border-white/20 bg-void-surface/30",
          disabled && "cursor-not-allowed opacity-50",
          !(disabled || isFull) &&
            "cursor-pointer hover:border-biolum/50 hover:bg-void-surface/50"
        )}
        onClick={() => {
          if (!(disabled || isFull)) {
            inputRef.current?.click();
          }
        }}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          accept={acceptedFiles?.join(",")}
          className="hidden"
          disabled={disabled}
          multiple={multiple}
          onChange={handleFileSelect}
          ref={inputRef}
          type="file"
        />

        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              isDragOver
                ? "bg-biolum/20 text-biolum"
                : "bg-void-surface/80 text-biolum-dim"
            )}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium text-biolum text-sm">
              {isFull
                ? `Maximum ${maxFiles} files reached`
                : "Drop files here or click to upload"}
            </p>
            <p className="mt-1 text-biolum-dim text-xs">
              {acceptedFiles
                ? `Accepted: ${acceptedFiles.join(", ")}`
                : "Any file type"}{" "}
              • Max {formatFileSize(maxSize)}
            </p>
          </div>
        </div>
      </div>

      {value && value.length > 0 && (
        <div className="mt-4 space-y-2">
          {value.map((fileWithMeta) => (
            <div
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-void-surface/30 p-3"
              key={fileWithMeta.id}
            >
              {fileWithMeta.preview ? (
                <img
                  alt={fileWithMeta.file.name}
                  className="h-10 w-10 rounded object-cover"
                  src={fileWithMeta.preview}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-void-surface/80 text-biolum-dim">
                  {getFileIcon(fileWithMeta.file)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-biolum text-sm">
                  {fileWithMeta.file.name}
                </p>
                <p className="text-biolum-dim text-xs">
                  {formatFileSize(fileWithMeta.file.size)}
                </p>
              </div>
              {onRemove && (
                <Button
                  className="shrink-0"
                  onClick={() => onRemove(fileWithMeta.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

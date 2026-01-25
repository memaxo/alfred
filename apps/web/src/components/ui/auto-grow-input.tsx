import * as React from "react";

import { cn } from "@/lib/utils";

export interface AutoGrowInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  className?: string;
  disabled?: boolean;
}

export function AutoGrowInput({
  value,
  onChange,
  placeholder = "Type something...",
  minHeight = 40,
  maxHeight = 200,
  className,
  disabled = false,
}: AutoGrowInputProps) {
  const [text, setText] = React.useState(value);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setText(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setText(newValue);
    onChange(newValue);
  };

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [text, minHeight, maxHeight]);

  return (
    <div className="relative">
      <textarea
        className={cn(
          "w-full resize-none overflow-hidden rounded-lg px-4 py-2",
          "border border-white/10 bg-void-surface/50",
          "text-biolum placeholder:text-biolum-dim/50",
          "focus:outline-none focus:ring-2 focus:ring-biolum",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-shadow",
          className
        )}
        disabled={disabled}
        onChange={handleChange}
        placeholder={placeholder}
        ref={textareaRef}
        style={{
          minHeight: `${minHeight}px`,
          maxHeight: `${maxHeight}px`,
        }}
        value={text}
      />
    </div>
  );
}

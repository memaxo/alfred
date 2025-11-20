import { useMindscapeStore } from "@/store/mindscape";
import { useCallback } from "react";
import { nanoid } from "nanoid";
import { useMindscapeExecutor } from "@/hooks/use-mindscape-executor";

export function useMindscapeStream() {
    // Re-export for compatibility with existing ChatNode logic if needed,
    // or expand to include stream handling logic that was previously inline.
    // Currently ChatNode uses useAssistantStream directly.
    // This hook could be used to bridge the gap between "Chat" and "Mindscape Artifacts"
    
    return {};
}


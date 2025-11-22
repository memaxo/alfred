export function isTextPart(part) {
    if (part.type !== "text") {
        return false;
    }
    return typeof part.text === "string";
}
export function isReasoningPart(part) {
    if (part.type !== "reasoning") {
        return false;
    }
    return typeof part.text === "string";
}
export function isToolCallPart(part) {
    return part.type === "tool-call";
}
export function isToolResultPart(part) {
    return part.type === "tool-result";
}
export function isFilePart(part) {
    if (part.type !== "file") {
        return false;
    }
    const filePart = part;
    return (typeof filePart.mediaType === "string" && typeof filePart.url === "string");
}
export function isDataPart(part) {
    return typeof part.type === "string" && part.type.startsWith("data-");
}
export function isDataCachePart(part) {
    return part.type === "data-cache";
}
export function isDataStatusPart(part) {
    return part.type === "data-status";
}
export function isDataPartNamed(part, name) {
    return part.type === `data-${name}`;
}
export function extractStructuredData(part) {
    if (isDataPart(part)) {
        const dataPart = part;
        return dataPart.data;
    }
    if (isToolResultPart(part)) {
        return part.output;
    }
    return null;
}
function extractMetadata(message) {
    if (!message.metadata || typeof message.metadata !== "object") {
        return {};
    }
    return message.metadata;
}
export function getAgentLabel(message) {
    const metadata = extractMetadata(message);
    const agent = typeof metadata.agent === "string" ? metadata.agent : null;
    if (agent && agent.length > 0) {
        return agent;
    }
    switch (message.role) {
        case "system":
            return "System";
        case "assistant":
            return "Assistant";
        case "user":
            return "User";
        default:
            return String(message.role);
    }
}
export function getTimestamp(message) {
    const metadata = extractMetadata(message);
    const source = (metadata.completeAt ??
        metadata.createdAt ??
        metadata.created);
    if (!source) {
        return null;
    }
    const date = source instanceof Date ? source : new Date(source);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}
//# sourceMappingURL=parts.js.map
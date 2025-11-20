import Editor from "@monaco-editor/react";
import type { NodeProps } from "@xyflow/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { codeNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { MindscapeNode } from "./mindscape-node";

export function CodeNode({ id, data, selected }: NodeProps) {
  // Validate and parse node data
  const result = codeNodeDataSchema.safeParse(data);
  const path = result.success ? (result.data.path ?? "") : "";
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data: fileData, refetch } = trpc.fs.read.useQuery(
    { path },
    {
      enabled: !!path,
      onError: (err: Error) => {
        toast.error(`Failed to read file: ${err.message}`);
      },
    }
  );

  const saveMutation = trpc.fs.write.useMutation({
    onSuccess: () => {
      toast.success("File saved");
      setIsDirty(false);
      refetch();
    },
    onError: (err: Error) => {
      toast.error(`Failed to save file: ${err.message}`);
    },
  });

  useEffect(() => {
    if (fileData?.content) {
      setContent(fileData.content);
    }
  }, [fileData]);

  const handleSave = () => {
    if (!path) {
      return;
    }
    saveMutation.mutate({ path, content });
  };

  const handleReload = () => {
    refetch();
  };

  return (
    <MindscapeNode
      className="w-[600px]"
      id={id}
      selected={selected}
      title={path ? (path.split("/").pop() ?? "Code Editor") : "Code Editor"}
    >
      <div className="flex flex-col overflow-hidden rounded-b-md bg-[#1e1e1e]">
        <div className="flex items-center justify-between border-white/10 border-b bg-zinc-900 px-2 py-1">
          <span className="text-xs text-zinc-400">
            {path || "No file selected"}
          </span>
          <div className="flex gap-2">
            <Button
              className="h-6 px-2 text-xs"
              onClick={handleReload}
              size="sm"
              variant="ghost"
            >
              Reload
            </Button>
            <Button
              className="h-6 px-2 text-xs"
              disabled={!isDirty}
              onClick={handleSave}
              size="sm"
              variant="default"
            >
              Save
            </Button>
          </div>
        </div>
        <div className="h-[400px]">
          <Editor
            defaultLanguage="typescript"
            height="100%"
            onChange={(value) => {
              setContent(value || "");
              setIsDirty(true);
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              padding: { top: 10, bottom: 10 },
            }}
            path={path}
            theme="vs-dark"
            value={content}
          />
        </div>
      </div>
    </MindscapeNode>
  );
}

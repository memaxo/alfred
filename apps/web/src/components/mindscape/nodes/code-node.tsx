import Editor from "@monaco-editor/react";
import type { NodeProps } from "@xyflow/react";
import { Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { codeNodeDataSchema } from "@/store/mindscape.schemas";
import { trpc } from "@/utils/trpc";
import { useLOD, useNodeFocus } from "@/lib/mindscape/lod";
import { MindscapeNode } from "./mindscape-node";
import { NodeLODSmall, NodeLODTiny } from "./shared-lod";

export function CodeNode({ id, data, selected }: NodeProps) {
  const lod = useLOD();
  useNodeFocus(id);

  // Validate and parse node data
  const result = codeNodeDataSchema.safeParse(data);
  const path = result.success ? (result.data.path ?? "") : "";
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const { data: fileData, refetch } = trpc.fs.read.useQuery(
    { path },
    {
      enabled: !!path,
    }
  );

  const saveMutation = trpc.fs.write.useMutation({
    onSuccess: () => {
      toast.success("File saved");
      setIsDirty(false);
      refetch();
    },
    onError: (err) => {
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

  const label = path ? (path.split("/").pop() ?? "Code Editor") : "Code Editor";

  // LOD 0: Tiny
  if (lod === "tiny") {
    return <NodeLODTiny color="bg-yellow-500" shadow="shadow-yellow-500/50" />;
  }

  // LOD 1: Small
  if (lod === "small") {
    return (
      <NodeLODSmall
        borderColor="border-yellow-500/20"
        hoverColor="hover:border-yellow-500/40"
        icon={<Code2 className="h-3 w-3" />}
        label={label}
        textColor="text-yellow-500"
      />
    );
  }

  return (
    <MindscapeNode
      className="w-[600px]"
      id={id}
      selected={selected}
      title={label}
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

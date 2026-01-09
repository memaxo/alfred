import type { NodeProps } from "@xyflow/react";
import {
  ExternalLink,
  FolderKanban,
  Link,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SmallCard,
  TinyDot,
  useLOD,
  WindowFrame,
} from "@/components/windows/shared";
import { cn } from "@/lib/utils";
import { trpc } from "@/utils/trpc";

const projectWindowDataSchema = z.object({
  type: z.literal("project"),
  label: z.string().optional(),
  viewMode: z.enum(["compact", "full", "maximized"]).default("full"),
  selectedProjectId: z.string().uuid().optional(),
});

type Project = {
  id: string;
  name: string;
  slug: string;
  workspace: string;
  linearProjectId: string | null;
  linearTeamId: string | null;
  lastActiveAt: Date | null;
};

export function ProjectWindow({ id, data, selected }: NodeProps) {
  const lod = useLOD();

  const parsed = projectWindowDataSchema.safeParse(data);
  const windowData = parsed.success
    ? parsed.data
    : { type: "project" as const, viewMode: "full" as const };

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    windowData.selectedProjectId ?? null
  );
  const [workspacePath, setWorkspacePath] = useState("");
  const [linkingProjectId, setLinkingProjectId] = useState<string | null>(null);
  const [linearProjectId, setLinearProjectId] = useState("");

  const utils = trpc.useUtils();

  const projectsQuery = trpc.project.list.useQuery();
  const projects = (projectsQuery.data ?? []) as Project[];

  const detectProject = trpc.project.detect.useMutation({
    onSuccess: async (project) => {
      toast.success(`Project "${project.name}" detected`);
      setWorkspacePath("");
      await utils.project.list.invalidate();
    },
    onError: (error) =>
      toast.error(error.message ?? "Failed to detect project"),
  });

  const linkLinear = trpc.project.linkLinear.useMutation({
    onSuccess: async () => {
      toast.success("Linear project linked");
      setLinkingProjectId(null);
      setLinearProjectId("");
      await utils.project.list.invalidate();
    },
    onError: (error) => toast.error(error.message ?? "Failed to link Linear"),
  });

  const linearStatus = trpc.linear.getStatus.useQuery();
  const isLinearConnected = linearStatus.data?.connected ?? false;

  const handleDetect = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!workspacePath.trim()) {
        return;
      }
      detectProject.mutate({ workspace: workspacePath.trim() });
    },
    [workspacePath, detectProject]
  );

  const handleLinkLinear = useCallback(
    (projectId: string) => {
      if (!linearProjectId.trim()) {
        toast.error("Enter a Linear project ID");
        return;
      }
      linkLinear.mutate({ projectId, linearProjectId: linearProjectId.trim() });
    },
    [linearProjectId, linkLinear]
  );

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  if (lod === "tiny") {
    return <TinyDot color="bg-biolum" shadow="shadow-biolum/50" />;
  }

  if (lod === "small") {
    return (
      <SmallCard
        borderColor="border-biolum/20"
        hoverColor="hover:border-biolum/40"
        icon={<FolderKanban className="h-3 w-3" />}
        label="Projects"
        textColor="text-biolum"
      />
    );
  }

  return (
    <WindowFrame
      actions={
        <Button
          className="h-6 w-6"
          disabled={projectsQuery.isFetching}
          onClick={() => utils.project.list.invalidate()}
          size="icon"
          variant="ghost"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 text-biolum-dim",
              projectsQuery.isFetching && "animate-spin"
            )}
          />
        </Button>
      }
      id={id}
      selected={selected}
      title="Projects"
      width={500}
      windowType="project"
    >
      <div className="flex h-[400px] flex-col">
        <form
          className="flex gap-2 border-white/5 border-b p-3"
          onSubmit={handleDetect}
        >
          <Input
            className="flex-1"
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder="/path/to/project"
            value={workspacePath}
          />
          <Button
            disabled={detectProject.isPending || !workspacePath.trim()}
            size="sm"
            type="submit"
          >
            {detectProject.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="mr-1 h-4 w-4" />
                Detect
              </>
            )}
          </Button>
        </form>

        <div className="flex flex-1 overflow-hidden">
          <ScrollArea className="w-1/2 border-white/5 border-r">
            <div className="p-2">
              {projectsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-biolum-faint text-sm">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : projects.length === 0 ? (
                <p className="py-8 text-center text-biolum-faint text-sm">
                  No projects yet. Detect one above.
                </p>
              ) : (
                <ul className="space-y-1">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <button
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl p-2 text-left transition-all duration-300",
                          selectedProjectId === project.id
                            ? "bg-biolum/10 text-biolum shadow-[0_0_10px_rgba(var(--biolum-rgb),0.1)]"
                            : "hover:bg-white/5"
                        )}
                        onClick={() => setSelectedProjectId(project.id)}
                        type="button"
                      >
                        <FolderKanban className="h-4 w-4 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm">
                            {project.name}
                          </div>
                          <div className="truncate text-biolum-faint text-xs">
                            {project.slug}
                          </div>
                        </div>
                        {project.linearProjectId && (
                          <Link className="h-3 w-3 flex-shrink-0 text-biolum-dim" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>

          <div className="flex w-1/2 flex-col p-3">
            {selectedProject ? (
              <>
                <h3 className="mb-2 font-semibold text-biolum">
                  {selectedProject.name}
                </h3>
                <div className="mb-4 space-y-1 text-biolum-dim text-xs">
                  <p>
                    <span className="text-biolum-faint">Path:</span>{" "}
                    {selectedProject.workspace}
                  </p>
                  <p>
                    <span className="text-biolum-faint">Slug:</span>{" "}
                    {selectedProject.slug}
                  </p>
                  {selectedProject.lastActiveAt && (
                    <p>
                      <span className="text-biolum-faint">Last Active:</span>{" "}
                      {new Date(
                        selectedProject.lastActiveAt
                      ).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-void-surface/40 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <ExternalLink className="h-4 w-4 text-biolum-dim" />
                    <span className="font-medium text-sm">
                      Linear Integration
                    </span>
                  </div>

                  {isLinearConnected ? (
                    selectedProject.linearProjectId ? (
                      <div className="space-y-2">
                        <p className="text-biolum-dim text-xs">
                          Linked to: {selectedProject.linearProjectId}
                        </p>
                        <Button
                          className="w-full"
                          onClick={() =>
                            setLinkingProjectId(selectedProject.id)
                          }
                          size="sm"
                          variant="outline"
                        >
                          Change Link
                        </Button>
                      </div>
                    ) : linkingProjectId === selectedProject.id ? (
                      <div className="space-y-2">
                        <Input
                          onChange={(e) => setLinearProjectId(e.target.value)}
                          placeholder="Linear Project ID"
                          value={linearProjectId}
                        />
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={linkLinear.isPending}
                            onClick={() => handleLinkLinear(selectedProject.id)}
                            size="sm"
                          >
                            {linkLinear.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Link"
                            )}
                          </Button>
                          <Button
                            onClick={() => {
                              setLinkingProjectId(null);
                              setLinearProjectId("");
                            }}
                            size="sm"
                            variant="ghost"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setLinkingProjectId(selectedProject.id)}
                        size="sm"
                      >
                        <Link className="mr-1 h-4 w-4" />
                        Link to Linear
                      </Button>
                    )
                  ) : (
                    <p className="text-amber-300 text-xs">
                      Connect Linear in Integrations window first
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-biolum-faint text-sm">
                Select a project
              </div>
            )}
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

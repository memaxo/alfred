"use client";

/**
 * Agent Selector - Choose between different AI agents
 */

import { logger } from "@alfred/logger";
import { Bot, Cpu, Sparkles, Terminal, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AgentType = "assistant" | "codex" | "droid" | "roo" | "claude";

interface AgentSelectorProps {
  value: AgentType;
  onChange: (agent: AgentType) => void;
  className?: string;
}

const agents: {
  id: AgentType;
  name: string;
  description: string;
  icon: typeof Bot;
  color: string;
}[] = [
  {
    id: "assistant",
    name: "Assistant",
    description: "General purpose AI assistant",
    icon: Sparkles,
    color: "text-purple-400",
  },
  {
    id: "claude",
    name: "Claude",
    description: "Anthropic's Claude for reasoning",
    icon: Bot,
    color: "text-orange-400",
  },
  {
    id: "codex",
    name: "Codex",
    description: "OpenAI Codex for code generation",
    icon: Terminal,
    color: "text-green-400",
  },
  {
    id: "droid",
    name: "Droid",
    description: "Autonomous agent for complex tasks",
    icon: Cpu,
    color: "text-blue-400",
  },
  {
    id: "roo",
    name: "Roo",
    description: "Reasoning-optimized agent",
    icon: Wand2,
    color: "text-pink-400",
  },
];

export function AgentSelector({
  value,
  onChange,
  className,
}: AgentSelectorProps) {
  const defaultAgent = agents[0];
  const selected = agents.find((a) => a.id === value) ?? defaultAgent;

  if (!selected) {
    return null;
  }
  const Icon = selected.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className={cn("h-7 gap-2 px-2", className)} variant="ghost">
          <Icon className={cn("h-4 w-4", selected.color)} />
          <span className="text-sm">{selected.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {agents.map((agent) => {
          const AgentIcon = agent.icon;
          return (
            <DropdownMenuItem
              className={cn(
                "flex items-start gap-3 py-2",
                value === agent.id && "bg-white/5"
              )}
              key={agent.id}
              onClick={() => {
                try {
                  onChange(agent.id);
                } catch (error) {
                  logger.error("chat_agent_change_failed", {
                    agentId: agent.id,
                    error,
                  });
                }
              }}
            >
              <AgentIcon className={cn("mt-0.5 h-4 w-4", agent.color)} />
              <div>
                <div className="font-medium text-sm">{agent.name}</div>
                <div className="text-biolum-dim text-xs">
                  {agent.description}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

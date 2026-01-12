"use client";

import { useMemo, useState } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { ConversationBar } from "@/components/ui/conversation-bar";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Matrix } from "@/components/ui/matrix";
import { Message, MessageContent } from "@/components/ui/message";
import { Actions } from "./actions";
import { Artifact } from "./artifact";
import { AudioPlayer } from "./audio";
import { Autocomplete, type AutocompleteItem } from "./autocomplete";
import { Branch } from "./branch";
import { Canvas } from "./canvas";
import { Chart } from "./chart";
import { Checkbox } from "./checkbox";
import { Choice } from "./choice";
import { Cite } from "./cite";
import { Code } from "./code";
import { Confirm } from "./confirm";
import { Connect } from "./connect";
import { Controls } from "./controls";
import { Ctx } from "./ctx";
import { DateField } from "./date";
import { DateRangeField, type DateRangeValue } from "./daterange";
import { Dock } from "./dock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown";
import { Edge } from "./edge";
import { Grid } from "./grid";
import { List } from "./list";
import { Load } from "./load";
import { Loading } from "./loading";
import type { ComponentName } from "./manifest";
import { Mic } from "./mic";
import { Node } from "./node";
import { Number as SlidingNumber } from "./number";
import { Orb } from "./orb";
import { Panel } from "./panel";
import { Plan } from "./plan";
import { Preview } from "./preview";
import { Profile } from "./profile";
import { Queue } from "./queue";
import { Response } from "./response";
import {
  SelectContent,
  SelectItem,
  Select as SelectRoot,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Task } from "./task";
import { Term } from "./term";
import { Input } from "./text";
import { Think } from "./think";
import { Thought } from "./thought";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "./tool";
import { Toolbar } from "./toolbar";
import { Viz } from "./viz";
import { Voice } from "./voice";
import { VoiceBtn } from "./voice-btn";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

export function ComponentDemo({ name }: { name: ComponentName }) {
  switch (name) {
    case "connect":
      return <Connect agent="assistant" status="streaming" />;
    case "ctx":
      return (
        <Ctx
          memory={{ resource: "thread:demo", thread: "demo" }}
          runtimeContext={{ mode: "demo", status: "ok", sample: true }}
        />
      );
    case "actions":
      return (
        <Actions
          actions={[
            {
              id: "a1",
              name: "search",
              args: { q: "alfred components" },
              status: "running",
            },
            {
              id: "a2",
              name: "summarize",
              args: { url: "example.com" },
              status: "completed",
              result: { ok: true },
            },
          ]}
        />
      );
    case "think":
      return (
        <Think
          reasoning={[
            { id: "t1", thought: "Identify the missing components." },
            { id: "t2", thought: "Verify file existence and wiring." },
          ]}
        />
      );
    case "load":
      return <Load message="Streaming…" />;
    case "plan":
      return (
        <Plan
          plan={{
            requirement: "Ship component wiring",
            tasks: [
              { id: "p1", title: "Audit manifest", status: "completed" },
              {
                id: "p2",
                title: "Implement missing components",
                status: "running",
              },
            ],
          }}
        />
      );
    case "tool":
      return (
        <Tool defaultOpen={true}>
          <ToolHeader
            state="output-available"
            title="tool.demo"
            type="tool-call"
          />
          <ToolContent>
            <ToolInput input={{ hello: "world" }} />
            <ToolOutput errorText={undefined} output={{ ok: true }} />
          </ToolContent>
        </Tool>
      );
    case "task":
      return (
        <Task
          id="task-1"
          progress={62}
          status="running"
          title="Refactor status map"
        />
      );
    case "queue":
      return (
        <Queue
          items={[
            { id: "q1", title: "Fetch docs", priority: "low" },
            { id: "q2", title: "Render demo page", priority: "medium" },
            { id: "q3", title: "Run tests", priority: "high" },
          ]}
        />
      );
    case "confirm":
      return <ConfirmDemo />;
    case "cite":
      return <Cite source="https://ai-sdk.dev" text="AI SDK Elements" />;
    case "branch":
      return (
        <Branch
          branches={[
            { id: "b1", label: "Fast path", reasoning: "Minimal wiring only." },
            {
              id: "b2",
              label: "Thorough path",
              reasoning: "Wire + tests + desktop app",
              selected: true,
            },
          ]}
        />
      );
    case "thought":
      return (
        <Thought
          thoughts={[
            {
              id: "c1",
              step: 1,
              thought: "Make the manifest truthful.",
              evidence: ["File existence", "Usage sites", "Tests"],
            },
            { id: "c2", step: 2, thought: "Wire everything into surfaces." },
          ]}
        />
      );
    case "code":
      return (
        <Code
          code={`export function hello() {\n  return "world";\n}\n`}
          language="ts"
          showLineNumbers
        />
      );
    case "controls":
      return <ControlsDemo />;
    case "audio":
      return <AudioPlayer src={SILENT_WAV} />;
    case "viz":
      return <Viz data={[0.05, 0.2, 0.4, 0.7, 0.3, 0.15, 0.6, 0.25]} />;
    case "chat":
      return (
        <div className="h-64 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <Conversation>
            <ConversationContent>
              <Message from="user">
                <MessageContent>Hello.</MessageContent>
              </Message>
              <Message from="assistant">
                <MessageContent>How can I help?</MessageContent>
              </Message>
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        </div>
      );
    case "chatbar":
      return <ChatbarDemo />;
    case "voice":
      return <VoiceDemo />;
    case "orb":
      return <Orb status="thinking" />;
    case "wave":
      return <LiveWaveform processing />;
    case "response":
      return <Response>**Streamdown** renders _markdown_.</Response>;
    case "mic":
      return <MicDemo />;
    case "msg":
      return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <Message from="assistant">
            <MessageContent>Message primitive</MessageContent>
          </Message>
        </div>
      );
    case "voiceBtn":
      return <VoiceBtnDemo />;
    case "preview":
      return (
        <Preview status="active" title="ALFRED Web" url="https://example.com" />
      );
    case "node":
      return (
        <Node id="n1" label="Extract facts" status="running" type="task" />
      );
    case "artifact":
      return (
        <Artifact
          kind="file"
          name="report.json"
          path="/tmp/report.json"
          size={2560}
        />
      );
    case "panel":
      return (
        <Panel title="Panel">
          <p className="text-sm">Panels group related UI.</p>
        </Panel>
      );
    case "toolbar":
      return (
        <Toolbar
          actions={[
            { id: "tb1", label: "Run", onClick: () => {} },
            { id: "tb2", label: "Stop", onClick: () => {} },
          ]}
        />
      );
    case "canvas":
      return (
        <Canvas>
          <div className="flex gap-6">
            <Node id="n1" label="Start" status="completed" type="action" />
            <Edge from="Start" label="then" to="Next" />
            <Node id="n2" label="Next" status="pending" type="task" />
          </div>
        </Canvas>
      );
    case "edge":
      return <Edge from="A" label="relates_to" to="B" />;
    case "loading":
      return <Loading message="Processing…" />;
    case "list":
      return (
        <List
          items={[
            {
              id: "l1",
              content: <div className="rounded border p-3">First</div>,
            },
            {
              id: "l2",
              content: <div className="rounded border p-3">Second</div>,
            },
            {
              id: "l3",
              content: <div className="rounded border p-3">Third</div>,
            },
          ]}
        />
      );
    case "number":
      return <SlidingNumber value={12_345} />;
    case "chart":
      return (
        <Chart
          data={[
            { name: "alpha", value: 14 },
            { name: "beta", value: 9 },
          ]}
        />
      );
    case "matrix":
      return (
        <Matrix
          cols={12}
          levels={new Array(12).fill(0).map((_, i) => i / 12)}
          mode="vu"
          rows={8}
        />
      );
    case "grid":
      return (
        <Grid cols={3}>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            A
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            B
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            C
          </div>
        </Grid>
      );
    case "dock":
      return (
        <Dock>
          <div className="h-8 w-8 rounded-full bg-white/10" />
          <div className="h-8 w-8 rounded-full bg-white/10" />
          <div className="h-8 w-8 rounded-full bg-white/10" />
        </Dock>
      );
    case "term":
      return (
        <Term
          lines={[
            { id: "t1", channel: "system", text: "▶︎ demo command" },
            { id: "t2", channel: "stdout", text: "ok" },
            { id: "t3", channel: "stderr", text: "warning: demo" },
          ]}
          maxHeight={160}
        />
      );
    case "text":
      return <Input placeholder="Text field" readOnly value="hello" />;
    case "select":
      return <SelectDemo />;
    case "date":
      return <DateDemo />;
    case "daterange":
      return <DateRangeDemo />;
    case "checkbox":
      return <CheckboxDemo />;
    case "choice":
      return <ChoiceDemo />;
    case "autocomplete":
      return <AutocompleteDemo />;
    case "dropdown":
      return <DropdownDemo />;
    case "profile":
      return <Profile />;
    default:
      return null;
  }
}

function ConfirmDemo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      <button
        className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm"
        onClick={() => setOpen(true)}
        type="button"
      >
        Trigger confirmation
      </button>
      {open ? (
        <Confirm
          description="Confirm is used for sensitive actions."
          onCancel={() => setOpen(false)}
          onConfirm={() => setOpen(false)}
          requireBio={true}
          title="Approve action?"
        />
      ) : null}
    </div>
  );
}

function ControlsDemo() {
  const [agent, setAgent] = useState<"assistant" | "orchestrator">("assistant");
  return <Controls agent={agent} onAgentChange={setAgent} onClear={() => {}} />;
}

function VoiceDemo() {
  const [selected, setSelected] = useState("piper");
  return (
    <Voice
      onSelect={setSelected}
      selected={selected}
      voices={[
        { id: "piper", name: "Piper" },
        { id: "supertonic", name: "Supertonic" },
      ]}
    />
  );
}

function VoiceBtnDemo() {
  const [rec, setRec] = useState(false);
  return <VoiceBtn isRecording={rec} onToggle={() => setRec((p) => !p)} />;
}

function MicDemo() {
  const [deviceId, setDeviceId] = useState("");
  const [muted, setMuted] = useState(false);
  return (
    <Mic
      muted={muted}
      onMutedChange={setMuted}
      onValueChange={setDeviceId}
      value={deviceId}
    />
  );
}

function ChatbarDemo() {
  const [agentId, setAgentId] = useState("");
  return (
    <div className="space-y-3">
      <Input
        onChange={(e) => setAgentId(e.target.value)}
        placeholder="ElevenLabs agentId (required)"
        value={agentId}
      />
      {agentId.trim().length > 0 ? (
        <ConversationBar agentId={agentId.trim()} />
      ) : (
        <ConversationEmptyState
          description="Enter an agentId to render the conversation bar."
          title="agentId required"
        />
      )}
    </div>
  );
}

function SelectDemo() {
  const [value, setValue] = useState("b");
  return (
    <SelectRoot onValueChange={setValue} value={value}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Beta</SelectItem>
        <SelectItem value="c">Gamma</SelectItem>
      </SelectContent>
    </SelectRoot>
  );
}

function DateDemo() {
  const [value, setValue] = useState<Date | undefined>(new Date());
  return <DateField onChange={setValue} value={value} />;
}

function DateRangeDemo() {
  const [value, setValue] = useState<DateRangeValue>({});
  return <DateRangeField onChange={setValue} value={value} />;
}

function CheckboxDemo() {
  const [checked, setChecked] = useState(true);
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => setChecked(Boolean(v))}
      />
      <span className="text-sm">Enabled</span>
    </div>
  );
}

function ChoiceDemo() {
  const [value, setValue] = useState("dark");
  return (
    <Choice
      onValueChange={setValue}
      options={[
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "system", label: "System" },
      ]}
      value={value}
    />
  );
}

function AutocompleteDemo() {
  const [value, setValue] = useState("alpha");
  const items: AutocompleteItem[] = useMemo(
    () => [
      { value: "alpha", label: "Alpha" },
      { value: "beta", label: "Beta" },
      { value: "gamma", label: "Gamma" },
    ],
    []
  );
  return <Autocomplete items={items} onValueChange={setValue} value={value} />;
}

function DropdownDemo() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded border border-white/10 bg-white/5 px-3 py-2 text-sm"
          type="button"
        >
          Open menu
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem>Item A</DropdownMenuItem>
        <DropdownMenuItem>Item B</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

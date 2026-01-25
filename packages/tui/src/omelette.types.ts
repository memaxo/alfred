declare module "omelette" {
  export type CompletionReply = (suggestions: string[]) => void;

  export interface CompletionContext {
    before?: string;
    reply: CompletionReply;
  }

  export type CompletionHandler = (ctx: CompletionContext) => void;

  export interface Completion {
    on: (pattern: string, handler: CompletionHandler) => void;
    init: () => void;
    setupShellInitFile?: () => void;
  }

  export default function omelette(name: string): Completion;
}

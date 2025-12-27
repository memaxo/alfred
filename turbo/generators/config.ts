import type { PlopTypes } from "@turbo/gen";

export default function generator(plop: PlopTypes.NodePlopAPI): void {
  plop.setGenerator("package", {
    description: "Create a new @alfred/* package",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "Package name (single lowercase word):",
        validate: (input: string) => {
          if (!/^[a-z]+$/.test(input)) {
            return "Must be a single lowercase word (no hyphens, numbers, or special characters)";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "tag",
        message: "Package boundary tag:",
        choices: [
          { name: "core (shared across server and client)", value: "core" },
          {
            name: "server-only (DB, API, runtime packages)",
            value: "server-only",
          },
          { name: "client (UI, browser packages)", value: "client" },
        ],
        default: "core",
      },
      {
        type: "input",
        name: "description",
        message: "Package description:",
        default: "A new ALFRED package",
      },
    ],
    actions: [
      {
        type: "addMany",
        destination: "packages/{{name}}",
        templateFiles: "templates/package/**/*",
        base: "templates/package",
        globOptions: { dot: true },
      },
      {
        type: "append",
        path: "tsconfig.json",
        pattern: /("references": \[)/,
        template: '    { "path": "packages/{{name}}" },',
      },
    ],
  });

  plop.setGenerator("app", {
    description: "Create a new ALFRED application",
    prompts: [
      {
        type: "input",
        name: "name",
        message: "App name (single lowercase word):",
        validate: (input: string) => {
          if (!/^[a-z]+$/.test(input)) {
            return "Must be a single lowercase word";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "type",
        message: "App type:",
        choices: [
          { name: "web (TanStack Start)", value: "web" },
          { name: "native (React Native/Expo)", value: "native" },
        ],
        default: "web",
      },
    ],
    actions: (answers) => {
      const actions: PlopTypes.ActionType[] = [];

      if (answers?.type === "web") {
        actions.push({
          type: "add",
          path: "apps/{{name}}/package.json",
          template: `{
  "name": "{{name}}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "typecheck": "tsc -b"
  }
}`,
        });
      }

      return actions;
    },
  });
}

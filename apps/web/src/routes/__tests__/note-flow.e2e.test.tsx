import "@/test/dom";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import userEvent from "@testing-library/user-event";
import { waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { createTestClient } from "@/test/client";
import {
  createTestSession,
  setTestSession,
  type TestSession,
} from "@/test/auth";
import { renderRoute } from "@/test/render-route";
import {
  cleanupTestServer,
  createTestServer,
  type TestServer,
} from "@/test/server";

const describeE2E = process.env.DATABASE_URL ? describe : describe.skip;

const noteRouteModule = await import("../_authed/note");
const NoteRouteComponent = noteRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!NoteRouteComponent) {
  throw new Error("Note route component is unavailable");
}

function renderNoteRoute(server: TestServer, session: TestSession) {
  setTestSession(session);
  const trpcClient = createTestClient(server, { session });
  return renderRoute(<NoteRouteComponent />, { trpcClient });
}

describeE2E("Note route E2E", () => {
  let server: TestServer;
  let session: TestSession;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(server);
  });

  beforeEach(async () => {
    session = createTestSession({ id: `note-user-${Date.now()}` });
    server.setSession(session);
    await server.reset();
  });

  it("renders notes fetched through tRPC", async () => {
    const client = createTestClient(server, { session });
    await client.note.create.mutate({
      title: "Seeded note",
      content: "Created via tRPC before render",
    });
    await client.note.create.mutate({
      title: "Second seed",
      content: "Another record",
    });

    const view = renderNoteRoute(server, session);

    await waitFor(() => {
      expect(view.getByText(/seeded note/i)).toBeTruthy();
      expect(view.getByText(/second seed/i)).toBeTruthy();
    });
  });

  it("creates notes via the UI and shows them in the list", async () => {
    const user = userEvent.setup();
    const view = renderNoteRoute(server, session);

    const titleInput = view.getAllByPlaceholderText(/title \(optional\)/i)[0];
    const contentInput = view.getAllByPlaceholderText(/write your note/i)[0];
    const saveButton = view.getAllByRole("button", { name: /save note/i })[0];

    await user.type(titleInput, "E2E authored");
    await user.type(contentInput, "This note was created through the UI");
    await user.click(saveButton);

    await waitFor(() => {
      expect(view.getByText(/e2e authored/i)).toBeTruthy();
      expect(
        view.getByText(/this note was created through the ui/i)
      ).toBeTruthy();
    });
  });
});

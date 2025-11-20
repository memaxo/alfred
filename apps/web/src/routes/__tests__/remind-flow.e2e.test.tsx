import "@/test/dom";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import { fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

const remindRouteModule = await import("../_authed/remind");
const RemindRouteComponent = remindRouteModule.Route?.options
  ?.component as ComponentType | undefined;

if (!RemindRouteComponent) {
  throw new Error("Remind route component is unavailable");
}

function renderRemindRoute(server: TestServer, session: TestSession) {
  setTestSession(session);
  const trpcClient = createTestClient(server, { session });
  return renderRoute(<RemindRouteComponent />, { trpcClient });
}

function toLocalInputValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

describeE2E("Remind route E2E", () => {
  let server: TestServer;
  let session: TestSession;

  beforeAll(async () => {
    server = await createTestServer();
  });

  afterAll(async () => {
    await cleanupTestServer(server);
  });

  beforeEach(async () => {
    session = createTestSession({ id: `remind-user-${Date.now()}` });
    server.setSession(session);
    await server.reset();
  });

  it("renders reminders seeded through the API", async () => {
    const client = createTestClient(server, { session });
    const futureDue = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const overdue = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    await client.remind.create.mutate({
      title: "Pay quarterly taxes",
      due: futureDue,
    });
    await client.remind.create.mutate({
      title: "Send follow-up email",
      due: overdue,
    });

    const view = renderRemindRoute(server, session);

    await waitFor(() => {
      expect(view.getByText(/pay quarterly taxes/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(view.getAllByText(/send follow-up email/i).length).toBeGreaterThan(
        0
      );
    });
    await waitFor(() => {
      expect(view.getAllByText(/needs attention/i).length).toBeGreaterThan(0);
    });
  });

  it("creates reminders through the UI using live tRPC calls", async () => {
    const user = userEvent.setup();
    const view = renderRemindRoute(server, session);

    const titleInput = view.getAllByPlaceholderText(/reminder title/i)[0];
    const dueInput = view.container.querySelector(
      'input[type="datetime-local"]'
    ) as HTMLInputElement | null;
    if (!dueInput) {
      throw new Error("Missing due date input");
    }

    const dueValue = toLocalInputValue(new Date(Date.now() + 20 * 60 * 1000));
    fireEvent.change(dueInput, { target: { value: dueValue } });
    await user.type(titleInput, "Prepare demo deck");

    const saveButton = view.getAllByRole("button", {
      name: /save reminder/i,
    })[0];
    await user.click(saveButton);

    await waitFor(() => {
      expect(view.getByText(/prepare demo deck/i)).toBeTruthy();
    });

    // The reminder cards reflect the live tRPC response, so if the new title
    // renders we know the request completed successfully.
  });
});

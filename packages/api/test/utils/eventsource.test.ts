import { describe, expect, it, beforeEach } from "bun:test";
import { MockEventSource, setupEventSourceMock } from "../utils/eventsource";

describe("MockEventSource", () => {
  beforeEach(() => {
    MockEventSource.reset();
  });

  describe("simulates connection lifecycle", () => {
    it("starts in CONNECTING state", () => {
      const source = new MockEventSource("http://test.com/stream");
      expect(source.readyState).toBe(0);
    });

    it("transitions to OPEN state after tick", async () => {
      const source = new MockEventSource("http://test.com/stream");
      let opened = false;
      source.onopen = () => {
        opened = true;
      };

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(source.readyState).toBe(1);
      expect(opened).toBe(true);
    });

    it("transitions to CLOSED state on close", () => {
      const source = new MockEventSource("http://test.com/stream");
      source.close();
      expect(source.readyState).toBe(2);
    });

    it("does not transition to OPEN if closed before tick", async () => {
      const source = new MockEventSource("http://test.com/stream");
      let opened = false;
      source.onopen = () => {
        opened = true;
      };
      source.close();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(source.readyState).toBe(2);
      expect(opened).toBe(false);
    });
  });

  describe("addMessage emits message events", () => {
    it("emits message when OPEN", async () => {
      const source = new MockEventSource("http://test.com/stream");
      let receivedData: string | null = null;
      source.onmessage = (event) => {
        receivedData = event.data;
      };

      await new Promise((resolve) => setTimeout(resolve, 10));
      source.addMessage("test data");

      expect(receivedData).toBe("test data");
    });

    it("queues messages when CONNECTING", () => {
      const source = new MockEventSource("http://test.com/stream");
      let receivedData: string | null = null;
      source.onmessage = (event) => {
        receivedData = event.data;
      };

      source.addMessage("queued data");
      expect(receivedData).toBeNull();

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(receivedData).toBe("queued data");
          resolve();
        }, 10);
      });
    });

    it("does not emit messages when CLOSED", () => {
      const source = new MockEventSource("http://test.com/stream");
      let receivedData: string | null = null;
      source.onmessage = (event) => {
        receivedData = event.data;
      };

      source.close();
      source.addMessage("should not receive");
      expect(receivedData).toBeNull();
    });
  });

  describe("close transitions to CLOSED state", () => {
    it("sets readyState to CLOSED", () => {
      const source = new MockEventSource("http://test.com/stream");
      source.close();
      expect(source.readyState).toBe(2);
    });

    it("prevents further state transitions", async () => {
      const source = new MockEventSource("http://test.com/stream");
      source.close();

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(source.readyState).toBe(2);
    });
  });

  describe("setupEventSourceMock sets global EventSource", () => {
    it("sets global EventSource to MockEventSource", () => {
      const originalEventSource = globalThis.EventSource;
      setupEventSourceMock();
      expect(globalThis.EventSource).toBe(MockEventSource);
      globalThis.EventSource = originalEventSource;
    });
  });

  describe("reset clears instances", () => {
    it("clears all instances", () => {
      new MockEventSource("http://test.com/1");
      new MockEventSource("http://test.com/2");
      expect(MockEventSource.instances.length).toBe(2);

      MockEventSource.reset();
      expect(MockEventSource.instances.length).toBe(0);
    });
  });

  describe("multiple instances", () => {
    it("can be created independently", () => {
      const source1 = new MockEventSource("http://test.com/1");
      const source2 = new MockEventSource("http://test.com/2");

      expect(source1.url).toBe("http://test.com/1");
      expect(source2.url).toBe("http://test.com/2");
      expect(MockEventSource.instances.length).toBe(2);
    });

    it("each instance has independent state", async () => {
      const source1 = new MockEventSource("http://test.com/1");
      const source2 = new MockEventSource("http://test.com/2");

      let source1Data: string | null = null;
      let source2Data: string | null = null;

      source1.onmessage = (event) => {
        source1Data = event.data;
      };
      source2.onmessage = (event) => {
        source2Data = event.data;
      };

      await new Promise((resolve) => setTimeout(resolve, 10));

      source1.addMessage("data1");
      source2.addMessage("data2");

      expect(source1Data).toBe("data1");
      expect(source2Data).toBe("data2");
    });

    it("closing one instance does not affect others", () => {
      const source1 = new MockEventSource("http://test.com/1");
      const source2 = new MockEventSource("http://test.com/2");

      source1.close();
      expect(source1.readyState).toBe(2);
      expect(source2.readyState).toBe(0);
    });
  });
});


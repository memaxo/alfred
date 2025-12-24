# Agent Control Protocol (ACP)

1. **Schema Integrity.** All communication between agents and clients must follow the `@alfred/protocol` schemas. Use Zod parsers for incoming events.

2. **Event Envelopes.** Wrap every event in a consistent envelope with `timestamp`, `eventId`, and `runId`.

3. **ACP Modes.** Honor the ACP session modes: `interactive`, `autonomous`, `supervised`.

4. **Thread Items.** Segregate thread content into atomic items: `text`, `reasoning`, `tool-call`, `tool-result`. Never mix item types in a single event.

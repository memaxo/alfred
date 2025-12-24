# Event History

1. **Event Sourcing.** Persist every user and system event in `history_events`. Events are immutable.

2. **Replay.** Implement `replay()` to hydrate state from event streams.

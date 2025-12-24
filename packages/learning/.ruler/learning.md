# Self-Supervision & Dreaming

1. **Dreaming.** Convert failed runs into `kind="heuristic"` memory nodes. Skip transient/infra errors (timeouts, 5xx) to avoid poisoning heuristics.

2. **Self-Supervision.** Detect prediction errors by comparing expected vs. actual outcomes. Generate insights with `confidence = 1 - error`.

3. **Mistake Ledger.** Record failures in the `error_ledger`. Group by category to derive frequent focus areas for autonomy updates.

4. **Feedback Loop.** Integrate explicit user feedback to update Bayesian Beta priors (`alpha`, `beta`) for autonomy.

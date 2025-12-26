# CI/CD Patterns

## Core Principle

CI/CD must be fast, reliable, and prevent regressions. Local hooks catch issues before push; CI validates across the workspace; automation handles routine tasks.

## Rules

1. **Pre-push hooks.** Use Lefthook for git hooks. Pre-push must block on type errors and test failures. Lint warnings are allowed but should not block push.

2. **CI job structure.** Main CI workflow runs 4 parallel jobs: lint, typecheck, tests, boundaries. Keep jobs independent and fast (< 5 minutes each).

3. **Turbo caching.** Always use `rharkor/caching-for-turbo@v1.7` for typecheck and test jobs. This provides free GitHub Actions cache without external dependencies.

4. **Test exclusions.** Exclude slow tests (voice, embed, perf) from main CI using `--filter='!@package/name'`. Run slow tests locally or in separate workflows.

5. **Boundaries warnings.** Package boundary violations warn but don't block CI (`continue-on-error: true`). Fix violations in follow-up PRs.

6. **Lefthook configuration.** Use `parallel: true` for pre-push hooks. Use `skip_fail: true` and `|| true` for non-blocking lint checks. Use `stage_fixed: true` for pre-commit formatting.

7. **Turbo filter syntax.** Use git-based filters `[origin/main...HEAD]` for changed-package detection in hooks. Use package name filters `--filter='!@alfred/package'` for exclusions.

8. **Cursor CLI automation.** Use `gpt-5.2` model for all CI/CD automations. Install Cursor CLI via `curl https://cursor.com/install -fsS | bash`. Use `--headless --yolo` for auto-fix, `--headless --print` for reviews.

9. **Linear integration.** Extract Linear issue IDs from branch names using `grep -oE 'ALF-[0-9]+'`. Update issue status on PR open/merge. Use `LINEAR_API_KEY` secret.

10. **Workflow concurrency.** Use `concurrency.group` with `cancel-in-progress: true` to prevent duplicate runs. Group by `github.ref` for branch-level concurrency.

11. **Secret management.** Document required secrets in `config/env.example`. Use GitHub Secrets for API keys. Reference secrets via `${{ secrets.SECRET_NAME }}`.

12. **No nightly workflows.** Run all tests in main CI or on-demand. Don't create separate nightly workflows unless tests require > 30 minutes.

13. **Poof deprecation.** Poof isolation is deprecated. ALFRED agents execute in Docker containers only. Remove Poof references from CI and package.json.

14. **Husky replacement.** Use Lefthook instead of Husky. Remove `husky` and `lint-staged` from package.json. Add `lefthook` to devDependencies and `prepare` script.

15. **Workflow file structure.** Keep workflows in `.github/workflows/`. Use descriptive names: `ci.yml`, `cursor-automation.yml`, `linear-sync.yml`. One workflow per concern.

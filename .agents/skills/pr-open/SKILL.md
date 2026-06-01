---
name: pr-open
description: |
  Open a pull request the bklit-ui way: stage and commit with pre-commit hooks,
  run ultracite from the repo root, run a production test build, fix failures, push,
  and create a PR with a structured summary. Use when the user asks to commit, push,
  open a PR, "ship it", or run the full pre-PR checklist.
---

# PR Open Skill

End-to-end workflow for committing work and opening a merge-ready PR in **bklit-ui**.

Read this skill when the user wants to add, commit, validate, push, and open a PR — or references `@pr-open`.

---

## Before you start

1. **Confirm branch context**
   - If the user merged an earlier PR on this branch and there are new changes, branch from latest `main` instead of stacking on a stale feature branch:
     ```bash
     git fetch origin main
     git checkout -b <new-branch-name> origin/main
     ```
   - Re-apply or cherry-pick only the intended changes; do not commit unrelated `registry:build` noise (e.g. reformatted `packages/ui/registry/examples/*` unless those edits are intentional).

2. **Never commit secrets** — skip `.env`, credentials, API keys, etc. Warn the user if they ask to commit them.

3. **Git safety** (required)
   - Do not update git config.
   - Do not run destructive commands (`push --force`, `reset --hard`) unless the user explicitly asks.
   - Do not skip hooks (`--no-verify`) unless the user explicitly asks.
   - Do not `git commit --amend` unless all amend rules in the user's git rules are satisfied (HEAD commit is yours, not pushed, or user requested amend).
   - If a commit **fails** due to a hook, fix the issue and create a **new** commit — do not amend a failed commit.
   - Use HEREDOC for commit messages (see below).
   - Do not push unless the user asked to push or open a PR.

---

## Step 1 — Inspect changes

Run in parallel from the repo root:

```bash
git status
git diff
git diff --staged
git log -5 --oneline
```

If opening a PR, also check divergence from base:

```bash
git fetch origin main
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

Draft a commit message that explains **why**, not just what. Match recent repo style (e.g. `feat(charts): …`, `fix(web): …`).

---

## Step 2 — Stage and commit (pre-commit loop)

### Stage

```bash
git add <paths>   # prefer explicit paths over blind git add -A
```

### Commit

```bash
git commit -m "$(cat <<'EOF'
<subject line>

<optional body — 1–2 sentences on why>
EOF
)"
```

Husky **pre-commit** runs `npx ultracite fix` (see `.husky/pre-commit`).

### If pre-commit fails or leaves unstaged fixes

1. Read the hook output and fix every reported issue (lint correctness, nested ternaries, `biome-ignore` only when justified, etc.).
2. Re-stage affected files: `git add <paths>`
3. Commit again with a **new** commit (or amend only if amend rules allow and the previous commit succeeded but the hook auto-modified files).

Repeat until `git commit` succeeds **and** `git status` is clean (no leftover hook formatting).

---

## Step 3 — Ultracite from repo root

After commits are clean, run the root pnpm scripts (not `npx ultracite` directly unless fixing a one-off):

```bash
pnpm lint          # ultracite check
```

If check fails:

```bash
pnpm lint:fix      # ultracite fix (same as pnpm format)
```

Then:

1. Review `git diff` for unexpected changes.
2. If files changed: `git add <paths>` → `git commit -m "$(cat <<'EOF'
Fix lint issues from ultracite
EOF
)"`
3. Re-run `pnpm lint` until it passes with no fixes pending.

Do not open a PR while `pnpm lint` fails or while lint fixes are unstaged.

---

## Step 4 — Test build

Run a production build to catch type and compile errors before the PR.

**Default (whole monorepo):**

```bash
pnpm build
```

**Web app only** (faster when changes are confined to `apps/web`):

```bash
cd apps/web && pnpm build
```

If the web build OOMs in dev/CI-like environments, retry with more heap:

```bash
cd apps/web && NODE_OPTIONS='--max-old-space-size=8192' pnpm build
```

**Optional but recommended** when touching TypeScript:

```bash
pnpm check-types
```

### If build fails

1. Fix the root cause (types, imports, missing registry files, etc.).
2. Re-run the failing command until it passes.
3. Commit fixes with a clear message, then re-run **Step 3** (`pnpm lint`) if source files changed.

---

## Step 5 — Push

Only when the user asked to push or open a PR:

```bash
git push -u origin HEAD
```

If the branch was already pushed and you added commits, `git push` is enough.

---

## Step 6 — Open the PR

Use GitHub CLI from the repo root:

```bash
gh pr create --title "<PR title>" --body "$(cat <<'EOF'
## Summary

- <bullet: what changed and why>
- <bullet: user-facing impact>
- <bullet: follow-ups or deploy notes if any>

## Test plan

- [ ] `pnpm lint` passes at repo root
- [ ] `pnpm build` (or `apps/web` build for web-only changes)
- [ ] <manual verification step 1>
- [ ] <manual verification step 2>

EOF
)"
```

Return the PR URL to the user.

### PR title guidelines

- Short, imperative, scoped (e.g. `Add @bklit/chart-animation registry item`)
- Match the primary commit subject when possible

### PR body template (copy structure every time)

```markdown
## Summary

- <1–3 bullets: what and why>

## Test plan

- [ ] `pnpm lint` passes at repo root
- [ ] Production build succeeds (`pnpm build` or scoped web build)
- [ ] <feature-specific check>
- [ ] <regression check if applicable>
```

Add extra sections only when useful:

- **Context** — link to a merged PR or issue (e.g. "Follow-up to #70")
- **Deploy notes** — e.g. registry JSON must be live on `ui.bklit.com` for Open in v0

### Repo-specific PR notes

- **Registry changes**: run `pnpm registry:build` from root (or `packages/ui`) before commit; include `apps/web/public/r/` outputs in the commit.
- **Do not** commit incidental reformats from `registry:build` on `packages/ui/registry/examples/*` unless intentional.
- Chart/docs work: mention manual checks for docs pages, Studio, or Open in v0 when relevant.

---

## Full checklist (quick reference)

| Step | Command / action | Must pass before next step |
|------|------------------|----------------------------|
| 1 | `git status` / `git diff` / `git log` | Understand scope |
| 2 | `git add` → `git commit` | Pre-commit hook clean; working tree clean |
| 3 | `pnpm lint` → `pnpm lint:fix` if needed → re-commit | `pnpm lint` exits 0 |
| 4 | `pnpm build` (and `pnpm check-types` if TS changed) | Build exits 0 |
| 5 | `git push -u origin HEAD` | Only if user requested push/PR |
| 6 | `gh pr create` with Summary + Test plan | PR URL returned |

---

## Common failures

| Failure | Fix |
|---------|-----|
| Pre-commit biome errors | Fix code; add `biome-ignore` only with a one-line justification |
| Hook fixed files but commit already succeeded | `git add` + new commit (or amend if allowed) |
| `pnpm lint` fails after commit | `pnpm lint:fix`, review diff, commit, re-run `pnpm lint` |
| `Can't resolve './animation'` in registry consumers | Add missing `@bklit/*` registry deps; run `pnpm registry:build` |
| Web build OOM | `NODE_OPTIONS='--max-old-space-size=8192'` for `apps/web` build |
| PR branch already merged | New branch from `origin/main`, re-apply only new changes |

---

## Example flow

User: "commit this and open a PR"

1. `git status` + `git diff` + `git log -3`
2. `git add apps/web packages/ui` → `git commit` (fix pre-commit until clean)
3. `pnpm lint` → `pnpm lint:fix` if needed → commit → `pnpm lint`
4. `pnpm build` (fix until green) → commit if needed
5. `git push -u origin HEAD`
6. `gh pr create` with Summary + Test plan template
7. Reply with PR link and one-line summary of what was validated

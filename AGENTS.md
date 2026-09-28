<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Planning Poker Workflow

### Starting an update

- Start a separate update only when the user explicitly says they are starting a "new update" or equivalent. Follow-up requests belong to the current update and branch.
- Before starting a new update, check the current branch and `git status`. Never discard, overwrite, stash, or include existing changes without authorization.
- Fetch refs with `git fetch origin`, switch to `main`, synchronize it with `git pull --ff-only origin main`, then create a new branch from it, for example `feature/<short-summary>` or `fix/<short-summary>`.
- If local changes or a pending Git operation prevent this sequence, do not switch branches. Explain the state and agree on how to preserve the work.
- Do not stage, commit, push, open a PR, merge, or accept a PR by default. The user handles these steps manually unless they explicitly ask otherwise.

### Implementation and validation

- The product and its UI are in English. Communicate with the user in Brazilian Portuguese unless they ask otherwise.
- Preserve the current architecture: Next.js statically exported to `out/`, Supabase for data and realtime, and Wrangler configured to publish the static assets. Do not switch to a Next.js server deployment or add paid services unless requested.
- Changes to Supabase functions or tables must update `supabase/schema.sql`; tell the user when they need to run the SQL in Supabase. Never add `service_role`, private tokens, or `.env.local` to Git.
- Validate app changes with `npm run lint` and `npm run build`. If changing `wrangler.jsonc` or the deployment pipeline, also validate with `npx wrangler deploy --dry-run`.
- Review the diff and preserve user changes. Do not publish as part of validation.

### Improving these instructions

- During each conversation, watch for workflow friction or missing rules supported by concrete evidence. At the end of an update, briefly review whether `AGENTS.md`, `CLAUDE.md`, or `.github/copilot-instructions.md` would benefit from a small, reusable improvement.
- Avoid speculative or duplicated rules. If a proposed improvement would change the agreed workflow, describe it to the user and ask for confirmation before editing these documents.

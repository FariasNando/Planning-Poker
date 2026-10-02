# Planning Poker — Claude Context

## Repository
- **GitHub**: https://github.com/FariasNando/Planning-Poker.git
- **Local working dir**: `C:\Users\luis.f.oliveira\PlanningPoker`
- **Main branch**: `main`
- **Maintainer**: Luís Fernando Farias Oliveira (luis.f.oliveira@accenture.com)

---

## Collaboration rules — READ FIRST

> **Never run `git commit` without explicit developer approval.**
> Implement, show the diff, and wait for confirmation. No exceptions.

> **Never commit directly to `main`.**
> All changes must go through a branch + PR flow. If a fix is needed on `main`, create a new branch (`git checkout -b fix/<name>`), apply the fix there, and open a PR.

> **Always create a new branch from `main` when starting a new feature, task, or bug fix.**
> `git checkout main && git pull && git checkout -b <branch-name>` before touching any files.

> **After finishing a task, check if CLAUDE.md needs updating, then ask before doing it.**
> Explain what was done, then ask: "Want me to update CLAUDE.md now?" — never update silently.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.6 (App Router, static export) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 — all styles as utility classes inline in components |
| Backend | Supabase (PostgreSQL + Realtime) |
| Auth | Raw UUID tokens in `localStorage`; only SHA-256 hashes stored in DB |
| State | `useState` inside `usePlanningPokerRoom` hook — no Redux/Zustand/Context |
| Cron | `pg_cron` — daily cleanup of rooms inactive for 7+ days |

No custom server. All business logic lives in **PostgreSQL RPC functions** in Supabase using `security definer` (tables have no direct anon/authenticated access).

---

## Key file map

```
src/
  app/
    page.tsx                  # Root route — wraps PlanningPokerApp in <Suspense>
    layout.tsx                # Root layout (title, meta)
    globals.css               # CSS variables, global resets, and @keyframes reveal-up — component styles use Tailwind utilities
  features/planning-poker/
    model.ts                  # Types (Player, Task, Room) and localStorage key constants
    utils.ts                  # createId, createRoomCode, formatScore, mapRoom
    PlanningPokerApp.tsx      # Screen router — reads ?room= and ?name= from URL
    use-planning-poker-room.ts # Main hook — all state and room actions
    components/
      WelcomeScreen.tsx       # Home screen (create room + join by code)
      RoomHeader.tsx          # Room header (room name badge, status, admin actions)
      RoomSidebar.tsx         # Sidebar (players with vote indicators, tasks, join form)
      GameArea.tsx            # Game area (card deck, TaskResults, AllTasksCompleted)
      ConfirmDialog.tsx       # Confirmation modal for destructive actions
  lib/
    supabase.ts               # Supabase client singleton
supabase/
  schema.sql                  # Schema, RPCs, grants, pg_cron — source of truth for the DB
.claude/
  launch.json                 # Preview server config (npm run dev, port 3000)
```

---

## Application flow

1. **Home screen (`/`)**: create a room (player name + room name) or join by 6-char code.
2. **Create room**: generates a 6-char alphanumeric code, saves tokens to `localStorage`, navigates to `/?room=CODE&name=ROOM_NAME`.
3. **Join existing room**: via invite link `/?room=CODE&name=ROOM_NAME` or the "Room code" input on the home screen.
4. **Single-room guard**: on home screen load the hook scans `localStorage` for any active room registration, verifies it still exists in Supabase, and shows a popup asking to return or leave.
5. **Inside a room**: sidebar shows players with ✓/· vote indicators. Admin selects tasks, players vote, admin reveals votes, sees results, and advances.
6. **Realtime**: Supabase Realtime (`postgres_changes` on UPDATE/DELETE) pushes state to all clients instantly.
7. **Auto-cleanup**: `pg_cron` runs daily and deletes rooms with `updated_at` older than 7 days. Any mutation (vote, new task, etc.) refreshes `updated_at`, resetting the timer.

---

## localStorage keys

| Constant in `model.ts` | Actual key | Value |
|---|---|---|
| `ADMIN_TOKEN_PREFIX` | `planning-poker-admin-<ROOM_ID>` | UUID (admin token) |
| `PLAYER_ID_PREFIX` | `planning-poker-player-<ROOM_ID>` | UUID (player id) |
| `PLAYER_TOKEN_PREFIX` | `planning-poker-player-token-<ROOM_ID>` | UUID (player token) |
| `PLAYER_JOINED_PREFIX` | `planning-poker-player-joined-<ROOM_ID>` | `"true"` |
| `PLAYER_VOTE_PREFIX` | `planning-poker-vote-<ROOM_ID>-<TASK_ID>` | number (score) |
| `ROOM_NAME_PREFIX` | `planning-poker-room-name-<ROOM_ID>` | string (room name) |

**Why `localStorage`?** `sessionStorage` is tab-specific and caused identity loss. `myVote` is stored locally because the DB hides scores during active voting (only returned after `revealed=true`). Admin token stored in localStorage is **intentional** — not a security concern.

**Admin promotion detection**: if `savedPlayerId === room.adminId` but no admin token exists locally, the hook auto-copies the player token to the admin token key. This handles the case where another player was promoted to admin (previous admin left).

---

## Supabase RPCs

All mutations go through `callRoomRpc(functionName, params)` → `.rpc()` → updates `room` via `mapRoom(data)`. `skipNextUpdateRef` prevents double-fetch when a local mutation triggers a Realtime event.

| RPC | Purpose |
|---|---|
| `get_planning_poker_room` | Initial load + realtime refresh |
| `create_planning_poker_room` | Create room (no player cap) |
| `join_planning_poker_room` | Join room (cap: 10 players per room) |
| `leave_planning_poker_room` | Non-admin player leaves |
| `admin_leave_planning_poker_room` | Admin leaves: promotes first remaining player; deletes room if empty |
| `close_planning_poker_room` | Admin permanently deletes the room |
| `reset_planning_poker_room` | Admin wipes tasks and votes, keeps room |
| `remove_planning_poker_player` | Admin kicks a player |
| `add_planning_poker_task` | Admin adds a task |
| `select_planning_poker_task` | Admin sets the active task |
| `vote_planning_poker` | Player casts a vote |
| `reveal_planning_poker_votes` | Admin reveals votes — sets `revealed=true`, keeps task active |
| `advance_planning_poker_task` | Admin advances to next task, resets `revealed=false` |
| `cleanup_planning_poker_data` | Internal — called by `pg_cron` daily |

---

## Data model

```ts
type Player = { id: string; name: string };

type Task = {
  id: string; title: string;
  votes: Record<string, number>;       // hidden until revealed=true
  voteLabels: Record<string, string>;  // hidden until revealed=true
  voterIds: readonly string[];          // always visible — who voted, no scores
  voteCount: number;
  finalScore: number | null;
};

type Room = {
  id: string; adminId: string;
  players: readonly Player[];
  tasks: readonly Task[];
  activeTaskId: string | null;
  revealed: boolean;
};
```

---

## Visual identity

CSS variables are defined in `:root` in `globals.css`. Tailwind arbitrary values reference them as `var(--name)`.

| Variable | Value | Tailwind equivalent |
|---|---|---|
| `--green` (primary) | `#0ea5e9` | `sky-500` / `text-sky-500` / `bg-sky-500` |
| `--green-dark` | `#0284c7` | `sky-600` |
| `--coral` (destructive) | `#f97316` | `orange-500` |
| `--paper` (bg) | `#0f172a` | `slate-900` |
| `--white` (surface) | `#1e293b` | `slate-800` |
| `--ink` (text) | `#f1f5f9` | `slate-100` |
| `--muted` | `#94a3b8` | `slate-400` |
| `--line` (border) | `#334155` | `slate-700` |

> Note: `--green` / `--green-dark` are legacy names from an older Accenture purple palette — they now represent sky blue.

- **Sidebar background**: `#0b1220` → `bg-[#0b1220]` (arbitrary)
- **Vote panel background**: `#1a2333` → `bg-[#1a2333]` (arbitrary)
- **Hover surface**: `#263548` → `bg-[#263548]` (arbitrary)
- **Fonts**: `Trebuchet MS` (sans, body) + `Iowan Old Style`/Georgia (serif, card numbers — reference via `[font-family:var(--serif)]`)

---

## Development patterns

- **New actions** → `use-planning-poker-room.ts` (expose in the hook's return object)
- **New styles** → Tailwind utility classes inline in the component; only touch `globals.css` for global resets or new CSS variables
- **Components are presentational** — logic stays in the hook, components receive callbacks as props
- **Schema changes** → `supabase/schema.sql` (use `create or replace function`), then apply in Supabase Dashboard SQL Editor
- **No automated tests** — verify manually in the browser with `npm run dev`
- **TypeScript** — run `npx tsc --noEmit` before showing changes to the developer

## Useful commands

```bash
npm run dev        # Dev server at :3000 (HMR active)
npx tsc --noEmit   # Type-check without building
npm run build      # Production build
```

---

## CHANGELOG conventions

File: `CHANGELOG.md` — keep it updated whenever a branch ships.

**Format:**

```markdown
## [Unreleased]

* Description of change


## [x.x.x] - yyyy-mm-dd

* Description of change
* Description of change
```

**Versioning (semantic):**

| Branch prefix | Bump |
|---|---|
| `feature/*` | minor (`x.Y.0`) |
| `fix/*` | patch (`x.x.Z`) |
| `refactor/*` | patch (`x.x.Z`) |

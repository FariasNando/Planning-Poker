# Planning Poker — Claude Context

## Repository
- **GitHub**: https://github.com/FariasNando/Planning-Poker.git
- **Local working dir**: `C:\Users\luis.f.oliveira\PlanningPoker`
- **Main branch**: `main`
- **Maintainer**: Luís Fernando Farias Oliveira (luis.f.oliveira@accenture.com)

---

## Collaboration rules — READ FIRST

> **Never run `git commit` without explicit developer approval.**
> The developer reviews all changes before committing. Implement, show the diff, and wait for confirmation. No exceptions, even when the task looks complete.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.3.6 (App Router, static export) |
| UI | React 19 + TypeScript |
| Styling | Tailwind CSS v4 + custom CSS (`globals.css`) |
| Backend | Supabase (PostgreSQL + Realtime) |
| Auth | Raw UUID tokens in `localStorage`; only SHA-256 hashes stored in DB |
| State | `useState` inside `usePlanningPokerRoom` hook — no Redux/Zustand/Context |
| Cron | `pg_cron` for scheduled cleanup of old rooms |

No custom server. All business logic lives in **PostgreSQL RPC functions** in Supabase using `security definer` (tables have no direct anon/authenticated access).

---

## Key file map

```
src/
  app/
    page.tsx                  # Root route — wraps PlanningPokerApp in <Suspense>
    layout.tsx                # Root layout (title, meta)
    globals.css               # ALL styles — custom CSS classes live here (not inline Tailwind)
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
  schema.sql                  # Schema, RPCs, grants, pg_cron
public/
  accenture-logo.png          # Logo file (not rendered in UI — removed in feature/single-room-per-player)
.claude/
  launch.json                 # Preview server config (npm run dev, port 3000)
```

---

## Application flow

1. **Home screen (`/`)**: create a room (player name + room name) or join by 6-char code.
2. **Create room**: generates a 6-char alphanumeric code, saves tokens to `localStorage`, navigates to `/?room=CODE&name=ROOM_NAME`.
3. **Join existing room**: via invite link `/?room=CODE` or the "Room code" input on the home screen.
4. **Inside a room**: sidebar shows players with ✓/· vote indicators. Admin selects tasks, players vote, admin reveals votes, sees results, and advances to the next task.
5. **Realtime**: Supabase Realtime (`postgres_changes` on UPDATE/DELETE) pushes updates to all connected clients.

### Single-room-per-player guard
- On home screen load, the hook scans `localStorage` for `planning-poker-player-joined-*` keys
- Verifies with Supabase that the room still exists
- If found, shows a popup with the room name asking to return or leave
- "Leave": calls `leave_planning_poker_room` RPC (non-admins) and clears `localStorage`

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

**Why `localStorage`?** `sessionStorage` was tab-specific and caused identity loss across tabs. `myVote` is persisted locally because the DB hides vote scores during active voting (only exposed after `revealed=true`).

---

## Supabase RPCs

All mutations go through `callRoomRpc(functionName, params)` which calls `.rpc()` and updates `room` state via `mapRoom(data)`. `skipNextUpdateRef` prevents a double-fetch when the local client's own mutation triggers a Realtime event.

| RPC function | Called by |
|---|---|
| `get_planning_poker_room` | initial load + realtime refresh |
| `create_planning_poker_room` | `createRoom` |
| `join_planning_poker_room` | `joinRoom` |
| `leave_planning_poker_room` | `leaveRoom`, `leaveExistingRoom` |
| `close_planning_poker_room` | `closeRoom` |
| `reset_planning_poker_room` | `resetRoom` |
| `remove_planning_poker_player` | `removePlayer` |
| `add_planning_poker_task` | `addTask` |
| `select_planning_poker_task` | `selectTask` |
| `vote_planning_poker` | `castVote` |
| `reveal_planning_poker_votes` | `finalizeTask` — sets `revealed=true`, keeps task active |
| `advance_planning_poker_task` | `advanceToNextTask` — moves to next task, resets `revealed=false` |

---

## Data model (Task)

```ts
type Task = {
  id: string;
  title: string;
  votes: Record<string, number>;       // hidden until revealed=true
  voteLabels: Record<string, string>;  // hidden until revealed=true
  voterIds: readonly string[];          // always visible (who voted, no scores)
  voteCount: number;
  finalScore: number | null;
};
```

`voterIds` is always returned so the ✓/· sidebar indicator works without exposing vote values.

---

## Visual identity

- **Primary color** (`--green`): `#a100ff` (purple — legacy name, represents Accenture brand)
- **Primary dark** (`--green-dark`): `#7800c4`
- **Coral** (`--coral`): `#dc775d` — destructive actions
- **Paper** (`--paper`): `#f5f5f5` — background
- **Fonts**: `Trebuchet MS` (sans) + `Iowan Old Style`/Georgia (serif for card numbers)
- **Accenture logo**: file exists in `public/` but **not rendered in UI** (removed in `feature/single-room-per-player`)

---

## Branch history

### `fix/ux-and-code-quality` ← merged into main
- Global `isLoading` state, `myVote` persisted in localStorage
- `skipNextUpdateRef` to prevent double-fetch after local mutations
- Removed dead code, replaced `window.confirm` with `<ConfirmDialog>`
- Room ID regex validation, a11y (aria-live, correct button elements)
- Rate limit (max 10 rooms), TypeScript `readonly` types

### `feature/task-results-screen` ← merged into main
- `reveal_planning_poker_votes` no longer auto-advances `active_task_id` — sets `revealed=true` only
- New RPC `advance_planning_poker_task`: admin explicitly advances, resets `revealed=false`
- `TaskResults` component: score average, per-player breakdown, Next/Finish button for admin

### `feature/vote-visibility` ← merged into main
- `voterIds` added to `get_planning_poker_room` RPC response
- ✓/· indicators in `RoomSidebar` based on `voterIds`
- "Reveal votes" button disabled until all players have voted; dynamic status text

### `feature/accenture-theme` ← merged into main (PR #10)
- Full retheme to Accenture purple, footer credit
- `.claude/launch.json` created

### `feature/single-room-per-player` ← current branch
- AC1: existing room popup on home screen
- AC2: join by code input on home screen
- AC3: "Room name" field on create form, shown in header badge and popup
- AC4: removed Accenture `<img>` logo from `WelcomeScreen` and `RoomHeader`

---

## Development patterns

- New actions → `use-planning-poker-room.ts` (expose in the hook's return object)
- New styles → `globals.css` (CSS classes, not inline Tailwind)
- Components are presentational — logic stays in the hook
- No automated tests — verify manually in the browser with `npm run dev`
- Run `npx tsc --noEmit` to validate TypeScript before showing changes to the developer

## Useful commands

```bash
npm run dev      # Dev server at :3000 (HMR active)
npx tsc --noEmit # Type-check without building
npm run build    # Production build
```

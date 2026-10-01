# Changelog

All notable changes to this project are documented here.

---

## [Unreleased]

### `feat/remove-room-limit`
- Removed the 10-room cap on simultaneous rooms — rooms are now unlimited
- Confirmed: rooms auto-delete after 7 days of inactivity; any mutation (vote, new task, etc.) resets the timer

### `feature/single-room-per-player`
- **Single-room guard**: players can only be in one room at a time. Visiting the home screen while registered in a room shows a popup asking to return or leave
- **Admin leave**: when an admin dismisses the popup ("Leave room"), the `admin_leave_planning_poker_room` RPC removes them from the room, promotes the first remaining player to admin (reusing their player token hash as the new admin token), and deletes the room if no other players remain
- **Join by code**: added "Room code" input on the home screen to navigate directly into an existing room
- **Room name**: required field on the create form; shown as a badge in the room header and in the leave popup; propagated to all clients via the `?name=` query param in the invite link
- **Removed Accenture logo** from `WelcomeScreen` and `RoomHeader`

---

## [Released — merged into main]

### `feature/accenture-theme` — PR #10
- Full visual retheme to Accenture purple (`#a100ff`)
- Added `.claude/launch.json` for preview server
- Footer credit added to `WelcomeScreen`

### `feature/vote-visibility`
- Added `voterIds` field to room state (always visible, no scores exposed before reveal)
- ✓/· vote indicators in `RoomSidebar` per player
- "Reveal votes" button disabled until all players have voted; dynamic status text

### `feature/task-results-screen`
- Added per-task results screen after admin reveals votes: average score + per-player breakdown
- Admin gets "Next task" / "Finish session" button; players see a waiting message
- `reveal_planning_poker_votes` no longer auto-advances — sets `revealed=true` only
- New RPC `advance_planning_poker_task`: admin explicitly advances to next task, resets `revealed=false`

### `fix/ux-and-code-quality`
- Global `isLoading` state; `myVote` persisted in `localStorage` across page refreshes
- `skipNextUpdateRef` to prevent double-fetch after local mutations trigger Realtime events
- Replaced `window.confirm` with `<ConfirmDialog>` component
- Room ID regex validation, a11y improvements (aria-live, semantic button elements)
- TypeScript `readonly` types across the data model
- Rooms stay for 7 days without activity; `pg_cron` runs daily cleanup

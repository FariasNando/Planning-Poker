# Changelog

---

## [Unreleased]

## [1.10.1] - 2026-10-01

- Corrected CHANGELOG version numbering: room limit removal entry renamed from `[1.9.0]` to `[1.11.0]` (main was already at `1.10.0`)
- Added "never commit directly to main" rule to CLAUDE.md
- Removed automatic PR version bump workflow from CLAUDE.md — versioning is now manual

## [1.10.0] - 2026-10-01

- Admin leave transfers ownership: `admin_leave_planning_poker_room` RPC removes admin from the room and promotes the first remaining player; if no players remain, the room is deleted
- Client detects promotion automatically and grants admin rights without page reload

## [1.9.0] - 2026-10-01

- Removed room creation cap — rooms are now unlimited
- Confirmed: rooms auto-delete after 7 days of inactivity; any room activity resets the timer

## [1.8.0] - 2026-10-01

- Single-room guard: players can only be in one room at a time; visiting the home screen while registered in a room shows a popup to return or leave
- Join by code: added "Room code" input on the home screen to navigate into an existing room directly
- Room name: required field on the create form; shown in the room header and in the popup; propagated to all clients via `?name=` in the invite link
- Removed Accenture logo from header and home screen

## [1.7.0] - 2026-09-29

- Full visual retheme to Accenture purple (`#a100ff`)
- Added author credit to the home screen footer
- Added `.claude/launch.json` for dev server preview

## [1.6.0] - 2026-09-29

- Per-player vote status indicators (✓ voted / · pending) in the sidebar
- `voterIds` always returned from the server — who voted, without exposing scores before reveal
- "Reveal votes" button disabled until all players have voted; dynamic status text

## [1.5.0] - 2026-09-28

- Added intermediate results screen after admin reveals votes: average score and per-player breakdown
- Admin gets "Next task" / "Finish session" button; players see a waiting message
- `reveal_planning_poker_votes` now only sets `revealed=true` (no longer auto-advances)
- New RPC `advance_planning_poker_task`: admin explicitly advances to next task, resets `revealed=false`

## [1.4.1] - 2026-09-28

- `myVote` persisted in `localStorage` — survives page refreshes and prevents double submissions
- `skipNextUpdateRef` prevents double-fetch after local mutations trigger Realtime events
- Replaced `window.confirm` with `<ConfirmDialog>` component
- Room ID regex validation; accessibility improvements (aria-live, semantic buttons)
- TypeScript `readonly` types across the data model
- Scheduled cleanup via `pg_cron` — deletes rooms inactive for 7+ days

## [1.4.0] - 2026-09-28

- Players can leave a room; admin can close it permanently
- Identity persistence across browser tabs (migrated from `sessionStorage` to `localStorage`)

## [1.3.0] - 2026-09-28

- Admin controls fully wired: reset room, remove players, close room

## [1.2.1] - 2026-09-28

- Codebase reorganized into `src/features/planning-poker/` structure

## [1.2.0] - 2026-09-28

- Room identity persisted across browser restarts
- Admin can reset room data and remove individual players

## [1.1.0] - 2026-09-28

- Estimation deck with cards 1–5
- Task finalization with average score calculation

## [1.0.0] - 2026-09-28

- Full UI translated to English

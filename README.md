# Planning Poker

A real-time estimation room for up to 10 players. The app is deployed on Vercel and uses Supabase Free for room data and realtime updates.

## Project structure

- `src/app/page.tsx` is a small Server Component route that provides the static page shell and the `Suspense` boundary.
- `src/features/planning-poker/PlanningPokerApp.tsx` is the client entry point for the room query parameter and interactive flow.
- `src/features/planning-poker/use-planning-poker-room.ts` owns room state, Supabase Realtime, and room actions.
- `src/features/planning-poker/components/` contains the welcome screen, room header, sidebar, and estimation view.
- `src/features/planning-poker/model.ts` and `utils.ts` hold shared types, constants, and pure helpers.
- `src/lib/supabase.ts` creates the Supabase browser client.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com/).
2. In the dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it. Run this script again after app updates that change room behavior or the database functions.
3. Under **Project Settings > API**, copy the Project URL and the public `anon`/publishable key. Never use the `service_role` key in the frontend.
4. Create a `.env.local` file in the project root using `.env.example` as a template:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
```

5. Restart the local development server after configuring the variables.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push this project to GitHub and import the repository into Vercel.
2. Set the build command to `npm run build` if it is not detected automatically. The Next.js static export writes to `out/`.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Production and Preview environment variables.
4. Deploy. Share the resulting public URL; each admin can create a room and share its invite link.

The app exports static files and does not require a paid Next.js server. Vercel and Supabase free plans are subject to their current quotas and terms; usage beyond those limits may require reducing traffic or upgrading.

## How it works

- The admin creates a room, adds tasks, and finalizes each voting round.
- The admin can reset a room, deleting all tasks and votes while keeping the room and its players.
- The admin can close a room, permanently deleting the room and all its data.
- A regular player can leave the room; their membership is removed while their existing votes remain.
- The admin can remove another player with the `×` control in that player's row. This disconnects their current session, deletes their votes, and frees a seat; they can rejoin from the invite link with a new session.
- The invite link contains only the room code, not admin credentials.
- Each player joins with a name and can vote once per task, changing their vote while the round is open.
- The deck contains 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, and 5.
- Votes remain secret in the database until the admin finalizes the task.
- Finalizing a task stores its average permanently, locks its votes, and advances to the next unfinished task. Finalized tasks cannot be reopened.
- The confirmed average is shown beside the task in the sidebar.
- The database enforces the 10-player limit for each room.
- A player's identity and role persist for the current browser tab session. Closing that session can require the player to enter their name again. The room remains available through its link while its data stays in Supabase.

## Security

The admin and player tokens are random and stored in the current browser tab's session storage; only their hashes are stored in the database. The public `anon`/publishable key is intended for frontend use, and database operations are validated by SQL functions. Never publish the `service_role` key.

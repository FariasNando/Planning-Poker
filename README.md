# Planning Poker

A real-time estimation room for up to 10 players. The app can be hosted for free with the Supabase Free plan and a free static hosting provider such as Vercel.

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com/).
2. In the dashboard, open **SQL Editor**, paste the contents of `supabase/schema.sql`, and run it.
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

## Free deployment

1. Push this project to a GitHub repository.
2. Import the repository into Vercel or another static hosting provider.
3. Set the build command to `npm run build` and the output directory to `out` if the provider asks for one.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the Production and Preview environment variables.
5. Deploy. Share the resulting public URL; each admin can create a room and share its invite link.

The app exports static files and does not require a paid Next.js server. Supabase and hosting provider free plans are subject to their current quotas and terms; usage beyond those limits may require reducing traffic or upgrading.

## How it works

- The admin creates a room, adds tasks, and reveals or hides votes.
- The invite link contains only the room code, not admin credentials.
- Each player joins with a name and can vote once per task, changing their vote while the round is open.
- Votes remain secret in the database until the admin reveals the round.
- The database enforces the 10-player limit for each room.
- A player's presence lasts while they keep their browser session. The room remains available through its link while its data stays in Supabase.

## Security

The admin and player tokens are random and stored in the browser session; only their hashes are stored in the database. The public `anon`/publishable key is intended for frontend use, and database operations are validated by SQL functions. Never publish the `service_role` key.

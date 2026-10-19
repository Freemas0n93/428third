# 428third

Interactive 3D planning and operations site for the showroom at 428 3rd St, San Francisco.

- **Space** — 3D model of the building (scan), movable catalog objects, paintable surfaces
- **Tasks** — build-out, launch, vendor and punch lists, linked to objects in the space
- **Calendar** — deliveries, installs, inspections, events, programming; ICS feed
- **Resources** — plans, vendors, permits, SOPs, specs

Roadmap and status live in the Claude project (`claude/roadmap.md`).

## Stack

| Layer | Choice |
|---|---|
| App | Vite · React 19 · TypeScript · Tailwind v4 |
| 3D | three.js via `@react-three/fiber` + `@react-three/drei` |
| State | Zustand |
| Backend | Supabase — Postgres · Auth (magic link, allow-listed) · Realtime · Storage |
| Hosting | Vercel, auto-deploy from `main` |

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key (optional until Day 3)
npm run dev                  # http://localhost:5173
```

`npm run build` type-checks and produces `dist/`. `npm run preview` serves the build.

## Deploy

1. Import this repo in Vercel (framework: Vite — detected automatically; `vercel.json` adds SPA rewrites).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under *Settings → Environment Variables*.
3. Every push to `main` deploys production; every branch/PR gets a preview URL.

## Database

1. Create a Supabase project (free tier is fine).
2. Open *SQL Editor*, paste `supabase/schema.sql`, run once. It is idempotent.
3. Add the team to the allow-list:
   ```sql
   insert into public.allowed_emails (email, role) values
     ('you@example.com', 'owner'),
     ('teammate@example.com', 'editor');
   ```
   Sign-in is refused for emails not on this list.
4. *Authentication → Providers → Email*: enable, turn **off** "Confirm email" if you want one-click magic links.

## Building model

The 3D model is the v33 corrected export (`Showroom_Corrected_Full_Detail.glb`: 2.34 M triangles, 125 MB), split into 11 layer files and optimized for the web — **22 MB in total; the default Ground view loads 8.8 MB / 301k triangles first and the upper floor (5.3 MB) prefetches behind it**. Files live in `public/models/building/` with content-hashed names (safe to cache forever); `src/data/modelLayers.ts` is generated alongside them. Exterior and roof load only when switched on.

Full pipeline, settings, measurements and re-run steps: [`scan/README.md`](scan/README.md). Raw exports go in `scan/raw/` (git-ignored).

## Conventions

- Units are meters. World frame = the export's: origin at datum A (hall floor corner, Third St front / Perry St window wall), +X down the hall away from Third St, +Z across the hall toward the brick wall, +Y up. Ground floor y = 0, upper floor y = 2.745.
- Catalog sizes: `w` = x, `d` = z, `h` = y before rotation. Object position is the footprint center on the floor it stands on.
- Colors are hex strings; paint finishes also carry a brand code and sheen.
- Anything the team edits lives in Supabase; nothing user-generated is committed to git.

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

## Scan pipeline

Raw scan exports go in `scan/raw/` (git-ignored). The optimized, calibrated GLB goes in `public/models/`.

Targets: ≤ 500k triangles · ≤ 25 MB · textures ≤ 2048² · meters · floor at y = 0 · +Z toward the street wall.

```bash
# after cleanup/decimation in Blender:
npx @gltf-transform/cli optimize scan/raw/showroom.glb public/models/showroom.glb \
  --compress draco --texture-size 2048
```

Calibration (scale/rotation/offset from two tape measurements) is stored on the `scenes.calibration` row, never baked into the file, so a re-export doesn't lose it.

## Conventions

- Units are meters. `w` = x, `d` = z, `h` = y. Object position is the footprint center on the floor.
- Colors are hex strings; paint finishes also carry a brand code and sheen.
- Anything the team edits lives in Supabase; nothing user-generated is committed to git.

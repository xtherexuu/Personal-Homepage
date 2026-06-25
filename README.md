# bartoszzaleski.com

Personal sales site for Bartosz Załęski, freelance web developer — Polish copy,
written from the client's perspective. Currently a single, cinematic hero: a
WebGL2 "NoiseMask" that reveals a night-lake photo through an organic, morphing
shape following the cursor.

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** (tokens in `app/globals.css`)
- **framer-motion** for the hero text cascade
- Custom WebGL2 fragment shader for the hero reveal (no 3D library)

> ⚠️ This is Next.js **16**, which has breaking changes vs. earlier versions.
> See [`AGENTS.md`](./AGENTS.md) before editing — read the bundled guides in
> `node_modules/next/dist/docs/` rather than relying on older Next.js knowledge.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # eslint
```

## Structure

```
app/
  layout.tsx        metadata, fonts, <html>/<body> shell
  page.tsx          renders <Hero/> + JSON-LD structured data
  globals.css       Tailwind import + "Aurora Night" design tokens
  robots.ts         robots.txt (allows all crawlers, incl. AI)
  sitemap.ts        sitemap.xml
components/hero/
  hero.tsx          WebGL2 NoiseMask reveal + <Image> LCP fallback
  hero-content.tsx  text layer (name, value prop, badges, CTAs)
public/
  hero-bg.jpg       hero background photo
  llms.txt          plain-language summary for AI agents
```

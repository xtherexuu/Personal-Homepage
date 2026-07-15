"use client";

import { useEffect, useRef } from "react";

/**
 * WhyBadges — the interactive service-tag pile that sits in the open space to the
 * RIGHT of the "JA" in the „dlaczego JA" header.
 *
 * Seven grey pill badges (Responsywność, SEO, …) settle into a loose, readable
 * pyramid heap on the left of the box (right beside „JA") and then behave as real
 * rigid bodies inside an invisible box whose walls they can't be pushed past:
 *
 *   • Desktop (hover pointer): the cursor is a „spychacz" (plow) — moving through
 *     the pile shoves badges away and along the swipe, so you can scatter them and
 *     toss them up; gravity + wall bounces pull them back into a heap.
 *   • Touch (no hover): a single decisive TAP detonates a little explosion at the
 *     tap point, flinging nearby badges outward. Holds, drags and scroll-swipes are
 *     ignored (they move too far / take too long to count as a tap), so the pile
 *     never fights the page scroll.
 *
 * Physics is matter-js, loaded lazily (dynamic import) only once this section is
 * active — it never touches the hero's first-paint bundle. The badges are plain
 * DOM elements positioned each frame from their bodies (translate + rotate), so the
 * text stays crisp and themable. The box is decorative (aria-hidden); the real list
 * of these terms is exposed as sr-only text in the header for AT / crawlers.
 *
 * The arena runs on requestAnimationFrame, which the browser pauses while the tab /
 * document is hidden, so the loop costs nothing off-screen; matter's sleeping also
 * idles the solver once the heap settles. `prefers-reduced-motion` skips physics
 * entirely and just lays the same readable pyramid out statically. The rest state is
 * always painted directly (not via an animation), so the pile is visible on the very
 * first frame even before / without the simulation running.
 */

// The service tags, in the order the client gave them. Order only seeds the heap;
// the pyramid packer re-sorts by width so the widest sit at the base.
const BADGES = [
  "Responsywność",
  "SEO",
  "Szybkość",
  "Bezpieczeństwo",
  "UX",
  "UI",
  "Wdrożenie",
  "Wsparcie po publikacji",
] as const;

// ---- Physics feel (all tunable; units are px unless noted) -------------------
const GRAVITY_Y = 1; // downward pull; scaled by GRAVITY_SCALE below
const GRAVITY_SCALE = 0.0018; // a touch heavier than matter's default so tosses fall back promptly
const RESTITUTION = 0.34; // badge bounciness
const FRICTION = 0.26; // surface friction between badges
const FRICTION_AIR = 0.022; // air drag — bleeds off a toss so the pile settles
const MAX_SPEED = 46; // px/step velocity cap (well under wall thickness → no tunnelling)

// Cursor plow (desktop hover) — dominated by cursor SPEED so a still/slow cursor
// barely nudges, while a fast swipe scatters and tosses.
const PLOW_RADIUS_K = 0.62; // reach as a fraction of box height
const PLOW_RADIAL_BASE = 0.3; // gentle constant outward shove on contact
const PLOW_RADIAL_SPEED = 0.55; // extra outward shove scaled by cursor speed
const PLOW_CARRY = 0.6; // momentum carried ALONG the swipe (enables tossing up)
const CURSOR_SPEED_CAP = 42; // clamp wild cursor velocities

// Tap explosion (touch / click)
const EXPLODE_STRENGTH = 24; // burst velocity at the epicentre
const EXPLODE_LIFT = 0.28; // upward bias so badges pop, not just spread
const TAP_MAX_MS = 320; // longer press → not a tap (a hold)
const TAP_MAX_MOVE = 12; // further travel → not a tap (a drag / scroll)

// Layout
const WALL_INSET = 2; // rest a hair inside the visual edge so shadows aren't clipped
const SEED = 0x9e3779b9; // fixed RNG seed → the "first arrangement" is stable & readable

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

// Small deterministic PRNG (mulberry32) so the initial heap looks hand-scattered
// but is identical every load — the "nice readable first arrangement" is repeatable.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Size = { w: number; h: number };
type Placement = { x: number; y: number; angle: number };
type Layout = {
  placements: Placement[];
  height: number; // total heap height
  baseW: number; // widest row → the width the heap actually occupies
  availW: number;
  availH: number;
};

const PYRAMID_ROWS = 3; // preferred rows — the pyramid look when the box allows it
const FS_MAX = 20; // px — pill cap so badges never get chunky on a big screen
const FS_MIN = 7; // px — hard floor
const ROW_CAP = 5; // never split into more than this many rows
const REF_FS = 16; // reference font-size to measure pill widths at, then scale from
const PYRAMID_BAND = 0.88; // rows within 12% of the best readability are "as good"

// Choose how many rows (and the font-size) for the heap. Every candidate row count is
// scored by the largest font-size at which its base row fits the box WIDTH and all its
// rows fit the box HEIGHT — so a narrow box naturally uses more rows (fewer, bigger
// badges per row) and a short box fewer. Among the near-best options we prefer the one
// closest to a 3-row pyramid. Widths are measured once at REF_FS and scale linearly.
function chooseLayout(
  sizesRef: readonly Size[],
  availW: number,
  availH: number,
): { rows: number; fs: number } {
  const n = sizesRef.length;
  const gapX = REF_FS * 0.55;
  const rowPitch = Math.max(...sizesRef.map((s) => s.h)) + REF_FS * 0.4;
  const widths = sizesRef.map((s) => s.w).sort((a, b) => b - a); // widest first → base
  const cands: { rows: number; fs: number }[] = [];

  for (let rows = 1; rows <= Math.min(ROW_CAP, n); rows++) {
    const baseCount = Math.floor(n / rows) + (n % rows > 0 ? 1 : 0); // biggest row
    const baseWidth = widths
      .slice(0, baseCount)
      .reduce((sum, w, i) => sum + w + (i ? gapX : 0), 0);
    const fsForWidth = (REF_FS * availW) / baseWidth;
    const fsForHeight = (REF_FS * availH) / (rows * rowPitch);
    cands.push({ rows, fs: Math.min(FS_MAX, fsForWidth, fsForHeight) });
  }

  const best = Math.max(...cands.map((c) => c.fs));
  const near = cands.filter((c) => c.fs >= best * PYRAMID_BAND);
  near.sort(
    (a, b) =>
      Math.abs(a.rows - PYRAMID_ROWS) - Math.abs(b.rows - PYRAMID_ROWS) ||
      b.fs - a.fs,
  );
  return { rows: near[0].rows, fs: clamp(near[0].fs, FS_MIN, FS_MAX) };
}

// Pack the badges into a loose, left-anchored pyramid heap resting on the floor.
// Rows are BOTTOM-HEAVY: the base row holds the most (and the widest) badges, upper
// rows fewer — a proper pyramid. Per-badge jitter keeps it from looking
// machine-stacked, and each row is centred over the base near „JA", leaving the rest
// of the (wide) box as the play area badges scatter into.
function layoutPyramid(
  sizes: readonly Size[],
  boxW: number,
  boxH: number,
  fs: number,
  rowCount: number,
  rand: () => number,
): Layout {
  const n = sizes.length;
  const margin = Math.max(WALL_INSET + 2, fs * 0.5);
  const gapX = fs * 0.55;
  const gapY = fs * 0.4;
  const tallest = Math.max(...sizes.map((s) => s.h));
  const availW = boxW - margin * 2;
  const availH = boxH - margin * 2;
  const rowPitch = tallest + gapY;
  const rows_ = clamp(rowCount, 1, n);

  // Bottom-heavy per-row counts (bottom rows get the remainder), widest badges first.
  const base = Math.floor(n / rows_);
  const extra = n % rows_;
  const order = [...sizes.keys()].sort((a, b) => sizes[b].w - sizes[a].w);

  const rows: { items: number[]; width: number }[] = [];
  let k = 0;
  for (let r = 0; r < rows_; r++) {
    const count = base + (r < extra ? 1 : 0); // r = 0 is the bottom row
    const items = order.slice(k, k + count);
    k += count;
    const width = items.reduce(
      (sum, idx, ii) => sum + sizes[idx].w + (ii ? gapX : 0),
      0,
    );
    rows.push({ items, width });
  }

  const baseW = Math.max(...rows.map((row) => row.width));
  const heapLeft = margin;
  const placements = new Array<Placement>(n);

  rows.forEach((row, ri) => {
    // ri = 0 is the bottom row; stack upward from the floor.
    const cy = boxH - margin - tallest / 2 - ri * rowPitch;
    let x = heapLeft + (baseW - row.width) / 2; // centre each row over the base
    for (const idx of row.items) {
      const { w, h } = sizes[idx];
      const jx = (rand() * 2 - 1) * fs * 0.35;
      const jy = (rand() * 2 - 1) * fs * 0.2;
      placements[idx] = {
        x: clamp(x + w / 2 + jx, WALL_INSET + w / 2, boxW - WALL_INSET - w / 2),
        y: clamp(cy + jy, WALL_INSET + h / 2, boxH - WALL_INSET - h / 2),
        angle: (rand() * 2 - 1) * 0.13, // ±~7°
      };
      x += w + gapX;
    }
  });

  return { placements, height: rows_ * rowPitch, baseW, availW, availH };
}

export function WhyBadges({ active }: { active: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const badgeRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (!active) return;
    const box = boxRef.current;
    if (!box) return;
    const els = () =>
      badgeRefs.current.filter((el): el is HTMLDivElement => el != null);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Measure natural pill sizes at a given font-size, then find a font-size where
    // the whole heap fits the box (height + widest badge). Returns the chosen sizes,
    // font-size and pyramid placement.
    const fit = () => {
      const boxW = box.clientWidth;
      const boxH = box.clientHeight;
      if (boxW < 24 || boxH < 24) return null;

      const nodes = els();
      if (nodes.length === 0) return null;

      // Measure pill widths once at the reference size, then choose row count + font.
      box.style.setProperty("--badge-fs", `${REF_FS}px`);
      const ref = nodes.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
      const estMargin = Math.max(WALL_INSET + 2, REF_FS * 0.5);
      const { rows, fs: fs0 } = chooseLayout(
        ref,
        boxW - estMargin * 2,
        boxH - estMargin * 2,
      );

      // Lay out at the chosen font; shrink only if the estimate left the base row a
      // hair too wide / tall for the real box (keeping the chosen row count).
      let fs = fs0;
      let sizes: Size[] = [];
      let plan!: Layout;
      for (let attempt = 0; attempt < 6; attempt++) {
        box.style.setProperty("--badge-fs", `${fs.toFixed(2)}px`);
        // Reading offset* forces the reflow that applies the new --badge-fs.
        sizes = nodes.map((el) => ({ w: el.offsetWidth, h: el.offsetHeight }));
        plan = layoutPyramid(sizes, boxW, boxH, fs, rows, mulberry32(SEED));
        const fits = plan.height <= plan.availH && plan.baseW <= plan.availW;
        if (fits || fs <= FS_MIN) break;
        fs *= 0.92;
      }
      return { boxW, boxH, fs, sizes, nodes, placements: plan.placements };
    };

    // Paint the pills at a set of placements (used for the static / reduced-motion
    // heap and for the very first frame before physics moves anything).
    const paint = (nodes: HTMLDivElement[], place: Placement[]) => {
      nodes.forEach((el, i) => {
        const p = place[i];
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        el.style.transform = `translate3d(${p.x - w / 2}px, ${p.y - h / 2}px, 0) rotate(${p.angle}rad)`;
        el.style.opacity = "1";
      });
    };

    // ---- Reduced motion: static readable heap, no engine, no listeners --------
    if (reduced) {
      const f = fit();
      if (f) paint(f.nodes, f.placements);
      const ro = new ResizeObserver(() => {
        const g = fit();
        if (g) paint(g.nodes, g.placements);
      });
      ro.observe(box);
      return () => ro.disconnect();
    }

    // ---- Full simulation ------------------------------------------------------
    let disposed = false;
    let stop = () => {};

    (async () => {
      const Matter = (await import("matter-js")).default;
      if (disposed) return;

      type Body = import("matter-js").Body;

      let engine: import("matter-js").Engine | null = null;
      let bodies: Body[] = [];
      let sizes: Size[] = [];
      let nodes: HTMLDivElement[] = [];
      let raf = 0;
      let builtW = 0;
      let builtH = 0;

      const wake = (b: Body) => Matter.Sleeping.set(b, false);
      const capSpeed = (b: Body) => {
        const { x, y } = b.velocity;
        const s = Math.hypot(x, y);
        if (s > MAX_SPEED)
          Matter.Body.setVelocity(b, { x: (x / s) * MAX_SPEED, y: (y / s) * MAX_SPEED });
      };

      const teardown = () => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (engine) {
          Matter.Composite.clear(engine.world, false, true);
          Matter.Engine.clear(engine);
        }
        engine = null;
        bodies = [];
      };

      const build = () => {
        const f = fit();
        if (!f) return;
        teardown();

        const { boxW, boxH, sizes: sz, nodes: nd, placements } = f;
        sizes = sz;
        nodes = nd;
        builtW = boxW;
        builtH = boxH;

        engine = Matter.Engine.create({ enableSleeping: true });
        engine.gravity.y = GRAVITY_Y;
        engine.gravity.scale = GRAVITY_SCALE;
        engine.positionIterations = 8;
        engine.velocityIterations = 6;

        const T = Math.max(300, boxW, boxH); // walls thick enough to never be tunnelled
        const wallOpts = { isStatic: true, restitution: 0.15, friction: 0.4 };
        const walls = [
          Matter.Bodies.rectangle(boxW / 2, boxH + T / 2 - WALL_INSET, boxW + 2 * T, T, wallOpts), // floor
          Matter.Bodies.rectangle(boxW / 2, -T / 2 + WALL_INSET, boxW + 2 * T, T, wallOpts), // ceiling
          Matter.Bodies.rectangle(-T / 2 + WALL_INSET, boxH / 2, T, boxH + 2 * T, wallOpts), // left
          Matter.Bodies.rectangle(boxW + T / 2 - WALL_INSET, boxH / 2, T, boxH + 2 * T, wallOpts), // right
        ];

        const kick = mulberry32(SEED ^ 0x55);
        bodies = sizes.map((s, i) => {
          const p = placements[i];
          const body = Matter.Bodies.rectangle(p.x, p.y, s.w, s.h, {
            chamfer: { radius: Math.min(s.h, s.w) / 2 - 1 }, // fully-rounded pill collider
            restitution: RESTITUTION,
            friction: FRICTION,
            frictionStatic: 0.5,
            frictionAir: FRICTION_AIR,
            angle: p.angle,
          });
          // A whisper of initial energy so the heap visibly settles on load.
          Matter.Body.setVelocity(body, {
            x: (kick() * 2 - 1) * 1.2,
            y: -kick() * 1.5,
          });
          Matter.Body.setAngularVelocity(body, (kick() * 2 - 1) * 0.05);
          return body;
        });

        Matter.Composite.add(engine.world, [...walls, ...bodies]);

        // Paint the rest pose immediately so the readable heap shows on frame 0,
        // even if rAF is throttled/paused (e.g. an off-screen preview).
        paint(nodes, placements);

        const frame = () => {
          if (!engine) return;
          Matter.Engine.update(engine, 1000 / 60);
          for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            capSpeed(b);
            const s = sizes[i];
            nodes[i].style.transform = `translate3d(${b.position.x - s.w / 2}px, ${b.position.y - s.h / 2}px, 0) rotate(${b.angle}rad)`;
          }
          raf = requestAnimationFrame(frame);
        };
        raf = requestAnimationFrame(frame);
      };

      // Cursor-in-box coordinates.
      const toBox = (e: PointerEvent) => {
        const r = box.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      // Plow: shove nearby badges outward + carry them along the swipe direction.
      const plow = (cx: number, cy: number, vx: number, vy: number) => {
        const R = Math.max(60, builtH * PLOW_RADIUS_K);
        const speed = Math.min(Math.hypot(vx, vy), CURSOR_SPEED_CAP);
        for (const b of bodies) {
          const dx = b.position.x - cx;
          const dy = b.position.y - cy;
          const dist = Math.hypot(dx, dy) || 0.001;
          if (dist > R) continue;
          const f = 1 - dist / R;
          const nx = dx / dist;
          const ny = dy / dist;
          const radial = PLOW_RADIAL_BASE + speed * PLOW_RADIAL_SPEED;
          const ax = nx * radial * f + vx * PLOW_CARRY * f * f;
          const ay = ny * radial * f + vy * PLOW_CARRY * f * f;
          wake(b);
          Matter.Body.setVelocity(b, {
            x: b.velocity.x + ax,
            y: b.velocity.y + ay,
          });
          capSpeed(b);
        }
      };

      // Explosion: radial burst away from a tap point, with a little lift.
      const burst = mulberry32(SEED ^ 0xabcd);
      const explode = (ex: number, ey: number) => {
        const R = Math.max(builtW, builtH) * 0.9;
        for (const b of bodies) {
          const dx = b.position.x - ex;
          const dy = b.position.y - ey;
          const dist = Math.hypot(dx, dy) || 0.001;
          const f = 1 - dist / R;
          if (f <= 0) continue;
          const nx = dx / dist;
          const ny = dy / dist;
          wake(b);
          Matter.Body.setVelocity(b, {
            x: b.velocity.x + nx * EXPLODE_STRENGTH * f,
            y: b.velocity.y + ny * EXPLODE_STRENGTH * f - EXPLODE_STRENGTH * EXPLODE_LIFT * f,
          });
          Matter.Body.setAngularVelocity(
            b,
            b.angularVelocity + (burst() * 2 - 1) * 0.3 * f,
          );
          capSpeed(b);
        }
      };

      // ---- Pointer wiring (all passive — never blocks scroll / deck gestures) --
      let lastX = 0;
      let lastY = 0;
      let lastT = 0;
      let downX = 0;
      let downY = 0;
      let downT = 0;
      let downValid = false;
      let moved = false;

      const onMove = (e: PointerEvent) => {
        const { x, y } = toBox(e);
        // Plow only for hover-capable pointers; on touch a move IS a scroll.
        if (e.pointerType !== "touch" && bodies.length) {
          const now = e.timeStamp;
          const dt = Math.max(8, now - lastT);
          const vx = ((x - lastX) / dt) * (1000 / 60);
          const vy = ((y - lastY) / dt) * (1000 / 60);
          if (lastT) plow(x, y, vx, vy);
          lastX = x;
          lastY = y;
          lastT = now;
        }
        if (downValid && Math.hypot(x - downX, y - downY) > TAP_MAX_MOVE) {
          moved = true; // a drag / scroll — disqualify the tap
        }
      };

      const onDown = (e: PointerEvent) => {
        const { x, y } = toBox(e);
        downX = x;
        downY = y;
        downT = e.timeStamp;
        downValid = true;
        moved = false;
        // Seed plow velocity tracking from here so the first move isn't a jump.
        lastX = x;
        lastY = y;
        lastT = e.timeStamp;
      };

      const onUp = (e: PointerEvent) => {
        if (!downValid) return;
        downValid = false;
        if (moved) return; // was a drag / scroll
        if (e.timeStamp - downT > TAP_MAX_MS) return; // was a hold
        const { x, y } = toBox(e);
        if (x < 0 || y < 0 || x > builtW || y > builtH) return;
        if (bodies.length) explode(x, y);
      };

      const onCancel = () => {
        downValid = false;
        moved = false;
      };

      // Leaving the box drops velocity tracking, so coming back doesn't fling the
      // pile with a stale cross-gap "swipe".
      const onLeave = () => {
        lastT = 0;
        downValid = false;
      };

      box.addEventListener("pointermove", onMove, { passive: true });
      box.addEventListener("pointerdown", onDown, { passive: true });
      box.addEventListener("pointerup", onUp, { passive: true });
      box.addEventListener("pointercancel", onCancel, { passive: true });
      box.addEventListener("pointerleave", onLeave, { passive: true });

      // Rebuild on meaningful resize (--ws tracks the viewport, so the box does too).
      let roTimer = 0;
      const ro = new ResizeObserver(() => {
        if (roTimer) window.clearTimeout(roTimer);
        roTimer = window.setTimeout(() => {
          if (
            Math.abs(box.clientWidth - builtW) > 2 ||
            Math.abs(box.clientHeight - builtH) > 2
          )
            build();
        }, 150);
      });
      ro.observe(box);

      build();

      stop = () => {
        if (roTimer) window.clearTimeout(roTimer);
        ro.disconnect();
        box.removeEventListener("pointermove", onMove);
        box.removeEventListener("pointerdown", onDown);
        box.removeEventListener("pointerup", onUp);
        box.removeEventListener("pointercancel", onCancel);
        box.removeEventListener("pointerleave", onLeave);
        teardown();
      };
    })();

    return () => {
      disposed = true;
      stop();
    };
  }, [active]);

  return (
    <div
      ref={boxRef}
      aria-hidden
      className="relative h-full w-full select-none overflow-hidden"
    >
      {BADGES.map((label, i) => (
        <div
          key={label}
          ref={(el) => {
            badgeRefs.current[i] = el;
          }}
          style={{ opacity: 0, transformOrigin: "center center" }}
          className="absolute left-0 top-0 inline-flex items-center whitespace-nowrap rounded-full bg-[#dbe4e0] px-[0.92em] py-[0.44em] font-sans font-semibold leading-none tracking-[-0.01em] text-[#12211f] shadow-[0_5px_14px_-5px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-black/[0.06] will-change-transform text-[length:var(--badge-fs,0.9rem)]"
        >
          {label}
        </div>
      ))}
    </div>
  );
}

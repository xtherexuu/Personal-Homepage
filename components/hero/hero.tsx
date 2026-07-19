"use client";

import Image from "next/image";
import { useEffect, useRef, type ReactNode } from "react";

import heroBg from "@/public/hero-bg.jpg";

/**
 * Hero — cursor-reactive organic "NoiseMask" reveal over a static image, ported
 * 1:1 from the madebycat.com hero (a hosted Unicorn Studio WebGL scene).
 *
 * Mechanism (faithful to their GLSL): a clean circle SDF follows the cursor, and
 * its sampling coordinate is DOMAIN-WARPED by an animated Worley/voronoi field
 * (turbulence 0.15). That warp shreds the circular boundary into chunky, morphing
 * islands / continents — the torn paint-splatter edge. Outside the mask is the
 * flat dark field (#0b1a1c). A pcg blue-noise dither posterizes the whole frame to
 * ~16 levels for the gritty film texture. The cursor target is parallax-damped +
 * eased; on touch/coarse devices it auto-drifts; the noise animates continuously.
 *
 * Drawn in a WebGL2 fragment shader (the only way to get the animated noise edge
 * GPU-cheaply). The <Image> underneath is the LCP image + graceful fallback (if
 * WebGL is unavailable the canvas hides and the photo shows).
 *
 * Perf safeguards — two independent mechanisms:
 *  1. The context is created ONCE with failIfMajorPerformanceCaveat: software
 *     rasterizers (no hardware acceleration) yield null, the canvas hides and
 *     the static <Image> underneath is the gentle fallback.
 *  2. An fps governor times real frames in ~1s windows and walks the QUALITY
 *     ladder (render scale + voronoi kernel). Debug/UI handle: setHeroQuality()
 *     from code, window.__heroQuality from the console.
 */

const DARK: [number, number, number] = [0x0b / 255, 0x1a / 255, 0x1c / 255];
const TURBULENCE = 0.34; // voronoi warp amplitude (zero-mean displacement)
const LEVELS = 16; // dither posterization levels (madebycat: ~14)
const SPEED = 0.6; // base morph speed of the mask shape
const BOOST_GAIN = 3.0; // cursor speed (px/ms) -> extra morph-speed multiplier
const BOOST_MAX = 16; // cap on the cursor-driven speed boost
const VEL_GAIN = 0.22; // cursor speed (px/ms) -> directional smear strength (0..1)

// How closely the reveal tracks the pointer (1 = exact; lower lags toward centre).
const TRACK = 0.92;
const EASE = 0.14; // per-60fps-frame follow easing (frame-rate-independent below)
const INTRO_MS = 1700;

/**
 * Render-quality ladder for the adaptive governor in draw(). Each level sets the
 * two GPU levers this scene actually has (no lights / geometry here):
 *  - rscale: backing-store scale (CSS size stays full; composes with the dpr <= 2
 *    cap in resize()) — fragment count scales with rscale²
 *  - kernel: voronoi kernel radius — 2 = 5x5 taps (reference look), 1 = 3x3
 *    (~1/3 of the per-fragment ALU, marginally simpler mask edge)
 * low therefore renders ~30% of high's fragments, each ~3x cheaper.
 */
const QUALITY = {
  low: { rscale: 0.55, kernel: 1 },
  medium: { rscale: 0.78, kernel: 2 },
  high: { rscale: 1.0, kernel: 2 },
} as const;
const QUALITY_ORDER = ["low", "medium", "high"] as const;
export type HeroQualityLevel = (typeof QUALITY_ORDER)[number];

// fps-governor tuning (all thresholds live here). fps is averaged over ~1s of
// wall-clock time (no fixed-Hz assumption); the 30–55 dead zone plus the change
// cooldown is the hysteresis that stops flapping around a single threshold.
const FPS_WINDOW_MS = 1000; // averaging window
const FPS_DOWN = 30; // avg fps below → one level down
const FPS_UP = 55; // avg fps above → one level up
const QUALITY_COOLDOWN_MS = 2500; // min gap between level changes
const GOVERNOR_WARMUP_MS = 1500; // ignore windows overlapping intro/compile jank

// Debug/UI handle for the mounted hero (the deck mounts exactly one). A manual
// set("low" | "medium" | "high") PINS the level (governor off); set("auto")
// re-enables adaptation. Mirrored on window.__heroQuality for console testing.
type QualityCtl = {
  get: () => HeroQualityLevel;
  set: (level: HeroQualityLevel | "auto") => void;
};
let qualityCtl: QualityCtl | null = null;
/** Current hero render quality, or null while the WebGL renderer isn't up. */
export const getHeroQuality = (): HeroQualityLevel | null =>
  qualityCtl ? qualityCtl.get() : null;
/** Force a quality level (pins it) or pass "auto" to resume fps adaptation. */
export const setHeroQuality = (level: HeroQualityLevel | "auto"): void =>
  qualityCtl?.set(level);

const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));
void main(){ gl_Position = vec4(P[gl_VertexID], 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 frag;

uniform vec2  uRes;     // canvas px (device)
uniform float uTime;    // seconds
uniform vec2  uMouse;   // normalised 0..1, y-up
uniform float uRadius;  // circle radius as fraction of width
uniform float uIntro;   // 0 normal .. 1 fully revealed
uniform float uTurb;    // voronoi turbulence
uniform float uLevels;  // dither levels
uniform float uSpeed;   // morph speed
uniform vec2  uVel;     // cursor velocity dir * strength(0..1) for the smear
uniform float uGrain;   // STEADY (unboosted) time for the film grain
uniform vec3  uDark;
uniform sampler2D uTex;
uniform vec2  uTexRes;
uniform int   uKernel;  // voronoi kernel radius: 2 = 5x5 (full), 1 = 3x3 (low quality)

const float PI = 3.14159265359;
mat2 rot(float a){ return mat2(cos(a), -sin(a), sin(a), cos(a)); }

vec3 hash3(vec2 p){
  vec3 q = vec3(dot(p, vec2(127.1, 311.7)),
                dot(p, vec2(269.5, 183.3)),
                dot(p, vec2(419.2, 371.9)));
  return fract(sin(q) * 43758.5453);
}

// Worley/voronoise (madebycat: 5x5 cells, scale 2.91, animated centres)
float voronoise(vec2 uv, float time, float phase){
  uv *= 0.5;   // direction 0.5
  uv *= 2.91;
  vec2 p = floor(uv), f = fract(uv);
  float va = 0.0, wt = 0.0;
  for(int j=-2;j<=2;j++)
  for(int i=-2;i<=2;i++){
    if (abs(i) > uKernel || abs(j) > uKernel) continue; // quality-governed taps
    vec2 g = vec2(float(i), float(j));
    vec3 o = hash3(p + g);
    // cells ORBIT (sin,cos) so the field flows organically rather than just bobbing
    o.xy += 0.5 * vec2(sin(time + phase + o.x * 6.2831853),
                       cos(time + phase + o.y * 6.2831853));
    vec2 r = g - f + o.xy;
    float ww = 1.0 - smoothstep(0.0, 1.4142, length(r)); // k = 1
    va += o.z * ww;
    wt += ww;
  }
  return va / max(wt, 1e-4);
}
vec2 voronoiOffset(vec2 st, float time){
  return vec2(voronoise(st, time, 0.0), voronoise(st + vec2(9.2, 1.2), time, 0.0));
}

// pcg2d blue-noise dither (madebycat: posterize + reseed once per second)
uvec2 pcg2d(uvec2 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= (v >> 16u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u;
  v ^= (v >> 16u);
  return v;
}
float randFibo(vec2 p){
  uvec2 v = pcg2d(floatBitsToUint(p));
  return float(v.x ^ v.y) / float(0xffffffffu);
}
vec3 dither(vec3 color, vec2 st){
  float delta = floor(uGrain * 24.0); // steady reseed -> grain never strobes
  vec2 off = vec2(randFibo(vec2(123.0, 16.0) + delta), randFibo(vec2(56.0, 96.0) + delta));
  float n = randFibo(st + off) - 0.005;
  return floor(color * uLevels + n) / uLevels;
}

vec2 coverUV(vec2 uv, vec2 res, vec2 img){
  float ra = res.x / res.y, ia = img.x / img.y;
  vec2 s = (ra > ia) ? vec2(1.0, ia / ra) : vec2(ra / ia, 1.0);
  return (uv - 0.5) * s + 0.5;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;       // y-up
  float aspect = uRes.x / uRes.y;
  vec2 m = uMouse;

  // domain-warp the sampling coord with an animated voronoi field -> torn edge
  vec2 st = (uv - m) * vec2(aspect, 1.0);
  st *= 13.99;
  st = rot(0.0216 * -2.0 * PI) * st;
  st += vec2(sin(uTime * 0.18), cos(uTime * 0.15)) * 2.0; // slow flow of the field
  // zero-mean voronoi displacement -> tears the edge without shifting the centre
  vec2 warped = uv + (voronoiOffset(st, uTime * uSpeed) - 0.5) * uTurb;

  // circle mask (centred on cursor); the radius breathes around its circumference
  // so the blob widens here and narrows there over time
  vec2 dv = (warped - m) * vec2(aspect, 1.0);

  // directional "wind smear": the leading edge (direction of motion) flattens as
  // if pressed by wind, the trailing edge stretches into a streak. Strength and
  // direction come from the cursor velocity (uVel); works along any axis.
  float vmag = length(uVel);
  if (vmag > 0.001) {
    vec2 vdir = uVel / vmag;
    float par = dot(dv, vdir);          // component along the motion axis
    vec2 perp = dv - par * vdir;        // component across it
    float kPar = par > 0.0 ? (1.0 + 1.15 * vmag)   // leading -> compress (flatten)
                           : (1.0 - 0.55 * vmag);  // trailing -> stretch (streak)
    float kPerp = 1.0 + 0.45 * vmag;    // narrow the streak a little (comet-like)
    dv = vdir * (par * max(kPar, 0.25)) + perp * kPerp;
  }

  float ang = atan(dv.y, dv.x);
  float breathe = 1.0 + 0.10 * sin(uTime * 0.40 + ang * 3.0)
                      + 0.07 * sin(uTime * 0.31 - ang * 5.0 + 1.7);
  float R = mix(uRadius * aspect * breathe, length(vec2(aspect, 1.0)) * 1.2, uIntro);
  float d = length(dv) - R;
  float aa = 0.004;
  float mask = 1.0 - smoothstep(-aa, aa, d);

  vec3 img = texture(uTex, coverUV(uv, uRes, uTexRes)).rgb;
  vec3 col = mix(uDark, img, mask);
  col = dither(col, gl_FragCoord.xy);

  frag = vec4(col, 1.0);
}`;

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function Hero({ children }: { children?: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarseMQ = window.matchMedia("(hover: none) and (pointer: coarse)");

    // One-shot context creation — never retried, and independent of the fps
    // governor below. failIfMajorPerformanceCaveat refuses a context that would
    // be software-rasterized (SwiftShader & co.): this full-screen shader on a
    // CPU rasterizer burns 100% CPU for a slideshow. So null here (that flag,
    // missing WebGL2, or a blocklisted driver) means "no adequate GPU" — skip
    // the whole effect and leave the static <Image> as the gentle fallback.
    // Browsers that ignore the flag still end up on the governor's lowest rung.
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) {
      canvas.style.display = "none"; // graceful fallback: show the <Image>
      return;
    }

    // Compile + link WITHOUT a synchronous status read. gl.getProgramParameter(
    // LINK_STATUS) forces the driver to FINISH compiling on the spot, freezing the
    // main thread (300ms–>1s on mobile GPUs for this shader) and blocking hydration
    // and paint. Instead we kick off the compile and poll KHR_parallel_shader_compile
    // off the main thread, wiring everything up only once the program is ready — same
    // program, same pixels, only WHEN the first frame appears changes. Where the
    // extension is absent (some iOS Safari) we fall back to today's behaviour.
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    const mkShader = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh); // status read deferred until after link completes
      return sh;
    };
    let vs: WebGLShader | null = mkShader(gl.VERTEX_SHADER, VERT);
    let fs: WebGLShader | null = mkShader(gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    // texture object + 1px dark placeholder, created up front so the image can
    // start downloading NOW — in parallel with the shader compile above — and
    // upload whenever it's ready; the placeholder keeps the first frame correct.
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
      new Uint8Array([11, 26, 28]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Initial quality: a coarse guess from CPU threads + RAM (deviceMemory is
    // Chromium-only, hardwareConcurrency gets clamped by some browsers — safe
    // defaults cover both). Deliberately biased LOW: a too-low start self-heals
    // by promotion within ~2 windows, a too-high start janks the intro. The
    // governor in draw() then corrects it from measured fps. Reduced-motion
    // renders a single static frame (no ongoing GPU cost), so it always gets
    // full quality.
    const cores = navigator.hardwareConcurrency || 4;
    const mem =
      (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
    let level: HeroQualityLevel = reduce
      ? "high"
      : cores <= 4 || mem <= 2
        ? "low"
        : cores >= 8 && mem >= 6
          ? "high"
          : "medium";

    const st = {
      w: 0, h: 0, dpr: 1, rscale: QUALITY[level].rscale,
      mx: 0, my: 0, tx: 0, ty: 0,
      hasPointer: false, texW: 1, texH: 1,
      start: 0, last: 0, raf: 0, pollRaf: 0, running: false, disposed: false,
      prevTx: 0, prevTy: 0, boost: 0, sTime: 0, velX: 0, velY: 0,
      fpsFrames: 0, fpsWindow: 0, lastChange: 0, pinned: false,
    };

    // Uniform locations + VAO are filled once the program links (finishInit below);
    // observers are created there too so nothing can fire before the program exists.
    let u: { [k: string]: WebGLUniformLocation | null } | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let ro: ResizeObserver | null = null;
    let io: IntersectionObserver | null = null;

    // Feed the WebGL texture from Next's image optimizer (AVIF/WebP, right-sized)
    // instead of the raw 347 KB JPG; fall back to the raw asset on error. The
    // width MIRRORS the variant the <Image> srcset picks for sizes="100vw"
    // (smallest deviceSize ≥ viewport CSS width × the REAL, uncapped dpr) and
    // shares q=75 — so the browser serves this from the <Image>'s cache entry:
    // one hero download for both, and a phone never pulls the full 1920px frame.
    const DEVICE_SIZES = [640, 750, 828, 1080, 1200, 1920];
    const cssW = document.documentElement.clientWidth || window.innerWidth;
    const need = Math.ceil(cssW * (window.devicePixelRatio || 1));
    const texW = DEVICE_SIZES.find((s) => s >= need) ?? 1920;

    const img = new window.Image();
    img.decoding = "async";
    img.onerror = () => {
      if (img.src.includes("/_next/image") && !st.disposed) img.src = heroBg.src;
    };
    img.onload = () => {
      if (st.disposed) return;
      st.texW = img.naturalWidth || 1;
      st.texH = img.naturalHeight || 1;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      if (u) gl.uniform2f(u.texRes, st.texW, st.texH); // else resize() sets it
    };
    img.src = `/_next/image?url=${encodeURIComponent(heroBg.src)}&w=${texW}&q=75`;

    const radiusFor = () => (st.w < 768 ? 0.4 : 0.27); // fraction of width

    const resize = () => {
      if (!u) return;
      const r = root.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = r.width;
      st.h = r.height;
      // st.rscale (≤1) downscales ONLY the backing store (set by the QUALITY
      // level); the CSS size and st.w/st.h (CSS px) stay full, so the mask
      // geometry, pointer mapping and aspect ratio are unchanged.
      const bw = Math.max(1, Math.round(r.width * st.dpr * st.rscale));
      const bh = Math.max(1, Math.round(r.height * st.dpr * st.rscale));
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(u.res, bw, bh);
      gl.uniform2f(u.texRes, st.texW, st.texH);
      gl.uniform1f(u.radius, radiusFor());
    };

    const initCentre = () => {
      st.mx = st.tx = st.prevTx = st.w / 2;
      st.my = st.ty = st.prevTy = st.h / 2;
    };

    const draw = (now: number) => {
      if (st.disposed || !u) return;
      if (!st.start) st.start = now;
      const dt = Math.min(now - st.last, 64);
      st.last = now;
      const elapsed = (now - st.start) / 1000;

      // Quality governor: average fps over ~1s wall-clock windows (counted from
      // performance.now() timestamps — no fixed-Hz assumption). Per closed
      // window: < FPS_DOWN → one level down, > FPS_UP → one level up; never more
      // than one step per window, plus QUALITY_COOLDOWN_MS between changes, so
      // the level can't oscillate around a threshold. Pauses never pollute a
      // window (startLoop re-anchors it). Off under a manual setHeroQuality()
      // pin and under reduced-motion (single static frame — nothing to measure).
      if (!reduce && !st.pinned) {
        st.fpsFrames++;
        const win = now - st.fpsWindow;
        if (win >= FPS_WINDOW_MS) {
          const fps = (st.fpsFrames * 1000) / win;
          st.fpsFrames = 0;
          st.fpsWindow = now;
          if (
            now - st.start > GOVERNOR_WARMUP_MS &&
            now - st.lastChange >= QUALITY_COOLDOWN_MS
          ) {
            const i = QUALITY_ORDER.indexOf(level);
            const next = fps < FPS_DOWN ? i - 1 : fps > FPS_UP ? i + 1 : i;
            if (next !== i && next >= 0 && next < QUALITY_ORDER.length) {
              st.lastChange = now;
              applyQuality(QUALITY_ORDER[next]);
            }
          }
        }
      }

      const introT = Math.min((now - st.start) / INTRO_MS, 1);
      const intro = reduce ? 0 : 1 - easeOutExpo(introT);

      if (!st.hasPointer && coarseMQ.matches && !reduce) {
        const ax = st.w * 0.3, ay = st.h * 0.26;
        st.tx = st.w / 2 + Math.sin(elapsed * 0.34) * ax + Math.sin(elapsed * 0.21) * ax * 0.25;
        st.ty = st.h / 2 + Math.sin(elapsed * 0.27 + 1.7) * ay + Math.cos(elapsed * 0.16) * ay * 0.2;
      }

      // cursor velocity this frame (px, screen y-down) -> drives BOTH a big speed
      // boost on the morph AND the directional "wind smear" of the shape.
      const vxi = st.tx - st.prevTx;
      const vyi = st.ty - st.prevTy;
      st.prevTx = st.tx;
      st.prevTy = st.ty;
      const speed = Math.hypot(vxi, vyi) / Math.max(dt, 1); // px/ms

      // morph-speed boost: surges on move, eases back to base when it rests.
      const targetBoost = reduce ? 0 : Math.min(speed * BOOST_GAIN, BOOST_MAX);
      const bk = targetBoost > st.boost ? 0.4 : 0.05; // fast attack, slow release
      st.boost += (targetBoost - st.boost) * (1 - Math.pow(1 - bk, dt / (1000 / 60)));
      st.sTime += (dt / 1000) * (1 + st.boost);

      // smoothed velocity vector (px/ms) for the smear; the trailing streak
      // lingers a touch after you stop (fast attack, slow release).
      const ivx = vxi / Math.max(dt, 1);
      const ivy = vyi / Math.max(dt, 1);
      const vk = speed > Math.hypot(st.velX, st.velY) ? 0.5 : 0.08;
      const vsm = 1 - Math.pow(1 - vk, dt / (1000 / 60));
      st.velX += (ivx - st.velX) * vsm;
      st.velY += (ivy - st.velY) * vsm;
      let uvx = 0, uvy = 0;
      const sp = Math.hypot(st.velX, st.velY);
      if (!reduce && sp > 1e-4) {
        const strength = Math.min(sp * VEL_GAIN, 1);
        uvx = (st.velX / sp) * strength;
        uvy = (-st.velY / sp) * strength; // flip y -> shader y-up
      }

      const a = reduce ? 1 : 1 - Math.pow(1 - EASE, dt / (1000 / 60));
      st.mx += (st.tx - st.mx) * a;
      st.my += (st.ty - st.my) * a;

      gl.uniform1f(u.time, reduce ? 0 : st.sTime);
      gl.uniform1f(u.grain, reduce ? 0 : elapsed); // grain on REAL time, not boosted
      gl.uniform1f(u.intro, intro);
      gl.uniform2f(u.mouse, st.mx / Math.max(st.w, 1), 1 - st.my / Math.max(st.h, 1));
      gl.uniform2f(u.vel, uvx, uvy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!st.disposed && st.running) st.raf = requestAnimationFrame(draw);
    };

    const startLoop = () => {
      if (st.running || st.disposed) return;
      st.running = true;
      st.last = performance.now();
      st.fpsFrames = 0;
      st.fpsWindow = st.last; // fresh fps window — a pause must not read as ~0fps
      st.raf = requestAnimationFrame(draw);
    };
    const stopLoop = () => {
      st.running = false;
      cancelAnimationFrame(st.raf);
    };

    // The loop runs only while the hero is BOTH on screen and the tab is visible.
    // The page is one native scroll, so once you scroll past the hero it leaves
    // the viewport and this suspends the heavy full-screen shader — it must never
    // keep burning the GPU behind the content below. `onScreen` is kept honest by
    // the IntersectionObserver (finishInit); sync() is the single place that folds
    // the two conditions into a start or a stop, so a tab-return can't restart an
    // off-screen hero.
    let onScreen = true;
    const sync = () => {
      if (reduce || st.disposed) return;
      if (onScreen && !document.hidden) startLoop();
      else stopLoop();
    };

    // Switch the live renderer to a quality level. Safe to call before the
    // program links — it only records state then, and finishInit() applies it.
    const applyQuality = (l: HeroQualityLevel) => {
      if (level === l) return;
      level = l;
      st.rscale = QUALITY[l].rscale;
      if (u) {
        gl.uniform1i(u.kernel, QUALITY[l].kernel);
        resize();
        // reduced-motion has no loop — repaint its single frame at the new level
        if (reduce && !st.running) draw(performance.now());
      }
    };
    const dropQualityCtl = () => {
      qualityCtl = null;
      delete (window as Window & { __heroQuality?: QualityCtl }).__heroQuality;
    };
    qualityCtl = {
      get: () => level,
      set: (l) => {
        if (l === "auto") {
          st.pinned = false;
          st.fpsFrames = 0;
          st.fpsWindow = performance.now(); // a stale window must not decide
          return;
        }
        if (!(l in QUALITY)) return; // window handle gets untyped console input
        st.pinned = true; // manual choice wins until set("auto")
        applyQuality(l);
      },
    };
    (window as Window & { __heroQuality?: QualityCtl }).__heroQuality =
      qualityCtl;

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      st.hasPointer = true;
      const r = root.getBoundingClientRect();
      st.tx = st.w / 2 + (e.clientX - r.left - st.w / 2) * TRACK;
      st.ty = st.h / 2 + (e.clientY - r.top - st.h / 2) * TRACK;
    };

    const onVis = () => sync();

    // A real GL context loss (GPU reset, driver timeout) invalidates every GL
    // object and we don't rebuild them — so hide the now-dead canvas to reveal
    // the <Image> LCP fallback underneath instead of covering it with a blank
    // layer. Only ever runs in the already-broken state; normal paths untouched.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      stopLoop();
      canvas.style.display = "none";
      dropQualityCtl(); // renderer is dead — stop reporting/accepting levels
    };

    // Wire everything up once the shader program has linked (driven by the poll
    // below). Deferring this — instead of reading LINK_STATUS synchronously — is
    // what lets the heavy mobile shader compile on a background thread without
    // freezing hydration; observers/listeners attach here so nothing fires early.
    const finishInit = () => {
      if (st.disposed) return;
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(
          "[hero] WebGL link failed:",
          gl.getProgramInfoLog(program),
          fs && gl.getShaderInfoLog(fs),
          vs && gl.getShaderInfoLog(vs),
        );
        canvas.style.display = "none"; // graceful fallback: show the <Image>
        dropQualityCtl();
        return;
      }
      gl.useProgram(program);
      if (vs) { gl.deleteShader(vs); vs = null; }
      if (fs) { gl.deleteShader(fs); fs = null; }

      vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const loc = (n: string) => gl.getUniformLocation(program, n);
      u = {
        res: loc("uRes"), time: loc("uTime"), mouse: loc("uMouse"),
        radius: loc("uRadius"), intro: loc("uIntro"), turb: loc("uTurb"),
        levels: loc("uLevels"), speed: loc("uSpeed"), vel: loc("uVel"),
        grain: loc("uGrain"), dark: loc("uDark"), tex: loc("uTex"),
        texRes: loc("uTexRes"), kernel: loc("uKernel"),
      };
      gl.uniform3fv(u.dark, DARK);
      gl.uniform1i(u.tex, 0);
      gl.uniform1f(u.turb, TURBULENCE);
      gl.uniform1f(u.levels, LEVELS);
      gl.uniform1f(u.speed, SPEED);
      gl.uniform1i(u.kernel, QUALITY[level].kernel);

      root.addEventListener("pointermove", onMove, { passive: true });
      ro = new ResizeObserver(() => {
        resize();
        if (!st.hasPointer) initCentre();
        st.tx = clamp(st.tx, 0, st.w);
        st.ty = clamp(st.ty, 0, st.h);
      });
      ro.observe(root);
      // pause when off-screen / tab hidden (the effect is otherwise perpetual)
      io = new IntersectionObserver(
        ([entry]) => {
          if (reduce) return;
          onScreen = entry.isIntersecting;
          sync();
        },
        { threshold: 0.01 },
      );
      io.observe(root);
      document.addEventListener("visibilitychange", onVis);
      canvas.addEventListener("webglcontextlost", onContextLost);

      resize();
      initCentre();
      if (reduce) {
        st.start = performance.now();
        st.last = st.start;
        draw(st.start); // single static frame, centred
      } else {
        // Seed on-screen from a rect so a hero that mounts already scrolled past
        // (a reload landed deep in the page) doesn't start the loop; the observer
        // above then keeps it honest.
        const r0 = root.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        onScreen = r0.bottom > 0 && r0.top < vh;
        sync();
      }
    };

    // Poll for compile/link completion off the main thread (one rAF apart, so it
    // overlaps hydration + first paint). Fall back to proceeding immediately when
    // the extension is missing, and cap the wait so a driver that never reports
    // completion can't strand the effect.
    const compileStart = performance.now();
    const poll = () => {
      if (st.disposed) return;
      const ready =
        !parallel ||
        gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true ||
        performance.now() - compileStart > 3000;
      if (ready) finishInit();
      else st.pollRaf = requestAnimationFrame(poll);
    };
    st.pollRaf = requestAnimationFrame(poll);

    return () => {
      st.disposed = true;
      dropQualityCtl();
      stopLoop();
      cancelAnimationFrame(st.pollRaf);
      root.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      ro?.disconnect();
      io?.disconnect();
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      id="hero"
      data-nav-section="hero"
      data-copy-spaces
      className="relative h-dvh w-full overflow-hidden bg-[#0b1a1c]"
    >
      {/* LCP image + graceful fallback (covered by the canvas when WebGL works). */}
      <Image
        src={heroBg}
        alt=""
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        quality={75}
        placeholder="blur"
        className="select-none object-cover"
        draggable={false}
      />

      {/* WebGL NoiseMask reveal. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Legibility scrim — dims both flanks (left where the copy sits, right
          under the nav rail) and keeps the mask vivid through the centre, plus a
          soft floor for the lower elements. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-1"
        style={{
          background:
            "linear-gradient(96deg, rgba(11,26,28,0.75) 0%, rgba(11,26,28,0.6) 20%, rgba(11,26,28,0.2) 35%, rgba(11,26,28,0) 50%), linear-gradient(-96deg, rgba(11,26,28,0.75) 0%, rgba(11,26,28,0.6) 10%, rgba(11,26,28,0.2) 25%, rgba(11,26,28,0) 50%), linear-gradient(0deg, rgba(11,26,28,0.55) 0%, rgba(11,26,28,0) 20%)",
        }}
      />

      {/* Text layer (server-rendered, passed in as children — see page.tsx). */}
      {children}
    </section>
  );
}

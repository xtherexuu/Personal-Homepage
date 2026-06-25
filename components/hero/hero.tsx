"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

import heroBg from "@/public/hero-bg.jpg";
import { HeroContent } from "@/components/hero/hero-content";

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

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("shader compile: " + log);
  }
  return sh;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function Hero() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarseMQ = window.matchMedia("(hover: none) and (pointer: coarse)");

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      canvas.style.display = "none"; // graceful fallback: show the <Image>
      return;
    }

    let program: WebGLProgram;
    try {
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) || "link failed");
      }
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    } catch (e) {
      console.error("[hero] WebGL init failed:", e);
      canvas.style.display = "none";
      return;
    }
    gl.useProgram(program);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const loc = (n: string) => gl.getUniformLocation(program, n);
    const u = {
      res: loc("uRes"), time: loc("uTime"), mouse: loc("uMouse"),
      radius: loc("uRadius"), intro: loc("uIntro"), turb: loc("uTurb"),
      levels: loc("uLevels"), speed: loc("uSpeed"), vel: loc("uVel"),
      grain: loc("uGrain"), dark: loc("uDark"), tex: loc("uTex"),
      texRes: loc("uTexRes"),
    };
    gl.uniform3fv(u.dark, DARK);
    gl.uniform1i(u.tex, 0);
    gl.uniform1f(u.turb, TURBULENCE);
    gl.uniform1f(u.levels, LEVELS);
    gl.uniform1f(u.speed, SPEED);

    // texture (1px placeholder until the image decodes)
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE,
      new Uint8Array([11, 26, 28]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const st = {
      w: 0, h: 0, dpr: 1,
      mx: 0, my: 0, tx: 0, ty: 0,
      hasPointer: false, texW: 1, texH: 1,
      start: 0, last: 0, raf: 0, running: false, disposed: false,
      prevTx: 0, prevTy: 0, boost: 0, sTime: 0, velX: 0, velY: 0,
    };

    const radiusFor = () => (st.w < 768 ? 0.4 : 0.27); // fraction of width

    const resize = () => {
      const r = root.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = r.width;
      st.h = r.height;
      const bw = Math.max(1, Math.round(r.width * st.dpr));
      const bh = Math.max(1, Math.round(r.height * st.dpr));
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

    // Feed the WebGL texture from Next's image optimizer (AVIF/WebP, resized)
    // instead of the raw 347 KB JPG; fall back to the raw asset on error.
    const img = new window.Image();
    img.decoding = "async";
    img.onerror = () => {
      if (img.src.includes("/_next/image") && !st.disposed) img.src = heroBg.src;
    };
    img.src = `/_next/image?url=${encodeURIComponent(heroBg.src)}&w=1920&q=75`;
    img.onload = () => {
      if (st.disposed) return;
      st.texW = img.naturalWidth || 1;
      st.texH = img.naturalHeight || 1;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.uniform2f(u.texRes, st.texW, st.texH);
    };

    const draw = (now: number) => {
      if (st.disposed) return;
      if (!st.start) st.start = now;
      const dt = Math.min(now - st.last, 64);
      st.last = now;
      const elapsed = (now - st.start) / 1000;

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
      st.raf = requestAnimationFrame(draw);
    };
    const stopLoop = () => {
      st.running = false;
      cancelAnimationFrame(st.raf);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      st.hasPointer = true;
      const r = root.getBoundingClientRect();
      st.tx = st.w / 2 + (e.clientX - r.left - st.w / 2) * TRACK;
      st.ty = st.h / 2 + (e.clientY - r.top - st.h / 2) * TRACK;
    };
    root.addEventListener("pointermove", onMove, { passive: true });

    const ro = new ResizeObserver(() => {
      resize();
      if (!st.hasPointer) initCentre();
      st.tx = clamp(st.tx, 0, st.w);
      st.ty = clamp(st.ty, 0, st.h);
    });
    ro.observe(root);

    // pause when off-screen / tab hidden (the effect is otherwise perpetual)
    const io = new IntersectionObserver(
      ([entry]) => {
        if (reduce) return;
        if (entry.isIntersecting && !document.hidden) startLoop();
        else stopLoop();
      },
      { threshold: 0.01 },
    );
    io.observe(root);
    const onVis = () => {
      if (reduce) return;
      if (document.hidden) stopLoop();
      else startLoop();
    };
    document.addEventListener("visibilitychange", onVis);

    // A real GL context loss (GPU reset, driver timeout) invalidates every GL
    // object and we don't rebuild them — so hide the now-dead canvas to reveal
    // the <Image> LCP fallback underneath instead of covering it with a blank
    // layer. Only ever runs in the already-broken state; normal paths untouched.
    const onContextLost = (e: Event) => {
      e.preventDefault();
      stopLoop();
      canvas.style.display = "none";
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    resize();
    initCentre();
    if (reduce) {
      st.start = performance.now();
      st.last = st.start;
      draw(st.start); // single static frame, centred
    } else {
      startLoop();
    }

    return () => {
      st.disposed = true;
      stopLoop();
      root.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      ro.disconnect();
      io.disconnect();
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <section
      ref={rootRef}
      id="hero"
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
        quality={90}
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

      {/* Legibility scrim — dims the left where the copy sits, keeps the effect
          vivid toward the right. Plus a soft floor for the lower elements. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(96deg, rgba(11,26,28,0.94) 0%, rgba(11,26,28,0.72) 28%, rgba(11,26,28,0.32) 52%, rgba(11,26,28,0) 72%), linear-gradient(0deg, rgba(11,26,28,0.55) 0%, rgba(11,26,28,0) 32%)",
        }}
      />

      {/* Text layer. */}
      <HeroContent />
    </section>
  );
}

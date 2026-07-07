"use client";

import Image, { getImageProps, type StaticImageData } from "next/image";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { usePanelActive, useSection } from "./section-context";

// One art-directed pair per part: BIG = portrait (desktop column), SMALL = 3:1
// landscape (mobile banner). Static imports so next/image gets a blur placeholder
// + intrinsic size and the optimizer can emit AVIF/WebP variants.
import bizPortrait from "@/public/why/PH-czyTaOsobaRozumieMojBiznes-BIG-opt.jpg";
import bizLandscape from "@/public/why/PH-czyTaOsobaRozumieMojBiznes-SMALL-opt.jpg";
import supportPortrait from "@/public/why/PH-czyZostaneSam-BIG-opt.jpg";
import supportLandscape from "@/public/why/PH-czyZostaneSam-SMALL-opt.jpg";
import resultPortrait from "@/public/why/PH-finalnyEfekt-BIG-opt.jpg";
import resultLandscape from "@/public/why/PH-finalnyEfekt-SMALL-opt.jpg";

/**
 * WhyMeReveal — closing panel of "Dlaczego ja?". After the kinetic intro panels,
 * this reveals three long-form answers to the questions a prospective client is
 * really asking. Each "part" is one answer.
 *
 * Layout:
 *  - lg+ : two columns — a SCROLLABLE text column on the left, and a full-height
 *          image column on the right. The image is effectively "sticky": it's its
 *          own non-scrolling column, so only the text moves when the copy overflows.
 *  - <lg : one column — a landscape image pinned to the TOP of the scroll area
 *          (so it scrolls away with the copy), text below, and the nav bar pinned
 *          to the bottom of the viewport.
 *
 * Navigation between the three parts: the bottom Prev/Next buttons, OR scrolling —
 * once the copy is scrolled to its edge, a little extra overscroll walks to the
 * next/previous part (handled by the deck's SubNav; see SectionDeck). Only at the
 * first part's top / last part's bottom does the gesture fall through to the deck
 * and step to an adjacent panel.
 *
 * Type scales fluidly with the viewport (a --rv unit built from vw + vh, so it
 * grows on large screens and shrinks to avoid needless scroll on tiny ones, in
 * either orientation). Headings sit in mint typographic quotes — low „ opens,
 * high ” closes. A muted "1 / 3" counter faces the eyebrow across the header.
 *
 * Images use next/image, art-directed: the BIG portrait serves the desktop column,
 * the SMALL 3:1 landscape serves the mobile banner. Each part carries its own pair
 * (see PARTS). Delivery is handled by next/image: content-hashed static imports give
 * a blur placeholder + intrinsic size, and the optimizer serves AVIF/WebP at q75
 * sized to the slot via `sizes` (formats/quality in next.config images).
 */

type Part = {
  eyebrow: string;
  title: string;
  paragraphs: readonly string[];
  portrait: StaticImageData;
  landscape: StaticImageData;
  alt: string;
};

const PARTS: readonly Part[] = [
  {
    eyebrow: "Dlaczego ja?",
    title: "Czy ta osoba rzeczywiście rozumie mój biznes?",
    paragraphs: [
      "Zanim rozpocznę pracę, umawiamy się na rozmowę, podczas której omawiamy Twoją firmę, cel strony i to, co ma ona realnie osiągnąć. Nie projektuję strony przypadkowo. Najpierw chcę zrozumieć, do kogo ma trafiać, czego szukają Twoi klienci i jakie działanie chcesz, aby wykonali.",
      "Zadaję konkretne pytania, bo dobra strona powinna nie tylko dobrze wyglądać, ale też jasno prowadzić użytkownika. Jeśli nie pracowałem wcześniej przy podobnym typie biznesu, poświęcam czas na przejrzenie konkurencji i zrozumienie oczekiwań klientów w danej branży.",
      "Pomagam również przy treściach. Bazuję na informacjach od Ciebie, ale mogę pomóc ubrać je w słowa tak, aby brzmiały profesjonalnie, jasno i zachęcająco.",
    ],
    portrait: bizPortrait,
    landscape: bizLandscape,
    alt: "Ilustracja: właściciel firmy nocą przy laptopie, w zamyśleniu nad notatnikiem z listą „cel, klienci, przekaz, działanie” — strona planowana wokół celów biznesu.",
  },
  {
    eyebrow: "Dlaczego ja?",
    title: "Czy po zakończeniu projektu zostanę ze stroną sam?",
    paragraphs: [
      "Nie urywam kontaktu z klientem zaraz po zakończeniu projektu. Po oddaniu strony nadal możesz się do mnie odezwać, jeśli pojawi się problem, pytanie albo coś przestanie działać tak, jak powinno.",
      "W miarę możliwości staram się odpowiadać i pomagać także po zakończeniu współpracy. Przy drobnych sprawach często wystarczy szybka wiadomość i wyjaśnienie. Większe zmiany, rozbudowa strony albo nowe funkcje mogą wymagać dodatkowej wyceny, ale sam kontakt pozostaje prosty i dostępny.",
      "Dla mnie dobrze wykonany projekt to nie tylko ładna strona w dniu oddania. To też poczucie, że klient wie, co dalej z nią zrobić i do kogo może się zgłosić, gdy będzie potrzebował wsparcia.",
    ],
    portrait: supportPortrait,
    landscape: supportLandscape,
    alt: "Ilustracja: klient nocą przy laptopie z ekranem „projekt zakończony” i wątkiem wiadomości z szybką odpowiedzią oraz listą przekazania projektu — kontakt i wsparcie po oddaniu strony.",
  },
  {
    eyebrow: "Dlaczego ja?",
    title: "Czy finalny efekt mi się spodoba?",
    paragraphs: [
      "Nie zostawiam klienta w niepewności do samego końca projektu. W trakcie pracy pokazuję postępy i daję możliwość zobaczenia, jak strona wygląda na konkretnych etapach. Dzięki temu możesz na bieżąco ocenić kierunek projektu i zgłaszać sensowne poprawki.",
      "Ważne jest jednak trzymanie się wcześniejszych ustaleń. Jeśli jakaś sekcja wymaga dopracowania, zmiany układu albo innego podejścia wizualnego, można to omówić i poprawić. Końcowy etap projektu nie jest jednak momentem na całkowite przeprojektowanie strony od zera, jeśli wcześniej zaakceptowaliśmy jej kierunek.",
      "Dzięki temu praca jest uporządkowana, a efekt końcowy nie jest przypadkiem. Jest wynikiem wspólnie podejmowanych decyzji i regularnej komunikacji w trakcie projektu.",
    ],
    portrait: resultPortrait,
    landscape: resultLandscape,
    alt: "Ilustracja: klient nocą przy laptopie ogląda gotową stronę obok diagramu „projekt krok po kroku” z wersją wstępną i wersją po poprawkach — praca etapami z akceptacją kierunku.",
  },
];

const PROJECTS_HREF = "/projekty"; // subpage nie istnieje jeszcze — patrz notatka

// next/image `sizes` per slot — shared by the <Image> tags AND the idle preloader
// below, so a warmed request and the later real one resolve to the exact same
// optimized variant (a straight cache hit, no re-fetch).
const PORTRAIT_SIZES = "(min-width: 1024px) 40vw, 100vw"; // desktop right column
const BANNER_SIZES = "100vw"; // mobile 3:1 banner

// Fluid type unit: scales with the smaller-feeling of width/height so it works in
// both orientations, from ~300×500 up to 4K. Body = --rv, heading = 2×, eyebrow ≈ 0.6×.
const FLUID = {
  "--rv": "clamp(0.95rem, calc(0.6rem + 0.6vw + 0.4vh), 1.85rem)",
} as CSSProperties;
const EYEBROW_SIZE: CSSProperties = {
  fontSize: "clamp(0.6rem, calc(var(--rv) * 0.6), 0.9rem)",
};

function QuotedHeading({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{ fontSize: "calc(var(--rv) * 2)" }}
      className="mt-[0.5em] max-w-[18em] text-pretty font-display font-bold leading-[1.1] tracking-[-0.01em] text-paper"
    >
      <span aria-hidden className="text-mint">
        „
      </span>
      {children}
      <span aria-hidden className="text-mint">
        ”
      </span>
    </h2>
  );
}

const navBtn =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line text-paper transition-colors duration-200 hover:border-mint hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:border-line/40 disabled:text-muted/35 disabled:hover:border-line/40 disabled:hover:text-muted/35";

export function WhyMeReveal() {
  const isActive = usePanelActive();
  const { registerSubNav } = useSection();
  const [part, setPart] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const total = PARTS.length;
  const active = PARTS[part];
  const atFirst = part === 0;
  const atLast = part === total - 1;

  const move = (dir: number) =>
    setPart((p) => Math.min(total - 1, Math.max(0, p + dir)));

  // Let scrolling past the copy's edge walk between parts (deck reads this at a
  // boundary). Registered only while active so other panels step normally, and
  // re-registered whenever `part` changes so `canAdvance` always sees the current
  // part (no lagging ref) — advance stays a clamped functional update regardless.
  useEffect(() => {
    if (!isActive) return;
    registerSubNav({
      canAdvance: (dir) => (dir > 0 ? part < total - 1 : part > 0),
      advance: (dir) =>
        setPart((p) => Math.min(total - 1, Math.max(0, p + dir))),
    });
    return () => registerSubNav(null);
  }, [isActive, part, registerSubNav, total]);

  // Reset to the first part (and scroll to the top) whenever the panel re-enters
  // view, so it always opens on the first question. Deferred to a timer callback
  // (not a synchronous effect body) to avoid a cascading-render lint/perf hit — the
  // panel is crossfading in over this tick, so the reset is never visible.
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => {
      setPart(0);
      scrollRef.current?.scrollTo({ top: 0 });
    }, 0);
    return () => clearTimeout(t);
  }, [isActive]);

  // Switching parts starts each answer from its heading.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [part]);

  // Preload the OTHER parts' artwork in the background. This panel only renders the
  // active part's <Image>, so parts 2/3 would otherwise pop in the moment you step to
  // them — and this panel itself may first appear only after navigating here from an
  // earlier section. Instead, once the browser goes idle (so we never fight the hero's
  // LCP), warm the images the current width actually shows: portraits on lg+, the 3:1
  // banner below. getImageProps builds the exact same optimized srcSet/sizes the real
  // <Image> will request, so arriving/stepping is a cache hit with no visible load.
  // Skipped on data-saver / 2g so a metered connection isn't charged for it.
  useEffect(() => {
    const conn = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    if (conn?.saveData || (conn?.effectiveType && /2g/.test(conn.effectiveType))) return;

    const warm = () => {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      for (const p of PARTS) {
        const { props } = getImageProps({
          alt: "",
          fill: true,
          quality: 75,
          src: desktop ? p.portrait : p.landscape,
          sizes: desktop ? PORTRAIT_SIZES : BANNER_SIZES,
        });
        const img = new window.Image();
        img.fetchPriority = "low";
        if (props.sizes) img.sizes = props.sizes;
        if (props.srcSet) img.srcset = props.srcSet;
        if (props.src) img.src = props.src;
        img.decode?.().catch(() => {});
      }
    };

    const ric = window.requestIdleCallback;
    if (ric) {
      const id = ric(warm, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="czemu-ja-3"
      aria-label="Dlaczego ja? — odpowiedzi na najczęstsze pytania"
      style={FLUID}
      className="relative flex h-full w-full flex-col overflow-hidden bg-surface lg:flex-row"
    >
      {/* ---------- Text column (scrolls) + nav bar ---------- */}
      <div className="flex min-h-0 flex-1 flex-col lg:order-1">
        <div
          ref={scrollRef}
          data-deck-scroll
          role="region"
          tabIndex={0}
          aria-label="Treść — przewiń, aby przeczytać całość"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint/30"
        >
          {/* Mobile banner — top of the scroll area, scrolls with the copy. Keyed
              by image src (not part) so it only re-fades when the picture actually
              changes; with one shared image it stays mounted across parts. */}
          <div
            key={active.landscape.src}
            className="why-reveal-fade relative h-[clamp(150px,32vh,300px)] w-full shrink-0 lg:hidden"
          >
            <Image
              src={active.landscape}
              alt={active.alt}
              fill
              sizes={BANNER_SIZES}
              quality={75}
              placeholder="blur"
              className="object-cover"
              draggable={false}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/15 to-transparent"
            />
          </div>

          {/* Copy — keyed by part so it fades on each part change */}
          <div
            key={part}
            className="why-reveal-fade px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-14 xl:px-20 2xl:px-24"
          >
            {/* Header row: eyebrow (left) faces a muted part counter (right) */}
            <div className="flex items-baseline justify-between gap-4">
              <p
                style={EYEBROW_SIZE}
                className="font-mono uppercase tracking-[0.3em] text-mint/80"
              >
                {active.eyebrow}
              </p>
              <span
                style={EYEBROW_SIZE}
                className="shrink-0 select-none font-mono tabular-nums text-muted/55"
              >
                {part + 1} / {total}
              </span>
            </div>

            <QuotedHeading>{active.title}</QuotedHeading>

            <div
              style={{ fontSize: "var(--rv)" }}
              className="mt-[1.1em] max-w-[64ch] space-y-[1.15em] leading-relaxed text-muted hyphens-auto text-justify"
            >
              {active.paragraphs.map((text, i) => (
                <p key={i}>{text}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Nav bar — pinned below the copy. Bottom padding respects the iOS home
            indicator when the viewport is drawn edge-to-edge (a no-op otherwise). */}
        <div className="shrink-0 border-t border-line bg-surface/70 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-10 lg:px-14 xl:px-20 2xl:px-24">
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => move(-1)}
                disabled={atFirst}
                aria-label="Poprzednia część"
                className={navBtn}
              >
                <ArrowLeft className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                disabled={atLast}
                aria-label="Następna część"
                className={navBtn}
              >
                <ArrowRight className="size-5" strokeWidth={1.75} aria-hidden />
              </button>
            </div>

            <a
              href={PROJECTS_HREF}
              style={{
                fontSize: "clamp(0.9rem, calc(0.78rem + 0.35vw), 1.15rem)",
              }}
              className="group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-paper/30 bg-transparent px-4 py-2.5 font-semibold text-paper transition duration-200 hover:-translate-y-0.5 hover:border-paper/60 hover:bg-paper/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:px-5"
            >
              <span className="hidden sm:inline">Przejdź do projektów</span>
              <span className="sm:hidden">Projekty</span>
              <ArrowUpRight
                className="size-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden
              />
            </a>
          </div>
        </div>
      </div>

      {/* ---------- Image column (desktop, full height) ----------
          data-deck-scroll-proxy: a wheel/swipe over the image scrolls the text
          column (the deck routes the gesture there) instead of jumping straight
          to the next panel — see resolveScroll in SectionDeck. */}
      <aside
        aria-hidden
        data-deck-scroll-proxy
        className="relative hidden h-full w-[42%] shrink-0 select-none lg:order-2 lg:block xl:w-[40%] 2xl:w-[40%]"
      >
        {/* Keyed by image src (not part): the full-height image stays put while the
            copy changes, and only re-fades if a part introduces a different picture. */}
        <div key={active.portrait.src} className="why-reveal-fade absolute inset-0">
          <Image
            src={active.portrait}
            alt=""
            fill
            sizes={PORTRAIT_SIZES}
            quality={75}
            placeholder="blur"
            className="object-cover"
            draggable={false}
          />
        </div>
        {/* Melt the image's left edge into the text column: a wide, eased fade so
            the night-forest edge dissolves into the surface with no visible seam.
            Uses surface-at-zero-alpha (not the `transparent` keyword) so the ramp
            stays a clean fade instead of shifting toward black at the midpoint. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-surface from-0% via-surface/40 via-[46%] to-surface/0 to-100%"
        />
        {/* Soft contact shadow right at the seam — a narrow, feathered darkening
            that gives the image a sense of depth over the text column. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/20 to-transparent"
        />
      </aside>
    </section>
  );
}

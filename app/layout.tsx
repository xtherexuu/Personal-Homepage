import type { Metadata, Viewport } from "next";
import {
  Anton,
  Bricolage_Grotesque,
  Geist,
  Geist_Mono,
  Hanken_Grotesk,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";

import { SITE } from "@/lib/site";

const anton = Anton({
  variable: "--font-anton",
  weight: "400", // Anton ships a single (very heavy) weight
  subsets: ["latin", "latin-ext"], // the name carries Ł / Ę
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "latin-ext"], // accent phrase carries ą / ś
  style: "italic",
  display: "swap",
  preload: false, // one accent phrase, not LCP — don't contend at t=0
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"], // value line carries ą / ż / ó
  display: "swap",
  preload: false, // hero value line, not LCP — defer the preload
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false, // no longer on the first-paint hero — sections/menu only
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false, // body copy, not LCP — don't contend with the hero image at t=0
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"], // badges carry ć / ż (Responsywność, Wdrożenie)
  display: "swap",
  preload: false, // eyebrow + badges, not LCP — defer the preload
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: "Bartosz Załęski — Strony internetowe dla firm i marek",
    template: "%s · Bartosz Załęski",
  },
  description:
    "Projektuję i wdrażam nowoczesne, szybkie strony internetowe, które budują zaufanie i zdobywają klientów. Dopracowany design, responsywność, podstawowe SEO, wdrożenie i wsparcie po publikacji — od pomysłu do gotowej strony.",
  keywords: [
    "strony internetowe",
    "tworzenie stron internetowych",
    "projektowanie stron internetowych",
    "strony internetowe dla firm",
    "web developer",
    "freelancer strony www",
    "responsywne strony",
    "SEO",
    "Next.js",
  ],
  authors: [{ name: "Bartosz Załęski" }],
  creator: "Bartosz Załęski",
  applicationName: "Bartosz Załęski",
  category: "technology",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    url: "/",
    siteName: "Bartosz Załęski",
    title: "Bartosz Załęski — Strony internetowe dla firm i marek",
    description:
      "Nowoczesne, szybkie strony internetowe, które budują zaufanie i zdobywają klientów. Design, responsywność, podstawowe SEO, wdrożenie i wsparcie po publikacji.",
    images: [{ url: "/hero-bg.jpg", width: 1672, height: 941, alt: "Bartosz Załęski — strony internetowe" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bartosz Załęski — Strony internetowe dla firm i marek",
    description:
      "Nowoczesne, szybkie strony internetowe, które budują zaufanie i zdobywają klientów.",
    images: ["/hero-bg.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1a1c",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pl"
      data-scroll-behavior="smooth"
      className={`${anton.variable} ${playfair.variable} ${geistSans.variable} ${bricolage.variable} ${hanken.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}

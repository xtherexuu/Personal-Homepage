import { Hero } from "@/components/hero/hero";
import { HeroContent } from "@/components/hero/hero-content";
import { Panel } from "@/components/sections/panel";
import { SectionDeck } from "@/components/sections/section-deck";
import { Why } from "@/components/sections/why";
import { SITE } from "@/lib/site";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "Bartosz Załęski",
      inLanguage: "pl-PL",
      publisher: { "@id": `${SITE}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE}/#person`,
      name: "Bartosz Załęski",
      url: SITE,
      jobTitle: "Web Developer & Projektant stron internetowych",
      description:
        "Freelancer tworzący nowoczesne, szybkie strony internetowe dla firm i marek.",
      knowsAbout: [
        "Strony internetowe",
        "Projektowanie stron internetowych",
        "Next.js",
        "React",
        "TypeScript",
        "SEO",
        "Optymalizacja szybkości stron",
        "Responsywny design",
      ],
    },
    {
      "@type": "ProfessionalService",
      "@id": `${SITE}/#service`,
      name: "Bartosz Załęski — Tworzenie stron internetowych",
      description:
        "Projektowanie i wdrażanie nowoczesnych, szybkich stron internetowych dla firm i marek: design, responsywność, podstawowe SEO, wdrożenie i wsparcie po publikacji.",
      url: SITE,
      image: `${SITE}/hero-bg.jpg`,
      inLanguage: "pl-PL",
      areaServed: { "@type": "Country", name: "Polska" },
      availableLanguage: "pl",
      provider: { "@id": `${SITE}/#person` },
      serviceType: "Tworzenie stron internetowych",
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Usługi",
        itemListElement: [
          "Strony internetowe dla firm",
          "Landing page",
          "Strony z prostą edycją treści (CMS)",
          "Rozbudowane strony z funkcjami",
          "Opieka i rozwój strony po publikacji",
        ].map((s) => ({
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: s },
        })),
      },
    },
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main>
        <SectionDeck>
          <Panel id="hero">
            <Hero>
              <HeroContent />
            </Hero>
          </Panel>
          <Panel id="czemu-ja">
            <Why />
          </Panel>
        </SectionDeck>
      </main>
    </>
  );
}

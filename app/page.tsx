import { Hero } from "@/components/hero/hero";
import { HeroContent } from "@/components/hero/hero-content";
import { Contact } from "@/components/sections/contact";
import { Offer } from "@/components/sections/offer";
import { SectionDeck } from "@/components/sections/section-deck";
import { Why } from "@/components/sections/why";
import { CONTACT, SITE } from "@/lib/site";

// The same identity everywhere: `sameAs` + `email` read from CONTACT (lib/site),
// so the JSON-LD, the contact tiles and llms.txt can never drift apart — that
// cross-source consistency is what lets Google / AI engines reconcile the entity.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      url: SITE,
      name: "Bartosz Załęski",
      description:
        "Strona Bartosza Załęskiego — projektowanie i wdrażanie nowoczesnych, szybkich stron internetowych dla firm i marek.",
      inLanguage: "pl-PL",
      publisher: { "@id": `${SITE}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE}/#person`,
      name: "Bartosz Załęski",
      url: SITE,
      email: CONTACT.email,
      sameAs: [CONTACT.instagram, CONTACT.facebook],
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
      email: CONTACT.email,
      sameAs: [CONTACT.instagram, CONTACT.facebook],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        email: CONTACT.email,
        availableLanguage: "pl",
      },
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
      {/* `<` is escaped per the Next.js JSON-LD guide: JSON.stringify doesn't
          sanitize, and a literal `<` inside a <script> could open an XSS hole
          if any field ever stops being a hand-written constant. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <main>
        {/* One page, one scroll: the hero sits at the top of the same natively-
            scrolling region as every content section, so there's no transition
            between them — you just scroll. The hero's WebGL mask pauses itself the
            moment it leaves the viewport (its own IntersectionObserver), so it
            stops costing anything once you've scrolled past it. Adding a section
            is just dropping it in here; the nav lists it by its data-nav-section. */}
        <SectionDeck>
          <Hero>
            <HeroContent />
          </Hero>
          <Why />
          <Offer />
          <Contact />
        </SectionDeck>
      </main>
    </>
  );
}

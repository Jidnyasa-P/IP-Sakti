import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

export interface OfficialPortalLink {
  id: string;
  label: string;
  url: string;
}

interface OfficialPartnersCarouselProps {
  links: OfficialPortalLink[];
}

/** Official partner links taken directly from the supplied manifest.json. */
const MANIFEST_PARTNERS: OfficialPortalLink[] = [
  { id: "ip-india", label: "IP India", url: "https://ipindia.gov.in/resource/patents-resources-act" },
  { id: "ppvfra", label: "PPV&FR Authority", url: "https://plantauthority.gov.in/compendium-varieties-registered-under-ppvfr-act-2001" },
  { id: "nba", label: "National Biodiversity Authority", url: "https://www.nbaindia.nic.in/acts-and-rules/acts" },
  { id: "cdsco", label: "CDSCO", url: "https://cdsco.gov.in/opencms/opencms/en/Acts-and-rules/Drugs-and-Cosmetics-Act/" },
  { id: "fssai", label: "FSSAI", url: "https://fssai.gov.in/food-law/regulations" },
  { id: "wipo", label: "WIPO", url: "https://www.wipo.int/pct/en/" },
  { id: "india-code", label: "India Code", url: "https://indiacode.gov.in/act/a0e67f19-8e2e-4ba2-bde4-6354e5ff7dee/sections" },
  { id: "meity", label: "MeitY", url: "https://www.meity.gov.in/documents/act-and-policies?page=2" },
  { id: "cbd", label: "Convention on Biological Diversity", url: "https://www.cbd.int/abs/" },
];

export const OfficialPartnersCarousel: React.FC<OfficialPartnersCarouselProps> = ({ links }) => {
  const partners = MANIFEST_PARTNERS;


  const [startIndex, setStartIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(5);
  const [stepPx, setStepPx] = useState(0);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const update = () => {
      if (window.innerWidth < 640) setVisibleCount(1);
      else if (window.innerWidth < 900) setVisibleCount(2);
      else if (window.innerWidth < 1280) setVisibleCount(3);
      else setVisibleCount(5);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const measure = () => {
      const width = viewportRef.current?.clientWidth || 0;
      if (!width) return;
      const gap = 14;
      const cardWidth = (width - gap * (visibleCount - 1)) / visibleCount;
      setStepPx(cardWidth + gap);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [visibleCount, partners.length]);

  useEffect(() => {
    const maxStart = Math.max(0, partners.length - visibleCount);
    if (startIndex > maxStart) setStartIndex(0);
  }, [partners.length, visibleCount, startIndex]);

  useEffect(() => {
    if (partners.length <= visibleCount) return;

    const timer = window.setInterval(() => {
      setStartIndex((current) => {
        const maxStart = Math.max(0, partners.length - visibleCount);
        return current >= maxStart ? 0 : current + 1;
      });
    }, 3200);

    return () => window.clearInterval(timer);
  }, [partners.length, visibleCount]);

  const gapPx = 14;
  const cardWidth = `calc((100% - ${(visibleCount - 1) * gapPx}px) / ${visibleCount})`;

  const goPrevious = () => {
    setStartIndex((current) => {
      const maxStart = Math.max(0, partners.length - visibleCount);
      return current <= 0 ? maxStart : current - 1;
    });
  };

  const goNext = () => {
    setStartIndex((current) => {
      const maxStart = Math.max(0, partners.length - visibleCount);
      return current >= maxStart ? 0 : current + 1;
    });
  };

  return (
    <section
      className="w-full bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-4 sm:py-5"
      aria-label="Official partner organizations"
    >
      <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8">
        <div className="mb-3 text-center">
          <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Official Knowledge Partners
          </p>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous partner"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-800 hover:bg-blue-900 text-white shadow-md flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div ref={viewportRef} className="mx-12 sm:mx-16 overflow-hidden">
            <div
              className="flex items-stretch transition-transform duration-700 ease-in-out will-change-transform"
              style={{
                gap: `${gapPx}px`,
                transform: `translateX(-${startIndex * stepPx}px)`,
              }}
            >
              {partners.map((partner) => (
                <a
                  key={`${partner.id}-${partner.url}`}
                  href={partner.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 min-h-28 sm:min-h-32 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex flex-col items-center justify-center gap-2 px-4 py-4 hover:border-emerald-400 hover:shadow-md transition-all"
                  style={{ width: cardWidth }}
                  title={`Official link — ${partner.label}`}
                  aria-label={`Open official link for ${partner.label}`}
                >
                  <span className="text-center text-sm sm:text-base font-semibold leading-tight text-slate-800 dark:text-slate-100">
                    {partner.label}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Official link
                    <ExternalLink className="h-3 w-3" />
                  </span>
                </a>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next partner"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-800 hover:bg-blue-900 text-white shadow-md flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </section>
  );
};

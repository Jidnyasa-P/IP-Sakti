import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Landmark } from "lucide-react";

export interface OfficialPortalLink {
  id: string;
  label: string;
  url: string;
}

interface OfficialPartnersCarouselProps {
  links: OfficialPortalLink[];
}

const FALLBACK_LOGO = "https://www.google.com/s2/favicons?domain=example.com&sz=128";

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "official portal";
  }
}

function logoFor(url: string): string {
  const host = hostnameFor(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
}

export const OfficialPartnersCarousel: React.FC<OfficialPartnersCarouselProps> = ({ links }) => {
  const partners = useMemo(() => {
    const seenHosts = new Set<string>();
    return links.filter((link) => {
      const host = hostnameFor(link.url);
      if (seenHosts.has(host)) return false;
      seenHosts.add(host);
      return Boolean(link.url);
    });
  }, [links]);

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
      const gap = 12;
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

  if (partners.length === 0) return null;

  const gapPx = 12;
  const cardWidth = `calc((100% - ${(visibleCount - 1) * gapPx}px) / ${visibleCount})`;

  return (
    <section className="w-full bg-white dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 py-5 sm:py-6" aria-label="Official partner and source portals">
      <div className="w-full max-w-[1800px] mx-auto px-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] text-emerald-800 dark:text-emerald-400">Official Sources</p>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verified portals referenced by IP-SAKTI</p>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-400">
            <Landmark className="w-3.5 h-3.5" />
            Government & international knowledge portals
          </div>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setStartIndex((current) => current <= 0 ? Math.max(0, partners.length - visibleCount) : current - 1)}
            aria-label="Previous official source"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-blue-800 hover:bg-blue-900 text-white shadow-md flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <div ref={viewportRef} className="mx-11 sm:mx-14 overflow-hidden">
            <div
              className="flex items-stretch transition-transform duration-700 ease-in-out will-change-transform"
              style={{ gap: `${gapPx}px`, transform: `translateX(-${startIndex * stepPx}px)` }}
            >
              {partners.map((partner) => (
                <a
                  key={`${partner.id}-${partner.url}`}
                  href={partner.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 min-w-0 h-24 sm:h-28 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg px-4 flex items-center justify-center gap-3 hover:border-emerald-400 hover:shadow-md transition-all"
                  style={{ width: cardWidth }}
                  title={`Open ${partner.label}`}
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-md bg-white flex items-center justify-center shrink-0 border border-slate-100 overflow-hidden">
                    <img
                      src={logoFor(partner.url)}
                      alt={`${partner.label} logo`}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_LOGO;
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">{partner.label}</p>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 truncate">{hostnameFor(partner.url)}</p>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStartIndex((current) => {
              const maxStart = Math.max(0, partners.length - visibleCount);
              return current >= maxStart ? 0 : current + 1;
            })}
            aria-label="Next official source"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 sm:h-11 sm:w-11 rounded-lg bg-blue-800 hover:bg-blue-900 text-white shadow-md flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>
    </section>
  );
};

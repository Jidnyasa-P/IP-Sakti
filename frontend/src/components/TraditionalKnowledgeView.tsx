import React, { useState } from "react";
import {
  Shield,
  Leaf,
  Globe,
  FileCheck,
  AlertCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  Info,
  FileDown,
  ExternalLink,
} from "lucide-react";
import { Citation, TKABSQuery, TKABSResult } from "../types";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { useTranslation } from "../context/LanguageContext";
import { exportTKABSToPDF } from "../utils/pdfGenerator";
import { authFetch } from "./auth/authStorage";

interface TraditionalKnowledgeViewProps {
  onOpenCitation: (citation: Citation) => void;
}

export const TraditionalKnowledgeView: React.FC<
  TraditionalKnowledgeViewProps
> = ({ onOpenCitation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<TKABSQuery>({
    biological_resource: "Withania somnifera (Ashwagandha)",
    plant_material: "Dried roots and root extract",
    geographic_origin: "Central India (Madhya Pradesh / Rajasthan)",
    traditional_use:
      "Rasayana (rejuvenative), balya (strength-promoting), and stress management in classical Ayurveda (Charaka Samhita)",
    source_community_info:
      "Procured from registered farmer cooperatives and cultivated farm estates with BMC records",
    intended_use: "Commercial utilization",
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TKABSResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const handleExportPDF = () => {
    if (!result) return;
    setIsExportingPDF(true);
    try {
      exportTKABSToPDF(result, formData);
    } catch (err) {
      console.error("Failed to export TK-ABS PDF dossier:", err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const plantPresets = [
    {
      name: "Withania somnifera (Ashwagandha)",
      material: "Roots & hydro-ethanolic extract",
      origin: "Madhya Pradesh & Rajasthan",
      use: "Rasayana, stress adaptation, joint vitality",
      community: "Cultivated via local farmer producer organizations (FPO)",
      intended: "Commercial utilization" as const,
    },
    {
      name: "Curcuma longa (Haridra / Turmeric)",
      material: "Rhizome powder and standardized curcuminoids",
      origin: "Kerala & Tamil Nadu",
      use: "Vranaropana (wound healing), anti-inflammatory, digestive enhancer",
      community: "Agricultural farmland with state mandi cess certification",
      intended: "IP filing" as const,
    },
    {
      name: "Bacopa monnieri (Brahmi)",
      material: "Whole aerial plant biomass and standardized bacosides",
      origin: "Wetlands of West Bengal and Odisha",
      use: "Medhya Rasayana (cognitive function, memory retention)",
      community: "Wild collection from wetland habitats by local gatherers",
      intended: "Foreign entity utilization" as const,
    },
    {
      name: "Commiphora mukul (Guggulu)",
      material: "Purified gum resin (Shuddha Guggulu)",
      origin: "Arid tracts of Rajasthan & Gujarat",
      use: "Deepana, pachana, medoroga (lipid balance), and anti-arthritic formulations",
      community:
        "Forest department licensed tapping through tribal cooperatives",
      intended: "Commercial utilization" as const,
    },
  ];

  const supportedTKABSResources = [
    "withania somnifera",
    "curcuma longa",
    "bacopa monnieri",
    "commiphora mukul",
  ];

  const tkdlAccessMessage =
    "TKDL access is currently restricted and is not available in this system. TK & ABS analysis can currently be demonstrated using the four preset biological resources provided above: Ashwagandha, Turmeric, Brahmi, and Guggulu.";

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    const resource = (formData.biological_resource || "").trim().toLowerCase();
    const isSupportedResource = supportedTKABSResources.some((name) =>
      resource.includes(name),
    );

    if (!isSupportedResource) {
      setError(tkdlAccessMessage);
      setLoading(false);
      return;
    }

    try {
      const res = await authFetch("/api/abs/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.detail || `Analysis failed (HTTP ${res.status})`,
        );
      }
      const data: TKABSResult = await res.json();
      setResult(data);
    } catch (e: any) {
      console.error("ABS research error:", e);
      setError(e?.message || "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Title & Introduction */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <Shield className="w-3.5 h-3.5 text-emerald-700" />
          <span>Access and Benefit Sharing (ABS) & TKDL Compliance</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">
          {t("tk.title", "Traditional Knowledge & Biological Resources")}
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          {t(
            "tk.subtitle",
            "Evaluate biological resource compliance under the Biological Diversity Act 2002 and 2023 Amendments, National Biodiversity Authority (NBA) approval requirements, and Traditional Knowledge Digital Library (TKDL) prior art bars.",
          )}
        </p>
      </div>
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {/* Quic
      k Presets */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <span className="text-xs font-bold text-slate-700 block">
          Preset Authoritative Biological Resources:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {plantPresets.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => {
                setFormData({
                  biological_resource: p.name,
                  plant_material: p.material,
                  geographic_origin: p.origin,
                  traditional_use: p.use,
                  source_community_info: p.community,
                  intended_use: p.intended,
                });
                setResult(null);
              }}
              className="p-2.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 text-left transition-all text-xs group"
            >
              <span className="font-semibold text-slate-900 group-hover:text-emerald-950 block truncate">
                {p.name.split("(")[0]}
              </span>
              <span className="text-[11px] text-slate-500 block truncate">
                {p.name.split("(")[1]?.replace(")", "") || p.origin}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Query Form */}
      <div
        id="tk-abs-form-card"
        className="p-4 sm:p-6 md:p-8 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-6"
      >
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
          <Leaf className="w-4 h-4 text-emerald-700" />
          Biological Resource & Traditional Knowledge Parameters
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Biological Resource / Botanical Name *
            </label>
            <input
              type="text"
              value={formData.biological_resource}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  biological_resource: e.target.value,
                })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Plant Material / Part Used
            </label>
            <input
              type="text"
              value={formData.plant_material}
              onChange={(e) =>
                setFormData({ ...formData, plant_material: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Geographic Origin & State
            </label>
            <input
              type="text"
              value={formData.geographic_origin}
              onChange={(e) =>
                setFormData({ ...formData, geographic_origin: e.target.value })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Intended Activity / Utilization
            </label>
            <select
              value={formData.intended_use}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  intended_use: e.target.value as any,
                })
              }
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden bg-white"
            >
              <option value="Commercial utilization">
                Commercial manufacturing in India (Section 7 SBB)
              </option>
              <option value="IP filing">
                Applying for Patent / IPR (Section 6 NBA Form III)
              </option>
              <option value="Foreign entity utilization">
                Foreign Entity / NRI / Foreign Collaboration (Section 3 NBA Form
                I)
              </option>
              <option value="Academic research">
                Pure Academic Research (Section 5 exemption)
              </option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Documented Traditional Use & Ayurvedic Reference
          </label>
          <textarea
            rows={2}
            value={formData.traditional_use}
            onChange={(e) =>
              setFormData({ ...formData, traditional_use: e.target.value })
            }
            className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">
            Sourcing Provenance & Community / Cultivation Details
          </label>
          <textarea
            rows={2}
            value={formData.source_community_info}
            onChange={(e) =>
              setFormData({
                ...formData,
                source_community_info: e.target.value,
              })
            }
            className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            id="run-tk-abs-analysis-btn"
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-2"
          >
            {loading ? (
              <span>Querying NBA & TKDL Repositories...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Evaluate TK & ABS Obligations</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Header Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[11px] font-bold text-emerald-800 tracking-wider uppercase">
                Statutory Assessment Dossier
              </span>
              <h2 className="text-xl font-serif font-bold text-slate-900">
                {formData.biological_resource}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                id="export-tk-pdf-btn"
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-amber-300" />
                <span>
                  {isExportingPDF ? "Generating PDF..." : "Extract as PDF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
              >
                New Assessment
              </button>
            </div>
          </div>

          {/* Section 1: Traditional Knowledge Overview */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Traditional Knowledge Overview
            </span>
            <p className="text-sm text-slate-800 leading-relaxed font-serif">
              {result.traditional_knowledge_overview}
            </p>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <strong>Prior Art Status:</strong>{" "}
              {result.prior_art_tk_considerations}
            </div>
          </div>

          {/* Section 2: ABS Considerations & National Biodiversity Authority */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-700" />
              Access & Benefit Sharing (ABS) Statutory Mandates
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">
                  Required Statutory Approvals
                </span>
                <div className="space-y-1 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      NBA Approval Required:
                    </span>
                    <strong
                      className={
                        result.abs_considerations.nba_approval_needed
                          ? "text-rose-700"
                          : "text-emerald-700"
                      }
                    >
                      {result.abs_considerations.nba_approval_needed
                        ? "YES (Form I or Form III)"
                        : "No"}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      SBB Intimation Required:
                    </span>
                    <strong>
                      {result.abs_considerations.sbb_notification_needed
                        ? "YES (State Board)"
                        : "No"}
                    </strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-500 block mb-1">
                    Applicable Sections:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-700">
                    {result.abs_considerations.statutory_sections.map(
                      (s, i) => (
                        <li key={i}>• {s}</li>
                      ),
                    )}
                  </ul>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-900 block">
                  Benefit Sharing & Exemptions
                </span>
                <p className="text-slate-700">
                  <strong>Levy Matrix:</strong>{" "}
                  {result.abs_considerations.benefit_sharing_rate}
                </p>
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/60 mt-2">
                  <strong>2023 Amendment Exemptions:</strong>
                  <p className="text-[11px] mt-0.5">
                    {result.abs_considerations.exemptions_applicable}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Potential IP Implications */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              IP Implications & Patent Strategy
            </h3>
            <ul className="space-y-2 text-xs text-slate-700">
              {result.potential_ip_implications.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-700 font-bold mt-0.5">•</span>
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 4: Recommended Next Steps */}
          <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Compliance & Action Roadmap
            </h3>
            <ol className="space-y-1.5 text-xs text-slate-700">
              {result.recommended_next_steps.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {/* Section 5: Sources - 1 Option per section to open working link */}
          {result.sources && result.sources.length > 0 && (
            <div className="p-4 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Authoritative Legal Provisions
              </h4>
              <div className="space-y-2.5">
                {result.sources.map((s) => {
                  return (
                    /* CHANGED: opens the shared CitationModal (App.tsx already
                       wires `onOpenCitation` into this component) instead of
                       jumping straight to an external link -- full retrieved
                       section text + both the source-PDF and official-website
                       links, same as chat citations. */
                    <button
                      type="button"
                      key={s.chunk_id}
                      onClick={() => onOpenCitation(s)}
                      title={`View full cited section: ${s.section} (${s.authority})`}
                      className="block p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all group space-y-2 shadow-2xs hover:shadow-xs text-left w-full"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 group-hover:text-emerald-900 mb-1">
                        <span>
                          [{s.index}] {s.section} — {s.title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-slate-200 font-medium text-slate-700">
                          {s.authority.split(",")[0]}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 line-clamp-2 italic font-serif leading-relaxed">
                        "{s.excerpt}"
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                        <span className="text-[10px] text-slate-400 font-medium">
                          Official Reference
                        </span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-800 group-hover:text-emerald-950 group-hover:underline">
                          <span>View Full Citation</span>
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-700 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DisclaimerBanner />
        </div>
      )}
    </div>
  );
};
function setError(arg0: any) {
  throw new Error("Function not implemented.");
}

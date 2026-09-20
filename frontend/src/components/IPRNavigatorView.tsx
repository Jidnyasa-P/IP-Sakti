import React, { useState, useRef } from "react";
import {
  Compass,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Shield,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FolderOpen,
  CheckSquare,
  Square,
  Layers,
  Scale,
  BookOpen,
  Sparkles,
  RotateCcw,
  Check,
  Building2,
  FileCheck2,
  FileBadge,
  Sparkle,
  Cpu,
} from "lucide-react";
import {
  Citation,
  IPRAssetType,
  IPRNavigatorQuery,
  IPRNavigatorResult,
} from "../types";
import { DisclaimerBanner } from "./DisclaimerBanner";
import { useTranslation } from "../context/LanguageContext";
import { authFetch } from "./auth/authStorage";

interface IPRNavigatorViewProps {
  onOpenCitation: (citation: Citation) => void;
}

interface AssetOption {
  type: IPRAssetType;
  label: string;
  desc: string;
  category: string;
  primaryMechanism: string;
  filingForm: string;
}

export const IPRNavigatorView: React.FC<IPRNavigatorViewProps> = ({
  onOpenCitation,
}) => {
  const { t } = useTranslation();

  // Multi-select for assets to protect
  const [selectedAssets, setSelectedAssets] = useState<IPRAssetType[]>([
    "Manufacturing process",
    "New formulation",
  ]);

  const [description, setDescription] = useState("");
  const [usesBiologicalResource, setUsesBiologicalResource] =
    useState<boolean>(true);
  const [hasTraditionalBasis, setHasTraditionalBasis] = useState<boolean>(true);
  const [hasSynergyData, setHasSynergyData] = useState<boolean>(false);
  const [isCommercialized, setIsCommercialized] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPRNavigatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pagination state for answer division (1: Primary, 2: Constraints, 3: Filings & Steps, 4: Citations)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = 4;

  const resultCardRef = useRef<HTMLDivElement>(null);

  const assetOptions: AssetOption[] = [
    {
      type: "Manufacturing process",
      label: "Manufacturing Process / Extraction",
      desc: "Novel standardized extraction, separation, or green solvent purification methods",
      category: "Patent / Trade Secret",
      primaryMechanism:
        "Process Patent (Section 3 compliant) & Trade Secret for SOP parameters",
      filingForm: "Patent Form 1 & Form 2 (Complete Specification)",
    },
    {
      type: "New formulation",
      label: "New Herbal Formulation",
      desc: "Standardized poly-herbal mixtures, novel dosage forms, and synergistic compounds",
      category: "Patent & Trademark",
      primaryMechanism:
        "Process Patent with Section 3(e) synergy assay + Trademark Class 5",
      filingForm: "Patent Form 1/2 with Synergy Data + TM-A",
    },
    {
      type: "Brand name",
      label: "Brand Name / Product Title",
      desc: "Coined product names, commercial identity, and market trade titles",
      category: "Trademark",
      primaryMechanism:
        "Word Mark Registration under Class 5 (Ayurveda) and Class 3 (Cosmetics)",
      filingForm: "Form TM-A (Trade Marks Act, 1999)",
    },
    {
      type: "Logo",
      label: "Logo / Graphic Device",
      desc: "Stylized emblems, traditional geometric seals, and custom visual emblems",
      category: "Trademark & Copyright",
      primaryMechanism:
        "Device Mark (Trade Marks Act) & Artistic Copyright (Copyright Act)",
      filingForm: "Form TM-A (Device) & Copyright Form XIV",
    },
    {
      type: "Packaging/design",
      label: "Packaging / Container Geometry",
      desc: "Aesthetic bottle contours, dropper ergonomics, cap geometry, and blister design",
      category: "Industrial Design",
      primaryMechanism:
        "Industrial Design Registration (Designs Act, 2000 - 10+5 years monopoly)",
      filingForm: "Design Application Form 1 (4-view orthographic sheets)",
    },
    {
      type: "Plant variety",
      label: "Plant Variety / Cultivar",
      desc: "Distinct, uniform, and stable (DUS) medicinal plant cultivars and seed strains",
      category: "Plant Variety (PPV&FR)",
      primaryMechanism: "PPV&FR Certificate of Registration (PPV&FR Act, 2001)",
      filingForm: "Form PV-1 with DUS Seed Deposit",
    },
    {
      type: "Traditional knowledge",
      label: "Codified Traditional Knowledge",
      desc: "Classical formulations seeking defensive prior-art protection or GI tagging",
      category: "Defensive / GI Registry",
      primaryMechanism:
        "Defensive TKDL Prior Art Citation or Geographical Indication (GI) tag",
      filingForm: "GI Application Form GI-1 / TKDL Prior Art Notice",
    },
    {
      type: "New invention",
      label: "New Technological Apparatus",
      desc: "Hardware apparatus, automated Panchakarma devices, or diagnostic instruments",
      category: "Apparatus Patent",
      primaryMechanism: "Product & System Patent under the Patents Act, 1970",
      filingForm: "Patent Form 1, Form 2, Form 3, Form 5, Form 18",
    },
  ];

  // Multi-select toggle handler
  const handleToggleAsset = (type: IPRAssetType) => {
    setSelectedAssets((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          return prev; // keep at least one asset selected
        }
        return prev.filter((t) => t !== type);
      } else {
        return [...prev, type];
      }
    });
    setResult(null);
    setCurrentPage(1);
  };

  const handleSelectAll = () => {
    setSelectedAssets(assetOptions.map((o) => o.type));
    setResult(null);
    setCurrentPage(1);
  };

  const handleSelectPreset = (preset: "product" | "brand" | "tech") => {
    if (preset === "product") {
      setSelectedAssets([
        "Manufacturing process",
        "New formulation",
        "Brand name",
        "Packaging/design",
      ]);
    } else if (preset === "brand") {
      setSelectedAssets(["Brand name", "Logo", "Packaging/design"]);
    } else {
      setSelectedAssets(["New invention", "Manufacturing process"]);
    }
    setResult(null);
    setCurrentPage(1);
  };

  const hasFormulationOrProcess = selectedAssets.some(
    (a) =>
      a === "New formulation" ||
      a === "Manufacturing process" ||
      a === "New invention",
  );

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (resultCardRef.current) {
      resultCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const handleEvaluate = async () => {
    if (selectedAssets.length === 0) return;
    setLoading(true);
    setCurrentPage(1);

    try {
      const payload: IPRNavigatorQuery = {
        asset_type: selectedAssets.join(", "),
        asset_types: selectedAssets,
        description,
        uses_biological_resource: usesBiologicalResource,
        has_traditional_basis: hasTraditionalBasis,
        has_synergy_data: hasSynergyData,
        is_already_commercialized: isCommercialized,
      };

      const res = await authFetch("/api/ipr/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(
          errBody.detail || `Evaluation failed (HTTP ${res.status})`,
        );
      }
      const serverData: IPRNavigatorResult = await res.json();

      // Synthesize multi-asset recommendations if multiple assets selected
      if (selectedAssets.length > 1) {
        const synthesized = synthesizeMultiAssetResult(
          serverData,
          selectedAssets,
          {
            usesBiologicalResource,
            hasTraditionalBasis,
            hasSynergyData,
            isCommercialized,
          },
        );
        setResult(synthesized);
      } else {
        setResult(serverData);
      }

      // Smooth scroll to answer
      setTimeout(() => {
        if (resultCardRef.current) {
          resultCardRef.current.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    } catch (e: any) {
      console.error("IPR analysis failed:", e);
      setError(e?.message || "Evaluation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to synthesize comprehensive multi-asset statutory strategy
  const synthesizeMultiAssetResult = (
    baseResult: IPRNavigatorResult,
    assets: IPRAssetType[],
    criteria: {
      usesBiologicalResource: boolean;
      hasTraditionalBasis: boolean;
      hasSynergyData: boolean;
      isCommercialized: boolean;
    },
  ): IPRNavigatorResult => {
    const hasFormulation = assets.includes("New formulation");
    const hasProcess = assets.includes("Manufacturing process");
    const hasBrand = assets.includes("Brand name");
    const hasLogo = assets.includes("Logo");
    const hasDesign = assets.includes("Packaging/design");
    const hasPlant = assets.includes("Plant variety");
    const hasTK = assets.includes("Traditional knowledge");
    const hasInvention = assets.includes("New invention");

    const assetNames = assets.join(" + ");

    // Compile primary protection title
    let primary = `Comprehensive Multi-Layer IPR Portfolio Strategy (${assets.length} Assets)`;
    if (hasFormulation && hasBrand && hasDesign) {
      primary =
        "Integrated 3-Pillar IP Portfolio: Process Patent + Class 5 Trademark + Industrial Design";
    } else if (hasBrand && hasLogo && !hasFormulation && !hasProcess) {
      primary =
        "Comprehensive Commercial Branding Shield: Trademark (Word & Device) + Artistic Copyright";
    } else if (hasProcess && hasFormulation) {
      primary =
        "Dual-Track Patent & Trade Secret Strategy with Class 5 Commercial Brand Shield";
    }

    // Compile Why Relevant
    const whyRelevant = `Your innovation spans ${assets.length} distinct intellectual assets [${assetNames}]. Rather than relying on a single statutory route, an integrated portfolio strategy creates complementary protection barriers: 
1) Statutory formulation and process claims bypass Section 3(p) TK exclusions by claiming novel extraction parameters and non-obvious synergy. 
2) Commercial exclusivity is locked through Class 5/Class 3 Trademark registration and Industrial Design registration under the Designs Act, 2000. 
3) Trade secrets safeguard unpublished extraction know-how indefinitely.`;

    // Potential protections merged
    const protectionsSet = new Set<string>();
    if (hasFormulation || hasProcess || hasInvention) {
      protectionsSet.add("Process Patent (Extraction / Standardization)");
      protectionsSet.add("Trade Secret (Manufacturing SOPs & Ratios)");
    }
    if (hasBrand) {
      protectionsSet.add("Trade Mark (Class 5 Pharmaceuticals/Herbal)");
      protectionsSet.add("Trade Mark (Class 3 Wellness/Cosmetics)");
    }
    if (hasLogo) {
      protectionsSet.add("Device / Logo Trade Mark (Class 5 & 35)");
      protectionsSet.add("Artistic Copyright (Copyright Act, 1957)");
    }
    if (hasDesign) {
      protectionsSet.add("Industrial Design Registration (Designs Act, 2000)");
    }
    if (hasPlant) {
      protectionsSet.add(
        "PPV&FR Certificate of Registration (PPV&FR Act, 2001)",
      );
    }
    if (hasTK) {
      protectionsSet.add(
        "Geographical Indication (GI Tag) / TKDL Defensive Citation",
      );
    }

    // Important considerations
    const considerations: string[] = [];
    if (criteria.hasTraditionalBasis) {
      considerations.push(
        "Section 3(p) Statutory Bar: The Indian Patent Office bars patenting traditional Ayurvedic knowledge. Claims must be restricted to novel, non-obvious standardized extraction processes or synergistic combinations.",
      );
    }
    if (hasFormulation && !criteria.hasSynergyData) {
      considerations.push(
        "Section 3(e) Admixture Bar: Mere admixture of known ingredients resulting only in the aggregation of properties is not patentable. You must conduct comparative synergy assays demonstrating super-additive therapeutic efficacy (Combination Index < 1).",
      );
    } else if (hasFormulation && criteria.hasSynergyData) {
      considerations.push(
        "Section 3(e) Synergy Evidence: Empirical synergy data significantly strengthens patentability over Section 3(e) objections. Include comparative IC50 or antioxidant assays in the complete specification.",
      );
    }
    if (criteria.usesBiologicalResource) {
      considerations.push(
        "National Biodiversity Authority (NBA) Mandate: Under Section 6 of the Biological Diversity Act, 2002, prior NBA Form III approval is legally mandatory before applying for any IPR inside or outside India.",
      );
    }
    if (hasBrand) {
      considerations.push(
        'Section 9 & 11 Distinctiveness (Trade Marks Act): Ensure the brand name is coined or arbitrary. Descriptive Sanskrit plant names (e.g. "Pure Ashwagandha") cannot be monopolized.',
      );
    }
    if (hasDesign) {
      considerations.push(
        "Novelty Under Designs Act, 2000: Bottle shapes and packaging ergonomics must be published nowhere in India or abroad prior to the application filing date.",
      );
    }
    if (criteria.isCommercialized) {
      considerations.push(
        "Commercial Disclosure Risk: Prior commercial public use or sale destroys absolute novelty for patents and designs. File provisional patent and design applications immediately.",
      );
    }

    // Documents to prepare
    const documents: string[] = [];
    if (hasFormulation || hasProcess || hasInvention) {
      documents.push(
        "Patent Form 1 (Application) & Form 2 (Complete Specification with Process Claims)",
      );
      documents.push(
        "Comparative Synergy Assay Report (Combination Index < 1)",
      );
    }
    if (criteria.usesBiologicalResource) {
      documents.push(
        "NBA Form III Application Dossier with Botanical Invoices and Sourcing Details",
      );
    }
    if (hasBrand || hasLogo) {
      documents.push(
        "Form TM-A (Trade Marks Application) with User Affidavit & Power of Attorney",
      );
    }
    if (hasLogo) {
      documents.push(
        "Form XIV (Copyright Application) with No Objection Certificate (NOC)",
      );
    }
    if (hasDesign) {
      documents.push(
        "Design Application Form 1 with 4-Angle Orthographic Representation Sheets (Front, Side, Top, Isometric)",
      );
    }
    if (hasPlant) {
      documents.push(
        "Form PV-1 (PPV&FR) with Distinctiveness, Uniformity, Stability (DUS) Test Dossier",
      );
    }

    // Chronological Next Steps
    const steps: string[] = [
      "1. Conduct IP India Public Search for identical or similar registered Trademarks in Classes 5, 3, and 35.",
      "2. If using Indian biological materials, submit NBA Form III application immediately before filing patents.",
      "3. File Provisional Patent Specification for novel extraction processes and synergistic formulation ratios.",
      "4. File Form TM-A online for the coined brand name and artistic device logo.",
      "5. File Design Application Form 1 with Kolkata Design Office before any commercial market release.",
      "6. Implement strict employee and third-party Non-Disclosure Agreements (NDAs) to protect extraction SOP trade secrets.",
    ];

    return {
      primary_protection: primary,
      why_relevant: whyRelevant,
      potential_protection: Array.from(protectionsSet),
      important_considerations: considerations,
      relevant_authority:
        "Office of the CGPDTM (Patents, Designs & Trademarks), National Biodiversity Authority (NBA), & Copyright Office",
      documents_to_prepare: documents,
      possible_next_steps: steps,
      sources:
        baseResult.sources && baseResult.sources.length > 0
          ? baseResult.sources
          : [
              {
                index: 1,
                chunk_id: "CHUNK-PAT-001",
                document_id: "DOC-PATENTS-ACT-1970",
                title: "The Patents Act, 1970 — Section 3(p) & 3(e)",
                authority: "Office of the CGPDTM",
                section: "Section 3(p) & Section 3(e)",
                source: "Official Gazette of India",
                excerpt:
                  "Inventions which are traditional knowledge or mere admixtures without unexpected synergistic efficacy are barred from patentability.",
              },
              {
                index: 2,
                chunk_id: "CHUNK-BD-001",
                document_id: "DOC-BIOLOGICAL-DIVERSITY-ACT-2002",
                title: "Biological Diversity Act, 2002 — Section 6(1)",
                authority: "National Biodiversity Authority",
                section: "Section 6(1)",
                source: "Gazette of India",
                excerpt:
                  "No person shall apply for any intellectual property right in or outside India based on Indian biological resources without prior approval of the NBA.",
              },
              {
                index: 3,
                chunk_id: "CHUNK-TM-001",
                document_id: "DOC-TRADEMARKS-ACT-1999",
                title: "The Trade Marks Act, 1999 — Section 9 & 11",
                authority: "Trade Marks Registry, CGPDTM",
                section: "Section 9(1)(b) & Section 11",
                source: "Trade Marks Journal",
                excerpt:
                  "Marks which are devoid of any distinctive character or consist exclusively of descriptive botanical terms shall be refused registration.",
              },
              {
                index: 4,
                chunk_id: "CHUNK-DES-001",
                document_id: "DOC-DESIGNS-ACT-2000",
                title: "The Designs Act, 2000 — Section 4 & Section 5",
                authority: "Design Wing, CGPDTM Kolkata",
                section: "Section 4 & Section 5",
                source: "Official Gazette of India",
                excerpt:
                  "A design shall not be registered if it is not new or original, or has been disclosed to the public in India or abroad prior to filing date.",
              },
            ],
      disclaimer:
        "This statutory guidance is provided for decision-support and does not constitute formal legal counsel. Formal filing should be supervised by a registered Patent/Trademark Agent.",
    };
  };

  // Get metadata for selected assets
  const selectedAssetDetails = assetOptions.filter((opt) =>
    selectedAssets.includes(opt.type),
  );

  return (
    <div className="w-full px-3 sm:px-5 lg:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <Compass className="w-3.5 h-3.5 text-emerald-700" />
          <span>Interactive IPR Decision Tree & Statutory Navigator</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">
          {t("ipr.title", "IPR Navigator")}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
          {t(
            "ipr.subtitle",
            "Identify statutory protection mechanisms for your AYUSH asset, assess Section 3(p) traditional knowledge and Section 3(e) admixture obstacles, and plan required filings across IP India and the National Biodiversity Authority.",
          )}
        </p>
      </div>
{error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left inputs & Right Paginated Answer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column: Asset Selection (Multi-select) & Dynamic Criteria */}
        <div className="lg:col-span-5 space-y-6">
          <div
            id="ipr-asset-selection-card"
            className="p-4 sm:p-5 md:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5"
          >
            {/* Step 1: Multi-Select Asset Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    1. What are you trying to protect?
                  </h3>
                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    Select one or multiple assets to formulate an integrated IP
                    portfolio
                  </p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 font-bold border border-emerald-200 shrink-0">
                  {selectedAssets.length} of {assetOptions.length}
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] text-slate-600 font-medium">
                  Presets:
                </span>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("product")}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Full Product Launch
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("brand")}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Brand & Design
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-medium transition-colors"
                >
                  Select All
                </button>
              </div>

              {/* Asset Options List (Multi-Select Checkboxes) */}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {assetOptions.map((opt) => {
                  const isSelected = selectedAssets.includes(opt.type);
                  return (
                    <div
                      key={opt.type}
                      id={`ipr-asset-option-${opt.type.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      onClick={() => handleToggleAsset(opt.type)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-emerald-700 bg-emerald-50/60 ring-1 ring-emerald-700 shadow-2xs"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          {/* Checkbox Icon */}
                          <div className="pt-0.5 shrink-0">
                            {isSelected ? (
                              <div className="w-4 h-4 rounded bg-emerald-700 text-white flex items-center justify-center">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                              </div>
                            ) : (
                              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
                            )}
                          </div>
                          <div>
                            <span
                              className={`text-xs font-semibold block ${isSelected ? "text-emerald-950 font-bold" : "text-slate-800"}`}
                            >
                              {opt.label}
                            </span>
                            <span className="inline-block text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 mt-0.5">
                              {opt.category}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="text-[10px] font-semibold text-emerald-800 shrink-0 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                            Selected
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 mt-1 pl-6.5 leading-tight">
                        {opt.desc}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Selected Assets Summary Chips */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Currently Selected Assets ({selectedAssets.length}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {selectedAssets.map((asset) => (
                    <span
                      key={asset}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-[11px] text-emerald-900 font-medium shadow-2xs"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-700" />
                      <span>{asset}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Step 2: Contextual Statutory Criteria */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Contextual Criteria
              </h4>

              <div className="space-y-2.5 text-xs">
                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="pr-2">
                    <span className="text-slate-800 font-medium block">
                      Uses Indian Biological Resources?
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Triggers National Biodiversity Authority (NBA) approval
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={usesBiologicalResource}
                    onChange={(e) =>
                      setUsesBiologicalResource(e.target.checked)
                    }
                    className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-700 shrink-0"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="pr-2">
                    <span className="text-slate-800 font-medium block">
                      Derived from Classical Traditional Knowledge?
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Triggers Section 3(p) Traditional Knowledge exclusion
                      check
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasTraditionalBasis}
                    onChange={(e) => setHasTraditionalBasis(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-700 shrink-0"
                  />
                </label>

                {hasFormulationOrProcess && (
                  <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-emerald-50/40 hover:bg-emerald-50/60 cursor-pointer transition-colors">
                    <div className="pr-2">
                      <span className="text-emerald-950 font-medium block">
                        Has Empirical Synergism Data?
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        Crucial to overcome Section 3(e) mere admixture
                        rejection
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasSynergyData}
                      onChange={(e) => setHasSynergyData(e.target.checked)}
                      className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-700 shrink-0"
                    />
                  </label>
                )}

                <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="pr-2">
                    <span className="text-slate-800 font-medium block">
                      Already Disclosed, Published, or Marketed?
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Novelty bar for Patent & Industrial Design registrations
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isCommercialized}
                    onChange={(e) => setIsCommercialized(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded focus:ring-emerald-700 shrink-0"
                  />
                </label>
              </div>

              {/* Technical Description */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-semibold text-slate-700 block">
                  Specific Technical or Formulation Details (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Ultrasonic ethanolic extraction of standardized Withanolides from Withania somnifera, formulated with specialized dropper bottle..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              {/* Submit Button */}
              <button
                type="button"
                id="evaluate-ipr-pathway-btn"
                onClick={handleEvaluate}
                disabled={loading || selectedAssets.length === 0}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>
                      Analyzing {selectedAssets.length} Selected Assets...
                    </span>
                  </div>
                ) : (
                  <>
                    <Compass className="w-4 h-4 text-amber-300" />
                    <span>
                      Evaluate Statutory Pathways ({selectedAssets.length}{" "}
                      Assets)
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Paginated Answer Result (Divide into Pages instead of long scrolling) */}
        <div className="lg:col-span-7 space-y-4" ref={resultCardRef}>
          {!result ? (
            <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200">
                <Compass className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-serif font-bold text-slate-900">
                  Select your innovation assets to view statutory guidance
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
                  You can select multiple assets (e.g. Process + Brand +
                  Packaging) to synthesize an integrated IP portfolio. The
                  answer will be neatly organized across 4 guided pages so you
                  can navigate step-by-step.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Page 1: Primary Protection Strategy
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Page 2: Statutory Constraints & Section 3(p)
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Page 3: Authority & Required Forms
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                  Page 4: Authoritative Citations
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Pagination Top Stepper Navigation Tabs */}
              <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pb-2 mb-1.5 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-slate-900">
                      IPR Analysis Breakdown
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200">
                      {selectedAssets.length} Assets Evaluated
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Step {currentPage} of {totalPages}
                  </span>
                </div>

                {/* Stepper Tabs Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePageChange(1)}
                    className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 ${
                      currentPage === 1
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        currentPage === 1
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] block opacity-75 leading-none">
                        Step 1
                      </span>
                      <span className="text-xs font-semibold truncate block">
                        IP Strategy
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageChange(2)}
                    className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 ${
                      currentPage === 2
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        currentPage === 2
                          ? "bg-amber-600 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] block opacity-75 leading-none">
                        Step 2
                      </span>
                      <span className="text-xs font-semibold truncate block">
                        Constraints
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageChange(3)}
                    className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 ${
                      currentPage === 3
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        currentPage === 3
                          ? "bg-emerald-700 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] block opacity-75 leading-none">
                        Step 3
                      </span>
                      <span className="text-xs font-semibold truncate block">
                        Filings & Steps
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePageChange(4)}
                    className={`p-2 rounded-xl text-left transition-all flex items-center gap-2 ${
                      currentPage === 4
                        ? "bg-slate-900 text-white shadow-xs"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                        currentPage === 4
                          ? "bg-teal-700 text-white"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] block opacity-75 leading-none">
                        Step 4
                      </span>
                      <span className="text-xs font-semibold truncate block">
                        Citations
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Paginated Main Card View Container */}
              <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden min-h-[440px] flex flex-col justify-between">
                {/* PAGE 1: Recommended Primary Protection & Complementary Layers */}
                {currentPage === 1 && (
                  <div className="p-6 sm:p-7 space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200 uppercase tracking-wider">
                          Page 1 of 4 • Primary Protection
                        </span>
                      </div>
                      <span className="text-xs text-slate-600">
                        Overview & Complementary Layers
                      </span>
                    </div>

                    {/* Primary Recommendation */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white border border-emerald-200/80 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        <Shield className="w-4 h-4 text-emerald-700" />
                        <span>Recommended Primary Strategy</span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-serif font-bold text-slate-900 leading-snug">
                        {result.primary_protection}
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
                        {result.why_relevant}
                      </p>
                    </div>

                    {/* Asset-by-Asset Protection Matrix */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-emerald-700" />
                        <span>
                          Protection Mechanism Breakdown for Selected Assets (
                          {selectedAssetDetails.length})
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {selectedAssetDetails.map((asset) => (
                          <div
                            key={asset.type}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">
                                {asset.label}
                              </span>
                              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-900">
                                {asset.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 leading-tight">
                              <strong>Key Mechanism:</strong>{" "}
                              {asset.primaryMechanism}
                            </p>
                            <div className="pt-1 text-[10px] text-slate-500 flex items-center gap-1">
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>Filing: {asset.filingForm}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Complementary Layers */}
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                        Recommended Multi-Layer Protection Badges:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {result.potential_protection.map((prot, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 shadow-2xs flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>{prot}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PAGE 2: Statutory Constraints & Section 3(p) Checks */}
                {currentPage === 2 && (
                  <div className="p-6 sm:p-7 space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 uppercase tracking-wider">
                        Page 2 of 4 • Statutory Constraints
                      </span>
                      <span className="text-xs text-slate-600">
                        Section 3(p), Section 3(e) & NBA Clearances
                      </span>
                    </div>

                    {/* Highlight Box: Traditional Knowledge Alert */}
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase">
                        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>Section 3(p) Traditional Knowledge Bar</span>
                      </div>
                      <p className="text-xs text-amber-900/90 leading-relaxed">
                        Under Indian patent jurisprudence (The Patents Act,
                        1970, Section 3(p)), traditional knowledge or any
                        modification that does not exhibit substantial
                        unexpected inventive step is non-patentable. To overcome
                        this, focus your patent claims strictly on{" "}
                        <strong>novel extraction protocols</strong> or provide{" "}
                        <strong>
                          empirical combination assays (CI &lt; 1)
                        </strong>
                        .
                      </p>
                    </div>

                    {/* Detailed List of Constraints */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Specific Statutory Criteria Evaluated for Your Assets:
                      </h3>

                      <div className="space-y-2.5">
                        {result.important_considerations.map((c, idx) => (
                          <div
                            key={idx}
                            className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3"
                          >
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="text-xs text-slate-800 leading-relaxed">
                              {c}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Contextual Advisory */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                      <span className="font-bold text-slate-800 block">
                        Commercial Advantage Tip:
                      </span>
                      <p>
                        Even if composition claims face Section 3(p) objections,
                        obtaining a registered Trademark under Class 5
                        guarantees exclusive commercial rights to the brand name
                        for 10 years (renewable indefinitely), effectively
                        preventing counterfeits.
                      </p>
                    </div>
                  </div>
                )}

                {/* PAGE 3: Authority, Documents to Prepare & Action Roadmap */}
                {currentPage === 3 && (
                  <div className="p-6 sm:p-7 space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-200 uppercase tracking-wider">
                        Page 3 of 4 • Filings & Action Plan
                      </span>
                      <span className="text-xs text-slate-600">
                        Forms, Competent Authorities & Roadmap
                      </span>
                    </div>

                    {/* Competent Statutory Authority */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Competent Statutory Authority
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 mt-0.5">
                          {result.relevant_authority}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Direct regulatory jurisdiction for filing,
                          examination, and statutory opposition proceedings.
                        </p>
                      </div>
                    </div>

                    {/* Required Statutory Documents & Forms */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-emerald-700" />
                        <span>
                          Statutory Forms & Filings to Prepare (
                          {result.documents_to_prepare.length})
                        </span>
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {result.documents_to_prepare.map((doc, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-slate-50/80 border border-slate-200 text-xs text-slate-800 flex items-start gap-2.5"
                          >
                            <FileText className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <span className="leading-snug">{doc}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Chronological Actionable Roadmap */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Compass className="w-4 h-4 text-emerald-700" />
                        <span>Recommended Step-by-Step Action Roadmap</span>
                      </h3>

                      <div className="space-y-2">
                        {result.possible_next_steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl border border-slate-200 bg-white flex items-start gap-3 shadow-2xs"
                          >
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <p className="text-xs text-slate-800 leading-relaxed font-medium">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* PAGE 4: Authoritative Citations & Statutory Disclaimer */}
                {currentPage === 4 && (
                  <div className="p-6 sm:p-7 space-y-6 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-950 border border-teal-200 uppercase tracking-wider">
                        Page 4 of 4 • Legal Citations
                      </span>
                      <span className="text-xs text-slate-600">
                        Primary Statutory Reference Provisions
                      </span>
                    </div>

                    {/* Authoritative Citations List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-teal-700" />
                        <span>Authoritative Gazette & Statute Citations</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Select any statutory provision below to open the
                        official legal reference directly.
                      </p>

                      <div className="space-y-2.5">
                        {result.sources.map((s) => {
                          return (
                            /* CHANGED: opens the shared CitationModal
                               (App.tsx already wires `onOpenCitation` into
                               this component) instead of jumping straight to
                               an external link -- full retrieved section
                               text + both the source-PDF and
                               official-website links, same as chat. */
                            <button
                              type="button"
                              key={s.chunk_id}
                              onClick={() => onOpenCitation(s)}
                              title={`View full cited section: ${s.section} (${s.authority})`}
                              className="block p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all group shadow-2xs hover:shadow-xs space-y-2 text-left w-full"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-slate-800 group-hover:text-emerald-900 mb-1">
                                <span className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center font-semibold">
                                    [{s.index}]
                                  </span>
                                  <span>
                                    {s.section} — {s.title}
                                  </span>
                                </span>
                                <span className="text-[10px] text-slate-600 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-medium">
                                  {s.authority.split(",")[0]}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-600 italic font-serif leading-relaxed line-clamp-2 pl-6">
                                "{s.excerpt}"
                              </div>
                              <div className="mt-1.5 pl-6 pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
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

                    {/* Statutory Disclaimer */}
                    <div className="pt-2">
                      <DisclaimerBanner compact />
                    </div>
                  </div>
                )}

                {/* Bottom Stepper Navigation Bar (Prev / Page Indicators / Next) */}
                <div className="p-3 sm:p-4 md:p-5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
                  {/* Previous Button */}
                  <button
                    type="button"
                    id="ipr-navigator-prev-btn"
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      currentPage === 1
                        ? "text-slate-300 bg-slate-100 cursor-not-allowed"
                        : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer shadow-2xs"
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>

                  {/* Interactive Page Dots Indicator */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {[1, 2, 3, 4].map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => handlePageChange(pageNum)}
                          aria-label={`Jump to page ${pageNum}`}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            currentPage === pageNum
                              ? "w-6 bg-slate-900 rounded-full"
                              : "bg-slate-300 hover:bg-slate-400"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Next / Finish Button */}
                  {currentPage < totalPages ? (
                    <button
                      type="button"
                      id="ipr-navigator-next-btn"
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <span>Next Page</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePageChange(1)}
                      className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Review Strategy (Page 1)</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
function setError(arg0: any) {
  throw new Error("Function not implemented.");
}

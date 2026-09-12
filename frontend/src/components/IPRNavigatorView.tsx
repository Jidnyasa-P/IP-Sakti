import React, { useState } from 'react';
import {
  Compass,
  CheckCircle2,
  ArrowRight,
  Shield,
  FileText,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { Citation, IPRAssetType, IPRNavigatorQuery, IPRNavigatorResult } from '../types';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';

interface IPRNavigatorViewProps {
  onOpenCitation: (citation: Citation) => void;
}

export const IPRNavigatorView: React.FC<IPRNavigatorViewProps> = ({ onOpenCitation }) => {
  const { t } = useTranslation();
  const [selectedAsset, setSelectedAsset] = useState<IPRAssetType>('Manufacturing process');
  const [description, setDescription] = useState('');
  const [usesBiologicalResource, setUsesBiologicalResource] = useState<boolean>(true);
  const [hasTraditionalBasis, setHasTraditionalBasis] = useState<boolean>(true);
  const [hasSynergyData, setHasSynergyData] = useState<boolean>(false);
  const [isCommercialized, setIsCommercialized] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IPRNavigatorResult | null>(null);

  const assetOptions: { type: IPRAssetType; label: string; desc: string }[] = [
    { type: 'Manufacturing process', label: 'Manufacturing Process / Extraction', desc: 'Novel standardized extraction or purification methods' },
    { type: 'New formulation', label: 'New Herbal Formulation', desc: 'Poly-herbal blends and standardized compositions' },
    { type: 'Brand name', label: 'Brand Name / Product Title', desc: 'Commercial identity and product trade names' },
    { type: 'Logo', label: 'Logo / Graphic Device', desc: 'Stylized emblems, seals, and visual marks' },
    { type: 'Packaging/design', label: 'Packaging / Container Geometry', desc: 'Aesthetic bottle shapes, droppers, and packaging design' },
    { type: 'Plant variety', label: 'Plant Variety / Cultivar', desc: 'Distinct, uniform, stable medicinal plant breeds' },
    { type: 'Traditional knowledge', label: 'Codified Traditional Knowledge', desc: 'Classical formulations seeking defensive protection' },
    { type: 'New invention', label: 'New Technological Apparatus', desc: 'Devices for AYUSH diagnostics or therapy delivery' },
  ];

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const payload: IPRNavigatorQuery = {
        asset_type: selectedAsset,
        description,
        uses_biological_resource: usesBiologicalResource,
        has_traditional_basis: hasTraditionalBasis,
        has_synergy_data: hasSynergyData,
        is_already_commercialized: isCommercialized,
      };

      const res = await fetch('/api/ipr/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: IPRNavigatorResult = await res.json();
      setResult(data);
    } catch (e) {
      console.error('IPR analysis failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <Compass className="w-3.5 h-3.5 text-emerald-700" />
          <span>Interactive IPR Decision Tree</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">
          {t('ipr.title', 'IPR Navigator')}
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          {t('ipr.subtitle', 'Identify the appropriate intellectual property protection mechanisms for your AYUSH asset, assess Section 3(p) statutory obstacles, and plan required statutory filings with IP India and the National Biodiversity Authority.')}
        </p>
      </div>

      {/* Decision Tree Interactive Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Asset Selection & Dynamic Follow-ups */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              1. What are you trying to protect?
            </h3>

            <div className="space-y-2">
              {assetOptions.map((opt) => {
                const isSelected = selectedAsset === opt.type;
                return (
                  <div
                    key={opt.type}
                    onClick={() => {
                      setSelectedAsset(opt.type);
                      setResult(null);
                    }}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-800 bg-emerald-50/50 ring-1 ring-emerald-800'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                        {opt.label}
                      </span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                );
              })}
            </div>

            {/* Dynamic Follow-up Questions Based on Selection */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                2. Contextual Criteria
              </h4>

              <div className="space-y-3 text-xs">
                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <span className="text-slate-700 font-medium">Uses Indian Biological Resources?</span>
                  <input
                    type="checkbox"
                    checked={usesBiologicalResource}
                    onChange={(e) => setUsesBiologicalResource(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded-sm focus:ring-emerald-700"
                  />
                </label>

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <span className="text-slate-700 font-medium">Derived from Classical Traditional Knowledge?</span>
                  <input
                    type="checkbox"
                    checked={hasTraditionalBasis}
                    onChange={(e) => setHasTraditionalBasis(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded-sm focus:ring-emerald-700"
                  />
                </label>

                {(selectedAsset === 'New formulation' || selectedAsset === 'Manufacturing process') && (
                  <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                    <div>
                      <span className="text-slate-700 font-medium block">Has Empirical Synergism Data?</span>
                      <span className="text-[10px] text-slate-400">Section 3(e) requirement</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasSynergyData}
                      onChange={(e) => setHasSynergyData(e.target.checked)}
                      className="w-4 h-4 text-emerald-800 rounded-sm focus:ring-emerald-700"
                    />
                  </label>
                )}

                <label className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer">
                  <span className="text-slate-700 font-medium">Already Disclosed or Marketed?</span>
                  <input
                    type="checkbox"
                    checked={isCommercialized}
                    onChange={(e) => setIsCommercialized(e.target.checked)}
                    className="w-4 h-4 text-emerald-800 rounded-sm focus:ring-emerald-700"
                  />
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-slate-700">
                  Specific Technical Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Hydro-ethanolic ultrasonic extraction method yielding 15% standardized withanolide glycosides..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                id="evaluate-ipr-pathway-btn"
                onClick={handleEvaluate}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Evaluating Statutory Pathways...</span>
                ) : (
                  <>
                    <Compass className="w-4 h-4 text-amber-300" />
                    <span>Evaluate IPR Pathways</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Pathway Recommendations */}
        <div className="lg:col-span-7 space-y-6">
          {!result ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center">
                <Compass className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-slate-800">
                Select an asset type to inspect statutory pathways
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                The navigator will evaluate whether your innovation qualifies for a Process Patent, Trademark (Class 5/3), Industrial Design, or PPV&FR certificate while highlighting Section 3(p) risks.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Primary Protection Pathway */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Recommended Primary Protection
                </span>
                <h2 className="text-xl font-serif font-bold text-slate-900">
                  {result.primary_protection}
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed font-serif">
                  {result.why_relevant}
                </p>

                <div className="pt-2 flex flex-wrap gap-2">
                  <span className="text-xs font-medium text-slate-500 py-1">Complementary layers:</span>
                  {result.potential_protection.map((prot, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200"
                    >
                      {prot}
                    </span>
                  ))}
                </div>
              </div>

              {/* Statutory Considerations (Section 3p, 3e, NBA) */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  Statutory Constraints & Section 3(p) Checks
                </h3>
                <ul className="space-y-2 text-xs text-slate-700">
                  {result.important_considerations.map((c, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-700 font-bold mt-0.5">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Governing Authority & Required Filings */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase">
                    Competent Statutory Authority
                  </span>
                  <p className="text-xs font-semibold text-slate-900 mt-0.5">
                    {result.relevant_authority}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Documents & Forms to Prepare
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.documents_to_prepare.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-800 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="line-clamp-2">{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Recommended Actionable Steps
                  </span>
                  <ol className="space-y-1.5 text-xs text-slate-700">
                    {result.possible_next_steps.map((step, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Citations */}
              {result.sources && result.sources.length > 0 && (
                <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Authoritative Citations
                  </h4>
                  <div className="space-y-2">
                    {result.sources.map((s) => (
                      <div
                        key={s.chunk_id}
                        onClick={() => onOpenCitation(s)}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors cursor-pointer group"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 group-hover:text-emerald-900 mb-1">
                          <span>[{s.index}] {s.section} — {s.title}</span>
                          <span className="text-[10px] text-slate-500">{s.authority}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                          "{s.excerpt}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DisclaimerBanner compact />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

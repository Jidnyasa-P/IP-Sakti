import React, { useState } from 'react';
import { authFetch } from './auth/authStorage';
import {
  FlaskConical,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FileText,
  Bookmark,
  Sparkles,
  ExternalLink,
  Info,
  Download
} from 'lucide-react';
import { Citation, ProductAnalysisResult, ProductInformation } from '../types';
import { DisclaimerBanner } from './DisclaimerBanner';
import { useTranslation } from '../context/LanguageContext';
import { generatePDFReport } from '../utils/pdfExport';

interface ProductAnalyzerViewProps {
  onOpenCitation: (citation: Citation) => void;
  onSaveToWorkspace?: (item: any) => void;
}

export const ProductAnalyzerView: React.FC<ProductAnalyzerViewProps> = ({ onOpenCitation, onSaveToWorkspace }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<ProductAnalysisResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const [formData, setFormData] = useState<ProductInformation>({
    product_name: '',
    product_type: 'Proprietary Ayurvedic Medicine',
    dosage_form: 'Capsule',
    manufacturing_info: 'Domestic licensed manufacturing facility (Schedule T compliant)',
    ingredients: '',
    classical_reference: '',
    biological_source_details: 'Biological herbs sourced from Indian flora',
    intended_use: '',
    claims: '',
    target_symptoms: '',
    target_market: 'Both',
    distribution_channels: 'Pharmacies, Ayurvedic dispensaries, Online e-commerce'
  });

  // Preset Demo Samples for Instant 1-Click Testing
  const loadPreset = (presetNumber: number) => {
    if (presetNumber === 1) {
      setFormData({
        product_name: 'Ashwa-Curcumin Joint Mobility Extract',
        product_type: 'Proprietary Ayurvedic Medicine',
        dosage_form: 'Standardized Extract Capsule',
        manufacturing_info: 'Contract manufacturing under State AYUSH GMP certification',
        ingredients: 'Standardized Withania somnifera (Ashwagandha) root extract (5% Withanolides) - 300mg, Curcuma longa (Haridra) rhizome extract (95% Curcuminoids) - 200mg, Piper nigrum (Maricha) extract - 5mg',
        classical_reference: '',
        biological_source_details: 'Withania somnifera cultivated in Madhya Pradesh; Curcuma longa cultivated in Kerala. Certificate of origin available from suppliers.',
        intended_use: 'Management of inflammatory joint pain, stiffness, and chronic musculoskeletal discomfort',
        claims: 'Clinically proven synergistic anti-inflammatory action; 3x higher bioavailability than individual extracts',
        target_symptoms: 'Joint stiffness, osteoarthritis discomfort, cartilage inflammation',
        target_market: 'Both',
        distribution_channels: 'Specialty AYUSH clinics, nutraceutical retailers, and cross-border e-commerce'
      });
    } else if (presetNumber === 2) {
      setFormData({
        product_name: 'Chyawanprash Special Avaleha',
        product_type: 'Classical Ayurvedic Medicine',
        dosage_form: 'Avaleha / Semisolid Paste',
        manufacturing_info: 'Internal dedicated Ayurvedic pharmaceutical facility',
        ingredients: 'Emblica officinalis (Amalaki), Withania somnifera, Asparagus racemosus (Shatavari), Pippali, Clarified Butter (Ghee), Honey, Sesamum indicum oil, and Dashamoola herbs',
        classical_reference: 'Charaka Samhita, Chikitsa Sthana, Chapter 1, Rasayana Adhyaya (First Schedule of Drugs & Cosmetics Act, 1940)',
        biological_source_details: 'Wild-harvested Emblica officinalis from central Indian forests; Dashamoola roots procured via local Biodiversity Management Committees (BMCs)',
        intended_use: 'Rasayana rejuvenation, immunity modulation, respiratory vitality',
        claims: 'Traditional classical Ayurvedic Rasayana formulation conforming strictly to Charaka Samhita',
        target_symptoms: 'General debility, low immunity, seasonal respiratory infections',
        target_market: 'Domestic',
        distribution_channels: 'Pharmacies, direct distribution, supermarkets'
      });
    } else if (presetNumber === 3) {
      setFormData({
        product_name: 'Triphala Daily Digest Herbal Fizz',
        product_type: 'Ayurveda-Aahar',
        dosage_form: 'Effervescent Tablet',
        manufacturing_info: 'FSSAI licensed dietary supplements plant',
        ingredients: 'Equal parts aqueous extracts of Terminalia chebula (Haritaki), Terminalia bellirica (Bibhitaki), and Emblica officinalis (Amalaki) with food-grade citric acid and sodium bicarbonate',
        classical_reference: 'Sushruta Samhita, Sutrasthana, Triphala group',
        biological_source_details: 'Botanicals sourced from local farmer cooperatives in Maharashtra (commercially cultivated)',
        intended_use: 'Daily digestive balance and gut motility support as dietary food supplement',
        claims: 'Promotes natural digestion and regularity without medicinal disease claims',
        target_symptoms: 'Occasional digestive sluggishness',
        target_market: 'Both',
        distribution_channels: 'Supermarkets, health food stores, modern retail'
      });
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/products/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data: ProductAnalysisResult = await res.json();
      setResult(data);
      setStep(5);
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToWorkspace = async () => {
    if (!result) return;
    try {
      await authFetch('/api/workspace/save-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: result.id,
          title: `Product Analysis: ${result.product_information.product_name}`,
          notes: `Likely Category: ${result.likely_category}. ${result.category_reasoning}`
        })
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save to workspace:', e);
    }
  };

  const handleExportPDF = () => {
    if (!result) return;

    generatePDFReport({
      title: 'IP-SAKTI Sahayak — Product Analysis Dossier',
      subtitle: result.product_information.product_name,
      fileName: `${result.product_information.product_name.replace(/[^a-z0-9]+/gi, '_')}_analysis.pdf`,
      sections: [
        {
          heading: 'Statutory Classification',
          keyValues: [{ label: 'Likely Category', value: result.likely_category }],
          paragraphs: [result.category_reasoning],
        },
        {
          heading: 'Regulatory Considerations & Compliance',
          paragraphs: result.regulatory_considerations.flatMap(rc => [
            `${rc.title}: ${rc.description}`,
            `Governing Statute: ${rc.governing_statute}`,
          ]),
        },
        {
          heading: 'Intellectual Property Rights (IPR) Evaluation',
          paragraphs: [
            `Section 3(p) & 3(e) Patent Hurdles: ${result.ipr_considerations.patent_assessment}`,
            result.ipr_considerations.section_3e_admixture_bar,
            `Trademark Protection (Class 5/Class 3): ${result.ipr_considerations.trademark_recommendation}`,
            `Industrial Design: ${result.ipr_considerations.industrial_design}`,
            `Trade Secret Potential: ${result.ipr_considerations.trade_secret_potential}`,
          ],
        },
        {
          heading: 'Traditional Knowledge & ABS Flags',
          keyValues: [{ label: 'TK Prior Art Risk', value: result.traditional_knowledge_abs_flags.tk_prior_art_risk }],
          paragraphs: [
            result.traditional_knowledge_abs_flags.tk_details,
            `NBA / SBB Statutory Filing: ${result.traditional_knowledge_abs_flags.nba_abs_requirements}`,
          ],
        },
        {
          heading: 'Recommended Action Plan',
          list: result.recommended_next_steps.map(s => s.replace(/^\d+\.\s*/, '')),
          listStyle: 'number',
        },
        ...(result.evidence && result.evidence.length > 0
          ? [{
              heading: `Authoritative Statutory Citations (${result.evidence.length})`,
              list: result.evidence.map(ev => `[${ev.index}] ${ev.section} (${ev.authority}) — "${ev.excerpt}"`),
              listStyle: 'bullet' as const,
            }]
          : []),
      ],
    });
  };

  return (
    <div className="w-full max-w-[84rem] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8">
      {/* Title & Description */}
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-semibold">
          <FlaskConical className="w-3.5 h-3.5 text-emerald-700" />
          <span>Multi-Step Decision Support</span>
        </div>
        <h1 className="text-3xl font-serif font-bold text-slate-900">
          {t('product.title', 'Product Intelligence Analyzer')}
        </h1>
        <p className="text-sm text-slate-600 max-w-3xl">
          {t('product.subtitle', 'Evaluate AYUSH formulations against the Drugs and Cosmetics Act (Schedule T & Rule 158-B), FSSAI Ayurveda Aahar regulations, Indian Patents Act Section 3(p)/3(e), and National Biodiversity Authority ABS requirements.')}
        </p>
      </div>

      {/* Preset Quick Loader Buttons */}
      {step < 5 && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 font-medium">
            <span className="font-semibold text-slate-900">Quick Test:</span> Load an authoritative product profile:
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadPreset(1)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-700/50 hover:bg-emerald-50 text-xs text-slate-700 font-medium transition-colors"
            >
              1. Synergistic Ashwagandha Extract (Proprietary)
            </button>
            <button
              type="button"
              onClick={() => loadPreset(2)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-700/50 hover:bg-emerald-50 text-xs text-slate-700 font-medium transition-colors"
            >
              2. Chyawanprash Rasayana (Classical Text)
            </button>
            <button
              type="button"
              onClick={() => loadPreset(3)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-emerald-700/50 hover:bg-emerald-50 text-xs text-slate-700 font-medium transition-colors"
            >
              3. Triphala Fizz (Ayurveda Aahar)
            </button>
          </div>
        </div>
      )}

      {/* Wizard Step Progress Bar */}
      {step < 5 && (
        <div className="relative flex items-center justify-between">
          {[
            { num: 1, label: 'Basic Information' },
            { num: 2, label: 'Ingredients & Formula' },
            { num: 3, label: 'Intended Use & Claims' },
            { num: 4, label: 'Market & Distribution' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => setStep(s.num)}
              className="flex-1 flex flex-col items-center cursor-pointer group"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.num
                    ? 'bg-slate-900 text-white shadow-md'
                    : step > s.num
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}
              >
                {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
              </div>
              <span
                className={`text-[11px] mt-1.5 font-medium text-center hidden sm:block ${
                  step === s.num ? 'text-slate-900 font-semibold' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Step Forms */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 1: Product Identification & Dosage Form
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Product Commercial Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ashwa-Curcumin Mobility Formula"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Proposed Product Category
                </label>
                <select
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden bg-white"
                >
                  <option>Proprietary Ayurvedic Medicine</option>
                  <option>Classical Ayurvedic Medicine</option>
                  <option>Ayurveda-Aahar</option>
                  <option>Cosmetic / Herbal Skincare</option>
                  <option>Phytopharmaceutical</option>
                  <option>Other / Unsure</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Dosage Form / Delivery System
                </label>
                <input
                  type="text"
                  placeholder="e.g. Capsule, Syrup, Tablet, Avaleha, Oil, Effervescent"
                  value={formData.dosage_form}
                  onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Manufacturing Setup & Premises
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule T GMP Certified facility, Third-party loan license"
                  value={formData.manufacturing_info}
                  onChange={(e) => setFormData({ ...formData, manufacturing_info: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!formData.product_name.trim()}
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Continue to Ingredients</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 2: Ingredients, Formulation & Biological Sourcing
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Ingredients List (with botanical names and quantities) *
                </label>
                <textarea
                  rows={4}
                  placeholder="e.g. Withania somnifera (Ashwagandha) extract 300mg, Curcuma longa (Haridra) 200mg, Piper nigrum 5mg..."
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Classical Authoritative Text Reference (If Classical Medicine)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Charaka Samhita Chikitsa Sthana Ch. 1, Sharangadhara Samhita, or Leave blank if proprietary"
                  value={formData.classical_reference}
                  onChange={(e) => setFormData({ ...formData, classical_reference: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500">
                  Must be one of the 54 authoritative texts listed in the First Schedule of the Drugs & Cosmetics Act, 1940.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Biological Resource Origin & Provenance Details (NBA/SBB compliance)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sourced from cultivated farms in Madhya Pradesh vs wild harvested from forest areas; vendor origin certification status"
                  value={formData.biological_source_details}
                  onChange={(e) => setFormData({ ...formData, biological_source_details: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!formData.ingredients.trim()}
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Continue to Claims</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 3: Intended Use, Symptoms & Label Claims
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Intended Therapeutic or Dietary Use
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Joint mobility support, antioxidant rejuvenation, healthy cartilage maintenance"
                  value={formData.intended_use}
                  onChange={(e) => setFormData({ ...formData, intended_use: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Specific Marketing Claims & Packaging Statements
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. 'Clinically proven synergy', 'Relieves chronic arthritis in 7 days', 'Rasayana rejuvenation'..."
                  value={formData.claims}
                  onChange={(e) => setFormData({ ...formData, claims: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500">
                  Note: Claims to "cure" diseases listed in Schedule J of Drugs & Cosmetics Rules are strictly prohibited.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Continue to Market</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <h3 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
              Step 4: Target Market & Commercial Distribution
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Target Geographic Market
                </label>
                <select
                  value={formData.target_market}
                  onChange={(e) => setFormData({ ...formData, target_market: e.target.value as any })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden bg-white"
                >
                  <option value="Domestic">Domestic India Only</option>
                  <option value="Export">Export Only (CoPP / WHO-GMP)</option>
                  <option value="Both">Both Domestic and International Export</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Distribution Channels
                </label>
                <input
                  type="text"
                  placeholder="e.g. Registered Ayurvedic doctors, Over-the-counter, D2C e-commerce"
                  value={formData.distribution_channels}
                  onChange={(e) => setFormData({ ...formData, distribution_channels: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs text-emerald-950 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <p>
                Ready to analyze against authoritative repositories. The AI will evaluate patentability hurdles under Section 3(p)/3(e), regulatory licensing pathways under the Drugs & Cosmetics Act, and mandatory NBA approvals.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                id="run-product-analysis-btn"
                onClick={handleAnalyze}
                disabled={loading}
                className="px-6 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white text-xs font-semibold transition-all shadow-md flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Analyzing Formulation...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generate Complete Analysis</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Analysis & Results Display */}
        {step === 5 && result && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 tracking-wider uppercase">
                  Analysis Dossier
                </span>
                <h2 className="text-xl font-serif font-bold text-slate-900">
                  {result.product_information.product_name}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToWorkspace}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>{savedSuccess ? 'Saved to Workspace!' : 'Save Dossier'}</span>
                </button>

                <button
                  type="button"
                  id="export-product-analysis-pdf-btn"
                  onClick={handleExportPDF}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
                >
                  New Analysis
                </button>
              </div>
            </div>

            {/* Structured Card 1: Likely Category */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Statutory Classification
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-semibold text-xs border border-emerald-200">
                  {result.likely_category}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-serif">
                {result.category_reasoning}
              </p>
              <div className="text-[11px] text-slate-400 italic">
                * Note: Category determination is an AI-assisted analytical finding for decision support and does not replace formal licensing from the State AYUSH Licensing Authority.
              </div>
            </div>

            {/* Structured Card 2: Regulatory Considerations */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                Regulatory Considerations & Compliance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.regulatory_considerations.map((rc, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <span className="text-xs font-bold text-slate-900 block">{rc.title}</span>
                    <p className="text-xs text-slate-600 leading-relaxed">{rc.description}</p>
                    <div className="pt-2 border-t border-slate-200/60 text-[11px]">
                      <span className="text-slate-500 block">Governing Statute:</span>
                      <strong className="text-slate-800">{rc.governing_statute}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Structured Card 3: IPR Considerations */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Intellectual Property Rights (IPR) Evaluation
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <span>Section 3(p) & Section 3(e) Patent Hurdles</span>
                  </div>
                  <p className="leading-relaxed">{result.ipr_considerations.patent_assessment}</p>
                  <p className="leading-relaxed font-medium">{result.ipr_considerations.section_3e_admixture_bar}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block">Trademark Protection (Class 5/Class 3)</span>
                    <p className="text-slate-600 leading-relaxed">{result.ipr_considerations.trademark_recommendation}</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-900 block">Industrial Design & Trade Secrets</span>
                    <p className="text-slate-600 leading-relaxed">{result.ipr_considerations.industrial_design}</p>
                    <p className="text-slate-600 leading-relaxed">{result.ipr_considerations.trade_secret_potential}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Structured Card 4: Traditional Knowledge / Biological Resource / ABS Flags */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                Traditional Knowledge & ABS Flags
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">TK Prior Art Risk Level:</span>
                  <span className={`px-2 py-0.5 rounded font-bold ${
                    result.traditional_knowledge_abs_flags.tk_prior_art_risk === 'High'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {result.traditional_knowledge_abs_flags.tk_prior_art_risk}
                  </span>
                </div>
                <p className="text-slate-600">{result.traditional_knowledge_abs_flags.tk_details}</p>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                  <strong>NBA / SBB Statutory Filing:</strong> {result.traditional_knowledge_abs_flags.nba_abs_requirements}
                </div>
              </div>
            </div>

            {/* Structured Card 5: Recommended Next Steps */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Recommended Action Plan
              </h3>
              <ol className="space-y-2 text-xs text-slate-700">
                {result.recommended_next_steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-slate-900 shrink-0">{idx + 1}.</span>
                    <span>{step.replace(/^\d+\.\s*/, '')}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Structured Card 6: Authoritative Evidence */}
            {result.evidence && result.evidence.length > 0 && (
              <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Authoritative Statutory Citations ({result.evidence.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.evidence.map((ev) => (
                    <div
                      key={ev.chunk_id}
                      onClick={() => onOpenCitation(ev)}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-emerald-50/50 hover:border-emerald-300 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-900 group-hover:text-emerald-900 mb-1">
                        <span>[{ev.index}] {ev.section}</span>
                        <span className="text-[10px] text-slate-500">{ev.authority}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                        "{ev.excerpt}"
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DisclaimerBanner />
          </div>
        )}
      </div>
    </div>
  );
};

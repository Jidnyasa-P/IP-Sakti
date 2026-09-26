import React, { useState } from 'react';
import {
  HelpCircle,
  AlertTriangle,
  Mail,
  Send,
  ChevronDown,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { ActiveTab } from './Header';
import { authFetch } from './auth/authStorage';
import { LegalDocument } from './LegalPolicyModal';
import { useAuth } from '../context/AuthContext';

interface HelpDeskViewProps {
  setActiveTab: (tab: ActiveTab) => void;
  onRaiseGrievance?: () => void;
  onOpenLegal: (document: LegalDocument) => void;
}

const FAQS = [
  ['What can I ask IP-SAKTI Sahayak?', 'You can ask about intellectual property, AYUSH regulations, traditional knowledge, biodiversity and related regulatory research. The assistant uses the selected jurisdiction and available authoritative sources to support its response.'],
  ['What is the difference between Indian and International jurisdiction?', 'Indian jurisdiction focuses on Indian statutes, authorities and requirements. International jurisdiction focuses on relevant global frameworks, treaties and foreign intellectual-property or regulatory contexts. Select the mode that matches your question.'],
  ['Can I upload a document or image with my question?', 'Yes. Supported documents can be read for relevant text, while supported images can be analyzed for readable text and other material details. The extracted attachment context can then be considered with your question.'],
  ['What happens when an answer has low confidence?', 'The chat can offer expert consultation for low-confidence cases. You can choose an Ayurveda Expert, Legal / IP Expert or Regulatory Affairs Expert so the request is routed according to the selected expert type.'],
  ['Is the answer a legal opinion or a substitute for professional advice?', 'No. IP-SAKTI Sahayak is a decision-support and research tool. Its responses should be checked against the cited sources and, where appropriate, reviewed by a qualified legal, regulatory or domain professional.'],
  ['Does the platform support multiple languages?', 'Yes. The interface and supported language workflow are designed for multilingual access, with the available language options shown in the application.'],
];

export const HelpDeskView: React.FC<HelpDeskViewProps> = ({ setActiveTab, onRaiseGrievance, onOpenLegal }) => {
  const { isLoggedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [contactSending, setContactSending] = useState(false);

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactError(null);
    setContactSent(false);
    setContactSending(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const res = await authFetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'We could not send your message. Please try again.');
      }
      setContactSent(true);
      form.reset();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : 'We could not send your message.');
    } finally {
      setContactSending(false);
    }
  };

  const raiseGrievance = () => {
    if (isLoggedIn) onRaiseGrievance?.();
    else setActiveTab('login');
  };

  return (
    <div className="w-full overflow-hidden bg-slate-50">
      <section className="px-4 sm:px-6 lg:px-8 pt-10 pb-10 border-b border-slate-300">
        <div className="max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold">
            <HelpCircle className="w-4 h-4" />
            HelpDesk
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl font-serif font-semibold text-slate-950">Help & Support</h1>
          <p className="mt-3 max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">Find answers, raise a grievance, contact the IP-SAKTI team, and review the platform policies.</p>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-10 border-b border-slate-300">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4">
          <button type="button" onClick={raiseGrievance} className="text-left rounded-2xl border border-slate-300 bg-white p-5 hover:border-emerald-400 shadow-sm transition-colors">
            <AlertTriangle className="w-5 h-5 text-emerald-700 mb-3" />
            <h2 className="text-base font-semibold text-slate-900">Raise a Grievance</h2>
            <p className="mt-1 text-xs text-slate-500">Submit a concern or report an issue for review.</p>
          </button>
          <button type="button" onClick={() => document.getElementById('helpdesk-contact')?.scrollIntoView({ behavior: 'smooth' })} className="text-left rounded-2xl border border-slate-300 bg-white p-5 hover:border-emerald-400 shadow-sm transition-colors">
            <Mail className="w-5 h-5 text-emerald-700 mb-3" />
            <h2 className="text-base font-semibold text-slate-900">Contact Us</h2>
            <p className="mt-1 text-xs text-slate-500">Send a message to the IP-SAKTI team.</p>
          </button>
        </div>
      </section>

      <section id="helpdesk-faqs" className="px-4 sm:px-6 lg:px-8 py-14 border-b border-slate-300">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Frequently Asked Questions</p>
          <h2 className="mt-2 text-3xl font-serif font-semibold text-slate-950">Common questions about IP-SAKTI Sahayak</h2>
          <div className="mt-7 space-y-3">
            {FAQS.map(([question, answer], index) => {
              const open = openFaq === index;
              return (
                <div key={question} className="rounded-xl border border-slate-300 bg-white shadow-sm overflow-hidden">
                  <button type="button" onClick={() => setOpenFaq(open ? null : index)} className="w-full flex items-center justify-between gap-4 p-4 text-left">
                    <span className="text-sm font-semibold text-slate-900">{question}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && <div className="px-4 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200 pt-3">{answer}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact section intentionally mirrors the Home page Contact Us section. */}
      <section id="helpdesk-contact" className="px-4 sm:px-6 lg:px-8 py-14 sm:py-20 bg-slate-950 dark:bg-black text-white border-b border-slate-800">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-16">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Contact Us</p>
            <h2 className="mt-2 text-3xl sm:text-4xl font-serif font-semibold">Have a question or want to work with us?</h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-md">Share your query, feedback or collaboration idea. We will use your message to understand what you need from IP-SAKTI Sahayak.</p>
          </div>
          <form onSubmit={handleContactSubmit} className="rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-7 text-slate-900 dark:text-white shadow-2xl border border-slate-300 dark:border-slate-700">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="text-sm font-medium">Name<input required name="name" type="text" placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" /></label>
              <label className="text-sm font-medium">Email<input required name="email" type="email" placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" /></label>
            </div>
            <label className="block mt-4 text-sm font-medium">Subject<input required name="subject" type="text" placeholder="How can we help?" className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500" /></label>
            <label className="block mt-4 text-sm font-medium">Message<textarea required name="message" rows={5} placeholder="Tell us a little about your question..." className="mt-1.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-3 text-sm outline-none focus:border-emerald-500 resize-y" /></label>
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button type="submit" disabled={contactSending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white px-5 py-3 text-sm font-semibold transition-colors disabled:opacity-60"><Send className="w-4 h-4" />{contactSending ? 'Sending...' : 'Send Message'}</button>
                <button type="button" onClick={raiseGrievance} className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"><AlertTriangle className="w-4 h-4" />Raise a Grievance</button>
              </div>
              {contactError && <span className="text-sm text-rose-300 font-medium">{contactError}</span>}
              {contactSent && <span className="text-sm text-emerald-300 font-medium">Thanks! Your message has been recorded for this session.</span>}
            </div>
          </form>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-10 border-b border-slate-300">
        <div className="max-w-6xl mx-auto grid sm:grid-cols-2 gap-4">
          <button type="button" onClick={() => onOpenLegal('terms')} className="text-left rounded-2xl border border-slate-300 bg-white p-5 hover:border-emerald-400 shadow-sm">
            <FileText className="w-5 h-5 text-emerald-700 mb-3" /><h2 className="text-sm font-semibold text-slate-900">Terms & Conditions</h2><p className="mt-1 text-xs text-slate-500">Read the terms governing use of the platform.</p>
          </button>
          <button type="button" onClick={() => onOpenLegal('privacy')} className="text-left rounded-2xl border border-slate-300 bg-white p-5 hover:border-emerald-400 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-emerald-700 mb-3" /><h2 className="text-sm font-semibold text-slate-900">Privacy Policy</h2><p className="mt-1 text-xs text-slate-500">Understand how information is processed and protected.</p>
          </button>
        </div>
      </section>
    </div>
  );
};

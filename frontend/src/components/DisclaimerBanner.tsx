import React from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

interface DisclaimerBannerProps {
  compact?: boolean;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ compact = false }) => {
  const { t } = useTranslation();

  return (
    <div
      id="responsible-ai-disclaimer"
      className={`rounded-lg border border-amber-900/20 bg-amber-50/60 text-amber-900 ${
        compact ? 'p-2.5 text-xs' : 'p-3.5 text-sm'
      } flex items-start gap-2.5 transition-all`}
    >
      <AlertCircle className={`flex-shrink-0 text-amber-700 ${compact ? 'w-4 h-4 mt-0.5' : 'w-5 h-5 mt-0.5'}`} />
      <p className="leading-relaxed font-normal">
        <strong className="font-semibold">{t('disclaimer.title', 'Statutory Advisory:')}</strong>{' '}
        {t(
          'disclaimer.body',
          'IP-SAKTI Sahayak provides AI-assisted research and decision support based on indexed statutory provisions. It does not constitute formal legal counsel or a binding regulatory determination. Verify critical matters with the Controller General of Patents (CGPDTM), the National Biodiversity Authority (NBA), or State AYUSH Authorities.'
        )}
      </p>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { authFetch } from '../components/auth/authStorage';

export interface StatutoryLinkInfo {
  section: string;
  documentTitle: string;
  authority: string;
  url?: string;
  description?: string;
}

/**
 * Resolve authoritative citation metadata from the backend, whose document
 * metadata is loaded from ip_sakti_rag/data/documents/manifest.json.
 * No government URL is stored in frontend source code.
 */
export async function getManifestSectionLink(
  sectionOrDocumentId: string,
  documentId?: string,
): Promise<StatutoryLinkInfo | null> {
  const id = (documentId || sectionOrDocumentId || '').trim();
  if (!id) return null;

  try {
    const res = await authFetch(`/api/documents/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const payload = await res.json();
    const metadata = payload?.metadata || payload;
    if (!metadata) return null;

    return {
      section: sectionOrDocumentId || metadata.title || id,
      documentTitle: metadata.title || id,
      authority: metadata.authority || metadata.source || 'Authoritative source',
      url: metadata.url || undefined,
      description: metadata.summary || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Backwards-compatible clickable statutory reference. Pass the manifest
 * document ID through `documentId`; without it the component renders the
 * section label but never invents a URL.
 */
export const StatutorySectionLink: React.FC<{
  sectionText: string;
  documentId?: string;
  className?: string;
  showIcon?: boolean;
}> = ({ sectionText, documentId, className = '', showIcon = true }) => {
  const [link, setLink] = useState<StatutoryLinkInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(documentId));

  useEffect(() => {
    let active = true;
    if (!documentId) {
      setLink(null);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    getManifestSectionLink(sectionText, documentId).then((resolved) => {
      if (!active) return;
      setLink(resolved);
      setLoading(false);
    });

    return () => { active = false; };
  }, [sectionText, documentId]);

  if (!link?.url) {
    return (
      <span className={className} title={loading ? 'Loading authoritative source…' : 'Authoritative source unavailable'}>
        {sectionText}
      </span>
    );
  }

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noreferrer noopener"
      className={className}
      title={`Open authoritative source: ${link.documentTitle} (${link.authority})`}
    >
      {sectionText}
      {showIcon && (loading ? <Loader2 className="inline-block w-3 h-3 ml-1 animate-spin" /> : <ExternalLink className="inline-block w-3 h-3 ml-1" />)}
    </a>
  );
};

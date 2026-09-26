import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LowConfidenceQuery, ExpertReview } from '../types';
import { INITIAL_LOW_CONFIDENCE_QUERIES } from '../data/lowConfidenceQueries';
import { authFetch } from '../components/auth/authStorage';
import { useAuth } from './AuthContext';

// Server-backed expert queue. The previous local-storage-only mode meant
// expert users could never see consultations submitted by real users.
const SERVER_SYNC_ENABLED = true;

const STORAGE_KEY = 'ipsakti_expert_flagged_queries_v2';

interface ExpertAdvisoryContextType {
  queries: LowConfidenceQuery[];
  pendingCount: number;
  resolvedCount: number;
  isLoading: boolean;
  resolveQuery: (id: string, review: ExpertReview) => Promise<void>;
  flagQuery: (query: Partial<LowConfidenceQuery>) => Promise<void>;
  deleteQuery: (id: string) => Promise<void>;
  refreshQueries: () => Promise<void>;
}

const ExpertAdvisoryContext = createContext<ExpertAdvisoryContextType | undefined>(undefined);

export const ExpertAdvisoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLoggedIn, currentUser } = useAuth();
  const isExpert = isLoggedIn && currentUser?.roles?.includes('Expert');
  const [queries, setQueries] = useState<LowConfidenceQuery[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {
        console.warn('Failed to parse local stored flagged queries', e);
      }
    }
    return INITIAL_LOW_CONFIDENCE_QUERIES;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sync to local storage
  useEffect(() => {
    if (typeof window !== 'undefined' && !isExpert) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
      } catch (e) {}
    }
  }, [queries]);

  // Fetch the authenticated expert's assigned consultations from the backend.
  const refreshQueries = async () => {
    if (!SERVER_SYNC_ENABLED || !isExpert) return;
    try {
      setIsLoading(true);
      const res = await authFetch('/api/expert-escalations');
      if (!res.ok) throw new Error(`Expert queue request failed (${res.status})`);
      const data = await res.json();
      const mapped: LowConfidenceQuery[] = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: item.id,
        conversation_id: item.conversation_id,
        inquirer_name: item.requester_name || 'Sahayak User',
        inquirer_role: 'Practitioner',
        topic: item.expert_type_label || 'Expert Consultation',
        query: item.query || item.case_summary || '',
        created_at: item.created_at || new Date().toISOString(),
        jurisdiction: 'india',
        ai_response: {
          content: 'This query was redirected by the user for expert guidance.',
          confidence: { level: 'Low', score: 0, reasons: item.reason ? [item.reason] : [] },
        },
        status: item.status === 'resolved' ? 'resolved' : item.status === 'assigned' ? 'in_review' : 'pending_review',
      }));
      setQueries(mapped);
    } catch (e) {
      console.warn('Could not load assigned expert consultations:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isExpert) refreshQueries();
  }, [isExpert, currentUser?.id]);

  const pendingCount = queries.filter(q => q.status !== 'resolved').length;
  const resolvedCount = queries.filter(q => q.status === 'resolved').length;

  const resolveQuery = async (id: string, review: ExpertReview) => {
    setQueries(prev =>
      prev.map(q => {
        if (q.id === id) {
          return {
            ...q,
            status: 'resolved',
            expert_review: review
          };
        }
        return q;
      })
    );

    if (!SERVER_SYNC_ENABLED || !isExpert) return;
    try {
      const res = await authFetch(`/api/expert-escalations/${encodeURIComponent(id)}?status=resolved`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error(`Status update failed (${res.status})`);
      await refreshQueries();
    } catch (e) {
      console.warn('Server update for expert resolve failed:', e);
    }
  };

  const flagQuery = async (queryData: Partial<LowConfidenceQuery>) => {
    const newQuery: LowConfidenceQuery = {
      id: `lc-query-${Date.now()}`,
      created_at: new Date().toISOString(),
      status: 'pending_review',
      inquirer_name: queryData.inquirer_name || 'Anonymous User',
      inquirer_role: queryData.inquirer_role || 'Practitioner',
      inquirer_organization: queryData.inquirer_organization || 'Clinical AYUSH Center',
      topic: queryData.topic || 'Unclassified Low-Confidence Query',
      query: queryData.query || '',
      jurisdiction: queryData.jurisdiction || 'india',
      ai_response: queryData.ai_response || {
        content: 'Low confidence statutory response generated.',
        confidence: {
          level: 'Low',
          score: 0.5,
          reasons: ['Statutory ambiguity flagged for human legal advisor review']
        }
      },
      ...queryData
    } as LowConfidenceQuery;

    setQueries(prev => [newQuery, ...prev]);

    if (!SERVER_SYNC_ENABLED) return; // see file-level note
    try {
      await fetch('/api/expert/flagged-queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuery)
      });
    } catch (e) {}
  };

  const deleteQuery = async (id: string) => {
    setQueries(prev => prev.filter(q => q.id !== id));
    if (!SERVER_SYNC_ENABLED) return; // see file-level note
    try {
      await fetch(`/api/expert/flagged-queries/${id}`, { method: 'DELETE' });
    } catch (e) {}
  };

  return (
    <ExpertAdvisoryContext.Provider
      value={{
        queries,
        pendingCount,
        resolvedCount,
        isLoading,
        resolveQuery,
        flagQuery,
        deleteQuery,
        refreshQueries
      }}
    >
      {children}
    </ExpertAdvisoryContext.Provider>
  );
};

export const useExpertAdvisory = (): ExpertAdvisoryContextType => {
  const context = useContext(ExpertAdvisoryContext);
  if (!context) {
    throw new Error('useExpertAdvisory must be used within an ExpertAdvisoryProvider');
  }
  return context;
};

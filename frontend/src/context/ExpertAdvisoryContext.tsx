import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LowConfidenceQuery, ExpertReview } from '../types';
import { INITIAL_LOW_CONFIDENCE_QUERIES } from '../data/lowConfidenceQueries';

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
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(queries));
      } catch (e) {}
    }
  }, [queries]);

  // Fetch from server on mount
  const refreshQueries = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/expert/flagged-queries');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setQueries(data);
        }
      }
    } catch (e) {
      console.warn('Could not fetch expert flagged queries from server, using local storage cache', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshQueries();
  }, []);

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

    try {
      await fetch(`/api/expert/flagged-queries/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expert_review: review })
      });
    } catch (e) {
      console.warn('Server update for expert resolve failed, cached locally', e);
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

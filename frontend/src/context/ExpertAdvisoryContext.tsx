import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { LowConfidenceQuery, ExpertReview, ExpertEscalation } from '../types';
import { authFetch } from '../components/auth/authStorage';
import { useAuth } from './AuthContext';

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

function expertTypeLabel(type?: string | null): string {
  return ({
    ayurveda: 'Ayurveda Expert',
    legal: 'Legal / IP Expert',
    regulatory: 'Regulatory Affairs Expert',
  } as Record<string, string>)[type || ''] || 'Expert';
}

function mapEscalation(row: ExpertEscalation): LowConfidenceQuery {
  return {
    id: row.id,
    conversation_id: row.conversation_id || undefined,
    inquirer_name: 'User',
    inquirer_role: 'Practitioner',
    topic: `${expertTypeLabel(row.expert_type)} consultation`,
    query: row.query || row.case_summary || '',
    created_at: row.created_at || new Date().toISOString(),
    status: row.status === 'resolved' ? 'resolved' : row.status === 'assigned' ? 'in_review' : 'pending_review',
    ai_response: {
      content: row.reason || 'This query was redirected for expert guidance.',
      confidence: {
        level: 'Low',
        score: 0,
        reasons: [row.reason || 'Expert guidance requested by the user.'],
      },
      citations: [],
      relevant_considerations: [],
      recommended_next_steps: [],
    },
  };
}

export const ExpertAdvisoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, isLoggedIn } = useAuth();
  const [queries, setQueries] = useState<LowConfidenceQuery[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshQueries = async () => {
    if (!isLoggedIn || !currentUser || currentUser.role !== 'Expert') {
      setQueries([]);
      return;
    }
    try {
      setIsLoading(true);
      const res = await authFetch('/api/expert-escalations');
      if (!res.ok) throw new Error(`Expert queue request failed: ${res.status}`);
      const data = await res.json();
      const rows: ExpertEscalation[] = Array.isArray(data) ? data : [];
      setQueries(rows.map(mapEscalation));
    } catch (e) {
      console.warn('Could not fetch assigned expert consultations:', e);
      setQueries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshQueries();
  }, [isLoggedIn, currentUser?.id, currentUser?.role]);

  const pendingCount = queries.filter(q => q.status !== 'resolved').length;
  const resolvedCount = queries.filter(q => q.status === 'resolved').length;

  const resolveQuery = async (id: string, review: ExpertReview) => {
    const res = await authFetch(`/api/expert-escalations/${encodeURIComponent(id)}?status=resolved`, {
      method: 'PATCH',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.detail || 'Could not update expert consultation status.');
    }
    setQueries(prev => prev.map(q => q.id === id ? { ...q, status: 'resolved', expert_review: review } : q));
  };

  const flagQuery = async () => {
    await refreshQueries();
  };

  const deleteQuery = async () => {
    // Expert consultation records are intentionally not deleted from the
    // server by experts; they remain auditable. Refresh the assigned queue.
    await refreshQueries();
  };

  return (
    <ExpertAdvisoryContext.Provider value={{
      queries, pendingCount, resolvedCount, isLoading,
      resolveQuery, flagQuery, deleteQuery, refreshQueries,
    }}>
      {children}
    </ExpertAdvisoryContext.Provider>
  );
};

export const useExpertAdvisory = (): ExpertAdvisoryContextType => {
  const context = useContext(ExpertAdvisoryContext);
  if (!context) throw new Error('useExpertAdvisory must be used within an ExpertAdvisoryProvider');
  return context;
};

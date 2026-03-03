// ccwg-web/src/components/system/SanctionGate.tsx

'use client';

import { useEffect, useState } from 'react';
import type { PlayerSanction } from '@/src/types/database';

const priority = (type: string) => {
  if (type === 'PermanentBan') return 3;
  if (type === 'Suspension') return 2;
  return 1;
};

export function SanctionGate({ children }: { children: React.ReactNode }) {
  const [sanction, setSanction] = useState<PlayerSanction | null>(null);
  const [loading, setLoading] = useState(true);
  const [petitionText, setPetitionText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchSanctions = async () => {
      try {
        const res = await fetch('/api/sanctions', { cache: 'no-store' });
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        const sanctions: PlayerSanction[] = data.sanctions || [];
        const top = sanctions.sort((a, b) => priority(b.sanction_type) - priority(a.sanction_type))[0];
        setSanction(top || null);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };

    fetchSanctions();
  }, []);

  const submitPetition = async () => {
    if (!sanction || !petitionText.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/petitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sanction_id: sanction.sanction_id,
          petition_text: petitionText.trim(),
        }),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !sanction) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-4">Account Action In Effect</h1>
        <p className="text-gray-300 mb-4">
          Your account has a <span className="font-semibold">{sanction.sanction_type}</span>.
        </p>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-400">Reason</p>
          <p className="text-base text-white">{sanction.reason}</p>
          {sanction.expires_at && (
            <p className="text-sm text-gray-400 mt-2">
              Expires: {new Date(sanction.expires_at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Petition this action</p>
          <textarea
            value={petitionText}
            onChange={(e) => setPetitionText(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded p-3 text-white"
            placeholder="Explain why this action should be reviewed..."
          />
          <button
            onClick={submitPetition}
            disabled={submitting || !petitionText.trim()}
            className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded"
          >
            {submitting ? 'Submitting...' : 'Submit Petition'}
          </button>
        </div>
      </div>
    </div>
  );
}

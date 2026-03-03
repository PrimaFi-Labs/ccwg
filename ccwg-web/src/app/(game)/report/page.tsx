'use client';

import { useState } from 'react';
import { ConnectWallet } from '@/src/components/auth/ConnectWallet';
import { useAccount } from '@starknet-react/core';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

const REASONS = ['Cheating', 'Stalling', 'Harassment', 'BugExploit', 'Other'];

export default function ReportPage() {
  const { isConnected } = useAccount();
  const [reportedWallet, setReportedWallet] = useState('');
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submitReport = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reported_wallet: reportedWallet,
          reason,
          details,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to submit report');
      } else {
        setMessage('Report submitted. Thank you.');
        setReportedWallet('');
        setDetails('');
      }
    } catch {
      setMessage('Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative text-center p-12 rounded-2xl border overflow-hidden max-w-sm w-full"
          style={{
            background: 'var(--bg-panel)',
            borderColor: 'var(--border-accent)',
            boxShadow: '0 0 60px var(--hud-glow)',
          }}
        >
          {/* scan-line sweep */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, var(--accent-primary) 2px, var(--accent-primary) 3px)',
              animation: 'pulse 4s ease-in-out infinite',
            }}
          />

          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto mb-5 w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'var(--accent-primary-dim)', boxShadow: '0 0 30px var(--accent-primary-glow)' }}
          >
            <ShieldAlert className="w-8 h-8" style={{ color: 'var(--accent-primary)' }} />
          </motion.div>

          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Reports Locked</h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
            Connect your wallet to submit a player report
          </p>
          <ConnectWallet />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-xl mx-auto bg-[var(--bg-panel)] border border-[var(--border-base)] rounded-lg p-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-4">Report a Player</h1>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Reported Wallet</label>
            <input
              value={reportedWallet}
              onChange={(e) => setReportedWallet(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded p-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="0x..."
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded p-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-muted)] mb-1">Details</label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-base)] rounded p-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--accent-primary)]"
              placeholder="Add any relevant details..."
            />
          </div>
          <button
            onClick={submitReport}
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white rounded py-3 font-semibold disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
          {message && <p className="text-sm text-gray-300">{message}</p>}
        </div>
      </div>
    </div>
  );
}

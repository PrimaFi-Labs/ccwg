'use client';

import { useEffect, useState } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import type { PlayerSanction } from '@/src/types/database';
import { Shield } from 'lucide-react';

const STATUS = ['Active', 'Expired', 'Revoked'];
const PETITION_STATUS = ['None', 'Pending', 'Approved', 'Rejected'];

export default function AdminSanctionsPage() {
  const [items, setItems] = useState<PlayerSanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [playerWallet, setPlayerWallet] = useState('');
  const [sanctionType, setSanctionType] = useState('Suspension');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [spPenalty, setSpPenalty] = useState('');

  useEffect(() => {
    fetchSanctions();
  }, []);

  const fetchSanctions = async () => {
    try {
      const res = await fetch('/api/control/sanctions');
      const data = await res.json();
      setItems(data.sanctions || []);
    } catch (error) {
      console.error('Failed to fetch sanctions:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSanction = async (sanction_id: number, status: string, petition_status: string) => {
    await fetch('/api/control/sanctions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sanction_id, status, petition_status }),
    });
    await fetchSanctions();
  };

  const createSanction = async () => {
    await fetch('/api/control/sanctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_wallet: playerWallet,
        sanction_type: sanctionType,
        reason,
        expires_at: expiresAt || null,
        sp_penalty: spPenalty || 0,
      }),
    });
    setPlayerWallet('');
    setReason('');
    setExpiresAt('');
    setSpPenalty('');
    await fetchSanctions();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-red-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Sanctions</h1>
            <p className="text-gray-400">Review and manage sanctions and petitions</p>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create Sanction</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={playerWallet}
              onChange={(e) => setPlayerWallet(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="Player wallet"
            />
            <select
              value={sanctionType}
              onChange={(e) => setSanctionType(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded p-3 text-white"
            >
              <option value="Suspension">Suspension</option>
              <option value="PermanentBan">Permanent Ban</option>
              <option value="TournamentBan">Tournament Ban</option>
            </select>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="Reason"
            />
            <input
              value={spPenalty}
              onChange={(e) => setSpPenalty(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="SP penalty (optional)"
            />
            <input
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="Expires at (optional ISO)"
            />
          </div>
          <button
            onClick={createSanction}
            className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded"
          >
            Create
          </button>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Player</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Reason</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">SP Penalty</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Petition</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-8 bg-gray-700 rounded animate-shimmer" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">
                    No sanctions
                  </td>
                </tr>
              ) : (
                items.map((s) => (
                  <tr key={s.sanction_id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-white font-mono">
                      {s.player_wallet.slice(0, 10)}...{s.player_wallet.slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-gray-300">{s.sanction_type}</td>
                    <td className="px-6 py-4 text-gray-300">{s.reason}</td>
                    <td className="px-6 py-4 text-gray-300">{s.sp_penalty ?? 0}</td>
                    <td className="px-6 py-4 text-gray-300">{s.status}</td>
                    <td className="px-6 py-4 text-gray-300">{s.petition_status}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <select
                          value={s.status}
                          onChange={(e) => updateSanction(s.sanction_id, e.target.value, s.petition_status)}
                          className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                        >
                          {STATUS.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <select
                          value={s.petition_status}
                          onChange={(e) => updateSanction(s.sanction_id, s.status, e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                        >
                          {PETITION_STATUS.map((ps) => (
                            <option key={ps} value={ps}>{ps}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

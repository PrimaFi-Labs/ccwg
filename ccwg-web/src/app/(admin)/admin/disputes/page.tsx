'use client';

import { useEffect, useState } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { AlertTriangle } from 'lucide-react';

type RoomDispute = {
  dispute_id: number;
  room_code: string;
  room_id: number | null;
  player_wallet: string;
  message: string;
  status: string;
  admin_wallet: string | null;
  admin_reply: string | null;
  report_id: number | null;
  created_at: string;
  updated_at: string;
};

const STATUS_OPTIONS = ['Open', 'Reviewed', 'Resolved', 'Closed'];

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<RoomDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [roomCodeSearch, setRoomCodeSearch] = useState('');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const res = await fetch('/api/admin/disputes');
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch (error) {
      console.error('Failed to fetch disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateDispute = async (disputeId: number, status?: string, adminReply?: string) => {
    const body: Record<string, unknown> = { dispute_id: disputeId };
    if (status) body.status = status;
    if (adminReply) body.admin_reply = adminReply;

    await fetch('/api/admin/disputes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await fetchDisputes();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Room Disputes</h1>
            <p className="text-gray-400">Review room disputes and reply to players</p>
          </div>
        </div>

        {/* Room lookup */}
        <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <label className="block text-sm font-medium text-gray-300 mb-2">Quick Room Lookup (Admin View)</label>
          <div className="flex gap-2">
            <input
              value={roomCodeSearch}
              onChange={(e) => setRoomCodeSearch(e.target.value.toUpperCase())}
              placeholder="Enter Room Code"
              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white"
            />
            <button
              onClick={() => {
                if (roomCodeSearch.trim()) {
                  window.open(`/api/admin/rooms/${roomCodeSearch.trim()}`, '_blank');
                }
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg"
            >
              View Room
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="bg-gray-800 rounded-lg p-6 text-gray-400">Loading disputes...</div>
          ) : disputes.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-gray-400 text-center">No disputes</div>
          ) : (
            disputes.map((d) => (
              <div key={d.dispute_id} className="bg-gray-800 border border-gray-700 rounded-lg p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        Room: {d.room_code}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                        #{d.dispute_id}
                      </span>
                      {d.report_id && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-900/30 text-yellow-300">
                          Report #{d.report_id}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 font-mono mb-1">
                      From: {d.player_wallet.slice(0, 12)}...{d.player_wallet.slice(-8)}
                    </p>
                    <p className="text-sm text-white mt-2">{d.message}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(d.created_at).toLocaleString()}</p>

                    {d.admin_reply && (
                      <div className="mt-3 bg-purple-900/20 border border-purple-700/30 rounded-lg p-3">
                        <p className="text-xs text-purple-400 mb-1">Admin Reply:</p>
                        <p className="text-sm text-gray-300">{d.admin_reply}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <select
                      value={d.status}
                      onChange={(e) => updateDispute(d.dispute_id, e.target.value)}
                      className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reply form */}
                <div className="mt-3 flex gap-2">
                  <input
                    value={replyText[d.dispute_id] || ''}
                    onChange={(e) => setReplyText((prev) => ({ ...prev, [d.dispute_id]: e.target.value }))}
                    placeholder="Type reply to send to player's inbox..."
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm"
                  />
                  <button
                    onClick={async () => {
                      const reply = replyText[d.dispute_id]?.trim();
                      if (!reply) return;
                      await updateDispute(d.dispute_id, undefined, reply);
                      setReplyText((prev) => ({ ...prev, [d.dispute_id]: '' }));
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

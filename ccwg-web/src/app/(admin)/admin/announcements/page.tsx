'use client';

import { useEffect, useState } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import type { Announcement } from '@/src/types/database';
import { Megaphone } from 'lucide-react';

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch('/api/admin/announcements');
      const data = await res.json();
      setItems(data.announcements || []);
    } catch (error) {
      console.error('Failed to fetch announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(typeof data?.error === 'string' ? data.error : 'Failed to publish announcement');
      return;
    }
    const delivered = typeof data?.inbox_delivered_count === 'number' ? data.inbox_delivered_count : 0;
    setStatus(`Announcement published. Delivered to ${delivered} inboxes.`);
    setTitle('');
    setBody('');
    await fetchAnnouncements();
  };

  const pingAnnouncement = async (announcementId: number) => {
    setPingingId(announcementId);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ping', announcement_id: announcementId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(typeof data?.error === 'string' ? data.error : 'Failed to ping announcement');
        return;
      }

      const delivered = typeof data?.inbox_delivered_count === 'number' ? data.inbox_delivered_count : 0;
      setStatus(`Ping sent. Resent to ${delivered} inboxes.`);
    } finally {
      setPingingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Megaphone className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Announcements</h1>
            <p className="text-gray-400">Publish updates to all players</p>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create Announcement</h2>
          <div className="space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="Title"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-white"
              placeholder="Message"
            />
            <button
              onClick={createAnnouncement}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded"
            >
              Publish
            </button>
            {status ? <p className="text-sm text-gray-300">{status}</p> : null}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Title</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Message</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Created</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-6 py-4">
                      <div className="h-8 bg-gray-700 rounded animate-shimmer" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                    No announcements
                  </td>
                </tr>
              ) : (
                items.map((a) => (
                  <tr key={a.announcement_id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-white">{a.title}</td>
                    <td className="px-6 py-4 text-gray-300">{a.body}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(a.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => pingAnnouncement(a.announcement_id)}
                        disabled={pingingId === a.announcement_id}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm rounded"
                      >
                        {pingingId === a.announcement_id ? 'Pinging...' : 'Ping'}
                      </button>
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

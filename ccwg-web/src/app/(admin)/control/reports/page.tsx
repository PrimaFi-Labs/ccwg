'use client';

import { useEffect, useState } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import type { PlayerReport } from '@/src/types/database';
import { AlertTriangle } from 'lucide-react';

const STATUS = ['Open', 'Reviewed', 'Actioned', 'Closed'];

export default function AdminReportsPage() {
  const [reports, setReports] = useState<PlayerReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch('/api/control/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (report_id: number, status: string) => {
    await fetch('/api/control/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_id, status }),
    });
    await fetchReports();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-yellow-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Player Reports</h1>
            <p className="text-gray-400">Review and action player reports</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Reported</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Reporter</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Reason</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-6 py-4">
                      <div className="h-8 bg-gray-700 rounded animate-shimmer" />
                    </td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                    No reports
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.report_id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-white font-mono">
                      {report.reported_wallet.slice(0, 10)}...{report.reported_wallet.slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-gray-300 font-mono">
                      {report.reporter_wallet.slice(0, 10)}...{report.reporter_wallet.slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-gray-300">{report.reason}</td>
                    <td className="px-6 py-4 text-gray-300">{report.status}</td>
                    <td className="px-6 py-4 text-right">
                      <select
                        value={report.status}
                        onChange={(e) => updateStatus(report.report_id, e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded p-2 text-sm text-white"
                      >
                        {STATUS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
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

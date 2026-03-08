'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { FileText, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AuditLog } from '@/src/types/database';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    table_name: '',
  });

  useEffect(() => {
    fetchAuditLogs();
  }, [page, filters]);

  const fetchAuditLogs = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: ((page - 1) * 50).toString(),
        ...(filters.action && { action: filters.action }),
        ...(filters.table_name && { table_name: filters.table_name }),
      });

      const response = await fetch(`/api/control/audit-logs?${params}`);
      const data = await response.json();
      
      setLogs(data.logs || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('create')) return 'text-green-400';
    if (action.includes('update')) return 'text-blue-400';
    if (action.includes('delete')) return 'text-red-400';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
              <p className="text-gray-400">Track all administrative actions</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by action..."
                  value={filters.action}
                  onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <select
              value={filters.table_name}
              onChange={(e) => setFilters(prev => ({ ...prev, table_name: e.target.value }))}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Tables</option>
              <option value="card_templates">Card Templates</option>
              <option value="abilities">Abilities</option>
              <option value="market_items">Market Items</option>
              <option value="events">Events</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700 mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Timestamp</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Admin</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Action</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Table</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Record ID</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  [...Array(10)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-6 py-4">
                        <div className="h-8 bg-gray-700 rounded animate-shimmer" />
                      </td>
                    </tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs.map(log => (
                    <tr key={log.log_id} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-white text-sm">
                          {log.admin_wallet.slice(0, 8)}...{log.admin_wallet.slice(-6)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm font-semibold ${getActionColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-300 text-sm">
                        {log.table_name || '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm font-mono">
                        {log.record_id || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            // Show modal with before/after data
                            alert(JSON.stringify({
                              before: log.before_data,
                              after: log.after_data,
                            }, null, 2));
                          }}
                          className="text-purple-400 hover:text-purple-300 text-sm font-semibold"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-gray-400 text-sm">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <button
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

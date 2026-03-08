'use client';

import { useEffect, useState } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import type { Admin } from '@/src/types/database';
import { UserCog } from 'lucide-react';

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const response = await fetch('/api/control/admins');
      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <UserCog className="w-8 h-8 text-purple-400" />
          <div>
            <h1 className="text-3xl font-bold text-white">Admins</h1>
            <p className="text-gray-400">Current admin accounts and roles</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Wallet</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Role</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={3} className="px-6 py-4">
                      <div className="h-8 bg-gray-700 rounded animate-shimmer" />
                    </td>
                  </tr>
                ))
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-400">
                    No admins found
                  </td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.wallet_address} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 text-white font-mono">
                      {admin.wallet_address.slice(0, 10)}...{admin.wallet_address.slice(-8)}
                    </td>
                    <td className="px-6 py-4 text-gray-300">{admin.role}</td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {admin.created_at ? new Date(admin.created_at).toLocaleString() : '-'}
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

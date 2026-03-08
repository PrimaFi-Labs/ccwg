'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { 
  Users, 
  CreditCard, 
  Trophy, 
  DollarSign,
  TrendingUp,
  Activity,
  ShoppingBag,
  Calendar
} from 'lucide-react';

interface DashboardStats {
  total_players: number;
  total_cards_issued: number;
  active_matches: number;
  total_events: number;
  total_revenue_strk: string;
  cards_in_circulation: number;
  market_items_active: number;
  matches_today: number;
  recent_matches: Array<{
    match_id: number;
    player_1: string;
    player_2: string;
    status: string;
    created_at: string;
  }>;
  recent_purchases: Array<{
    tx_id: number;
    player_wallet: string;
    amount: string;
    created_at: string;
  }>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const canCreate = role === 'SuperAdmin';

  useEffect(() => {
    fetchDashboardStats();
    fetchRole();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // In production, create an API endpoint for this
      const response = await fetch('/api/control/stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRole = async () => {
    try {
      const res = await fetch('/api/control/me', { cache: 'no-store' });
      const data = await res.json();
      setRole(data.role || null);
    } catch {
      setRole(null);
    }
  };
  const statCards = [
    {
      label: 'Total Players',
      value: stats?.total_players || 0,
      icon: Users,
      color: 'from-blue-600 to-cyan-600',
      change: '+12%',
    },
    {
      label: 'Cards Issued',
      value: stats?.total_cards_issued || 0,
      icon: CreditCard,
      color: 'from-purple-600 to-pink-600',
      change: '+8%',
    },
    {
      label: 'Active Matches',
      value: stats?.active_matches || 0,
      icon: Activity,
      color: 'from-green-600 to-emerald-600',
      change: '+23%',
    },
    {
      label: 'Total Events',
      value: stats?.total_events || 0,
      icon: Calendar,
      color: 'from-yellow-600 to-orange-600',
      change: '+5%',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Overview of CCWG platform metrics</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div
                key={index}
                className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg bg-gradient-to-br ${stat.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-green-400 text-sm font-semibold">
                    {stat.change}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-white">
                  {loading ? (
                    <span className="inline-block h-8 w-20 bg-gray-700 rounded animate-shimmer align-middle" />
                  ) : (
                    stat.value.toLocaleString()
                  )}
                </p>
              </div>
            );
          })}
        </div>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Recent Matches */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Recent Matches</h3>
            <div className="space-y-3">
              {stats?.recent_matches?.length ? (
                stats.recent_matches.map((match) => (
                  <div key={match.match_id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="text-gray-300 text-sm">Match #{match.match_id}</span>
                    </div>
                    <span className="text-gray-500 text-xs">
                      {new Date(match.created_at).toLocaleString()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">No recent matches</div>
              )}
            </div>
          </div>

          {/* Recent Purchases */}
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">Recent Purchases</h3>
            <div className="space-y-3">
              {stats?.recent_purchases?.length ? (
                stats.recent_purchases.map((purchase) => (
                  <div key={purchase.tx_id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300 text-sm">
                        {purchase.player_wallet.slice(0, 8)}...{purchase.player_wallet.slice(-6)}
                      </span>
                    </div>
                    <span className="text-purple-400 text-sm font-semibold">
                      {purchase.amount} STRK
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">No recent purchases</div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h3 className="text-xl font-bold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {canCreate && (
              <>
                <button className="p-4 bg-gradient-to-br from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-lg text-white font-semibold transition-all">
                  Create Card Template
                </button>
                <button className="p-4 bg-gradient-to-br from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-white font-semibold transition-all">
                  Create Market Item
                </button>
              </>
            )}
            <button className="p-4 bg-gradient-to-br from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 rounded-lg text-white font-semibold transition-all">
              Create Event
            </button>
            <button className="p-4 bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg text-white font-semibold transition-all">
              View Audit Logs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


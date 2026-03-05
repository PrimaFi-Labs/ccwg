'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { Plus, Edit, Eye, EyeOff, Package, Clock } from 'lucide-react';
import { CreateMarketItemForm } from '@/src/components/admin/CreateMarketItemForm';
import type { MarketItem, CardTemplate } from '@/src/types/database';
import { formatStrk } from '@/src/lib/cartridge/utils';

export default function AdminMarketPage() {
  const [items, setItems] = useState<MarketItem[]>([]);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MarketItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const canCreate = role === 'SuperAdmin';

  useEffect(() => {
    fetchMarketItems();
    fetchRole();
    fetchCardTemplates();
  }, []);

  const fetchMarketItems = async () => {
    try {
      const response = await fetch('/api/admin/market');
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Failed to fetch market items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRole = async () => {
    try {
      const res = await fetch('/api/admin/me', { cache: 'no-store' });
      const data = await res.json();
      setRole(data.role || null);
    } catch {
      setRole(null);
    }
  };

  const fetchCardTemplates = async () => {
    try {
      const response = await fetch('/api/admin/cards');
      const data = await response.json();
      setCardTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch card templates:', error);
    }
  };

  const toggleItemActive = async (itemId: number, isActive: boolean) => {
    if (!canCreate) return;
    try {
      await fetch('/api/admin/market', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          is_active: !isActive,
        }),
      });
      await fetchMarketItems();
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Market Items</h1>
              <p className="text-gray-400">Manage packs and individual card sales</p>
            </div>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Item
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && canCreate && (
          <div className="mb-8">
            <CreateMarketItemForm
              onSuccess={() => {
                setShowForm(false);
                setEditingItem(null);
                fetchMarketItems();
              }}
              cardTemplates={cardTemplates}
            />
          </div>
        )}

        {/* Items Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Price</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Cards</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Expires</th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-gray-300">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {items.map(item => (
                <tr key={item.item_id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      {item.description && (
                        <p className="text-gray-500 text-sm">{item.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      item.item_type === 'pack' 
                        ? 'bg-purple-900 text-purple-300' 
                        : 'bg-blue-900 text-blue-300'
                    }`}>
                      {item.item_type === 'pack' ? 'Pack' : 'Single Card'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-purple-400 font-semibold">
                    {formatStrk(item.price_strk)} STRK
                  </td>
                  <td className="px-6 py-4 text-gray-300">
                    {item.cards_granted} card{item.cards_granted > 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4">
                    {item.expires_at ? (
                      (() => {
                        const exp = new Date(item.expires_at);
                        const isExpired = exp <= new Date();
                        return (
                          <span className={`flex items-center gap-1.5 text-xs font-semibold ${isExpired ? 'text-red-400' : 'text-yellow-400'}`}>
                            <Clock className="w-3.5 h-3.5" />
                            {isExpired ? 'Expired' : exp.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-gray-500">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => toggleItemActive(item.item_id, item.is_active)}
                      disabled={!canCreate}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        item.is_active
                          ? 'bg-green-900 text-green-300'
                          : 'bg-gray-700 text-gray-400'
                      } ${!canCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {canCreate && (
                        <>
                          <button
                            onClick={() => toggleItemActive(item.item_id, item.is_active)}
                            className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                            title={item.is_active ? 'Hide' : 'Show'}
                          >
                            {item.is_active ? (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setShowForm(true);
                            }}
                            className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                          >
                            <Edit className="w-4 h-4 text-blue-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {items.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              No market items yet. Create your first one!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

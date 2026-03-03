'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { AbilityForm } from '@/src/components/admin/AbilityForm';
import { Plus, Edit, Sparkles } from 'lucide-react';
import type { Ability } from '@/src/types/database';
import { motion } from 'framer-motion';

export default function AdminAbilitiesPage() {
  const [abilities, setAbilities] = useState<Ability[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canCreate = role === 'SuperAdmin';

  useEffect(() => {
    fetchAbilities();
    fetchRole();
  }, []);

  const fetchAbilities = async () => {
    try {
      const response = await fetch('/api/admin/abilities');
      const data = await response.json();
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to fetch abilities';
        setErrorMessage(message);
        return;
      }
      setAbilities(data.abilities || []);
    } catch (error) {
      console.error('Failed to fetch abilities:', error);
      setErrorMessage('Failed to fetch abilities');
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

  const handleSubmit = async (data: any) => {
    try {
      setErrorMessage(null);
      const response = await fetch('/api/admin/abilities', {
        method: editingAbility ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : Array.isArray(payload?.error)
              ? payload.error.map((e: any) => e.message).join(', ')
              : 'Failed to save ability';
        setErrorMessage(message);
        return;
      }

      await fetchAbilities();
      setShowForm(false);
      setEditingAbility(null);
    } catch (error) {
      console.error('Failed to save ability:', error);
      setErrorMessage('Failed to save ability');
    }
  };

  const handleSeedDefaults = async () => {
    if (!canCreate) return;
    try {
      setErrorMessage(null);
      const res = await fetch('/api/admin/abilities/seed', { method: 'POST' });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to seed abilities';
        setErrorMessage(message);
        return;
      }
      await fetchAbilities();
    } catch (error) {
      console.error('Failed to seed abilities:', error);
      setErrorMessage('Failed to seed abilities');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">Abilities Management</h1>
              <p className="text-gray-400">Configure card abilities and effects</p>
            </div>
          </div>
          {canCreate && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSeedDefaults}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
              >
                Seed Default Abilities
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all font-semibold flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Ability
              </button>
            </div>
          )}
        </div>

        {showForm && (
          <div className="mb-8">
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
            <AbilityForm
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingAbility(null);
              }}
              initialData={editingAbility || undefined}
            />
          </div>
        )}

        {/* Abilities Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {abilities.map(ability => (
            <motion.div
              key={ability.ability_id}
              whileHover={{ y: -4 }}
              className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-purple-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <h3 className="text-lg font-bold text-white">{ability.name}</h3>
                </div>
                {canCreate && (
                  <button
                    onClick={() => {
                      setEditingAbility(ability);
                      setShowForm(true);
                    }}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              <p className="text-gray-400 text-sm mb-4">{ability.description}</p>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Trigger Type:</span>
                  <span className="text-white font-medium capitalize">
                    {ability.trigger_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Effect Type:</span>
                  <span className="text-purple-400 font-medium">{ability.effect_type}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Usage Limit:</span>
                  <span className="text-yellow-400 font-medium">{ability.usage_limit}</span>
                </div>
              </div>

              {/* Config Preview */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Configuration:</p>
                <pre className="text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto">
                  {JSON.stringify(ability.config, null, 2)}
                </pre>
              </div>
            </motion.div>
          ))}
        </div>

        {abilities.length === 0 && !loading && (
          <div className="text-center py-12 text-gray-400">
            No abilities created yet. Create your first one!
          </div>
        )}
      </div>
    </div>
  );
}

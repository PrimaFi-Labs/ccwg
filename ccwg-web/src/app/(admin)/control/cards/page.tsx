'use client';

import { useState, useEffect } from 'react';
import { AdminNav } from '@/src/components/admin/AdminNav';
import { CardTemplateForm } from '@/src/components/admin/CardTemplateForm';
import { Plus, Edit } from 'lucide-react';
import type { CardTemplate } from '@/src/types/database';

export default function AdminCardsPage() {
  const [templates, setTemplates] = useState<CardTemplate[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CardTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canCreate = role === 'SuperAdmin';

  useEffect(() => {
    fetchTemplates();
    fetchRole();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/control/cards');
      const data = await response.json();
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to fetch templates';
        setErrorMessage(message);
        return;
      }
      setTemplates(data.templates || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      setErrorMessage('Failed to fetch templates');
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

  const handleSubmit = async (data: any) => {
    try {
      setErrorMessage(null);
      const response = await fetch('/api/control/cards', {
        method: editingTemplate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          template_id: editingTemplate?.template_id,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : Array.isArray(payload?.error)
              ? payload.error.map((e: any) => e.message).join(', ')
              : 'Failed to save template';
        setErrorMessage(message);
        return;
      }

      await fetchTemplates();
      setShowForm(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error('Failed to save template:', error);
      setErrorMessage('Failed to save template');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <AdminNav />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Card Templates</h1>
          {canCreate && (
            <button
              onClick={() => setShowForm(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all font-semibold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Template
            </button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-8">
            {errorMessage && (
              <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                {errorMessage}
              </div>
            )}
            <CardTemplateForm
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingTemplate(null);
              }}
              initialData={editingTemplate ?? undefined}
            />
          </div>
        )}

        {/* Templates table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Asset</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Name</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Rarity</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Base</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Atk Aff</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Def Aff</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Charge Aff</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Volatility</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">AI</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {templates.map(template => (
                <tr key={template.template_id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4 text-white font-medium">{template.asset}</td>
                  <td className="px-6 py-4 text-white">{template.name}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      template.rarity === 'Legendary' ? 'bg-yellow-900 text-yellow-300' :
                      template.rarity === 'Epic' ? 'bg-purple-900 text-purple-300' :
                      template.rarity === 'Rare' ? 'bg-blue-900 text-blue-300' :
                      'bg-gray-700 text-gray-300'
                    }`}>
                      {template.rarity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-300">{template.base}</td>
                  <td className="px-6 py-4 text-gray-300">{template.attack_affinity}</td>
                  <td className="px-6 py-4 text-gray-300">{template.defense_affinity}</td>
                  <td className="px-6 py-4 text-gray-300">{template.charge_affinity}</td>
                  <td className="px-6 py-4 text-gray-300">{template.volatility_sensitivity}x</td>
                  <td className="px-6 py-4 text-gray-300">
                    {template.is_ai_card ? 'Yes' : 'No'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {canCreate && (
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setShowForm(true);
                          }}
                          className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4 text-blue-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {templates.length === 0 && !loading && (
            <div className="text-center py-12 text-gray-400">
              No card templates yet. Create your first one!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

//ccwg/ccwg-web/src/components/admin/AbilityForm.tsx
'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Save } from 'lucide-react';
import type { Ability } from '@/src/types/database';
import { DEFAULT_ABILITIES } from '@/src/config/abilities';

type FormData = Omit<Ability, 'created_at' | 'updated_at'>;

interface AbilityFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<FormData>;
}

const EFFECT_TYPES = [
  'momentum_amplifier',
  'visibility_denial',
  'defensive_reflect',
  'action_lock',
  'momentum_stabilizer',
];

const TRIGGER_TYPES = ['charge_triggered'] as const;

const USAGE_LIMITS = ['once_per_match', 'once_per_round', 'always'] as const;

export function AbilityForm({ onSubmit, onCancel, initialData }: AbilityFormProps) {
  const [formData, setFormData] = useState<FormData>({
    ability_id: initialData?.ability_id || '',
    name: initialData?.name || '',
    description: initialData?.description || '',
    trigger_type: initialData?.trigger_type || 'charge_triggered',
    effect_type: initialData?.effect_type || EFFECT_TYPES[0],
    config: initialData?.config || {},
    usage_limit: initialData?.usage_limit || 'once_per_match',
  });
  const [configText, setConfigText] = useState(
    JSON.stringify(formData.config || {}, null, 2)
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultAbilities = useMemo(
    () => Object.values(DEFAULT_ABILITIES),
    []
  );

  const applyDefault = (abilityId: string) => {
    const preset = DEFAULT_ABILITIES[abilityId];
    if (!preset) return;
    setFormData(preset);
    setConfigText(JSON.stringify(preset.config || {}, null, 2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const parsedConfig = JSON.parse(configText || '{}');
      await onSubmit({ ...formData, config: parsedConfig });
    } catch (error) {
      setErrorMessage('Config must be valid JSON.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onSubmit={handleSubmit}
      className="bg-gray-800 rounded-lg p-6 space-y-6"
    >
      {errorMessage && (
        <div className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ability ID
          </label>
          <input
            type="text"
            value={formData.ability_id}
            onChange={(e) => setFormData((prev) => ({ ...prev, ability_id: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="e.g., btc_halving_pressure"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Trigger Type
          </label>
          <select
            value={formData.trigger_type}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, trigger_type: e.target.value as Ability['trigger_type'] }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {TRIGGER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Effect Type
          </label>
          <select
            value={formData.effect_type}
            onChange={(e) => setFormData((prev) => ({ ...prev, effect_type: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {EFFECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[90px]"
            required
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Config JSON
          </label>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[160px] font-mono text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Usage Limit
          </label>
          <select
            value={formData.usage_limit}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, usage_limit: e.target.value }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {USAGE_LIMITS.map((limit) => (
              <option key={limit} value={limit}>
                {limit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Load Default Ability
          </label>
          <select
            value=""
            onChange={(e) => applyDefault(e.target.value)}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="" disabled>
              Select default ability
            </option>
            {defaultAbilities.map((ability) => (
              <option key={ability.ability_id} value={ability.ability_id}>
                {ability.name} ({ability.ability_id})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-4 pt-4 border-t border-gray-700">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg transition-all disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Ability
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}

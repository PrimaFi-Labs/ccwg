//ccwg/ccwg-web/src/components/admin/CardTemplateForm.tsx

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Save, Upload } from 'lucide-react';
import type { CardAsset, Rarity } from '@/src/types/database';

interface FormData {
  asset: CardAsset;
  name: string;
  rarity: Rarity;
  base: number;
  attack_affinity: number;
  defense_affinity: number;
  charge_affinity: number;
  volatility_sensitivity: number;
  ability_id: string;
  image_public_id: string;
  is_ai_card?: boolean;
}

interface CardTemplateFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<FormData>;
}

export function CardTemplateForm({ onSubmit, onCancel, initialData }: CardTemplateFormProps) {
  const [formData, setFormData] = useState<FormData>({
    asset: initialData?.asset || 'BTC',
    name: initialData?.name || '',
    rarity: initialData?.rarity || 'Common',
    base: initialData?.base || 100,
    attack_affinity: initialData?.attack_affinity || 0,
    defense_affinity: initialData?.defense_affinity || 0,
    charge_affinity: initialData?.charge_affinity || 10,
    volatility_sensitivity: initialData?.volatility_sensitivity || 1.0,
    ability_id: initialData?.ability_id || '',
    image_public_id: initialData?.image_public_id || '',
    is_ai_card: initialData?.is_ai_card || false,
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [abilities, setAbilities] = useState<{ ability_id: string; name: string }[]>([]);
  const [abilitiesLoaded, setAbilitiesLoaded] = useState(false);

  useEffect(() => {
    const loadAbilities = async () => {
      try {
        const res = await fetch('/api/admin/abilities', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok) {
          setAbilities(data.abilities || []);
        }
      } catch (error) {
        console.error('Failed to load abilities:', error);
      } finally {
        setAbilitiesLoaded(true);
      }
    };

    loadAbilities();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'CARDS');
      formData.append('admin_wallet', 'admin_address'); // Get from auth

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setFormData(prev => ({ ...prev, image_public_id: data.publicId }));
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(formData);
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
      <div className="grid grid-cols-2 gap-6">
        {/* Asset */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Asset
          </label>
          <select
            value={formData.asset}
            onChange={e => setFormData(prev => ({ ...prev, asset: e.target.value as CardAsset }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="BTC">BTC</option>
            <option value="ETH">ETH</option>
            <option value="STRK">STRK</option>
            <option value="SOL">SOL</option>
            <option value="DOGE">DOGE</option>
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        {/* Rarity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Rarity
          </label>
          <select
            value={formData.rarity}
            onChange={e => setFormData(prev => ({ ...prev, rarity: e.target.value as Rarity }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="Common">Common</option>
            <option value="Rare">Rare</option>
            <option value="Epic">Epic</option>
            <option value="Legendary">Legendary</option>
          </select>
        </div>

        {/* Base */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Base
          </label>
          <input
            type="number"
            value={formData.base}
            onChange={e => setFormData(prev => ({ ...prev, base: parseInt(e.target.value) }))}
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="50"
            max="500"
            required
          />
        </div>

        {/* Attack Affinity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Attack Affinity
          </label>
          <input
            type="number"
            value={formData.attack_affinity}
            onChange={e =>
              setFormData(prev => ({ ...prev, attack_affinity: parseInt(e.target.value) }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="-100"
            max="200"
            required
          />
        </div>

        {/* Defense Affinity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Defense Affinity
          </label>
          <input
            type="number"
            value={formData.defense_affinity}
            onChange={e =>
              setFormData(prev => ({ ...prev, defense_affinity: parseInt(e.target.value) }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="-100"
            max="200"
            required
          />
        </div>

        {/* Charge Affinity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Charge Affinity
          </label>
          <input
            type="number"
            value={formData.charge_affinity}
            onChange={e =>
              setFormData(prev => ({ ...prev, charge_affinity: parseInt(e.target.value) }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="0"
            max="100"
            required
          />
        </div>

        {/* Volatility Sensitivity */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Volatility Sensitivity (0.1 - 2.0)
          </label>
          <input
            type="number"
            step="0.1"
            value={formData.volatility_sensitivity}
            onChange={e =>
              setFormData(prev => ({ ...prev, volatility_sensitivity: parseFloat(e.target.value) }))
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            min="0.1"
            max="2.0"
            required
          />
        </div>

        {/* Ability */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Ability
          </label>
          {abilities.length > 0 ? (
            <select
              value={formData.ability_id}
              onChange={e => setFormData(prev => ({ ...prev, ability_id: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            >
              <option value="" disabled>
                Select ability
              </option>
              {abilities.map(ability => (
                <option key={ability.ability_id} value={ability.ability_id}>
                  {ability.name} ({ability.ability_id})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={formData.ability_id}
              onChange={e => setFormData(prev => ({ ...prev, ability_id: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder={abilitiesLoaded ? 'No abilities found' : 'Loading abilities...'}
              required
            />
          )}
        </div>

        {/* AI Card */}
        <div className="flex items-center gap-3">
          <input
            id="is-ai-card"
            type="checkbox"
            checked={Boolean(formData.is_ai_card)}
            onChange={e => setFormData(prev => ({ ...prev, is_ai_card: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-600 bg-gray-900 text-purple-500 focus:ring-purple-500"
          />
          <label htmlFor="is-ai-card" className="text-sm font-medium text-gray-300">
            Available for Bots (is_ai_card)
          </label>
        </div>
      </div>

      {/* Image upload */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Card Image
        </label>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="card-image"
          />
          <label
            htmlFor="card-image"
            className="px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white cursor-pointer hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Upload Image'}
          </label>
          {formData.image_public_id && (
            <span className="text-sm text-green-400">OK Image uploaded</span>
          )}
        </div>
      </div>

      {/* Actions */}
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
              Save Template
            </>
          )}
        </button>
      </div>
    </motion.form>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Save, X } from 'lucide-react';

interface EventFormData {
  event_name: string;
  entry_fee: string;
  max_players: number;
  total_rounds: number;
  sp_reward: number;
  first_place_percent: number;
  second_place_percent: number;
  third_place_percent: number;
  starts_at: string;
  ends_at: string;
}

interface EventFormProps {
  onSubmit: (data: EventFormData) => Promise<void>;
  onCancel: () => void;
}

export function EventForm({ onSubmit, onCancel }: EventFormProps) {
  const [formData, setFormData] = useState<EventFormData>({
    event_name: '',
    entry_fee: '0',
    max_players: 8,
    total_rounds: 3,
    sp_reward: 100,
    first_place_percent: 5000, // 50%
    second_place_percent: 3000, // 30%
    third_place_percent: 2000, // 20%
    starts_at: new Date(Date.now() + 3600000).toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 16),
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    // Validate prize percentages
    const totalPercent =
      formData.first_place_percent +
      formData.second_place_percent +
      formData.third_place_percent;
    if (totalPercent !== 10000) {
      setErrorMessage('Prize percentages must total 100%');
      setSubmitting(false);
      return;
    }

    if (new Date(formData.ends_at).getTime() <= new Date(formData.starts_at).getTime()) {
      setErrorMessage('End time must be later than start time');
      setSubmitting(false);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to create event'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof EventFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const percentageUsed =
    formData.first_place_percent +
    formData.second_place_percent +
    formData.third_place_percent;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Create New Event</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {errorMessage && (
            <div className="rounded-lg border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          {/* Event Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Event Name
            </label>
            <input
              type="text"
              value={formData.event_name}
              onChange={(e) => handleInputChange('event_name', e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="e.g., Championship Tournament"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Max Players */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max Players
              </label>
              <input
                type="number"
                value={formData.max_players}
                onChange={(e) =>
                  handleInputChange('max_players', parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rounds
              </label>
              <select
                value={formData.total_rounds}
                onChange={(e) =>
                  handleInputChange('total_rounds', parseInt(e.target.value, 10) || 3)
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </div>

            {/* SP Reward */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                STARK Points Reward
              </label>
              <input
                type="number"
                value={formData.sp_reward}
                onChange={(e) =>
                  handleInputChange('sp_reward', parseInt(e.target.value) || 0)
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Entry Fee */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entry Fee (STRK)
              </label>
              <input
                type="text"
                value={formData.entry_fee}
                onChange={(e) => handleInputChange('entry_fee', e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Starts At
              </label>
              <input
                type="datetime-local"
                value={formData.starts_at}
                onChange={(e) => handleInputChange('starts_at', e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ends At
              </label>
              <input
                type="datetime-local"
                value={formData.ends_at}
                onChange={(e) => handleInputChange('ends_at', e.target.value)}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>
          </div>

          {/* Prize Distribution */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Prize Distribution
              </label>
              <span className={`text-xs font-semibold ${percentageUsed === 10000 ? 'text-green-400' : 'text-yellow-400'}`}>
                {percentageUsed / 100}% allocated
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  1st Place (%)
                </label>
                <input
                  type="number"
                  value={formData.first_place_percent / 100}
                  onChange={(e) =>
                    handleInputChange(
                      'first_place_percent',
                      parseInt(e.target.value) * 100 || 0
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  2nd Place (%)
                </label>
                <input
                  type="number"
                  value={formData.second_place_percent / 100}
                  onChange={(e) =>
                    handleInputChange(
                      'second_place_percent',
                      parseInt(e.target.value) * 100 || 0
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  3rd Place (%)
                </label>
                <input
                  type="number"
                  value={formData.third_place_percent / 100}
                  onChange={(e) =>
                    handleInputChange(
                      'third_place_percent',
                      parseInt(e.target.value) * 100 || 0
                    )
                  }
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  min="0"
                  max="100"
                  required
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:border-gray-500 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || percentageUsed !== 10000}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

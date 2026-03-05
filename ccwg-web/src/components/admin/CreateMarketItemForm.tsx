// ccwg-web/src/components/admin/CreateMarketItemForm.tsx
// NEW - Admin form for creating market items with new fields

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Zap, Trash2 } from 'lucide-react';
import { strkToWei, formatStrk } from '@/src/lib/cartridge/utils';

interface CreateMarketItemFormProps {
  onSuccess: () => void;
  cardTemplates: Array<{ template_id: number; name: string; rarity: string }>;
}

export function CreateMarketItemForm({ onSuccess, cardTemplates }: CreateMarketItemFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [itemType, setItemType] = useState<'single_card' | 'pack'>('pack');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceStrk, setPriceStrk] = useState('10');
  const [cardsGranted, setCardsGranted] = useState(3);
  const [possibleCards, setPossibleCards] = useState<number[]>([]);
  const [guaranteedCards, setGuaranteedCards] = useState<number[]>([]);
  const [cardWeights, setCardWeights] = useState<Record<string, number>>({});
  const [revealAnimation, setRevealAnimation] = useState(true);
  const [imagePublicId, setImagePublicId] = useState('');
  const [perWalletLimit, setPerWalletLimit] = useState<string>('');
  const [durationHours, setDurationHours] = useState<string>('');
  const [singleCardId, setSingleCardId] = useState<number | ''>('');

  const handleAddPossibleCard = (templateId: number) => {
    if (!possibleCards.includes(templateId)) {
      setPossibleCards([...possibleCards, templateId]);
    }
  };

  const handleRemovePossibleCard = (templateId: number) => {
    setPossibleCards(possibleCards.filter(id => id !== templateId));
    // Also remove from guaranteed if present
    setGuaranteedCards(guaranteedCards.filter(id => id !== templateId));
    // Remove from weights
    const newWeights = { ...cardWeights };
    delete newWeights[templateId.toString()];
    setCardWeights(newWeights);
  };

  const handleToggleGuaranteed = (templateId: number) => {
    if (guaranteedCards.includes(templateId)) {
      setGuaranteedCards(guaranteedCards.filter(id => id !== templateId));
    } else {
      setGuaranteedCards([...guaranteedCards, templateId]);
    }
  };

  const handleSetWeight = (templateId: number, weight: number) => {
    setCardWeights({
      ...cardWeights,
      [templateId.toString()]: weight,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate
        if (itemType === 'single_card' && possibleCards.length !== 1) {
          throw new Error('Single cards must have exactly 1 possible card');
        }

        if (itemType === 'pack' && possibleCards.length === 0) {
          throw new Error('Packs must have at least 1 possible card');
        }

        if (itemType === 'pack' && possibleCards.length < cardsGranted) {
          throw new Error(`Select at least ${cardsGranted} possible cards`);
        }

        if (guaranteedCards.length > cardsGranted) {
          throw new Error('Guaranteed cards cannot exceed cards granted');
        }

      // Convert price to wei
      const priceWei = strkToWei(priceStrk).toString();

      const payload = {
        name,
        description: description || null,
        item_type: itemType,
        price_strk: priceWei,
        cards_granted: cardsGranted,
        possible_cards: possibleCards,
        guaranteed_cards: guaranteedCards.length > 0 ? guaranteedCards : null,
        card_weights: Object.keys(cardWeights).length > 0 ? cardWeights : null,
        per_wallet_limit: perWalletLimit ? parseInt(perWalletLimit) : null,
        duration_hours: durationHours ? parseInt(durationHours) : null,
        image_public_id: imagePublicId || null,
        reveal_animation: revealAnimation,
      };

      const response = await fetch('/api/market/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create item');
      }

      // Success!
      onSuccess();
      
      // Reset form
      setName('');
      setDescription('');
      setPriceStrk('10');
      setCardsGranted(3);
      setPossibleCards([]);
      setGuaranteedCards([]);
      setCardWeights({});
      setImagePublicId('');
      setPerWalletLimit('');
      setDurationHours('');
      setSingleCardId('');
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-6 space-y-6">
      <h2 className="text-2xl font-bold text-white mb-4">Create Market Item</h2>

      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Item Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Item Type</label>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setItemType('single_card');
              setCardsGranted(1);
              setRevealAnimation(false);
              setPossibleCards([]);
              setGuaranteedCards([]);
              setCardWeights({});
            }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              itemType === 'single_card'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Single Card
          </button>
          <button
            type="button"
            onClick={() => {
              setItemType('pack');
              setCardsGranted(3);
              setRevealAnimation(true);
              setSingleCardId('');
            }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              itemType === 'pack'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Card Pack
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">Price (STRK)</label>
          <input
            type="number"
            step="0.01"
            value={priceStrk}
            onChange={(e) => setPriceStrk(e.target.value)}
            required
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Wei: {strkToWei(priceStrk).toString()}
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
        />
      </div>

      {/* Pack-specific */}
      {itemType === 'pack' && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Cards per Pack (fixed)
          </label>
          <input
            type="number"
            value={cardsGranted}
            readOnly
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Set to 3. Choose at least 3 possible cards.</p>
        </div>
      )}

      {itemType === 'single_card' && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Select Card Template
          </label>
          <select
            value={singleCardId}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value) : '';
              setSingleCardId(val);
              setPossibleCards(val ? [val] : []);
            }}
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          >
            <option value="">Select a card template...</option>
            {cardTemplates.map((t) => (
              <option key={t.template_id} value={t.template_id}>
                {t.name} ({t.rarity})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Card Selection */}
      {itemType === 'pack' && (
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Possible Cards * ({possibleCards.length} selected)
          </label>
          <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
            {cardTemplates.map(template => {
              const isSelected = possibleCards.includes(template.template_id);
              const isGuaranteed = guaranteedCards.includes(template.template_id);
              const weight = cardWeights[template.template_id.toString()] || 0;

              return (
                <div
                  key={template.template_id}
                  className={`p-3 rounded-lg mb-2 transition-all ${
                    isSelected ? 'bg-purple-900/30 border border-purple-500/50' : 'bg-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? handleRemovePossibleCard(template.template_id)
                            : handleAddPossibleCard(template.template_id)
                        }
                        className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
                          isSelected
                            ? 'bg-red-600 hover:bg-red-500 text-white'
                            : 'bg-purple-600 hover:bg-purple-500 text-white'
                        }`}
                      >
                        {isSelected ? 'Remove' : 'Add'}
                      </button>

                      <div>
                        <p className="text-white font-semibold">{template.name}</p>
                        <p className="text-xs text-gray-400">
                          ID: {template.template_id} • {template.rarity}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex items-center gap-3">
                        {/* Guaranteed toggle */}
                        <button
                          type="button"
                          onClick={() => handleToggleGuaranteed(template.template_id)}
                          className={`flex items-center gap-2 px-3 py-1 rounded text-sm font-semibold transition-all ${
                            isGuaranteed
                              ? 'bg-yellow-600 text-black'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          <Zap className="w-4 h-4" />
                          {isGuaranteed ? 'Guaranteed' : 'Random'}
                        </button>

                        {/* Weight input */}
                        {!isGuaranteed && (
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-400">Weight:</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={weight}
                              onChange={(e) =>
                                handleSetWeight(template.template_id, parseInt(e.target.value) || 0)
                              }
                              className="w-16 px-2 py-1 bg-gray-600 text-white rounded text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Choose at least {cardsGranted} cards. Recommended: 6 for variety.
          </p>
        </div>
      )}

      {/* Summary */}
      {possibleCards.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="font-semibold text-blue-400 mb-2">Configuration Summary</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Total possible cards: {possibleCards.length}</li>
            <li>• Guaranteed cards: {guaranteedCards.length}</li>
            <li>
              • Random cards per pack:{' '}
              {cardsGranted - guaranteedCards.length}
            </li>
            {Object.keys(cardWeights).length > 0 && (
              <li>• Weighted distribution: {Object.keys(cardWeights).length} cards</li>
            )}
          </ul>
        </div>
      )}

      {/* Image, Animation, Limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            Image Public ID (Cloudinary)
          </label>
          <input
            type="text"
            value={imagePublicId}
            onChange={(e) => setImagePublicId(e.target.value)}
            placeholder="ccwg/packs/starter"
            className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={revealAnimation}
              onChange={(e) => setRevealAnimation(e.target.checked)}
              className="w-5 h-5 rounded"
            />
            <span className="text-sm font-semibold">Show reveal animation</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Purchase Limit per Wallet (optional)
        </label>
        <input
          type="number"
          min="1"
          max="999"
          value={perWalletLimit}
          onChange={(e) => setPerWalletLimit(e.target.value)}
          placeholder="e.g. 1, 5, 99"
          className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
        />
        <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited purchases.</p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          Duration (hours, optional)
        </label>
        <div className="flex gap-3">
          <input
            type="number"
            min="1"
            value={durationHours}
            onChange={(e) => setDurationHours(e.target.value)}
            placeholder="e.g. 24, 72, 168"
            className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
          />
          <div className="flex gap-1">
            {[24, 48, 72, 168].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(String(h))}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  durationHours === String(h)
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                {h < 48 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Leave empty for items that never expire.</p>
      </div>

      {/* Submit */}
      <div className="flex gap-4 pt-4 border-t border-gray-700">
        <button
          type="submit"
          disabled={isSubmitting || possibleCards.length === 0}
          className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Create Item
            </>
          )}
        </button>
      </div>
    </form>
  );
}

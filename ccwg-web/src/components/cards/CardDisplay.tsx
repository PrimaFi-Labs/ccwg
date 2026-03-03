//ccwg/ccwg-web/src/components/cards/CardDisplay.tsx

'use client';

import { motion } from 'framer-motion';
import { OptimizedImage } from '@/src/components/ui/OptimizedImage';
import type { PlayerCard, BotCard } from '@/src/types/database';
import { Swords, Shield, Hexagon, Zap } from 'lucide-react';

interface CardDisplayProps {
  card: PlayerCard | BotCard;
  showStats?: boolean;
  size?: 'small' | 'medium' | 'large';
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CardDisplay({
  card,
  showStats = true,
  size = 'medium',
  selected = false,
  disabled = false,
  onClick,
  className = '',
}: CardDisplayProps) {
  const sizeClasses = {
    small: 'w-32 h-44',
    medium: 'w-48 h-64',
    large: 'w-64 h-88',
  };

  const transformationMap = {
    small: 'CARD_THUMBNAIL' as const,
    medium: 'CARD_DISPLAY' as const,
    large: 'CARD_FULL' as const,
  };

  const template = card.template;
  if (!template) {
    console.warn('[CardDisplay] Card has no template, cannot render.', {
      cardId: card.id,
      level: card.level,
    });
    return null;
  }

  // Detect and log any null stats so we know which templates have incomplete data
  if (template.base_power == null || template.base_defense == null || template.base_focus == null) {
    console.warn('[CardDisplay] Template has null stat(s) — falling back to base value.', {
      templateId: template.template_id,
      name: template.name,
      asset: template.asset,
      base_power: template.base_power,
      base_defense: template.base_defense,
      base_focus: template.base_focus,
      base: template.base,
    });
  }

  if (template.volatility_sensitivity == null) {
    console.warn('[CardDisplay] Template has null volatility_sensitivity — defaulting to 1.', {
      templateId: template.template_id,
      name: template.name,
      asset: template.asset,
    });
  }

  const attackAffinity = template.attack_affinity ?? 0;
  const defenseAffinity = template.defense_affinity ?? 0;
  const baseStat = template.base ?? 0;
  const chargeAffinity = template.charge_affinity ?? 0;

  const rarityColors: Record<string, string> = {
    Common: 'from-gray-600 to-gray-800',
    Rare: 'from-blue-600 to-blue-800',
    Epic: 'from-purple-600 to-purple-800',
    Legendary: 'from-yellow-500 to-orange-600',
  };

  const rarityGradient = rarityColors[template.rarity] ?? 'from-gray-600 to-gray-800';

  if (!rarityColors[template.rarity]) {
    console.warn('[CardDisplay] Unknown rarity value — using default gradient.', {
      templateId: template.template_id,
      rarity: template.rarity,
    });
  }

  return (
    <motion.div
      whileHover={!disabled ? { scale: 1.05, y: -8 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      onClick={!disabled ? onClick : undefined}
      className={`
        ${sizeClasses[size]}
        relative rounded-xl overflow-hidden cursor-pointer
        ${selected ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-[var(--bg-panel)]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'card-hover'}
        ${className}
      `}
    >
      {/* Rarity glow */}
      <div className={`absolute inset-0 bg-gradient-to-b ${rarityGradient} opacity-20`} />

      {/* Card image */}
      <OptimizedImage
        publicId={template.image_url || `ccwg/cards/${template.asset.toLowerCase()}`}
        alt={template.name}
        transformation={transformationMap[size]}
        className="w-full h-full"
        priority={size === 'large'}
      />

      {/* Level badge */}
      {card.level > 1 && (
        <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold">
          LVL {card.level}
        </div>
      )}

      {/* Stats overlay */}
      {showStats && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3">
          <h3 className="font-bold text-white text-sm mb-2">{template.name}</h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1">
              <Swords className="w-3 h-3 text-rose-400" />
              <span className="text-xs text-white font-semibold">ATK {attackAffinity}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="w-3 h-3 text-blue-400" />
              <span className="text-xs text-white font-semibold">DEF {defenseAffinity}</span>
            </div>
            <div className="flex items-center gap-1">
              <Hexagon className="w-3 h-3 text-amber-400" />
              <span className="text-xs text-white font-semibold">BASE {baseStat}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-violet-400" />
              <span className="text-xs text-white font-semibold">CHG {chargeAffinity}</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

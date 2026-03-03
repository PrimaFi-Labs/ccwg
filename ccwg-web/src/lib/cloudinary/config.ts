// ccwg/ccwg-web/src/lib/cloudinary/config.ts

import 'server-only';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary (SERVER ONLY)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ?? process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

// Cloudinary folders (safe to share, but keep here since this file is server-only now)
export const CLOUDINARY_FOLDERS = {
  CARDS: 'ccwg/cards',
  ABILITIES: 'ccwg/abilities',
  UI: 'ccwg/ui',
  MARKET: 'ccwg/market',
  AVATARS: 'ccwg/avatars',
} as const;

// Transformation presets
export const TRANSFORMATIONS = {
  CARD_THUMBNAIL: {
    width: 200,
    height: 280,
    crop: 'fill',
    quality: 'auto:low',
    fetch_format: 'auto',
  },
  CARD_DISPLAY: {
    width: 400,
    height: 560,
    crop: 'fill',
    quality: 'auto:good',
    fetch_format: 'auto',
  },
  CARD_FULL: {
    width: 800,
    height: 1120,
    crop: 'fill',
    quality: 'auto:best',
    fetch_format: 'auto',
  },
  CARD_ANIMATION_PREVIEW: {
    width: 300,
    height: 420,
    crop: 'fill',
    quality: 'auto:low',
    fetch_format: 'auto',
    flags: 'lossy',
  },
  ABILITY_ICON: {
    width: 64,
    height: 64,
    crop: 'fill',
    quality: 'auto:eco',
    fetch_format: 'auto',
  },
  UI_ICON: {
    width: 32,
    height: 32,
    crop: 'fill',
    quality: 'auto:eco',
    fetch_format: 'auto',
  },
  BLUR_PLACEHOLDER: {
    width: 20,
    height: 28,
    crop: 'fill',
    quality: 'auto:eco',
    fetch_format: 'auto',
    effect: 'blur:1000',
  },
} as const;

// ccwg/ccwg-web/src/lib/cloudinary/utils.ts

// IMPORTANT: This module must remain CLIENT-SAFE.
// Do NOT import from './config' or 'cloudinary' here.

export const CLOUDINARY_FOLDERS = {
  CARDS: 'ccwg/cards',
  ABILITIES: 'ccwg/abilities',
  UI: 'ccwg/ui',
  MARKET: 'ccwg/market',
  AVATARS: 'ccwg/avatars',
} as const;

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

type TransformKey = keyof typeof TRANSFORMATIONS;

const getCloudName = (): string => {
  const name = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!name) {
    // Fail loudly in dev; in prod this avoids silent broken URLs
    throw new Error('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set');
  }
  return name;
};

// Build optimized Cloudinary URL
export const buildCloudinaryUrl = (
  publicId: string,
  transformation: TransformKey = 'CARD_DISPLAY'
): string => {
  const cloudName = getCloudName();
  const transformParams = TRANSFORMATIONS[transformation];

  // Build transformation string (Cloudinary expects short keys, but your format works fine:
  // width -> w_ , height -> h_ , crop -> c_ , quality -> q_ , fetch_format -> f_ , effect -> e_ , flags -> fl_
  const keyMap: Record<string, string> = {
    width: 'w',
    height: 'h',
    crop: 'c',
    quality: 'q',
    fetch_format: 'f',
    effect: 'e',
    flags: 'fl',
  };

  const params = Object.entries(transformParams)
    .map(([key, value]) => {
      const mapped = keyMap[key] ?? key;
      return `${mapped}_${value}`;
    })
    .join(',');

  return `https://res.cloudinary.com/${cloudName}/image/upload/${params}/${publicId}`;
};

// Generate responsive srcset for different screen sizes
export const buildResponsiveSrcSet = (publicId: string): string => {
  const cloudName = getCloudName();
  const widths = [200, 400, 600, 800];

  return widths
    .map((width) => {
      const url = `https://res.cloudinary.com/${cloudName}/image/upload/w_${width},q_auto,f_auto/${publicId}`;
      return `${url} ${width}w`;
    })
    .join(', ');
};

// Generate blur-up placeholder (LQIP)
export const generateBlurPlaceholder = (publicId: string): string => {
  return buildCloudinaryUrl(publicId, 'BLUR_PLACEHOLDER');
};

// Cloudinary video optimization (for card animations)
export const buildVideoUrl = (
  publicId: string,
  options: {
    width?: number;
    quality?: 'auto:low' | 'auto:good' | 'auto:best';
  } = {}
): string => {
  const cloudName = getCloudName();
  const { width = 400, quality = 'auto:low' } = options;

  // quality value already includes "auto:low", so use q_auto:low not q_auto:low? -> Cloudinary uses q_auto:low
  // Your previous code did q_${quality} which becomes q_auto:low, that's valid.
  return `https://res.cloudinary.com/${cloudName}/video/upload/w_${width},q_${quality},f_auto/${publicId}`;
};

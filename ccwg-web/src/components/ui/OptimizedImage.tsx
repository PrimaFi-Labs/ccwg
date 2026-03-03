// ccwg/ccwg-web/src/components/ui/OptimizedImage.tsx

'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  buildCloudinaryUrl,
  generateBlurPlaceholder,
  buildResponsiveSrcSet,
} from '@/src/lib/cloudinary/utils';

interface OptimizedImageProps {
  publicId: string;
  alt: string;
  transformation?: 'CARD_THUMBNAIL' | 'CARD_DISPLAY' | 'CARD_FULL' | 'ABILITY_ICON' | 'UI_ICON';
  className?: string;
  priority?: boolean;
}

/**
 * Dimensions that match your TRANSFORMATIONS.
 * (Next/Image strongly prefers known width/height to prevent layout shift.)
 */
const TRANSFORM_SIZES: Record<
  NonNullable<OptimizedImageProps['transformation']>,
  { width: number; height: number }
> = {
  CARD_THUMBNAIL: { width: 200, height: 280 },
  CARD_DISPLAY: { width: 400, height: 560 },
  CARD_FULL: { width: 800, height: 1120 },
  ABILITY_ICON: { width: 64, height: 64 },
  UI_ICON: { width: 32, height: 32 },
};

export function OptimizedImage({
  publicId,
  alt,
  transformation = 'CARD_DISPLAY',
  className = '',
  priority = false,
}: OptimizedImageProps) {
  const isExternal = /^https?:\/\//i.test(publicId);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);

  const blurDataURL = useMemo(
    () =>
      isExternal
        ? 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='
        : generateBlurPlaceholder(publicId),
    [publicId, isExternal]
  );
  const mainUrl = useMemo(
    () => (isExternal ? publicId : buildCloudinaryUrl(publicId, transformation)),
    [publicId, transformation, isExternal]
  );

  // We keep this call in case you want it elsewhere, but Next/Image won’t use srcSet directly.
  // (Next/Image generates its own srcset internally unless you fully custom-load.)
  useMemo(() => buildResponsiveSrcSet(publicId), [publicId]);

  const { width, height } = TRANSFORM_SIZES[transformation];

  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '50px' }
    );

    const el = document.getElementById(`img-${publicId}`);
    if (el) observer.observe(el);

    return () => observer.disconnect();
  }, [publicId, priority]);

  return (
    <div id={`img-${publicId}`} className={`relative overflow-hidden ${className}`}>
      {!isExternal && (
        <Image
          src={blurDataURL}
          alt=""
          width={width}
          height={height}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-0' : 'opacity-100'
          }`}
          aria-hidden="true"
          priority={priority}
          unoptimized
        />
      )}

      {isInView && (
        <Image
          src={mainUrl}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          placeholder={isExternal ? 'empty' : 'blur'}
          blurDataURL={isExternal ? undefined : blurDataURL}
          // Equivalent to your sizes string
          sizes="(max-width: 640px) 200px, (max-width: 1024px) 400px, 600px"
          className={`h-full w-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          unoptimized={isExternal}
        />
      )}
    </div>
  );
}

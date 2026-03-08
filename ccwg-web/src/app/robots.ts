import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/match/', '/control', '/control/'],
      },
    ],
    sitemap: 'https://ccwg.primafi.xyz/sitemap.xml',
  };
}

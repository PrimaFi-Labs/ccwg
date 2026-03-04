import type { MetadataRoute } from 'next';

const BASE = 'https://ccwg.primafi.xyz';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: BASE, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE}/lobby`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/inventory`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/market`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/profile`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${BASE}/leaderboard`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];
}

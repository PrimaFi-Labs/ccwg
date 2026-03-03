// ccwg-web/src/components/system/AnnouncementBar.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Announcement } from '@/src/types/database';

export function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const res = await fetch('/api/announcements', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        setItems(data.announcements || []);
      } catch {
        // ignore
      }
    };

    fetchAnnouncements();
  }, []);

  if (!items.length) return null;

  const top = items[0];
  return (
    <div className="bg-yellow-900/30 border-b border-yellow-700 text-yellow-200 text-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="min-w-0 truncate">
          <span className="font-semibold truncate">{top.title}</span>
        </div>
        <Link href="/inbox" className="text-yellow-100 hover:text-white underline shrink-0">
          Open inbox
        </Link>
      </div>
    </div>
  );
}

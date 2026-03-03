//ccwg/ccwg-web/src/components/admin/AdminNav.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Settings, CreditCard, Sparkles, Calendar, ShoppingCart, FileText, UserCog, AlertTriangle, Megaphone, Shield } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const navItems = [
  { href: '/admin', label: 'Overview', icon: Settings, roles: ['SuperAdmin', 'Moderator', 'Analyst'] },
  { href: '/admin/cards', label: 'Card Templates', icon: CreditCard, roles: ['SuperAdmin', 'Moderator'] },
  { href: '/admin/abilities', label: 'Abilities', icon: Sparkles, roles: ['SuperAdmin', 'Moderator'] },
  { href: '/admin/market', label: 'Market Items', icon: ShoppingCart, roles: ['SuperAdmin'] },
  { href: '/admin/events', label: 'Events', icon: Calendar, roles: ['SuperAdmin', 'Moderator'] },
  { href: '/admin/reports', label: 'Reports', icon: AlertTriangle, roles: ['SuperAdmin', 'Moderator', 'Analyst'] },
  { href: '/admin/disputes', label: 'Disputes', icon: AlertTriangle, roles: ['SuperAdmin', 'Moderator', 'Analyst'] },
  { href: '/admin/sanctions', label: 'Sanctions', icon: Shield, roles: ['SuperAdmin', 'Moderator', 'Analyst'] },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone, roles: ['SuperAdmin', 'Moderator'] },
  { href: '/admin/audit', label: 'Audit Logs', icon: FileText, roles: ['SuperAdmin', 'Moderator', 'Analyst'] },
  { href: '/admin/admins', label: 'Admins', icon: UserCog, roles: ['SuperAdmin'] },
];

export function AdminNav() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchRole = async () => {
      try {
        const res = await fetch('/api/admin/me', { cache: 'no-store' });
        const data = await res.json();
        if (active) setRole(data.role || null);
      } catch {
        if (active) setRole(null);
      }
    };
    fetchRole();
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(() => {
    if (!role) return [];
    return navItems.filter((item) => item.roles.includes(role));
  }, [role]);

  return (
    <nav className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-2 px-4 py-4 border-b-2 transition-colors whitespace-nowrap
                  ${isActive 
                    ? 'border-purple-500 text-purple-400' 
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

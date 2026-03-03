import Link from 'next/link';

type PolicyShellProps = {
  title: string;
  updatedOn: string;
  intro: string;
  children: React.ReactNode;
};

const relatedLinks = [
  { href: '/terms-of-service', label: 'Terms of Service' },
  { href: '/privacy-policy', label: 'Privacy Policy' },
  { href: '/cookie-policy', label: 'Cookie Policy' },
  { href: '/legal', label: 'Legal' },
];

export function PolicyShell({ title, updatedOn, intro, children }: PolicyShellProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
          <p className="mb-2 text-xs uppercase tracking-wider text-yellow-300">CCWG Policies</p>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-gray-400">Last updated: {updatedOn}</p>
          <p className="mt-4 text-gray-200">{intro}</p>
        </header>

        <article className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          {children}
        </article>

        <aside className="mt-8 rounded-2xl border border-gray-800 bg-gray-900/60 p-5">
          <h2 className="text-lg font-semibold">Related pages</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-gray-700 px-3 py-1 text-sm text-gray-200 hover:border-yellow-500 hover:text-yellow-300"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}


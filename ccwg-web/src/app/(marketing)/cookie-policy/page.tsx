import { PolicyShell } from '@/src/components/legal/PolicyShell';

export default function CookiePolicyPage() {
  return (
    <PolicyShell
      title="Cookie Policy"
      updatedOn="February 21, 2026"
      intro="Cookies help CCWG remember your settings, keep sessions secure, and understand what needs improvement. This page explains what we use and your choices."
    >
      <section>
        <h2 className="text-xl font-semibold">1. What cookies are</h2>
        <p className="mt-2 text-gray-200">
          Cookies are small text files stored in your browser. Similar technologies can include local storage,
          session storage, and device identifiers.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Types we use</h2>
        <p className="mt-2 text-gray-200">
          We use essential cookies (security and login continuity), functional cookies (preferences and UX), and
          performance/analytics tools to understand usage trends and improve reliability.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Why we use them</h2>
        <p className="mt-2 text-gray-200">
          Cookie-based data helps us keep sessions stable, reduce fraud, protect accounts, remember language or UI
          preferences, and measure feature performance.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Third-party technologies</h2>
        <p className="mt-2 text-gray-200">
          Some cookies or similar identifiers may come from trusted service providers used for hosting, analytics,
          wallet connectivity, and security tooling.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. Your choices</h2>
        <p className="mt-2 text-gray-200">
          You can manage cookies in your browser settings, including blocking or deleting cookies. Some essential
          functions of CCWG may not work properly if key cookies are disabled.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Do Not Track</h2>
        <p className="mt-2 text-gray-200">
          Browser Do Not Track signals are not always standardized. We evaluate and apply privacy controls in line
          with applicable laws and platform capabilities.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Updates and contact</h2>
        <p className="mt-2 text-gray-200">
          We may update this policy when technologies or legal requirements change. Questions can be sent through the
          official support/contact channel listed in CCWG.
        </p>
      </section>
    </PolicyShell>
  );
}

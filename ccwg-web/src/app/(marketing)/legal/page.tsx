import { PolicyShell } from '@/src/components/legal/PolicyShell';

export default function LegalPage() {
  return (
    <PolicyShell
      title="Legal"
      updatedOn="February 21, 2026"
      intro="This is the legal center for CCWG. It summarizes key legal notices, user protections, risk disclosures, and compliance expectations in one place."
    >
      <section>
        <h2 className="text-xl font-semibold">1. Legal documents that apply</h2>
        <p className="mt-2 text-gray-200">
          Your use of CCWG is governed by our Terms of Service, Privacy Policy, Cookie Policy, and any additional
          feature-specific rules posted in the product.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Compliance and acceptable use</h2>
        <p className="mt-2 text-gray-200">
          Users must comply with applicable laws, sanctions rules, anti-fraud requirements, and platform integrity
          standards. Accounts may be restricted for abuse, exploitation, or prohibited conduct.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Financial and token disclaimer</h2>
        <p className="mt-2 text-gray-200">
          CCWG is a game experience. Nothing in the service is investment, tax, accounting, or legal advice. Digital
          asset prices can be volatile, and transaction outcomes are your responsibility.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Intellectual property and brand protection</h2>
        <p className="mt-2 text-gray-200">
          The CCWG name, visuals, software, game systems, and related materials are protected by applicable
          intellectual property laws. Unauthorized commercial use is prohibited.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. Content and takedown requests</h2>
        <p className="mt-2 text-gray-200">
          If you believe content on CCWG infringes your rights, send a detailed notice through our official legal or
          support channel. We review good-faith reports and act as appropriate.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Security and incident handling</h2>
        <p className="mt-2 text-gray-200">
          We maintain security controls and investigate abuse reports. If a security event is identified, we may take
          temporary protective actions such as pausing features, limiting activity, or requiring verification.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Service and warranty notice</h2>
        <p className="mt-2 text-gray-200">
          CCWG is provided on an &quot;as is&quot; and &quot;as available&quot; basis, subject to maintenance and operational limits.
          We aim for reliability but cannot promise uninterrupted service.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">8. Legal framework and dispute handling</h2>
        <p className="mt-2 text-gray-200">
          Legal matters are handled under applicable law without fixing a single geographic jurisdiction in this page.
          Where local law gives mandatory rights, those rights remain fully applicable.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">9. How to contact us</h2>
        <p className="mt-2 text-gray-200">
          For legal notices, compliance questions, policy requests, or rights-related issues, use the official contact
          channel provided within CCWG.
        </p>
      </section>
    </PolicyShell>
  );
}

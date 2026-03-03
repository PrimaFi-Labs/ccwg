import { PolicyShell } from '@/src/components/legal/PolicyShell';

export default function PrivacyPolicyPage() {
  return (
    <PolicyShell
      title="Privacy Policy"
      updatedOn="February 21, 2026"
      intro="This page explains what data we collect, why we collect it, and how we protect it. We keep this as clear and practical as possible."
    >
      <section>
        <h2 className="text-xl font-semibold">1. Data we collect</h2>
        <p className="mt-2 text-gray-200">
          Depending on how you use CCWG, we may collect account identifiers (like wallet address), gameplay activity,
          transaction references, support messages, anti-abuse signals, and device/session metadata.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Why we collect it</h2>
        <p className="mt-2 text-gray-200">
          We process data to run matches, maintain rankings, secure accounts, prevent cheating and fraud, process
          purchases, respond to support requests, and improve game quality.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Legal bases</h2>
        <p className="mt-2 text-gray-200">
          We process data based on legitimate business interests, contractual necessity to provide the service,
          compliance obligations, and consent where required by applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Sharing data</h2>
        <p className="mt-2 text-gray-200">
          We may share data with service providers (hosting, infrastructure, analytics, wallet/connectivity providers),
          legal authorities where required, and professional advisers. We do not sell personal data.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. Retention</h2>
        <p className="mt-2 text-gray-200">
          We keep data for as long as needed to provide services, protect users, resolve disputes, and satisfy legal
          obligations. Some records may be retained longer for security or compliance reasons.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Security</h2>
        <p className="mt-2 text-gray-200">
          We use reasonable technical and organizational safeguards. No system is perfectly secure, but we continuously
          improve protection controls and incident response.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Your privacy rights</h2>
        <p className="mt-2 text-gray-200">
          Depending on where you live, you may have rights to access, correct, delete, or restrict certain personal
          data processing, and to object or withdraw consent where applicable.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">8. Cross-border processing</h2>
        <p className="mt-2 text-gray-200">
          Data may be processed in different locations through our global providers. We use reasonable safeguards for
          cross-border handling consistent with applicable law.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">9. Children</h2>
        <p className="mt-2 text-gray-200">
          CCWG is not intended for use in violation of local age restrictions. If you believe a child provided data in
          a way that should not have happened, contact us so we can review and act.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">10. Policy changes and contact</h2>
        <p className="mt-2 text-gray-200">
          We may update this policy when needed. For privacy requests, use the official support/contact channel shown
          in CCWG and include enough detail for us to verify and process your request.
        </p>
      </section>
    </PolicyShell>
  );
}

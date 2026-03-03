import { PolicyShell } from '@/src/components/legal/PolicyShell';

export default function TermsOfServicePage() {
  return (
    <PolicyShell
      title="Terms of Service"
      updatedOn="February 21, 2026"
      intro="These terms explain the rules for using CCWG. We wrote this in plain language so you can understand your rights and responsibilities before you play."
    >
      <section>
        <h2 className="text-xl font-semibold">1. Using CCWG</h2>
        <p className="mt-2 text-gray-200">
          By using CCWG, you agree to these terms. If you do not agree, please do not use the game or related services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">2. Eligibility</h2>
        <p className="mt-2 text-gray-200">
          You must be legally allowed to use this service where you live. If you are under the local age of majority,
          use is only allowed with permission from a parent or legal guardian.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">3. Account and wallet security</h2>
        <p className="mt-2 text-gray-200">
          You are responsible for your wallet keys, connected accounts, and device security. Activity through your
          credentials is treated as your activity.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">4. Fair play rules</h2>
        <p className="mt-2 text-gray-200">
          Do not cheat, exploit bugs, abuse other players, manipulate rankings, or try to interfere with service
          stability. We may suspend or remove access for violations.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">5. On-chain and digital asset risk</h2>
        <p className="mt-2 text-gray-200">
          Blockchain transactions are generally irreversible after confirmation. You are responsible for reviewing
          addresses, fees, and transaction details before signing. We do not guarantee value of any in-game or
          on-chain asset.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">6. Payments and purchases</h2>
        <p className="mt-2 text-gray-200">
          Some features may require payment or token use. Except where law requires otherwise, purchases are final.
          We may limit or reject transactions to prevent abuse, fraud, or security risk.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">7. Service availability and updates</h2>
        <p className="mt-2 text-gray-200">
          We may update, pause, or discontinue features. Outages, delays, and maintenance can happen. We do our best
          to keep the service stable, but uninterrupted availability is not guaranteed.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">8. Intellectual property</h2>
        <p className="mt-2 text-gray-200">
          CCWG content and software are owned by us or our licensors. You receive a limited right to use the service
          for personal, non-commercial play.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">9. Liability limits and legal framework</h2>
        <p className="mt-2 text-gray-200">
          The service is provided &quot;as is&quot; and &quot;as available.&quot; To the maximum extent permitted by applicable law, our
          liability is limited for indirect or consequential losses. Disputes are handled under applicable legal
          frameworks without fixing a single jurisdiction in this policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold">10. Contact and updates to terms</h2>
        <p className="mt-2 text-gray-200">
          We may update these terms over time. Continued use after updates means acceptance of the updated terms.
          For legal requests, use the official support/contact channel published in CCWG.
        </p>
      </section>
    </PolicyShell>
  );
}

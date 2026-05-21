import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — SOLTRA Solar',
  description:
    'Terms of Service governing use of the SOLTRA solar monitoring platform by Helios Systems.',
}

export default function TermsPage() {
  const lastUpdated = '21 May 2026'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest">
            ← Back to SOLTRA
          </a>
          <h1 className="text-4xl font-bold text-zinc-100 mt-6 mb-2">Terms of Service</h1>
          <p className="text-xs font-mono text-zinc-600">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose-custom space-y-10">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using the SOLTRA Solar platform ("<b>the Service</b>") operated by
              Helios Systems Sdn. Bhd. ("<b>Helios Systems</b>", "<b>we</b>", "<b>us</b>"), you
              agree to be bound by these Terms of Service ("<b>Terms</b>"). If you do not agree to
              all of these Terms, you may not access the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              The Service provides cloud-based monitoring and control of SOLTRA autonomous solar
              tracking hardware. Features include live telemetry visualisation, historical energy data,
              manual motor control, fleet management, and subscription billing.
            </p>
            <p className="mt-3">
              Hardware (SOLTRA nodes) must be purchased separately. The Service requires a compatible
              SOLTRA node to function. Helios Systems reserves the right to modify, suspend, or
              discontinue any part of the Service at any time with reasonable notice.
            </p>
          </Section>

          <Section title="3. Account Registration">
            <p>
              You must provide a valid email address and maintain the security of your password.
              You are responsible for all activity that occurs under your account. You must not
              create accounts for others without their explicit consent. We may suspend or terminate
              accounts that violate these Terms.
            </p>
          </Section>

          <Section title="4. User Responsibilities">
            <ul className="list-disc list-inside space-y-1.5 text-sm">
              <li>You are solely responsible for the physical installation of SOLTRA hardware</li>
              <li>Manual motor commands must be issued only by qualified persons familiar with the hardware</li>
              <li>You must not issue commands that could damage property or endanger persons</li>
              <li>You are responsible for ensuring the hardware complies with local electrical and building codes</li>
              <li>You must not use the Service to harm others or for any unlawful purpose</li>
              <li>You must not attempt to reverse-engineer, hack, or abuse the Service's infrastructure</li>
            </ul>
          </Section>

          <Section title="5. Hardware Safety">
            <p>
              The SOLTRA motor control system is capable of physically moving solar panels. Helios
              Systems provides the software interface; physical safety is your responsibility.
              We strongly recommend:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-sm mt-3">
              <li>Installing physical limit switches on all actuated axes</li>
              <li>Testing manual commands only while in visual range of the hardware</li>
              <li>Disabling manual mode when leaving the site</li>
              <li>Complying with wind speed limits appropriate for your installation</li>
            </ul>
            <p className="mt-3">
              Helios Systems is not liable for any property damage, personal injury, or financial loss
              resulting from improper hardware installation or misuse of the motor control interface.
            </p>
          </Section>

          <Section title="6. Data Accuracy Disclaimer">
            <p>
              Telemetry data (solar irradiance, wind speed, panel angles, energy estimates) is provided
              for informational purposes only. Helios Systems does not warrant the accuracy, completeness,
              or fitness for any particular purpose of this data. You should not rely on this data
              for safety-critical decisions without independent verification.
            </p>
          </Section>

          <Section title="7. Payment and Subscriptions">
            <p>
              Paid features require a one-time hardware purchase processed through Stripe, Inc.
              Prices are displayed in Malaysian Ringgit (MYR) unless otherwise stated. All sales are
              final. Refunds may be provided at Helios Systems' discretion within 14 days of purchase
              if the hardware has not been activated.
            </p>
            <p className="mt-3">
              Fleet Admin features require a separate Advanced tier purchase. Tier downgrades take
              effect at the end of the current billing cycle.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              All software, designs, trademarks, and content associated with the Service are the
              property of Helios Systems or its licensors. You are granted a limited, non-exclusive,
              non-transferable licence to access and use the Service for your own solar monitoring
              purposes. You may not reproduce, distribute, or create derivative works without our
              written permission.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              We may suspend or terminate your access to the Service at any time for violation of these
              Terms. You may delete your account at any time by contacting support. Upon termination,
              your right to use the Service ceases immediately; stored data will be handled per our
              Privacy Policy.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the fullest extent permitted by applicable law, Helios Systems shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages arising from your
              use of the Service, including but not limited to loss of data, loss of profits, or
              hardware damage.
            </p>
            <p className="mt-3">
              Our total liability to you for any claim arising out of or relating to these Terms shall
              not exceed the amount you paid to us in the 12 months preceding the event giving rise
              to the claim.
            </p>
          </Section>

          <Section title="11. Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of Malaysia.
              Any disputes shall be resolved in the courts of Kuala Lumpur, Malaysia. If you are a
              consumer resident in a jurisdiction that does not permit this choice of law, local
              mandatory consumer protection laws may apply.
            </p>
          </Section>

          <Section title="12. Changes to Terms">
            <p>
              We may update these Terms at any time. The "Last updated" date will reflect changes.
              Continued use of the Service after an update constitutes acceptance. For material
              changes, we will provide at least 14 days' notice via email.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              Helios Systems Sdn. Bhd.<br />
              {/* TODO: Add registered address */}
              General enquiries:{' '}
              <a href="mailto:support@soltra.solar" className="text-emerald-400 hover:text-emerald-300">
                support@soltra.solar
              </a><br />
              Legal:{' '}
              <a href="mailto:legal@soltra.solar" className="text-emerald-400 hover:text-emerald-300">
                legal@soltra.solar
              </a>
            </p>
          </Section>
        </div>

        <div className="mt-16 pt-8 border-t border-zinc-900 text-xs font-mono text-zinc-700">
          © 2026 Helios Systems Sdn. Bhd. · SOLTRA Solar Platform
        </div>
      </div>

      <style>{`
        .prose-custom p { font-size: 0.9rem; line-height: 1.75; color: #a1a1aa; }
        .prose-custom strong { color: #e4e4e7; }
        .prose-custom ul { color: #a1a1aa; }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-zinc-200 mb-4 pb-2 border-b border-zinc-800">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — SOLTRA Solar',
  description:
    'Understand how Helios Systems collects, uses, and protects your data when you use the SOLTRA solar monitoring platform.',
}

export default function PrivacyPage() {
  const lastUpdated = '21 May 2026'

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="text-[10px] font-mono text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest">
            ← Back to SOLTRA
          </a>
          <h1 className="text-4xl font-bold text-zinc-100 mt-6 mb-2">Privacy Policy</h1>
          <p className="text-xs font-mono text-zinc-600">Last updated: {lastUpdated}</p>
        </div>

        {/* Body */}
        <div className="prose-custom space-y-10">
          <Section title="1. About This Policy">
            <p>
              Helios Systems Sdn. Bhd. ("<b>Helios Systems</b>", "<b>we</b>", "<b>our</b>") operates the
              SOLTRA Solar monitoring platform ("<b>the Service</b>"). This Privacy Policy explains how we
              collect, use, disclose, and safeguard your information when you use the Service.
            </p>
            <p className="mt-3">
              By using the Service you agree to the practices described in this Policy. If you do not
              agree, please discontinue use of the Service.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <Subsection title="Account Information">
              When you register, we collect your email address and the role you select (Homeowner or
              Fleet Admin). Your password is hashed and never stored in plain text.
            </Subsection>
            <Subsection title="Telemetry Data">
              Your SOLTRA hardware node transmits solar irradiance, wind speed, panel angle, tilt angle,
              wind alert status, and firmware status strings to the Service. This data is associated
              with your account and stored in a Supabase PostgreSQL database hosted on AWS
              (Singapore region).
            </Subsection>
            <Subsection title="Payment Information">
              Payment card details are processed directly by Stripe, Inc. We receive only a Stripe
              customer ID and a subscription status; we never see or store your full card number.
            </Subsection>
            <Subsection title="Usage Data">
              We may collect standard server logs including IP address, browser type, pages visited,
              and timestamps. This is used for security monitoring and service improvement.
            </Subsection>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc list-inside space-y-1.5 text-sm">
              <li>To provide and operate the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>To display your solar array's live and historical telemetry</li>
              <li>To send transactional emails (account confirmation, password reset)</li>
              <li>To detect and prevent fraud and abuse</li>
              <li>To comply with legal obligations</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your data to third parties, and we do not use your
              telemetry data for advertising.
            </p>
          </Section>

          <Section title="4. Data Sharing">
            <p>We share data only with the following categories of service providers:</p>
            <ul className="list-disc list-inside space-y-1.5 text-sm mt-3">
              <li><strong>Supabase Inc.</strong> — Database and authentication infrastructure</li>
              <li><strong>Stripe, Inc.</strong> — Payment processing</li>
              <li><strong>HiveMQ GmbH</strong> — MQTT message broker for hardware communication</li>
              <li><strong>Vercel Inc.</strong> — Web hosting and edge delivery</li>
            </ul>
            <p className="mt-3">
              All providers are required to handle data in accordance with applicable privacy laws and
              are contractually bound to use your data only as directed by us.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              Telemetry data is retained for a rolling 12-month period by default. Account data is
              retained for as long as your account is active. Upon account deletion we will delete or
              anonymise your personal data within 30 days, except where retention is required by law.
            </p>
          </Section>

          <Section title="6. Your Rights (GDPR / PDPA)">
            <p>
              Depending on your jurisdiction you may have the right to access, correct, delete, or
              export your personal data. You may also object to or restrict certain processing.
            </p>
            <p className="mt-3">
              For Malaysian users, this Policy is designed to comply with the Personal Data Protection
              Act 2010 (PDPA). For European users, the General Data Protection Regulation (GDPR) applies.
            </p>
            <p className="mt-3">
              To exercise your rights, contact us at:{' '}
              {/* TODO: Replace with a real email address once the domain is registered */}
              <a href="mailto:privacy@soltra.solar" className="text-emerald-400 hover:text-emerald-300">
                privacy@soltra.solar
              </a>
            </p>
          </Section>

          <Section title="7. Cookies">
            <p>
              The Service uses a single session cookie to maintain your authenticated state. We do not
              use advertising or analytics cookies. You may configure your browser to reject cookies;
              however, some features of the Service may not function correctly without them.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We implement industry-standard security measures including TLS encryption in transit,
              AES-256 encryption at rest, Row Level Security (RLS) on all database tables, and regular
              dependency audits. No system is perfectly secure; in the event of a breach we will notify
              affected users as required by applicable law.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Policy from time to time. The "Last updated" date at the top of this
              page will reflect any changes. Continued use of the Service after an update constitutes
              acceptance of the revised Policy.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              Helios Systems Sdn. Bhd.<br />
              {/* TODO: Add physical registered address */}
              Email:{' '}
              <a href="mailto:privacy@soltra.solar" className="text-emerald-400 hover:text-emerald-300">
                privacy@soltra.solar
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

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-1.5">{title}</h3>
      <p className="text-sm text-zinc-500">{children}</p>
    </div>
  )
}

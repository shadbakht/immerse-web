import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support — Immerse',
  description: 'Get help with Immerse: contact us, manage your account and subscription, and find answers to common questions.',
};

function Section({ title }: { title: string }) {
  return <h2 className="text-base font-bold text-gray-900 mt-8 mb-2">{title}</h2>;
}

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back */}
        <Link href="/" className="text-sm text-[#1B6B7B] hover:underline mb-8 inline-block">← Back to Immerse</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">Support</h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-8">
          Need help with Immerse? We&rsquo;re happy to assist. Email us and we&rsquo;ll get back to you as soon as we can.
        </p>

        {/* Contact card */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 mb-2">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-2">Contact</p>
          <a
            href="mailto:support@immerseresearch.app"
            className="text-lg font-semibold text-[#1B6B7B] hover:underline"
          >
            support@immerseresearch.app
          </a>
        </div>

        <Section title="Resetting your password" />
        <p className="text-sm text-gray-600 leading-relaxed">
          On the sign-in screen, tap <span className="font-semibold">Forgot password?</span> and enter your email. We&rsquo;ll send a link to set a new password. (Check your spam folder if it doesn&rsquo;t arrive within a few minutes.)
        </p>

        <Section title="Managing your subscription" />
        <p className="text-sm text-gray-600 leading-relaxed">
          Immerse Pro subscriptions are managed where you bought them: on <span className="font-semibold">iOS</span> via your Apple ID subscriptions, on <span className="font-semibold">Android</span> via Google Play subscriptions, and on the <span className="font-semibold">web</span> from Settings. New accounts include a free trial; you can cancel anytime before it ends to avoid being charged.
        </p>

        <Section title="Deleting your account" />
        <p className="text-sm text-gray-600 leading-relaxed">
          Open <span className="font-semibold">Settings</span> in the app and choose <span className="font-semibold">Delete Account</span>. This permanently removes your account and the content stored on our servers.
        </p>

        <Section title="Annotations not syncing" />
        <p className="text-sm text-gray-600 leading-relaxed">
          Make sure you&rsquo;re signed in to the same account on each device and have an internet connection. Your highlights, tags, notes, and reading progress sync automatically. If something still looks off, email us the details and we&rsquo;ll help.
        </p>

        <Section title="Privacy &amp; Terms" />
        <p className="text-sm text-gray-600 leading-relaxed">
          See our <Link href="/privacy" className="text-[#1B6B7B] hover:underline">Privacy Policy, Terms of Service, and Community Guidelines</Link>.
        </p>
      </div>
    </div>
  );
}

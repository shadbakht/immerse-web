import Link from 'next/link';

function Section({ title }: { title: string }) {
  return <h2 className="text-base font-bold text-gray-900 mt-8 mb-2">{title}</h2>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#F8F7F4]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back */}
        <Link href="/" className="text-sm text-[#1B6B7B] hover:underline mb-8 inline-block">← Back to Immerse</Link>

        <h1 className="text-3xl font-bold text-gray-900 mb-1">Legal</h1>
        <p className="text-sm text-gray-400 mb-10">Effective Date: June 4, 2026</p>

        {/* ── Privacy Policy ── */}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Privacy Policy for Immerse</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          Immerse Research (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates the Immerse application (the &ldquo;App&rdquo;). We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and share information when you use Immerse on iOS, Android, and the web.
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          By using the App, you agree to the collection and use of information as described in this Privacy Policy.
        </p>

        <Section title="1. Information We Collect" />
        <p className="text-sm font-semibold text-gray-700 mb-1">1.1 Account Information</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">When you create an account, we may collect your full name, a unique username, your email address, and your password (handled securely via authentication services). You may also use Immerse as a guest without creating an account.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.2 Annotation and Reading Data</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">We collect and store content you create within the App, including highlighted text and selections, tags and notes, cross-references between passages (&ldquo;Xrefs&rdquo;), and your reading progress and preferences.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.3 Public Content</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">If you choose to share content with the Immerse community, your tags, notes, and Xrefs may be visible to other users, and your username will be displayed alongside that content.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.4 Imported Books</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">Immerse Pro subscribers may import their own files (e.g., EPUB or text files). Imported books and any annotations made on them are stored locally on your device only and are never uploaded to our servers.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.5 Subscription and Payment Information</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">If you subscribe to Immerse Pro, payments are processed by third-party providers — Apple In-App Purchase and RevenueCat on iOS and Android, and Stripe on the web. We do not store or process your payment card information directly.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.6 Usage Data</p>
        <p className="text-sm text-gray-600 leading-relaxed">We may collect limited technical data to improve the App, including app performance metrics, device type and operating system, and general interaction patterns.</p>

        <Section title="2. How We Use Your Information" />
        <p className="text-sm text-gray-600 leading-relaxed">We use collected information to provide, operate, and improve the App; sync your reading progress and annotations across devices; enable community sharing features; process subscription and entitlement management; and respond to support requests. We do not sell your personal data.</p>

        <Section title="3. Public vs. Private Content" />
        <p className="text-sm text-gray-600 leading-relaxed">All your annotations and reading data are private by default. You may choose to make specific content public. Public content may be viewed by any Immerse user, may include excerpts of text from library books, and will be associated with your username. Once made public, we cannot guarantee complete control over how other users may use or share that content.</p>

        <Section title="4. The Immerse Library" />
        <p className="text-sm text-gray-600 leading-relaxed">The App includes a curated library of spiritual, religious, philosophical, and historical texts from diverse traditions worldwide. These texts are provided for personal study and educational use only. Immerse Research does not claim ownership of these works. All texts are either in the public domain or used with appropriate permission.</p>

        <Section title="5. User-Imported Content" />
        <p className="text-sm text-gray-600 leading-relaxed">Pro subscribers may import their own books or documents. Imported files and any annotations made on them are stored locally on your device only — they are not synced to our servers. By importing content, you acknowledge that you are solely responsible for any content you import, you must have the legal right to use and store that content, and Immerse Research does not verify ownership or licensing of imported materials.</p>

        <Section title="6. AI Features" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse Pro includes AI-powered features such as passage summaries. When you use these features, relevant passage text may be processed by AI services to generate a response. We do not use your personal annotations or account data to train AI models.</p>

        <Section title="7. Content Sharing and Copyright" />
        <p className="text-sm text-gray-600 leading-relaxed">When you share annotations publicly, your shared content may include excerpts of text from library books. You are responsible for ensuring your shared content complies with applicable copyright laws. We reserve the right to remove content that violates applicable laws or our policies.</p>

        <Section title="8. Third-Party Services" />
        <p className="text-sm text-gray-600 leading-relaxed">We use the following third-party services to operate the App: Supabase (backend database and authentication), Apple and Google (platform distribution and in-app purchases), RevenueCat (subscription management on iOS and Android), and Stripe (payment processing on the web). These services may process and store your data in accordance with their own privacy policies.</p>

        <Section title="9. Data Storage and Security" />
        <p className="text-sm text-gray-600 leading-relaxed">We implement reasonable safeguards to protect your data, including secure data transmission (HTTPS), authentication protections, and controlled access to stored data. However, no system is completely secure, and we cannot guarantee absolute security.</p>

        <Section title="10. Data Retention" />
        <p className="text-sm text-gray-600 leading-relaxed">We retain your data for as long as your account is active and as necessary to provide the App&apos;s services. If you delete your account, we will delete or anonymize your data within a reasonable timeframe, except where retention is required by law.</p>

        <Section title="11. Your Rights and Controls" />
        <p className="text-sm text-gray-600 leading-relaxed">At any time, you may access, edit, or delete your annotations and content; change content between public and private; or delete your account. For assistance, contact us at <a href="mailto:support@immerseresearch.app" className="text-[#1B6B7B] hover:underline">support@immerseresearch.app</a>.</p>

        <Section title="12. Children's Privacy" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.</p>

        <Section title="13. Content Neutrality" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse provides access to a diverse collection of spiritual and philosophical texts from many traditions. We do not endorse any specific belief system or any particular interpretation of these texts. User-generated content reflects the views of individual users, not Immerse Research.</p>

        <Section title="14. Exported Data" />
        <p className="text-sm text-gray-600 leading-relaxed">The App allows you to export your annotations and reading data. Once exported, that data is outside our control and we are not responsible for how it is used, shared, or stored.</p>

        <Section title="15. Changes to This Policy" />
        <p className="text-sm text-gray-600 leading-relaxed">We may update this Privacy Policy from time to time. Changes will be reflected by updating the &ldquo;Effective Date&rdquo; above. Continued use of the App constitutes acceptance of the updated policy.</p>

        <Section title="16. Contact Us" />
        <p className="text-sm text-gray-600 leading-relaxed">If you have any questions about this Privacy Policy, contact us at: <a href="mailto:support@immerseresearch.app" className="text-[#1B6B7B] hover:underline">support@immerseresearch.app</a></p>

        {/* ── Terms of Service ── */}
        <hr className="my-10 border-gray-200" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Terms of Service for Immerse</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">Welcome to Immerse, developed by Immerse Research. These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Immerse application (the &ldquo;App&rdquo;) on iOS, Android, and the web. By accessing or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.</p>

        <Section title="1. Eligibility" />
        <p className="text-sm text-gray-600 leading-relaxed">You must be at least 13 years old to use the App.</p>

        <Section title="2. Account Registration" />
        <p className="text-sm text-gray-600 leading-relaxed">To access annotation and community features, you must create an account. You agree to provide accurate and complete information, maintain the confidentiality of your login credentials, and be responsible for all activity under your account. You may also use Immerse as a guest, which provides read-only access to the library.</p>

        <Section title="3. Description of the App" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse provides: a curated, multi-tradition library of spiritual, religious, philosophical, and historical texts; annotation tools including highlights, tags, notes, and cross-references (&ldquo;Xrefs&rdquo;); cross-device sync of reading progress and annotations (Standard and Pro accounts); a community feature for discovering and sharing public annotations; AI-powered passage summaries (Pro); and the ability to import your own EPUB or text files (Pro).</p>

        <Section title="4. Subscription Tiers" />
        <p className="text-sm text-gray-600 leading-relaxed mb-2"><span className="font-semibold text-gray-700">Guest</span> — Read the full library and share quotes. No account required.</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-2"><span className="font-semibold text-gray-700">Standard (free with account)</span> — All annotation features, cross-device sync, and content export.</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-2"><span className="font-semibold text-gray-700">Pro ($0.99/month)</span> — AI summaries, book import, and the ability to post to the community.</p>
        <p className="text-sm text-gray-600 leading-relaxed">Subscriptions are managed through Apple In-App Purchase and RevenueCat (iOS and Android) or Stripe (web). Billing, refunds, and cancellations are handled by the respective platform provider.</p>

        <Section title="5. User Content" />
        <p className="text-sm text-gray-600 leading-relaxed">You retain ownership of all content you create in the App. By using the App, you grant Immerse Research a limited, non-exclusive license to store, process, and display your content solely to operate the App. If you make content public, it may be viewed by other Immerse users and associated with your username.</p>

        <Section title="6. Discover Feature" />
        <p className="text-sm text-gray-600 leading-relaxed">You are solely responsible for content you make public. You agree not to post content that violates any applicable law, infringes intellectual property rights, is abusive, defamatory, hateful, or harmful, or is otherwise offensive or inappropriate. We reserve the right to remove any public content and to restrict or terminate accounts that violate these Terms.</p>

        <Section title="7. Intellectual Property" />
        <p className="text-sm text-gray-600 leading-relaxed">The texts in the Immerse library are either in the public domain or used with permission. We do not claim ownership of these works. You agree not to upload or share content you do not have the legal right to use. If you believe content in the App infringes your rights, contact us at <a href="mailto:support@immerseresearch.app" className="text-[#1B6B7B] hover:underline">support@immerseresearch.app</a>.</p>

        <Section title="8. User-Imported Content" />
        <p className="text-sm text-gray-600 leading-relaxed">Pro subscribers may import their own books or documents. Imported files and their annotations remain on your device only and are not synced to our servers. You are responsible for ensuring you have the legal right to use and store any imported content. We do not verify ownership or licensing of imported materials.</p>

        <Section title="9. Acceptable Use" />
        <p className="text-sm text-gray-600 leading-relaxed">You agree not to use the App for unlawful purposes, interfere with the operation or security of the App, attempt to access other users&apos; private data without authorization, or abuse the Discover feature.</p>

        <Section title="10. Privacy" />
        <p className="text-sm text-gray-600 leading-relaxed">Your use of the App is also governed by our Privacy Policy above, which is incorporated into these Terms by reference.</p>

        <Section title="11. Termination" />
        <p className="text-sm text-gray-600 leading-relaxed">We may suspend or terminate your account if you violate these Terms. You may delete your account at any time through the App&apos;s settings.</p>

        <Section title="12. Disclaimers" />
        <p className="text-sm text-gray-600 leading-relaxed">The App is provided &ldquo;as is&rdquo; without warranties of any kind. We do not guarantee the accuracy or completeness of library content, uninterrupted availability of the App or its AI features, or that user-generated or community content is reliable or appropriate.</p>

        <Section title="13. Limitation of Liability" />
        <p className="text-sm text-gray-600 leading-relaxed">To the maximum extent permitted by law, Immerse Research shall not be liable for indirect, incidental, or consequential damages, loss of annotation data or content, or issues arising from user-generated or public content.</p>

        <Section title="14. Content Neutrality" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse provides access to a wide range of spiritual and philosophical texts from diverse traditions. We do not endorse any particular belief system or any interpretation of these texts. User-generated content reflects the views of individual users, not Immerse Research.</p>

        <Section title="15. Changes to These Terms" />
        <p className="text-sm text-gray-600 leading-relaxed">We may update these Terms at any time. Continued use of the App constitutes acceptance of the updated Terms. Material changes will be reflected by updating the &ldquo;Effective Date.&rdquo;</p>

        <Section title="16. Governing Law" />
        <p className="text-sm text-gray-600 leading-relaxed">These Terms are governed by and interpreted in accordance with the laws of the Province of British Columbia, Canada.</p>

        <Section title="17. Contact" />
        <p className="text-sm text-gray-600 leading-relaxed">If you have any questions about these Terms, contact us at: <a href="mailto:support@immerseresearch.app" className="text-[#1B6B7B] hover:underline">support@immerseresearch.app</a></p>

        {/* ── Community Guidelines ── */}
        <hr className="my-10 border-gray-200" />
        <h2 className="text-xl font-bold text-gray-900 mb-4">Community Guidelines</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">Welcome to the Immerse community — a space for cross-tradition reading, reflection, and the sharing of insights from humanity&apos;s spiritual heritage.</p>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <div><p className="font-semibold text-gray-800">Be Respectful</p><p>Treat all traditions, texts, and fellow readers with genuine respect. Harassment, insults, and dismissive remarks have no place here.</p></div>
          <div><p className="font-semibold text-gray-800">Share Thoughtfully</p><p>Share highlights, tags, and reflections that invite meaningful engagement. Focus on insight rather than argument.</p></div>
          <div><p className="font-semibold text-gray-800">Honour Diverse Perspectives</p><p>Immerse brings together readers from many traditions and backgrounds. Approach differences with curiosity and humility. Respectful disagreement is welcome; mockery and hostility are not.</p></div>
          <div><p className="font-semibold text-gray-800">Share Responsibly</p><p>Only share content you have the right to share. Keep quotations from library texts reasonable in length. Respect copyright and intellectual property.</p></div>
          <div><p className="font-semibold text-gray-800">Engage in Good Faith</p><p>Use the community to connect with other readers over shared texts. Avoid promoting unrelated agendas or distributing spam. Quality over quantity.</p></div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link href="/" className="text-sm text-[#1B6B7B] hover:underline">← Back to Immerse</Link>
        </div>
      </div>
    </div>
  );
}

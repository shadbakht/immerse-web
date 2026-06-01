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
        <p className="text-sm text-gray-400 mb-10">Effective Date: May 1, 2026</p>

        {/* ── Privacy Policy ── */}
        <h2 className="text-xl font-bold text-gray-900 mb-1">Privacy Policy for Immerse Interfaith</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          Immerse research, we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and share information when you use the Immerse Interfaith application (the "App").
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          By using the App, you agree to the collection and use of information in accordance with this Privacy Policy.
        </p>

        <Section title="1. Information We Collect" />
        <p className="text-sm font-semibold text-gray-700 mb-1">1.1 Account Information</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">When you create an account, we may collect: full name, username (unique identifier), email address, and password (securely handled via authentication services).</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.2 User-Generated Content</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">We collect and store content you create within the App, including tags, notes, cross-references ("Xrefs"), highlights and selected text, and reading progress and preferences.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.3 Public Content</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">If you choose to make content public, your tags, notes, and xrefs may be visible to other users, and your username will be displayed alongside that content.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.4 Imported Content</p>
        <p className="text-sm text-gray-600 leading-relaxed mb-3">The App allows users to import their own files (e.g., EPUB or text files). We may store the content of imported files and associated annotations.</p>
        <p className="text-sm font-semibold text-gray-700 mb-1">1.5 Usage Data</p>
        <p className="text-sm text-gray-600 leading-relaxed">We may collect limited technical data such as app performance metrics, device type and operating system, and interaction patterns (for improving functionality).</p>

        <Section title="2. How We Use Your Information" />
        <p className="text-sm text-gray-600 leading-relaxed">We use collected information to provide and operate the App, save and sync your content across devices, enable annotation and community sharing features, improve performance and user experience, and respond to support requests. We do not sell your personal data.</p>

        <Section title="3. Public vs. Private Content" />
        <p className="text-sm text-gray-600 leading-relaxed">All user-generated content is private by default. You may choose to make specific content public. Public content may be viewed by other users, may include excerpts of text, and may be associated with your username. Once content is made public, we cannot guarantee complete control over how others may use or share it.</p>

        <Section title="4. Preloaded Content" />
        <p className="text-sm text-gray-600 leading-relaxed">The App includes a curated library of religious, philosophical, and historical texts from multiple traditions. These texts are provided for educational and personal use only. Immerse Interfaith does not claim ownership of these works and provides content believed to be public domain or used with permission where applicable.</p>

        <Section title="5. User-Imported Content" />
        <p className="text-sm text-gray-600 leading-relaxed">Users may import their own content into the App. You acknowledge and agree that you are solely responsible for any content you import, you must have the legal right to use and store such content, and Immerse Interfaith does not verify ownership or licensing of imported materials.</p>

        <Section title="6. Content Sharing and Copyright" />
        <p className="text-sm text-gray-600 leading-relaxed">When you share tags, notes, or xrefs publicly, you may be sharing excerpts of text from books. You are responsible for ensuring your shared content complies with applicable copyright laws. We reserve the right to remove content that violates laws or policies.</p>

        <Section title="7. Third-Party Services" />
        <p className="text-sm text-gray-600 leading-relaxed">We use third-party services to operate the App, including backend and database services (e.g., Supabase) and platform services provided by Apple. These services may process and store your data in accordance with their own privacy policies.</p>

        <Section title="8. Data Storage and Security" />
        <p className="text-sm text-gray-600 leading-relaxed">We implement reasonable safeguards to protect your data, including secure data transmission (HTTPS), authentication protections, and controlled access to stored data. However, no system is completely secure, and we cannot guarantee absolute security.</p>

        <Section title="9. Data Retention" />
        <p className="text-sm text-gray-600 leading-relaxed">We retain your data as long as your account is active and as necessary to provide services. If you delete your account, we will delete or anonymize your data within a reasonable timeframe, except where retention is required by law.</p>

        <Section title="10. Your Rights and Control" />
        <p className="text-sm text-gray-600 leading-relaxed">You may access, edit, or delete your content, make content public or private, or delete your account. For assistance, contact us at the email below.</p>

        <Section title="11. Children's Privacy" />
        <p className="text-sm text-gray-600 leading-relaxed">The App is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it.</p>

        <Section title="12. Content Neutrality" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse Interfaith provides access to a diverse collection of religious and philosophical texts. We do not endorse any specific belief system or any interpretation of these texts. User-generated content reflects the views of individual users, not the App.</p>

        <Section title="13. Exported Data" />
        <p className="text-sm text-gray-600 leading-relaxed">The App allows users to export content. Once exported, data is outside our control and we are not responsible for how exported content is used, shared, or stored.</p>

        <Section title="14. Changes to This Policy" />
        <p className="text-sm text-gray-600 leading-relaxed">We may update this Privacy Policy from time to time. Changes will be reflected by updating the "Effective Date." Continued use of the App constitutes acceptance of the updated policy.</p>

        <Section title="15. Contact Us" />
        <p className="text-sm text-gray-600 leading-relaxed">If you have any questions or concerns about this Privacy Policy, visit our website or Facebook page.</p>

        {/* ── Terms of Service ── */}
        <hr className="my-10 border-gray-200" />
        <h2 className="text-xl font-bold text-gray-900 mb-1">Terms of Service for Immerse Interfaith</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">Welcome to Immerse research. These Terms of Service ("Terms") govern your use of the Immerse Interfaith application (the "App"). By accessing or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.</p>

        <Section title="1. Eligibility" />
        <p className="text-sm text-gray-600 leading-relaxed">You must be at least 13 years old to use the App.</p>

        <Section title="2. Account Registration" />
        <p className="text-sm text-gray-600 leading-relaxed">To access certain features, you must create an account. You agree to provide accurate and complete information, maintain the confidentiality of your login credentials, and be responsible for all activity under your account.</p>

        <Section title="3. Description of the Service" />
        <p className="text-sm text-gray-600 leading-relaxed">Immerse Interfaith provides access to a curated library of religious and historical texts, tools for annotation (tags, notes, cross-references), and a community feature allowing users to share and discover public content.</p>

        <Section title="4. User Content" />
        <p className="text-sm text-gray-600 leading-relaxed mb-2">You retain ownership of all content you create. By using the App, you grant us a limited, non-exclusive license to store, process, and display your content solely for the purpose of operating the App. If you make content public, it may be viewed by other users and associated with your username.</p>

        <Section title="5. Community Feature" />
        <p className="text-sm text-gray-600 leading-relaxed">You are solely responsible for content you make public. You agree not to post content that violates any law, infringes intellectual property rights, is abusive, defamatory, hateful, or harmful, or contains offensive or inappropriate material. We reserve the right to remove any public content and restrict accounts that violate these Terms.</p>

        <Section title="6. Intellectual Property and Copyright" />
        <p className="text-sm text-gray-600 leading-relaxed">The App includes religious and historical texts provided for educational use. We do not claim ownership of these works. You agree not to upload or share content you do not have the right to use. If you believe content infringes your rights, contact us.</p>

        <Section title="7. User-Imported Content" />
        <p className="text-sm text-gray-600 leading-relaxed">You are responsible for ensuring you have legal rights to use any content you import. We do not verify ownership or licensing. Imported content is used at your own risk.</p>

        <Section title="8. Acceptable Use" />
        <p className="text-sm text-gray-600 leading-relaxed">You agree not to use the App for unlawful purposes, interfere with the operation of the App, attempt to access other users' data without authorization, or abuse the community feature.</p>

        <Section title="9. Data and Privacy" />
        <p className="text-sm text-gray-600 leading-relaxed">Your use of the App is also governed by our Privacy Policy above.</p>

        <Section title="10. Termination" />
        <p className="text-sm text-gray-600 leading-relaxed">We may suspend or terminate your account if you violate these Terms. You may delete your account at any time.</p>

        <Section title="11. Disclaimers" />
        <p className="text-sm text-gray-600 leading-relaxed">The App is provided "as is" without warranties of any kind. We do not guarantee accuracy of content, availability of the App at all times, or that user-generated content is reliable or appropriate.</p>

        <Section title="12. Limitation of Liability" />
        <p className="text-sm text-gray-600 leading-relaxed">To the maximum extent permitted by law, Immerse Interfaith shall not be liable for indirect, incidental, or consequential damages, loss of data or content, or issues arising from user-generated or public content.</p>

        <Section title="13. Content Neutrality" />
        <p className="text-sm text-gray-600 leading-relaxed">The App provides access to a wide range of religious and philosophical texts. We do not endorse any particular belief system or any user-generated interpretation.</p>

        <Section title="14. Changes to Terms" />
        <p className="text-sm text-gray-600 leading-relaxed">We may update these Terms at any time. Continued use of the App constitutes acceptance of the updated Terms.</p>

        <Section title="15. Governing Law" />
        <p className="text-sm text-gray-600 leading-relaxed">These Terms shall be governed by and interpreted in accordance with the laws of the Province of British Columbia, Canada.</p>

        <Section title="16. Contact Information" />
        <p className="text-sm text-gray-600 leading-relaxed">If you have any questions regarding these Terms, visit our website or Facebook page.</p>

        {/* ── Community Guidelines ── */}
        <hr className="my-10 border-gray-200" />
        <h2 className="text-xl font-bold text-gray-900 mb-4">Community Guidelines</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">Welcome to the Immerse Interfaith community. This is a space for thoughtful study, reflection, and sharing.</p>
        <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
          <div><p className="font-semibold text-gray-800">Be Respectful</p><p>Treat all traditions, texts, and users with respect. No harassment or insults.</p></div>
          <div><p className="font-semibold text-gray-800">Share Thoughtfully</p><p>Share insights, not attacks. Keep discussions meaningful and constructive.</p></div>
          <div><p className="font-semibold text-gray-800">Respect Others' Beliefs</p><p>People come from different backgrounds. Disagree respectfully — no mockery or hostility.</p></div>
          <div><p className="font-semibold text-gray-800">Share Responsibly</p><p>Only share content you have the right to share. Respect copyright and intellectual property.</p></div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link href="/" className="text-sm text-[#1B6B7B] hover:underline">← Back to Immerse</Link>
        </div>
      </div>
    </div>
  );
}

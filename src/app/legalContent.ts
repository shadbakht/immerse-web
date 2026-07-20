/**
 * Content for the Privacy / Terms / Community Guidelines page and the Support
 * page, in each supported locale.
 *
 * The page components render from this so the English and Spanish versions share
 * one layout — only the strings differ, and the English output is unchanged from
 * when the copy lived inline. Add a locale by adding a key here.
 *
 * These are the canonical legal texts the mobile app deep-links to. English is
 * authoritative; the Spanish is a courtesy translation.
 */

export type Locale = 'en' | 'es';

export const LOCALES: Locale[] = ['en', 'es'];

/** A titled block of one or more paragraphs; a paragraph may carry a bold lead-in. */
export interface Para {
  label?: string;
  text: string;
}
export interface LegalSection {
  title: string;
  paras: Para[];
}
export interface Guideline {
  title: string;
  text: string;
}

interface LegalContent {
  back: string;
  legalHeading: string;
  effectiveDate: string;
  otherLanguage: string;       // label of the toggle that switches to the OTHER locale

  privacyTitle: string;
  privacyIntro: string[];
  privacySections: LegalSection[];

  termsTitle: string;
  termsIntro: string;
  termsSections: LegalSection[];

  guidelinesTitle: string;
  guidelinesIntro: string;
  guidelines: Guideline[];
}

interface SupportContent {
  back: string;
  title: string;
  intro: string;
  contactLabel: string;
  sections: { title: string; html: string }[];
  privacyLinkText: string;
  privacyLinkIntro: string;
  privacyTermsTitle: string;
  otherLanguage: string;
}

// ─── English (authoritative) ─────────────────────────────────────────────────

const legalEn: LegalContent = {
  back: '← Back to Immerse',
  legalHeading: 'Legal',
  effectiveDate: 'Effective Date: June 4, 2026',
  otherLanguage: 'Español',

  privacyTitle: 'Privacy Policy for Immerse',
  privacyIntro: [
    'Immerse Research (“we,” “us,” or “our”) operates the Immerse application (the “App”). We respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and share information when you use Immerse on iOS, Android, and the web.',
    'By using the App, you agree to the collection and use of information as described in this Privacy Policy.',
  ],
  privacySections: [
    { title: '1. Information We Collect', paras: [
      { label: '1.1 Account Information', text: 'When you create an account, we may collect your full name, a unique username, your email address, and your password (handled securely via authentication services). You may also use Immerse as a guest without creating an account.' },
      { label: '1.2 Annotation and Reading Data', text: 'We collect and store content you create within the App, including highlighted text and selections, tags and notes, cross-references between passages (“Xrefs”), and your reading progress and preferences.' },
      { label: '1.3 Public Content', text: 'If you choose to share content with the Immerse community, your tags, notes, and Xrefs may be visible to other users, and your username will be displayed alongside that content.' },
      { label: '1.4 Imported Books', text: 'Immerse Pro subscribers may import their own files (e.g., EPUB or text files). Imported books and any annotations made on them are stored locally on your device only and are never uploaded to our servers.' },
      { label: '1.5 Subscription and Payment Information', text: 'If you subscribe to Immerse Pro, payments are processed by third-party providers — Apple In-App Purchase and RevenueCat on iOS and Android, and Stripe on the web. We do not store or process your payment card information directly.' },
      { label: '1.6 Usage Data', text: 'We may collect limited technical data to improve the App, including app performance metrics, device type and operating system, and general interaction patterns.' },
    ]},
    { title: '2. How We Use Your Information', paras: [{ text: 'We use collected information to provide, operate, and improve the App; sync your reading progress and annotations across devices; enable community sharing features; process subscription and entitlement management; and respond to support requests. We do not sell your personal data.' }]},
    { title: '3. Public vs. Private Content', paras: [{ text: 'All your annotations and reading data are private by default. You may choose to make specific content public. Public content may be viewed by any Immerse user, may include excerpts of text from library books, and will be associated with your username. Once made public, we cannot guarantee complete control over how other users may use or share that content.' }]},
    { title: '4. The Immerse Library', paras: [{ text: 'The App includes a curated library of spiritual, religious, philosophical, and historical texts from diverse traditions worldwide. These texts are provided for personal study and educational use only. Immerse Research does not claim ownership of these works. All texts are either in the public domain or used with appropriate permission.' }]},
    { title: '5. User-Imported Content', paras: [{ text: 'Pro subscribers may import their own books or documents. Imported files and any annotations made on them are stored locally on your device only — they are not synced to our servers. By importing content, you acknowledge that you are solely responsible for any content you import, you must have the legal right to use and store that content, and Immerse Research does not verify ownership or licensing of imported materials.' }]},
    { title: '6. AI Features', paras: [{ text: 'Immerse Pro includes AI-powered features such as passage summaries. When you use these features, relevant passage text may be processed by AI services to generate a response. We do not use your personal annotations or account data to train AI models.' }]},
    { title: '7. Content Sharing and Copyright', paras: [{ text: 'When you share annotations publicly, your shared content may include excerpts of text from library books. You are responsible for ensuring your shared content complies with applicable copyright laws. We reserve the right to remove content that violates applicable laws or our policies.' }]},
    { title: '8. Third-Party Services', paras: [{ text: 'We use the following third-party services to operate the App: Supabase (backend database and authentication), Apple and Google (platform distribution and in-app purchases), RevenueCat (subscription management on iOS and Android), and Stripe (payment processing on the web). These services may process and store your data in accordance with their own privacy policies.' }]},
    { title: '9. Data Storage and Security', paras: [{ text: 'We implement reasonable safeguards to protect your data, including secure data transmission (HTTPS), authentication protections, and controlled access to stored data. However, no system is completely secure, and we cannot guarantee absolute security.' }]},
    { title: '10. Data Retention', paras: [{ text: 'We retain your data for as long as your account is active and as necessary to provide the App’s services. If you delete your account, we will delete or anonymize your data within a reasonable timeframe, except where retention is required by law.' }]},
    { title: '11. Your Rights and Controls', paras: [{ text: 'At any time, you may access, edit, or delete your annotations and content; change content between public and private; or delete your account. For assistance, contact us at support@immerseresearch.app.' }]},
    { title: "12. Children's Privacy", paras: [{ text: 'Immerse is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that such data has been collected, we will delete it promptly.' }]},
    { title: '13. Content Neutrality', paras: [{ text: 'Immerse provides access to a diverse collection of spiritual and philosophical texts from many traditions. We do not endorse any specific belief system or any particular interpretation of these texts. User-generated content reflects the views of individual users, not Immerse Research.' }]},
    { title: '14. Exported Data', paras: [{ text: 'The App allows you to export your annotations and reading data. Once exported, that data is outside our control and we are not responsible for how it is used, shared, or stored.' }]},
    { title: '15. Changes to This Policy', paras: [{ text: 'We may update this Privacy Policy from time to time. Changes will be reflected by updating the “Effective Date” above. Continued use of the App constitutes acceptance of the updated policy.' }]},
    { title: '16. Contact Us', paras: [{ text: 'If you have any questions about this Privacy Policy, contact us at: support@immerseresearch.app' }]},
  ],

  termsTitle: 'Terms of Service for Immerse',
  termsIntro: 'Welcome to Immerse, developed by Immerse Research. These Terms of Service (“Terms”) govern your use of the Immerse application (the “App”) on iOS, Android, and the web. By accessing or using the App, you agree to be bound by these Terms. If you do not agree, do not use the App.',
  termsSections: [
    { title: '1. Eligibility', paras: [{ text: 'You must be at least 13 years old to use the App.' }]},
    { title: '2. Account Registration', paras: [{ text: 'To access annotation and community features, you must create an account. You agree to provide accurate and complete information, maintain the confidentiality of your login credentials, and be responsible for all activity under your account. You may also use Immerse as a guest, which provides read-only access to the library.' }]},
    { title: '3. Description of the App', paras: [{ text: 'Immerse provides: a curated, multi-tradition library of spiritual, religious, philosophical, and historical texts; annotation tools including highlights, tags, notes, and cross-references (“Xrefs”); cross-device sync of reading progress and annotations (Standard and Pro accounts); a community feature for discovering and sharing public annotations; AI-powered passage summaries (Pro); and the ability to import your own EPUB or text files (Pro).' }]},
    { title: '4. Subscription Tiers', paras: [
      { label: 'Guest', text: 'Read the full library and share quotes. No account required.' },
      { label: 'Standard (free with account)', text: 'All annotation features, cross-device sync, and content export.' },
      { label: 'Pro ($0.99/month)', text: 'AI summaries, book import, and the ability to post to the community.' },
      { text: 'Subscriptions are managed through Apple In-App Purchase and RevenueCat (iOS and Android) or Stripe (web). Billing, refunds, and cancellations are handled by the respective platform provider.' },
    ]},
    { title: '5. User Content', paras: [{ text: 'You retain ownership of all content you create in the App. By using the App, you grant Immerse Research a limited, non-exclusive license to store, process, and display your content solely to operate the App. If you make content public, it may be viewed by other Immerse users and associated with your username.' }]},
    { title: '6. Discover Feature', paras: [{ text: 'You are solely responsible for content you make public. You agree not to post content that violates any applicable law, infringes intellectual property rights, is abusive, defamatory, hateful, or harmful, or is otherwise offensive or inappropriate. We reserve the right to remove any public content and to restrict or terminate accounts that violate these Terms.' }]},
    { title: '7. Intellectual Property', paras: [{ text: 'The texts in the Immerse library are either in the public domain or used with permission. We do not claim ownership of these works. You agree not to upload or share content you do not have the legal right to use. If you believe content in the App infringes your rights, contact us at support@immerseresearch.app.' }]},
    { title: '8. User-Imported Content', paras: [{ text: 'Pro subscribers may import their own books or documents. Imported files and their annotations remain on your device only and are not synced to our servers. You are responsible for ensuring you have the legal right to use and store any imported content. We do not verify ownership or licensing of imported materials.' }]},
    { title: '9. Acceptable Use', paras: [{ text: "You agree not to use the App for unlawful purposes, interfere with the operation or security of the App, attempt to access other users' private data without authorization, or abuse the Discover feature." }]},
    { title: '10. Privacy', paras: [{ text: 'Your use of the App is also governed by our Privacy Policy above, which is incorporated into these Terms by reference.' }]},
    { title: '11. Termination', paras: [{ text: "We may suspend or terminate your account if you violate these Terms. You may delete your account at any time through the App's settings." }]},
    { title: '12. Disclaimers', paras: [{ text: 'The App is provided “as is” without warranties of any kind. We do not guarantee the accuracy or completeness of library content, uninterrupted availability of the App or its AI features, or that user-generated or community content is reliable or appropriate.' }]},
    { title: '13. Limitation of Liability', paras: [{ text: 'To the maximum extent permitted by law, Immerse Research shall not be liable for indirect, incidental, or consequential damages, loss of annotation data or content, or issues arising from user-generated or public content.' }]},
    { title: '14. Content Neutrality', paras: [{ text: 'Immerse provides access to a wide range of spiritual and philosophical texts from diverse traditions. We do not endorse any particular belief system or any interpretation of these texts. User-generated content reflects the views of individual users, not Immerse Research.' }]},
    { title: '15. Changes to These Terms', paras: [{ text: 'We may update these Terms at any time. Continued use of the App constitutes acceptance of the updated Terms. Material changes will be reflected by updating the “Effective Date.”' }]},
    { title: '16. Governing Law', paras: [{ text: 'These Terms are governed by and interpreted in accordance with the laws of the Province of British Columbia, Canada.' }]},
    { title: '17. Contact', paras: [{ text: 'If you have any questions about these Terms, contact us at: support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Community Guidelines',
  guidelinesIntro: "Welcome to the Immerse community — a space for cross-tradition reading, reflection, and the sharing of insights from humanity's spiritual heritage.",
  guidelines: [
    { title: 'Be Respectful', text: 'Treat all traditions, texts, and fellow readers with genuine respect. Harassment, insults, and dismissive remarks have no place here.' },
    { title: 'Share Thoughtfully', text: 'Share highlights, tags, and reflections that invite meaningful engagement. Focus on insight rather than argument.' },
    { title: 'Honour Diverse Perspectives', text: 'Immerse brings together readers from many traditions and backgrounds. Approach differences with curiosity and humility. Respectful disagreement is welcome; mockery and hostility are not.' },
    { title: 'Share Responsibly', text: 'Only share content you have the right to share. Keep quotations from library texts reasonable in length. Respect copyright and intellectual property.' },
    { title: 'Engage in Good Faith', text: 'Use the community to connect with other readers over shared texts. Avoid promoting unrelated agendas or distributing spam. Quality over quantity.' },
  ],
};

// ─── Spanish (courtesy translation) ──────────────────────────────────────────

const legalEs: LegalContent = {
  back: '← Volver a Immerse',
  legalHeading: 'Legal',
  effectiveDate: 'Fecha de entrada en vigor: 4 de junio de 2026',
  otherLanguage: 'English',

  privacyTitle: 'Política de privacidad de Immerse',
  privacyIntro: [
    'Immerse Research («nosotros» o «nuestro») opera la aplicación Immerse (la «App»). Respetamos tu privacidad y nos comprometemos a proteger tu información personal. Esta Política de privacidad explica cómo recopilamos, usamos, almacenamos y compartimos información cuando usas Immerse en iOS, Android y la web.',
    'Al usar la App, aceptas la recopilación y el uso de la información según lo descrito en esta Política de privacidad.',
  ],
  privacySections: [
    { title: '1. Información que recopilamos', paras: [
      { label: '1.1 Información de la cuenta', text: 'Cuando creas una cuenta, podemos recopilar tu nombre completo, un nombre de usuario único, tu dirección de correo electrónico y tu contraseña (gestionada de forma segura mediante servicios de autenticación). También puedes usar Immerse como invitado sin crear una cuenta.' },
      { label: '1.2 Datos de anotaciones y lectura', text: 'Recopilamos y almacenamos el contenido que creas dentro de la App, incluidos los textos subrayados y las selecciones, las etiquetas y notas, las remisiones entre pasajes («Remisiones») y tu progreso y preferencias de lectura.' },
      { label: '1.3 Contenido público', text: 'Si decides compartir contenido con la comunidad de Immerse, tus etiquetas, notas y remisiones pueden ser visibles para otros usuarios, y tu nombre de usuario se mostrará junto a ese contenido.' },
      { label: '1.4 Libros importados', text: 'Los suscriptores de Immerse Pro pueden importar sus propios archivos (por ejemplo, EPUB o archivos de texto). Los libros importados y cualquier anotación realizada sobre ellos se almacenan únicamente de forma local en tu dispositivo y nunca se suben a nuestros servidores.' },
      { label: '1.5 Información de suscripción y pago', text: 'Si te suscribes a Immerse Pro, los pagos son procesados por proveedores externos: Apple In-App Purchase y RevenueCat en iOS y Android, y Stripe en la web. No almacenamos ni procesamos directamente la información de tu tarjeta de pago.' },
      { label: '1.6 Datos de uso', text: 'Podemos recopilar datos técnicos limitados para mejorar la App, incluidas métricas de rendimiento, el tipo de dispositivo y sistema operativo, y patrones generales de interacción.' },
    ]},
    { title: '2. Cómo usamos tu información', paras: [{ text: 'Usamos la información recopilada para ofrecer, operar y mejorar la App; sincronizar tu progreso de lectura y tus anotaciones entre dispositivos; habilitar las funciones de la comunidad; gestionar las suscripciones y los permisos; y responder a las solicitudes de soporte. No vendemos tus datos personales.' }]},
    { title: '3. Contenido público frente a privado', paras: [{ text: 'Todas tus anotaciones y datos de lectura son privados de forma predeterminada. Puedes optar por hacer público cierto contenido. El contenido público puede ser visto por cualquier usuario de Immerse, puede incluir fragmentos de texto de los libros de la biblioteca y estará asociado a tu nombre de usuario. Una vez publicado, no podemos garantizar un control completo sobre cómo otros usuarios usan o comparten ese contenido.' }]},
    { title: '4. La biblioteca de Immerse', paras: [{ text: 'La App incluye una biblioteca seleccionada de textos espirituales, religiosos, filosóficos e históricos de diversas tradiciones de todo el mundo. Estos textos se proporcionan únicamente para estudio personal y uso educativo. Immerse Research no reclama la propiedad de estas obras. Todos los textos son de dominio público o se usan con la autorización correspondiente.' }]},
    { title: '5. Contenido importado por el usuario', paras: [{ text: 'Los suscriptores Pro pueden importar sus propios libros o documentos. Los archivos importados y cualquier anotación realizada sobre ellos se almacenan únicamente de forma local en tu dispositivo; no se sincronizan con nuestros servidores. Al importar contenido, reconoces que eres el único responsable de cualquier contenido que importes, que debes tener el derecho legal de usar y almacenar ese contenido, y que Immerse Research no verifica la propiedad ni las licencias de los materiales importados.' }]},
    { title: '6. Funciones de IA', paras: [{ text: 'Immerse Pro incluye funciones con IA, como los resúmenes de pasajes. Cuando usas estas funciones, el texto del pasaje correspondiente puede ser procesado por servicios de IA para generar una respuesta. No usamos tus anotaciones personales ni los datos de tu cuenta para entrenar modelos de IA.' }]},
    { title: '7. Compartir contenido y derechos de autor', paras: [{ text: 'Cuando compartes anotaciones públicamente, el contenido compartido puede incluir fragmentos de texto de los libros de la biblioteca. Eres responsable de garantizar que el contenido que compartes cumple con las leyes de derechos de autor aplicables. Nos reservamos el derecho de eliminar contenido que infrinja las leyes aplicables o nuestras políticas.' }]},
    { title: '8. Servicios de terceros', paras: [{ text: 'Usamos los siguientes servicios de terceros para operar la App: Supabase (base de datos y autenticación), Apple y Google (distribución en las plataformas y compras dentro de la app), RevenueCat (gestión de suscripciones en iOS y Android) y Stripe (procesamiento de pagos en la web). Estos servicios pueden procesar y almacenar tus datos de acuerdo con sus propias políticas de privacidad.' }]},
    { title: '9. Almacenamiento y seguridad de los datos', paras: [{ text: 'Implementamos medidas razonables para proteger tus datos, incluidas la transmisión segura (HTTPS), protecciones de autenticación y acceso controlado a los datos almacenados. Sin embargo, ningún sistema es completamente seguro y no podemos garantizar una seguridad absoluta.' }]},
    { title: '10. Conservación de los datos', paras: [{ text: 'Conservamos tus datos mientras tu cuenta esté activa y según sea necesario para prestar los servicios de la App. Si eliminas tu cuenta, eliminaremos o anonimizaremos tus datos en un plazo razonable, salvo cuando la ley exija su conservación.' }]},
    { title: '11. Tus derechos y controles', paras: [{ text: 'En cualquier momento puedes acceder, editar o eliminar tus anotaciones y contenido; cambiar el contenido entre público y privado; o eliminar tu cuenta. Para obtener ayuda, escríbenos a support@immerseresearch.app.' }]},
    { title: '12. Privacidad de los menores', paras: [{ text: 'Immerse no está dirigida a menores de 13 años. No recopilamos a sabiendas información personal de menores de 13 años. Si detectamos que se han recopilado dichos datos, los eliminaremos de inmediato.' }]},
    { title: '13. Neutralidad de contenido', paras: [{ text: 'Immerse ofrece acceso a una colección diversa de textos espirituales y filosóficos de muchas tradiciones. No respaldamos ningún sistema de creencias concreto ni ninguna interpretación particular de estos textos. El contenido generado por los usuarios refleja las opiniones de cada usuario, no las de Immerse Research.' }]},
    { title: '14. Datos exportados', paras: [{ text: 'La App te permite exportar tus anotaciones y datos de lectura. Una vez exportados, esos datos quedan fuera de nuestro control y no somos responsables de cómo se usan, comparten o almacenan.' }]},
    { title: '15. Cambios en esta política', paras: [{ text: 'Podemos actualizar esta Política de privacidad de vez en cuando. Los cambios se reflejarán al actualizar la «Fecha de entrada en vigor» que aparece arriba. El uso continuado de la App constituye la aceptación de la política actualizada.' }]},
    { title: '16. Contacto', paras: [{ text: 'Si tienes alguna pregunta sobre esta Política de privacidad, escríbenos a: support@immerseresearch.app' }]},
  ],

  termsTitle: 'Términos del servicio de Immerse',
  termsIntro: 'Te damos la bienvenida a Immerse, desarrollada por Immerse Research. Estos Términos del servicio («Términos») rigen tu uso de la aplicación Immerse (la «App») en iOS, Android y la web. Al acceder o usar la App, aceptas quedar vinculado por estos Términos. Si no estás de acuerdo, no uses la App.',
  termsSections: [
    { title: '1. Requisitos', paras: [{ text: 'Debes tener al menos 13 años para usar la App.' }]},
    { title: '2. Registro de la cuenta', paras: [{ text: 'Para acceder a las funciones de anotación y de la comunidad, debes crear una cuenta. Aceptas proporcionar información precisa y completa, mantener la confidencialidad de tus credenciales de acceso y ser responsable de toda la actividad de tu cuenta. También puedes usar Immerse como invitado, lo que da acceso de solo lectura a la biblioteca.' }]},
    { title: '3. Descripción de la App', paras: [{ text: 'Immerse ofrece: una biblioteca seleccionada y multitradición de textos espirituales, religiosos, filosóficos e históricos; herramientas de anotación como subrayados, etiquetas, notas y remisiones («Remisiones»); sincronización entre dispositivos del progreso de lectura y las anotaciones (cuentas Estándar y Pro); una función de comunidad para descubrir y compartir anotaciones públicas; resúmenes de pasajes con IA (Pro); y la posibilidad de importar tus propios archivos EPUB o de texto (Pro).' }]},
    { title: '4. Niveles de suscripción', paras: [
      { label: 'Invitado', text: 'Lee toda la biblioteca y comparte citas. No requiere cuenta.' },
      { label: 'Estándar (gratis con cuenta)', text: 'Todas las funciones de anotación, sincronización entre dispositivos y exportación de contenido.' },
      { label: 'Pro (0,99 USD/mes)', text: 'Resúmenes con IA, importación de libros y la posibilidad de publicar en la comunidad.' },
      { text: 'Las suscripciones se gestionan a través de Apple In-App Purchase y RevenueCat (iOS y Android) o Stripe (web). La facturación, los reembolsos y las cancelaciones son gestionados por el proveedor de la plataforma correspondiente.' },
    ]},
    { title: '5. Contenido del usuario', paras: [{ text: 'Conservas la propiedad de todo el contenido que creas en la App. Al usar la App, otorgas a Immerse Research una licencia limitada y no exclusiva para almacenar, procesar y mostrar tu contenido con el único fin de operar la App. Si haces público tu contenido, este puede ser visto por otros usuarios de Immerse y asociado a tu nombre de usuario.' }]},
    { title: '6. Función Descubrir', paras: [{ text: 'Eres el único responsable del contenido que haces público. Aceptas no publicar contenido que infrinja ninguna ley aplicable, vulnere derechos de propiedad intelectual, sea abusivo, difamatorio, odioso o dañino, o que resulte de otro modo ofensivo o inapropiado. Nos reservamos el derecho de eliminar cualquier contenido público y de restringir o cancelar las cuentas que infrinjan estos Términos.' }]},
    { title: '7. Propiedad intelectual', paras: [{ text: 'Los textos de la biblioteca de Immerse son de dominio público o se usan con autorización. No reclamamos la propiedad de estas obras. Aceptas no subir ni compartir contenido que no tengas el derecho legal de usar. Si crees que algún contenido de la App infringe tus derechos, escríbenos a support@immerseresearch.app.' }]},
    { title: '8. Contenido importado por el usuario', paras: [{ text: 'Los suscriptores Pro pueden importar sus propios libros o documentos. Los archivos importados y sus anotaciones permanecen únicamente en tu dispositivo y no se sincronizan con nuestros servidores. Eres responsable de garantizar que tienes el derecho legal de usar y almacenar cualquier contenido importado. No verificamos la propiedad ni las licencias de los materiales importados.' }]},
    { title: '9. Uso aceptable', paras: [{ text: 'Aceptas no usar la App con fines ilícitos, no interferir en el funcionamiento o la seguridad de la App, no intentar acceder sin autorización a los datos privados de otros usuarios y no abusar de la función Descubrir.' }]},
    { title: '10. Privacidad', paras: [{ text: 'Tu uso de la App también se rige por nuestra Política de privacidad anterior, que se incorpora a estos Términos por referencia.' }]},
    { title: '11. Cancelación', paras: [{ text: 'Podemos suspender o cancelar tu cuenta si infringes estos Términos. Puedes eliminar tu cuenta en cualquier momento desde los ajustes de la App.' }]},
    { title: '12. Renuncias de responsabilidad', paras: [{ text: 'La App se ofrece «tal cual», sin garantías de ningún tipo. No garantizamos la exactitud ni la integridad del contenido de la biblioteca, la disponibilidad ininterrumpida de la App o sus funciones de IA, ni que el contenido generado por los usuarios o de la comunidad sea fiable o apropiado.' }]},
    { title: '13. Limitación de responsabilidad', paras: [{ text: 'En la máxima medida permitida por la ley, Immerse Research no será responsable de daños indirectos, incidentales o consecuentes, de la pérdida de datos o contenido de anotaciones, ni de problemas derivados del contenido generado por los usuarios o público.' }]},
    { title: '14. Neutralidad de contenido', paras: [{ text: 'Immerse ofrece acceso a una amplia variedad de textos espirituales y filosóficos de diversas tradiciones. No respaldamos ningún sistema de creencias concreto ni ninguna interpretación de estos textos. El contenido generado por los usuarios refleja las opiniones de cada usuario, no las de Immerse Research.' }]},
    { title: '15. Cambios en estos Términos', paras: [{ text: 'Podemos actualizar estos Términos en cualquier momento. El uso continuado de la App constituye la aceptación de los Términos actualizados. Los cambios importantes se reflejarán al actualizar la «Fecha de entrada en vigor».' }]},
    { title: '16. Legislación aplicable', paras: [{ text: 'Estos Términos se rigen e interpretan de acuerdo con las leyes de la provincia de Columbia Británica, Canadá.' }]},
    { title: '17. Contacto', paras: [{ text: 'Si tienes alguna pregunta sobre estos Términos, escríbenos a: support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Normas de la comunidad',
  guidelinesIntro: 'Te damos la bienvenida a la comunidad de Immerse, un espacio para la lectura entre tradiciones, la reflexión y el intercambio de ideas del patrimonio espiritual de la humanidad.',
  guidelines: [
    { title: 'Sé respetuoso', text: 'Trata todas las tradiciones, los textos y a los demás lectores con auténtico respeto. El acoso, los insultos y los comentarios despectivos no tienen cabida aquí.' },
    { title: 'Comparte con criterio', text: 'Comparte subrayados, etiquetas y reflexiones que inviten a una participación significativa. Prioriza la comprensión antes que la discusión.' },
    { title: 'Honra la diversidad de perspectivas', text: 'Immerse reúne a lectores de muchas tradiciones y orígenes. Aborda las diferencias con curiosidad y humildad. El desacuerdo respetuoso es bienvenido; la burla y la hostilidad, no.' },
    { title: 'Comparte de forma responsable', text: 'Comparte solo contenido que tengas derecho a compartir. Mantén las citas de los textos de la biblioteca en una extensión razonable. Respeta los derechos de autor y la propiedad intelectual.' },
    { title: 'Participa de buena fe', text: 'Usa la comunidad para conectar con otros lectores en torno a textos compartidos. Evita promover agendas ajenas o difundir spam. Calidad antes que cantidad.' },
  ],
};

// ─── Support ─────────────────────────────────────────────────────────────────

const supportEn: SupportContent = {
  back: '← Back to Immerse',
  title: 'Support',
  intro: 'Need help with Immerse? We’re happy to assist. Email us and we’ll get back to you as soon as we can.',
  contactLabel: 'Contact',
  sections: [
    { title: 'Resetting your password', html: 'On the sign-in screen, tap <b>Forgot password?</b> and enter your email. We’ll send a link to set a new password. (Check your spam folder if it doesn’t arrive within a few minutes.)' },
    { title: 'Managing your subscription', html: 'Immerse Pro subscriptions are managed where you bought them: on <b>iOS</b> via your Apple ID subscriptions, on <b>Android</b> via Google Play subscriptions, and on the <b>web</b> from Settings. New accounts include a free trial; you can cancel anytime before it ends to avoid being charged.' },
    { title: 'Deleting your account', html: 'Open <b>Settings</b> in the app and choose <b>Delete Account</b>. This permanently removes your account and the content stored on our servers.' },
    { title: 'Annotations not syncing', html: 'Make sure you’re signed in to the same account on each device and have an internet connection. Your highlights, tags, notes, and reading progress sync automatically. If something still looks off, email us the details and we’ll help.' },
  ],
  privacyLinkIntro: 'See our ',
  privacyLinkText: 'Privacy Policy, Terms of Service, and Community Guidelines',
  privacyTermsTitle: 'Privacy & Terms',
  otherLanguage: 'Español',
};

const supportEs: SupportContent = {
  back: '← Volver a Immerse',
  title: 'Soporte',
  intro: '¿Necesitas ayuda con Immerse? Con gusto te ayudamos. Escríbenos y te responderemos lo antes posible.',
  contactLabel: 'Contacto',
  sections: [
    { title: 'Restablecer tu contraseña', html: 'En la pantalla de inicio de sesión, toca <b>¿Olvidaste tu contraseña?</b> e introduce tu correo. Te enviaremos un enlace para establecer una nueva contraseña. (Revisa tu carpeta de spam si no llega en unos minutos.)' },
    { title: 'Gestionar tu suscripción', html: 'Las suscripciones de Immerse Pro se gestionan donde las compraste: en <b>iOS</b> desde las suscripciones de tu Apple ID, en <b>Android</b> desde las suscripciones de Google Play y en la <b>web</b> desde Ajustes. Las cuentas nuevas incluyen una prueba gratuita; puedes cancelar en cualquier momento antes de que termine para evitar el cobro.' },
    { title: 'Eliminar tu cuenta', html: 'Abre <b>Ajustes</b> en la app y elige <b>Eliminar cuenta</b>. Esto elimina de forma permanente tu cuenta y el contenido almacenado en nuestros servidores.' },
    { title: 'Las anotaciones no se sincronizan', html: 'Asegúrate de haber iniciado sesión con la misma cuenta en cada dispositivo y de tener conexión a internet. Tus subrayados, etiquetas, notas y progreso de lectura se sincronizan automáticamente. Si algo sigue sin funcionar, escríbenos los detalles y te ayudaremos.' },
  ],
  privacyLinkIntro: 'Consulta nuestra ',
  privacyLinkText: 'Política de privacidad, Términos del servicio y Normas de la comunidad',
  privacyTermsTitle: 'Privacidad y Términos',
  otherLanguage: 'English',
};

// ─── exports ─────────────────────────────────────────────────────────────────

export const legalContent: Record<Locale, LegalContent> = { en: legalEn, es: legalEs };
export const supportContent: Record<Locale, SupportContent> = { en: supportEn, es: supportEs };

/** Narrow an arbitrary ?lang value to a supported locale, defaulting to English. */
export function resolveLocale(raw: string | string[] | undefined): Locale {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'es' ? 'es' : 'en';
}

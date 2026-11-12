import type { LegalContent, SupportContent } from '../legalContent';

// French — courtesy translation of the English legal texts and Support page.

export const legal: LegalContent = {
  back: '← Retour à Immerse',
  home: 'Aller sur immerseresearch.app',
  language: 'Langue',
  legalHeading: 'Mentions légales',
  effectiveDate: 'Date d’entrée en vigueur : 4 juin 2026',
  translationNotice: 'Cette traduction est fournie à titre de courtoisie. En cas de divergence, la version anglaise prévaut.',

  privacyTitle: 'Politique de confidentialité d’Immerse',
  privacyIntro: [
    'Immerse Research (« nous ») exploite l’application Immerse (l’« Application »). Nous respectons votre vie privée et nous nous engageons à protéger vos informations personnelles. La présente Politique de confidentialité explique comment nous collectons, utilisons, conservons et partageons des informations lorsque vous utilisez Immerse sur iOS, Android et le web.',
    'En utilisant l’Application, vous acceptez la collecte et l’utilisation des informations décrites dans la présente Politique de confidentialité.',
  ],
  privacySections: [
    { title: '1. Informations que nous collectons', paras: [
      { label: '1.1 Informations de compte', text: 'Lorsque vous créez un compte, nous pouvons collecter le nom complet que vous indiquez, un nom d’utilisateur unique, votre adresse e-mail et votre mot de passe (géré de manière sécurisée par des services d’authentification). Vous pouvez aussi utiliser Immerse en tant qu’invité, sans créer de compte.' },
      { label: '1.2 Données d’annotation et de lecture', text: 'Nous collectons et conservons le contenu que vous créez dans l’Application, notamment les passages surlignés et les sélections, les étiquettes et les notes, les renvois entre passages (« Xrefs »), ainsi que votre progression de lecture et vos préférences.' },
      { label: '1.3 Contenu public', text: 'Si vous choisissez de partager du contenu avec la communauté Immerse, vos étiquettes, notes et Xrefs peuvent être visibles par d’autres utilisateurs, et votre nom d’utilisateur s’affichera à côté de ce contenu.' },
      { label: '1.4 Livres importés', text: 'Les abonnés Immerse Pro peuvent importer leurs propres fichiers (par exemple EPUB ou fichiers texte). Les livres importés et les annotations qui y sont faites sont conservés uniquement en local sur votre appareil et ne sont jamais envoyés sur nos serveurs.' },
      { label: '1.5 Informations d’abonnement et de paiement', text: 'Si vous vous abonnez à Immerse Pro, les paiements sont traités par des prestataires tiers : les achats intégrés d’Apple et RevenueCat sur iOS et Android, et Stripe sur le web. Nous ne conservons ni ne traitons directement les informations de votre carte de paiement.' },
      { label: '1.6 Données d’utilisation', text: 'Nous pouvons collecter des données techniques limitées afin d’améliorer l’Application, notamment des mesures de performance, le type d’appareil et le système d’exploitation, ainsi que des tendances générales d’utilisation.' },
    ]},
    { title: '2. Utilisation de vos informations', paras: [{ text: 'Nous utilisons les informations collectées pour fournir, exploiter et améliorer l’Application ; synchroniser votre progression de lecture et vos annotations entre vos appareils ; permettre les fonctions de partage communautaire ; gérer les abonnements et les droits d’accès ; et répondre aux demandes d’assistance. Nous ne vendons pas vos données personnelles.' }]},
    { title: '3. Contenu public et contenu privé', paras: [{ text: 'Toutes vos annotations et données de lecture sont privées par défaut. Vous pouvez choisir de rendre public un contenu précis. Le contenu public peut être consulté par tout utilisateur d’Immerse, peut comporter des extraits de livres de la bibliothèque et sera associé à votre nom d’utilisateur. Une fois un contenu rendu public, nous ne pouvons pas garantir un contrôle total sur la manière dont d’autres utilisateurs l’utilisent ou le partagent.' }]},
    { title: '4. La bibliothèque Immerse', paras: [{ text: 'L’Application comprend une bibliothèque choisie de textes spirituels, religieux, philosophiques et historiques issus de traditions variées du monde entier. Ces textes sont fournis pour l’étude personnelle et un usage éducatif uniquement. Immerse Research ne revendique pas la propriété de ces œuvres. Tous les textes relèvent du domaine public ou sont utilisés avec l’autorisation appropriée.' }]},
    { title: '5. Contenu importé par l’utilisateur', paras: [{ text: 'Les abonnés Pro peuvent importer leurs propres livres ou documents. Les fichiers importés et les annotations qui y sont faites sont conservés uniquement en local sur votre appareil : ils ne sont pas synchronisés avec nos serveurs. En important du contenu, vous reconnaissez être seul responsable de tout contenu importé, devoir disposer du droit légal d’utiliser et de conserver ce contenu, et qu’Immerse Research ne vérifie ni la propriété ni les licences des documents importés.' }]},
    { title: '6. Fonctions d’IA', paras: [{ text: 'Immerse Pro comprend des fonctions reposant sur l’IA, comme les résumés de passages. Lorsque vous utilisez ces fonctions, le texte du passage concerné peut être traité par des services d’IA afin de générer une réponse. Nous n’utilisons pas vos annotations personnelles ni les données de votre compte pour entraîner des modèles d’IA.' }]},
    { title: '7. Partage de contenu et droit d’auteur', paras: [{ text: 'Lorsque vous partagez publiquement des annotations, le contenu partagé peut comporter des extraits de livres de la bibliothèque. Il vous appartient de veiller à ce que votre contenu partagé respecte les lois applicables en matière de droit d’auteur. Nous nous réservons le droit de supprimer tout contenu contraire aux lois applicables ou à nos règles.' }]},
    { title: '8. Services tiers', paras: [{ text: 'Nous utilisons les services tiers suivants pour exploiter l’Application : Supabase (base de données et authentification), Apple et Google (distribution sur les plateformes et achats intégrés), RevenueCat (gestion des abonnements sur iOS et Android) et Stripe (traitement des paiements sur le web). Ces services peuvent traiter et conserver vos données conformément à leurs propres politiques de confidentialité.' }]},
    { title: '9. Stockage et sécurité des données', paras: [{ text: 'Nous mettons en place des mesures raisonnables pour protéger vos données, notamment la transmission sécurisée (HTTPS), des protections d’authentification et un accès contrôlé aux données conservées. Toutefois, aucun système n’est totalement sûr et nous ne pouvons pas garantir une sécurité absolue.' }]},
    { title: '10. Conservation des données', paras: [{ text: 'Nous conservons vos données tant que votre compte est actif et aussi longtemps que nécessaire pour fournir les services de l’Application. Si vous supprimez votre compte, nous supprimerons ou anonymiserons vos données dans un délai raisonnable, sauf lorsque la loi impose leur conservation.' }]},
    { title: '11. Vos droits et vos choix', paras: [{ text: 'À tout moment, vous pouvez consulter, modifier ou supprimer vos annotations et votre contenu ; faire passer un contenu de public à privé ou inversement ; ou supprimer votre compte. Pour toute aide, écrivez-nous à support@immerseresearch.app.' }]},
    { title: '12. Protection des enfants', paras: [{ text: 'Immerse n’est pas destinée aux enfants de moins de 13 ans. Nous ne collectons pas sciemment d’informations personnelles auprès d’enfants de moins de 13 ans. Si nous apprenons que de telles données ont été collectées, nous les supprimerons rapidement.' }]},
    { title: '13. Neutralité du contenu', paras: [{ text: 'Immerse donne accès à un ensemble varié de textes spirituels et philosophiques issus de nombreuses traditions. Nous n’approuvons aucun système de croyance particulier ni aucune interprétation particulière de ces textes. Le contenu généré par les utilisateurs reflète les opinions de chacun, et non celles d’Immerse Research.' }]},
    { title: '14. Données exportées', paras: [{ text: 'L’Application vous permet d’exporter vos annotations et vos données de lecture. Une fois exportées, ces données échappent à notre contrôle et nous ne sommes pas responsables de la manière dont elles sont utilisées, partagées ou conservées.' }]},
    { title: '15. Modifications de la présente politique', paras: [{ text: 'Nous pouvons mettre à jour la présente Politique de confidentialité de temps à autre. Les modifications seront signalées par la mise à jour de la « Date d’entrée en vigueur » ci-dessus. La poursuite de l’utilisation de l’Application vaut acceptation de la politique mise à jour.' }]},
    { title: '16. Nous contacter', paras: [{ text: 'Pour toute question sur la présente Politique de confidentialité, écrivez-nous à : support@immerseresearch.app' }]},
  ],

  termsTitle: 'Conditions d’utilisation d’Immerse',
  termsIntro: 'Bienvenue sur Immerse, développée par Immerse Research. Les présentes Conditions d’utilisation (les « Conditions ») régissent votre utilisation de l’application Immerse (l’« Application ») sur iOS, Android et le web. En accédant à l’Application ou en l’utilisant, vous acceptez d’être lié par ces Conditions. Si vous ne les acceptez pas, n’utilisez pas l’Application.',
  termsSections: [
    { title: '1. Conditions d’âge', paras: [{ text: 'Vous devez avoir au moins 13 ans pour utiliser l’Application.' }]},
    { title: '2. Création de compte', paras: [{ text: 'Pour accéder aux fonctions d’annotation et de communauté, vous devez créer un compte. Vous vous engagez à fournir des informations exactes et complètes, à préserver la confidentialité de vos identifiants et à assumer la responsabilité de toute activité effectuée avec votre compte. Vous pouvez aussi utiliser Immerse en tant qu’invité, ce qui donne un accès en lecture seule à la bibliothèque.' }]},
    { title: '3. Description de l’Application', paras: [{ text: 'Immerse propose : une bibliothèque choisie de textes spirituels, religieux, philosophiques et historiques de plusieurs traditions ; des outils d’annotation, dont le surlignage, les étiquettes, les notes et les renvois (« Xrefs ») ; la synchronisation entre appareils de la progression de lecture et des annotations (comptes Standard et Pro) ; une fonction communautaire pour découvrir et partager des annotations publiques ; des résumés de passages par IA (Pro) ; et la possibilité d’importer vos propres fichiers EPUB ou texte (Pro).' }]},
    { title: '4. Formules d’abonnement', paras: [
      { label: 'Invité', text: 'Lisez toute la bibliothèque et partagez des citations. Aucun compte nécessaire.' },
      { label: 'Standard (gratuit avec un compte)', text: 'Toutes les fonctions d’annotation, la synchronisation entre appareils et l’export du contenu.' },
      { label: 'Pro (0,99 $/mois)', text: 'Résumés par IA, import de livres et possibilité de publier dans la communauté.' },
      { text: 'Les abonnements sont gérés via les achats intégrés d’Apple et RevenueCat (iOS et Android) ou Stripe (web). La facturation, les remboursements et les résiliations sont gérés par le prestataire de la plateforme concernée.' },
    ]},
    { title: '5. Contenu de l’utilisateur', paras: [{ text: 'Vous restez propriétaire de tout le contenu que vous créez dans l’Application. En utilisant l’Application, vous accordez à Immerse Research une licence limitée et non exclusive pour conserver, traiter et afficher votre contenu dans le seul but de faire fonctionner l’Application. Si vous rendez un contenu public, il peut être consulté par d’autres utilisateurs d’Immerse et associé à votre nom d’utilisateur.' }]},
    { title: '6. Fonction Découvrir', paras: [{ text: 'Vous êtes seul responsable du contenu que vous rendez public. Vous vous engagez à ne pas publier de contenu qui enfreint une loi applicable, porte atteinte à des droits de propriété intellectuelle, est injurieux, diffamatoire, haineux ou nuisible, ou est par ailleurs offensant ou inapproprié. Nous nous réservons le droit de supprimer tout contenu public et de restreindre ou de résilier les comptes qui enfreignent ces Conditions.' }]},
    { title: '7. Propriété intellectuelle', paras: [{ text: 'Les textes de la bibliothèque Immerse relèvent du domaine public ou sont utilisés avec autorisation. Nous ne revendiquons pas la propriété de ces œuvres. Vous vous engagez à ne pas téléverser ni partager de contenu que vous n’avez pas le droit légal d’utiliser. Si vous estimez qu’un contenu de l’Application porte atteinte à vos droits, écrivez-nous à support@immerseresearch.app.' }]},
    { title: '8. Contenu importé par l’utilisateur', paras: [{ text: 'Les abonnés Pro peuvent importer leurs propres livres ou documents. Les fichiers importés et leurs annotations restent uniquement sur votre appareil et ne sont pas synchronisés avec nos serveurs. Il vous appartient de vous assurer que vous avez le droit légal d’utiliser et de conserver tout contenu importé. Nous ne vérifions ni la propriété ni les licences des documents importés.' }]},
    { title: '9. Utilisation acceptable', paras: [{ text: 'Vous vous engagez à ne pas utiliser l’Application à des fins illicites, à ne pas perturber son fonctionnement ou sa sécurité, à ne pas tenter d’accéder sans autorisation aux données privées d’autres utilisateurs et à ne pas faire un usage abusif de la fonction Découvrir.' }]},
    { title: '10. Confidentialité', paras: [{ text: 'Votre utilisation de l’Application est également régie par notre Politique de confidentialité ci-dessus, intégrée aux présentes Conditions par référence.' }]},
    { title: '11. Résiliation', paras: [{ text: 'Nous pouvons suspendre ou résilier votre compte si vous enfreignez ces Conditions. Vous pouvez supprimer votre compte à tout moment depuis les réglages de l’Application.' }]},
    { title: '12. Exclusions de garantie', paras: [{ text: 'L’Application est fournie « en l’état », sans garantie d’aucune sorte. Nous ne garantissons ni l’exactitude ni l’exhaustivité du contenu de la bibliothèque, ni la disponibilité ininterrompue de l’Application ou de ses fonctions d’IA, ni la fiabilité ou le caractère approprié du contenu des utilisateurs ou de la communauté.' }]},
    { title: '13. Limitation de responsabilité', paras: [{ text: 'Dans toute la mesure permise par la loi, Immerse Research ne saurait être tenue responsable des dommages indirects, accessoires ou consécutifs, de la perte de données d’annotation ou de contenu, ni des problèmes liés au contenu des utilisateurs ou au contenu public.' }]},
    { title: '14. Neutralité du contenu', paras: [{ text: 'Immerse donne accès à un large éventail de textes spirituels et philosophiques de traditions diverses. Nous n’approuvons aucun système de croyance particulier ni aucune interprétation de ces textes. Le contenu généré par les utilisateurs reflète les opinions de chacun, et non celles d’Immerse Research.' }]},
    { title: '15. Modifications des présentes Conditions', paras: [{ text: 'Nous pouvons mettre à jour ces Conditions à tout moment. La poursuite de l’utilisation de l’Application vaut acceptation des Conditions mises à jour. Les modifications importantes seront signalées par la mise à jour de la « Date d’entrée en vigueur ».' }]},
    { title: '16. Droit applicable', paras: [{ text: 'Les présentes Conditions sont régies et interprétées conformément aux lois de la province de la Colombie-Britannique, au Canada.' }]},
    { title: '17. Contact', paras: [{ text: 'Pour toute question sur ces Conditions, écrivez-nous à : support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Règles de la communauté',
  guidelinesIntro: 'Bienvenue dans la communauté Immerse, un espace pour lire à travers les traditions, réfléchir et partager des idées issues du patrimoine spirituel de l’humanité.',
  guidelines: [
    { title: 'Soyez respectueux', text: 'Traitez toutes les traditions, tous les textes et tous les autres lecteurs avec un respect sincère. Le harcèlement, les insultes et les remarques méprisantes n’ont pas leur place ici.' },
    { title: 'Partagez avec réflexion', text: 'Partagez des passages surlignés, des étiquettes et des réflexions qui invitent à un échange enrichissant. Privilégiez la compréhension plutôt que la polémique.' },
    { title: 'Respectez la diversité des points de vue', text: 'Immerse réunit des lecteurs de nombreuses traditions et horizons. Abordez les différences avec curiosité et humilité. Le désaccord respectueux est bienvenu ; la moquerie et l’hostilité ne le sont pas.' },
    { title: 'Partagez de manière responsable', text: 'Ne partagez que du contenu que vous avez le droit de partager. Gardez les citations des textes de la bibliothèque d’une longueur raisonnable. Respectez le droit d’auteur et la propriété intellectuelle.' },
    { title: 'Participez de bonne foi', text: 'Utilisez la communauté pour échanger avec d’autres lecteurs autour de textes communs. Évitez de promouvoir des causes sans rapport ou de diffuser du spam. La qualité avant la quantité.' },
  ],
};

export const support: SupportContent = {
  back: '← Retour à Immerse',
  home: 'Aller sur immerseresearch.app',
  language: 'Langue',
  title: 'Assistance',
  intro: 'Besoin d’aide avec Immerse ? Nous sommes là pour vous aider. Écrivez-nous et nous vous répondrons dès que possible.',
  contactLabel: 'Contact',
  sections: [
    { title: 'Réinitialiser votre mot de passe', html: 'Sur l’écran de connexion, touchez <b>Mot de passe oublié ?</b> et saisissez votre adresse e-mail. Nous vous enverrons un lien pour choisir un nouveau mot de passe. (Vérifiez votre dossier de courrier indésirable s’il n’arrive pas dans les minutes qui suivent.)' },
    { title: 'Gérer votre abonnement', html: 'Les abonnements Immerse Pro se gèrent là où vous les avez souscrits : sur <b>iOS</b> dans les abonnements de votre identifiant Apple, sur <b>Android</b> dans les abonnements Google Play, et sur le <b>web</b> depuis les Réglages. Les nouveaux comptes bénéficient d’un essai gratuit ; vous pouvez l’annuler à tout moment avant la fin pour ne pas être débité.' },
    { title: 'Supprimer votre compte', html: 'Ouvrez les <b>Réglages</b> dans l’application et choisissez <b>Supprimer le compte</b>. Cela supprime définitivement votre compte et le contenu conservé sur nos serveurs.' },
    { title: 'Les annotations ne se synchronisent pas', html: 'Vérifiez que vous êtes connecté au même compte sur chaque appareil et que vous avez accès à Internet. Vos passages surlignés, compilations, notes, renvois et votre progression de lecture se synchronisent automatiquement. Si quelque chose ne va toujours pas, écrivez-nous en détaillant le problème et nous vous aiderons.' },
  ],
  privacyLinkIntro: 'Consultez notre ',
  privacyLinkText: 'Politique de confidentialité, nos Conditions d’utilisation et nos Règles de la communauté',
  privacyTermsTitle: 'Confidentialité et conditions',
};

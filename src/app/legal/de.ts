import type { LegalContent, SupportContent } from '../legalContent';

// German — courtesy translation of the English legal texts and Support page.

export const legal: LegalContent = {
  back: '← Zurück zu Immerse',
  home: 'Zu immerseresearch.app',
  language: 'Sprache',
  legalHeading: 'Rechtliches',
  effectiveDate: 'Gültig ab: 4. Juni 2026',
  translationNotice: 'Diese Übersetzung dient nur der Information. Bei Abweichungen ist die englische Fassung maßgeblich.',

  privacyTitle: 'Datenschutzerklärung für Immerse',
  privacyIntro: [
    'Immerse Research („wir“, „uns“ oder „unser“) betreibt die Anwendung Immerse (die „App“). Wir respektieren Ihre Privatsphäre und schützen Ihre personenbezogenen Daten. Diese Datenschutzerklärung erläutert, wie wir Informationen erheben, nutzen, speichern und weitergeben, wenn Sie Immerse unter iOS, Android und im Web nutzen.',
    'Durch die Nutzung der App stimmen Sie der Erhebung und Nutzung von Informationen gemäß dieser Datenschutzerklärung zu.',
  ],
  privacySections: [
    { title: '1. Welche Informationen wir erheben', paras: [
      { label: '1.1 Kontoinformationen', text: 'Wenn Sie ein Konto erstellen, können wir den von Ihnen angegebenen vollständigen Namen, einen eindeutigen Benutzernamen, Ihre E-Mail-Adresse und Ihr Passwort (sicher über Authentifizierungsdienste verarbeitet) erheben. Sie können Immerse auch als Gast nutzen, ohne ein Konto zu erstellen.' },
      { label: '1.2 Anmerkungs- und Lesedaten', text: 'Wir erheben und speichern Inhalte, die Sie in der App erstellen, darunter markierten Text und Auswahlen, Tags und Notizen, Querverweise zwischen Textstellen („Xrefs“) sowie Ihren Lesefortschritt und Ihre Einstellungen.' },
      { label: '1.3 Öffentliche Inhalte', text: 'Wenn Sie Inhalte mit der Immerse-Gemeinschaft teilen, können Ihre Tags, Notizen und Xrefs für andere Nutzer sichtbar sein, und Ihr Benutzername wird neben diesen Inhalten angezeigt.' },
      { label: '1.4 Importierte Bücher', text: 'Abonnenten von Immerse Pro können eigene Dateien importieren (z. B. EPUB- oder Textdateien). Importierte Bücher und alle darin gemachten Anmerkungen werden nur lokal auf Ihrem Gerät gespeichert und niemals auf unsere Server hochgeladen.' },
      { label: '1.5 Abonnement- und Zahlungsinformationen', text: 'Wenn Sie Immerse Pro abonnieren, werden Zahlungen von Drittanbietern abgewickelt – über In-App-Käufe von Apple und RevenueCat unter iOS und Android sowie über Stripe im Web. Wir speichern oder verarbeiten Ihre Zahlungskartendaten nicht selbst.' },
      { label: '1.6 Nutzungsdaten', text: 'Wir können begrenzte technische Daten erheben, um die App zu verbessern, darunter Leistungskennzahlen, Gerätetyp und Betriebssystem sowie allgemeine Nutzungsmuster.' },
    ]},
    { title: '2. Wie wir Ihre Informationen nutzen', paras: [{ text: 'Wir nutzen die erhobenen Informationen, um die App bereitzustellen, zu betreiben und zu verbessern; Ihren Lesefortschritt und Ihre Anmerkungen geräteübergreifend zu synchronisieren; Funktionen zum Teilen in der Gemeinschaft zu ermöglichen; Abonnements und Berechtigungen zu verwalten; und Supportanfragen zu beantworten. Wir verkaufen Ihre personenbezogenen Daten nicht.' }]},
    { title: '3. Öffentliche und private Inhalte', paras: [{ text: 'Alle Ihre Anmerkungen und Lesedaten sind standardmäßig privat. Sie können bestimmte Inhalte öffentlich machen. Öffentliche Inhalte können von allen Immerse-Nutzern angesehen werden, können Auszüge aus Büchern der Bibliothek enthalten und werden mit Ihrem Benutzernamen verknüpft. Sobald Inhalte öffentlich sind, können wir nicht vollständig kontrollieren, wie andere Nutzer sie verwenden oder weitergeben.' }]},
    { title: '4. Die Immerse-Bibliothek', paras: [{ text: 'Die App enthält eine kuratierte Bibliothek spiritueller, religiöser, philosophischer und historischer Texte aus vielfältigen Traditionen weltweit. Diese Texte dienen ausschließlich dem persönlichen Studium und Bildungszwecken. Immerse Research beansprucht kein Eigentum an diesen Werken. Alle Texte sind gemeinfrei oder werden mit entsprechender Genehmigung verwendet.' }]},
    { title: '5. Von Nutzern importierte Inhalte', paras: [{ text: 'Pro-Abonnenten können eigene Bücher oder Dokumente importieren. Importierte Dateien und alle darin gemachten Anmerkungen werden nur lokal auf Ihrem Gerät gespeichert – sie werden nicht mit unseren Servern synchronisiert. Mit dem Import erkennen Sie an, dass Sie allein für alle importierten Inhalte verantwortlich sind, dass Sie das gesetzliche Recht zur Nutzung und Speicherung dieser Inhalte besitzen müssen und dass Immerse Research Eigentum oder Lizenzen importierter Materialien nicht prüft.' }]},
    { title: '6. KI-Funktionen', paras: [{ text: 'Immerse Pro enthält KI-gestützte Funktionen wie Zusammenfassungen von Textstellen. Wenn Sie diese Funktionen nutzen, kann der betreffende Text von KI-Diensten verarbeitet werden, um eine Antwort zu erzeugen. Wir verwenden Ihre persönlichen Anmerkungen oder Kontodaten nicht zum Training von KI-Modellen.' }]},
    { title: '7. Teilen von Inhalten und Urheberrecht', paras: [{ text: 'Wenn Sie Anmerkungen öffentlich teilen, können Ihre geteilten Inhalte Auszüge aus Büchern der Bibliothek enthalten. Sie sind dafür verantwortlich, dass Ihre geteilten Inhalte dem geltenden Urheberrecht entsprechen. Wir behalten uns vor, Inhalte zu entfernen, die gegen geltendes Recht oder unsere Richtlinien verstoßen.' }]},
    { title: '8. Dienste Dritter', paras: [{ text: 'Wir nutzen folgende Dienste Dritter für den Betrieb der App: Supabase (Backend-Datenbank und Authentifizierung), Apple und Google (Vertrieb über die Plattformen und In-App-Käufe), RevenueCat (Abonnementverwaltung unter iOS und Android) und Stripe (Zahlungsabwicklung im Web). Diese Dienste können Ihre Daten gemäß ihren eigenen Datenschutzrichtlinien verarbeiten und speichern.' }]},
    { title: '9. Datenspeicherung und Sicherheit', paras: [{ text: 'Wir treffen angemessene Vorkehrungen zum Schutz Ihrer Daten, darunter sichere Datenübertragung (HTTPS), Schutzmaßnahmen bei der Authentifizierung und kontrollierten Zugriff auf gespeicherte Daten. Kein System ist jedoch völlig sicher, und wir können keine absolute Sicherheit garantieren.' }]},
    { title: '10. Aufbewahrung von Daten', paras: [{ text: 'Wir bewahren Ihre Daten auf, solange Ihr Konto aktiv ist und soweit dies zur Bereitstellung der Dienste der App erforderlich ist. Wenn Sie Ihr Konto löschen, löschen oder anonymisieren wir Ihre Daten innerhalb eines angemessenen Zeitraums, sofern keine gesetzliche Aufbewahrungspflicht besteht.' }]},
    { title: '11. Ihre Rechte und Einstellungen', paras: [{ text: 'Sie können jederzeit Ihre Anmerkungen und Inhalte einsehen, bearbeiten oder löschen; Inhalte zwischen öffentlich und privat umstellen; oder Ihr Konto löschen. Hilfe erhalten Sie unter support@immerseresearch.app.' }]},
    { title: '12. Datenschutz bei Kindern', paras: [{ text: 'Immerse richtet sich nicht an Kinder unter 13 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Kindern unter 13 Jahren. Sollten wir erfahren, dass solche Daten erhoben wurden, löschen wir sie umgehend.' }]},
    { title: '13. Inhaltliche Neutralität', paras: [{ text: 'Immerse bietet Zugang zu einer vielfältigen Sammlung spiritueller und philosophischer Texte aus vielen Traditionen. Wir befürworten kein bestimmtes Glaubenssystem und keine bestimmte Auslegung dieser Texte. Von Nutzern erstellte Inhalte geben die Ansichten der jeweiligen Nutzer wieder, nicht die von Immerse Research.' }]},
    { title: '14. Exportierte Daten', paras: [{ text: 'Die App ermöglicht Ihnen, Ihre Anmerkungen und Lesedaten zu exportieren. Nach dem Export liegen diese Daten außerhalb unserer Kontrolle, und wir sind nicht dafür verantwortlich, wie sie verwendet, geteilt oder gespeichert werden.' }]},
    { title: '15. Änderungen dieser Erklärung', paras: [{ text: 'Wir können diese Datenschutzerklärung von Zeit zu Zeit aktualisieren. Änderungen werden durch Aktualisierung des obigen Datums „Gültig ab“ kenntlich gemacht. Die weitere Nutzung der App gilt als Zustimmung zur aktualisierten Erklärung.' }]},
    { title: '16. Kontakt', paras: [{ text: 'Bei Fragen zu dieser Datenschutzerklärung erreichen Sie uns unter: support@immerseresearch.app' }]},
  ],

  termsTitle: 'Nutzungsbedingungen für Immerse',
  termsIntro: 'Willkommen bei Immerse, entwickelt von Immerse Research. Diese Nutzungsbedingungen (die „Bedingungen“) regeln Ihre Nutzung der Anwendung Immerse (die „App“) unter iOS, Android und im Web. Durch den Zugriff auf die App oder ihre Nutzung erklären Sie sich mit diesen Bedingungen einverstanden. Wenn Sie nicht einverstanden sind, nutzen Sie die App nicht.',
  termsSections: [
    { title: '1. Teilnahmeberechtigung', paras: [{ text: 'Sie müssen mindestens 13 Jahre alt sein, um die App zu nutzen.' }]},
    { title: '2. Kontoregistrierung', paras: [{ text: 'Für Anmerkungs- und Gemeinschaftsfunktionen müssen Sie ein Konto erstellen. Sie verpflichten sich, zutreffende und vollständige Angaben zu machen, Ihre Zugangsdaten vertraulich zu behandeln und für alle Aktivitäten unter Ihrem Konto verantwortlich zu sein. Sie können Immerse auch als Gast nutzen; damit haben Sie lesenden Zugriff auf die Bibliothek.' }]},
    { title: '3. Beschreibung der App', paras: [{ text: 'Immerse bietet: eine kuratierte Bibliothek spiritueller, religiöser, philosophischer und historischer Texte aus mehreren Traditionen; Anmerkungswerkzeuge wie Markierungen, Tags, Notizen und Querverweise („Xrefs“); geräteübergreifende Synchronisierung von Lesefortschritt und Anmerkungen (Standard- und Pro-Konten); eine Gemeinschaftsfunktion zum Entdecken und Teilen öffentlicher Anmerkungen; KI-gestützte Zusammenfassungen von Textstellen (Pro); und die Möglichkeit, eigene EPUB- oder Textdateien zu importieren (Pro).' }]},
    { title: '4. Abonnementstufen', paras: [
      { label: 'Gast', text: 'Lesen Sie die gesamte Bibliothek und teilen Sie Zitate. Kein Konto erforderlich.' },
      { label: 'Standard (kostenlos mit Konto)', text: 'Alle Anmerkungsfunktionen, geräteübergreifende Synchronisierung und Export von Inhalten.' },
      { label: 'Pro (0,99 $/Monat)', text: 'KI-Zusammenfassungen, Import von Büchern und die Möglichkeit, in der Gemeinschaft zu veröffentlichen.' },
      { text: 'Abonnements werden über In-App-Käufe von Apple und RevenueCat (iOS und Android) oder Stripe (Web) verwaltet. Abrechnung, Erstattungen und Kündigungen werden vom jeweiligen Plattformanbieter abgewickelt.' },
    ]},
    { title: '5. Nutzerinhalte', paras: [{ text: 'Sie bleiben Eigentümer aller Inhalte, die Sie in der App erstellen. Durch die Nutzung der App gewähren Sie Immerse Research eine beschränkte, nicht ausschließliche Lizenz, Ihre Inhalte ausschließlich zum Betrieb der App zu speichern, zu verarbeiten und anzuzeigen. Wenn Sie Inhalte öffentlich machen, können sie von anderen Immerse-Nutzern angesehen und mit Ihrem Benutzernamen verknüpft werden.' }]},
    { title: '6. Funktion „Entdecken“', paras: [{ text: 'Sie sind allein verantwortlich für Inhalte, die Sie öffentlich machen. Sie verpflichten sich, keine Inhalte zu veröffentlichen, die gegen geltendes Recht verstoßen, geistige Eigentumsrechte verletzen, beleidigend, verleumderisch, hasserfüllt oder schädlich oder anderweitig anstößig oder unangemessen sind. Wir behalten uns vor, öffentliche Inhalte zu entfernen und Konten, die gegen diese Bedingungen verstoßen, einzuschränken oder zu sperren.' }]},
    { title: '7. Geistiges Eigentum', paras: [{ text: 'Die Texte in der Immerse-Bibliothek sind gemeinfrei oder werden mit Genehmigung verwendet. Wir beanspruchen kein Eigentum an diesen Werken. Sie verpflichten sich, keine Inhalte hochzuladen oder zu teilen, zu deren Nutzung Sie nicht berechtigt sind. Wenn Sie der Ansicht sind, dass Inhalte in der App Ihre Rechte verletzen, wenden Sie sich an support@immerseresearch.app.' }]},
    { title: '8. Von Nutzern importierte Inhalte', paras: [{ text: 'Pro-Abonnenten können eigene Bücher oder Dokumente importieren. Importierte Dateien und ihre Anmerkungen verbleiben nur auf Ihrem Gerät und werden nicht mit unseren Servern synchronisiert. Sie sind dafür verantwortlich, dass Sie zur Nutzung und Speicherung importierter Inhalte berechtigt sind. Wir prüfen Eigentum oder Lizenzen importierter Materialien nicht.' }]},
    { title: '9. Zulässige Nutzung', paras: [{ text: 'Sie verpflichten sich, die App nicht für rechtswidrige Zwecke zu nutzen, den Betrieb oder die Sicherheit der App nicht zu stören, nicht unbefugt auf private Daten anderer Nutzer zuzugreifen und die Funktion „Entdecken“ nicht zu missbrauchen.' }]},
    { title: '10. Datenschutz', paras: [{ text: 'Ihre Nutzung der App unterliegt außerdem unserer obigen Datenschutzerklärung, die durch Verweis Bestandteil dieser Bedingungen ist.' }]},
    { title: '11. Kündigung', paras: [{ text: 'Wir können Ihr Konto sperren oder kündigen, wenn Sie gegen diese Bedingungen verstoßen. Sie können Ihr Konto jederzeit in den Einstellungen der App löschen.' }]},
    { title: '12. Haftungsausschlüsse', paras: [{ text: 'Die App wird „wie besehen“ und ohne jegliche Gewährleistung bereitgestellt. Wir garantieren weder die Richtigkeit oder Vollständigkeit der Inhalte der Bibliothek noch die ununterbrochene Verfügbarkeit der App oder ihrer KI-Funktionen, noch dass von Nutzern erstellte oder gemeinschaftliche Inhalte zuverlässig oder angemessen sind.' }]},
    { title: '13. Haftungsbeschränkung', paras: [{ text: 'Soweit gesetzlich zulässig, haftet Immerse Research nicht für indirekte, beiläufige oder Folgeschäden, für den Verlust von Anmerkungsdaten oder Inhalten oder für Probleme, die sich aus von Nutzern erstellten oder öffentlichen Inhalten ergeben.' }]},
    { title: '14. Inhaltliche Neutralität', paras: [{ text: 'Immerse bietet Zugang zu einem breiten Spektrum spiritueller und philosophischer Texte aus verschiedenen Traditionen. Wir befürworten kein bestimmtes Glaubenssystem und keine Auslegung dieser Texte. Von Nutzern erstellte Inhalte geben die Ansichten der jeweiligen Nutzer wieder, nicht die von Immerse Research.' }]},
    { title: '15. Änderungen dieser Bedingungen', paras: [{ text: 'Wir können diese Bedingungen jederzeit aktualisieren. Die weitere Nutzung der App gilt als Zustimmung zu den aktualisierten Bedingungen. Wesentliche Änderungen werden durch Aktualisierung des Datums „Gültig ab“ kenntlich gemacht.' }]},
    { title: '16. Anwendbares Recht', paras: [{ text: 'Diese Bedingungen unterliegen den Gesetzen der Provinz British Columbia, Kanada, und werden nach diesen ausgelegt.' }]},
    { title: '17. Kontakt', paras: [{ text: 'Bei Fragen zu diesen Bedingungen erreichen Sie uns unter: support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Gemeinschaftsrichtlinien',
  guidelinesIntro: 'Willkommen in der Immerse-Gemeinschaft – einem Ort für traditionsübergreifendes Lesen, Nachdenken und das Teilen von Einsichten aus dem spirituellen Erbe der Menschheit.',
  guidelines: [
    { title: 'Seien Sie respektvoll', text: 'Begegnen Sie allen Traditionen, Texten und anderen Lesern mit aufrichtigem Respekt. Belästigung, Beleidigungen und herablassende Bemerkungen haben hier keinen Platz.' },
    { title: 'Teilen Sie mit Bedacht', text: 'Teilen Sie Markierungen, Tags und Gedanken, die zu einem sinnvollen Austausch einladen. Setzen Sie auf Einsicht statt auf Streit.' },
    { title: 'Achten Sie unterschiedliche Sichtweisen', text: 'Immerse bringt Leser aus vielen Traditionen und Hintergründen zusammen. Begegnen Sie Unterschieden mit Neugier und Demut. Respektvoller Widerspruch ist willkommen; Spott und Feindseligkeit nicht.' },
    { title: 'Teilen Sie verantwortungsvoll', text: 'Teilen Sie nur Inhalte, die Sie teilen dürfen. Halten Sie Zitate aus Texten der Bibliothek in angemessener Länge. Achten Sie Urheberrecht und geistiges Eigentum.' },
    { title: 'Handeln Sie in gutem Glauben', text: 'Nutzen Sie die Gemeinschaft, um sich mit anderen Lesern über gemeinsame Texte auszutauschen. Werben Sie nicht für fremde Anliegen und verbreiten Sie keinen Spam. Qualität vor Quantität.' },
  ],
};

export const support: SupportContent = {
  back: '← Zurück zu Immerse',
  home: 'Zu immerseresearch.app',
  language: 'Sprache',
  title: 'Support',
  intro: 'Brauchen Sie Hilfe mit Immerse? Wir helfen gern. Schreiben Sie uns eine E-Mail, und wir melden uns so bald wie möglich.',
  contactLabel: 'Kontakt',
  sections: [
    { title: 'Passwort zurücksetzen', html: 'Tippen Sie auf dem Anmeldebildschirm auf <b>Passwort vergessen?</b> und geben Sie Ihre E-Mail-Adresse ein. Wir senden Ihnen einen Link, mit dem Sie ein neues Passwort festlegen können. (Sehen Sie im Spam-Ordner nach, falls die E-Mail nicht innerhalb weniger Minuten ankommt.)' },
    { title: 'Abonnement verwalten', html: 'Immerse-Pro-Abonnements werden dort verwaltet, wo Sie sie abgeschlossen haben: unter <b>iOS</b> in den Abonnements Ihrer Apple-ID, unter <b>Android</b> in den Google-Play-Abonnements und im <b>Web</b> in den Einstellungen. Neue Konten enthalten einen kostenlosen Testzeitraum; Sie können jederzeit vor dessen Ende kündigen, damit keine Kosten entstehen.' },
    { title: 'Konto löschen', html: 'Öffnen Sie in der App die <b>Einstellungen</b> und wählen Sie <b>Konto löschen</b>. Dadurch werden Ihr Konto und die auf unseren Servern gespeicherten Inhalte dauerhaft entfernt.' },
    { title: 'Anmerkungen werden nicht synchronisiert', html: 'Achten Sie darauf, dass Sie auf jedem Gerät mit demselben Konto angemeldet sind und eine Internetverbindung haben. Ihre Markierungen, Zusammenstellungen, Notizen, Querverweise und Ihr Lesefortschritt werden automatisch synchronisiert. Wenn trotzdem etwas nicht stimmt, schreiben Sie uns die Einzelheiten, und wir helfen Ihnen.' },
  ],
  privacyLinkIntro: 'Siehe unsere ',
  privacyLinkText: 'Datenschutzerklärung, Nutzungsbedingungen und Gemeinschaftsrichtlinien',
  privacyTermsTitle: 'Datenschutz und Bedingungen',
};

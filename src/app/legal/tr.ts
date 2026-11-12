import type { LegalContent, SupportContent } from '../legalContent';

// Turkish — courtesy translation of the English legal texts and Support page.

export const legal: LegalContent = {
  back: '← Immerse’e dön',
  home: 'immerseresearch.app’e git',
  language: 'Dil',
  legalHeading: 'Yasal',
  effectiveDate: 'Yürürlük tarihi: 4 Haziran 2026',
  translationNotice: 'Bu çeviri bilgi amaçlı sunulmuştur. Herhangi bir farklılık olması hâlinde İngilizce metin esas alınır.',

  privacyTitle: 'Immerse Gizlilik Politikası',
  privacyIntro: [
    'Immerse Research (“biz”) Immerse uygulamasını (“Uygulama”) işletir. Gizliliğinize saygı duyuyor ve kişisel bilgilerinizi korumayı taahhüt ediyoruz. Bu Gizlilik Politikası, Immerse’ü iOS, Android ve web üzerinde kullandığınızda bilgileri nasıl topladığımızı, kullandığımızı, sakladığımızı ve paylaştığımızı açıklar.',
    'Uygulamayı kullanarak bilgilerin bu Gizlilik Politikası’nda açıklandığı şekilde toplanmasını ve kullanılmasını kabul etmiş olursunuz.',
  ],
  privacySections: [
    { title: '1. Topladığımız bilgiler', paras: [
      { label: '1.1 Hesap bilgileri', text: 'Bir hesap oluşturduğunuzda verdiğiniz tam adı, benzersiz bir kullanıcı adını, e-posta adresinizi ve parolanızı (kimlik doğrulama hizmetleri aracılığıyla güvenli biçimde işlenir) toplayabiliriz. Immerse’ü hesap oluşturmadan misafir olarak da kullanabilirsiniz.' },
      { label: '1.2 Not ve okuma verileri', text: 'Uygulamada oluşturduğunuz içeriği toplar ve saklarız; vurgulanan metinler ve seçimler, etiketler ve notlar, pasajlar arasındaki çapraz referanslar (“Xrefs”) ile okuma ilerlemeniz ve tercihleriniz buna dahildir.' },
      { label: '1.3 Herkese açık içerik', text: 'İçeriği Immerse topluluğuyla paylaşmayı seçerseniz etiketleriniz, notlarınız ve Xrefs’leriniz diğer kullanıcılar tarafından görülebilir ve kullanıcı adınız bu içeriğin yanında gösterilir.' },
      { label: '1.4 İçe aktarılan kitaplar', text: 'Immerse Pro aboneleri kendi dosyalarını (ör. EPUB veya metin dosyaları) içe aktarabilir. İçe aktarılan kitaplar ve bunlara eklenen notlar yalnızca cihazınızda yerel olarak saklanır ve hiçbir zaman sunucularımıza yüklenmez.' },
      { label: '1.5 Abonelik ve ödeme bilgileri', text: 'Immerse Pro’ya abone olursanız ödemeler üçüncü taraf sağlayıcılar tarafından işlenir: iOS ve Android’de Apple uygulama içi satın alma ve RevenueCat, web’de Stripe. Ödeme kartı bilgilerinizi doğrudan saklamaz veya işlemeyiz.' },
      { label: '1.6 Kullanım verileri', text: 'Uygulamayı geliştirmek için performans ölçümleri, cihaz türü ve işletim sistemi ile genel kullanım eğilimleri gibi sınırlı teknik veriler toplayabiliriz.' },
    ]},
    { title: '2. Bilgilerinizi nasıl kullanırız', paras: [{ text: 'Toplanan bilgileri Uygulamayı sunmak, işletmek ve geliştirmek; okuma ilerlemenizi ve notlarınızı cihazlar arasında eşitlemek; topluluk paylaşım özelliklerini sağlamak; abonelik ve erişim haklarını yönetmek; ve destek taleplerini yanıtlamak için kullanırız. Kişisel verilerinizi satmayız.' }]},
    { title: '3. Herkese açık ve özel içerik', paras: [{ text: 'Tüm notlarınız ve okuma verileriniz varsayılan olarak özeldir. Belirli içerikleri herkese açık yapmayı seçebilirsiniz. Herkese açık içerik tüm Immerse kullanıcıları tarafından görülebilir, kütüphanedeki kitaplardan alıntılar içerebilir ve kullanıcı adınızla ilişkilendirilir. İçerik herkese açık yapıldıktan sonra diğer kullanıcıların onu nasıl kullanacağı veya paylaşacağı üzerinde tam denetim sağlayamayız.' }]},
    { title: '4. Immerse kütüphanesi', paras: [{ text: 'Uygulama, dünyanın dört bir yanındaki farklı geleneklerden manevi, dinî, felsefi ve tarihî metinlerden oluşan seçilmiş bir kütüphane içerir. Bu metinler yalnızca kişisel çalışma ve eğitim amaçlı sunulur. Immerse Research bu eserler üzerinde mülkiyet iddia etmez. Tüm metinler ya kamu malıdır ya da uygun izinle kullanılır.' }]},
    { title: '5. Kullanıcının içe aktardığı içerik', paras: [{ text: 'Pro aboneleri kendi kitaplarını veya belgelerini içe aktarabilir. İçe aktarılan dosyalar ve bunlara eklenen notlar yalnızca cihazınızda yerel olarak saklanır; sunucularımızla eşitlenmez. İçerik içe aktararak, içe aktardığınız tüm içerikten yalnızca sizin sorumlu olduğunuzu, bu içeriği kullanma ve saklama konusunda yasal hakka sahip olmanız gerektiğini ve Immerse Research’ün içe aktarılan materyallerin mülkiyetini veya lisansını doğrulamadığını kabul edersiniz.' }]},
    { title: '6. Yapay zekâ özellikleri', paras: [{ text: 'Immerse Pro, pasaj özetleri gibi yapay zekâ destekli özellikler içerir. Bu özellikleri kullandığınızda, yanıt üretmek için ilgili pasaj metni yapay zekâ hizmetleri tarafından işlenebilir. Kişisel notlarınızı veya hesap verilerinizi yapay zekâ modellerini eğitmek için kullanmayız.' }]},
    { title: '7. İçerik paylaşımı ve telif hakkı', paras: [{ text: 'Notlarınızı herkese açık paylaştığınızda, paylaşılan içerik kütüphanedeki kitaplardan alıntılar içerebilir. Paylaştığınız içeriğin geçerli telif hakkı yasalarına uygun olmasını sağlamak sizin sorumluluğunuzdadır. Geçerli yasaları veya politikalarımızı ihlal eden içeriği kaldırma hakkımız saklıdır.' }]},
    { title: '8. Üçüncü taraf hizmetler', paras: [{ text: 'Uygulamayı işletmek için şu üçüncü taraf hizmetleri kullanırız: Supabase (arka uç veritabanı ve kimlik doğrulama), Apple ve Google (platform dağıtımı ve uygulama içi satın almalar), RevenueCat (iOS ve Android’de abonelik yönetimi) ve Stripe (web’de ödeme işleme). Bu hizmetler verilerinizi kendi gizlilik politikalarına uygun olarak işleyebilir ve saklayabilir.' }]},
    { title: '9. Veri depolama ve güvenlik', paras: [{ text: 'Verilerinizi korumak için güvenli veri iletimi (HTTPS), kimlik doğrulama korumaları ve saklanan verilere denetimli erişim gibi makul önlemler alırız. Ancak hiçbir sistem tamamen güvenli değildir ve mutlak güvenliği garanti edemeyiz.' }]},
    { title: '10. Verilerin saklanması', paras: [{ text: 'Verilerinizi hesabınız etkin olduğu sürece ve Uygulamanın hizmetlerini sunmak için gerektiği kadar saklarız. Hesabınızı silerseniz, yasanın saklamayı zorunlu kıldığı durumlar dışında verilerinizi makul bir süre içinde siler veya anonim hâle getiririz.' }]},
    { title: '11. Haklarınız ve denetimleriniz', paras: [{ text: 'İstediğiniz zaman notlarınıza ve içeriğinize erişebilir, bunları düzenleyebilir veya silebilir; içeriği herkese açık ile özel arasında değiştirebilir; ya da hesabınızı silebilirsiniz. Yardım için support@immerseresearch.app adresine yazın.' }]},
    { title: '12. Çocukların gizliliği', paras: [{ text: 'Immerse 13 yaşın altındaki çocuklara yönelik değildir. 13 yaşın altındaki çocuklardan bilerek kişisel bilgi toplamayız. Bu tür verilerin toplandığını fark edersek derhâl sileriz.' }]},
    { title: '13. İçerik tarafsızlığı', paras: [{ text: 'Immerse birçok gelenekten manevi ve felsefi metinlerden oluşan çeşitli bir koleksiyona erişim sunar. Belirli bir inanç sistemini veya bu metinlerin belirli bir yorumunu desteklemeyiz. Kullanıcıların oluşturduğu içerik, Immerse Research’ün değil, her bir kullanıcının görüşlerini yansıtır.' }]},
    { title: '14. Dışa aktarılan veriler', paras: [{ text: 'Uygulama, notlarınızı ve okuma verilerinizi dışa aktarmanıza olanak tanır. Dışa aktarıldıktan sonra bu veriler denetimimiz dışındadır ve nasıl kullanıldığından, paylaşıldığından veya saklandığından sorumlu değiliz.' }]},
    { title: '15. Bu politikadaki değişiklikler', paras: [{ text: 'Bu Gizlilik Politikası’nı zaman zaman güncelleyebiliriz. Değişiklikler yukarıdaki “Yürürlük tarihi” güncellenerek belirtilir. Uygulamayı kullanmaya devam etmeniz, güncellenmiş politikayı kabul ettiğiniz anlamına gelir.' }]},
    { title: '16. Bize ulaşın', paras: [{ text: 'Bu Gizlilik Politikası hakkında sorularınız varsa bize şu adresten ulaşın: support@immerseresearch.app' }]},
  ],

  termsTitle: 'Immerse Hizmet Koşulları',
  termsIntro: 'Immerse Research tarafından geliştirilen Immerse’e hoş geldiniz. Bu Hizmet Koşulları (“Koşullar”), Immerse uygulamasını (“Uygulama”) iOS, Android ve web üzerinde kullanımınızı düzenler. Uygulamaya erişerek veya Uygulamayı kullanarak bu Koşullara bağlı olmayı kabul edersiniz. Kabul etmiyorsanız Uygulamayı kullanmayın.',
  termsSections: [
    { title: '1. Uygunluk', paras: [{ text: 'Uygulamayı kullanmak için en az 13 yaşında olmanız gerekir.' }]},
    { title: '2. Hesap kaydı', paras: [{ text: 'Not alma ve topluluk özelliklerine erişmek için bir hesap oluşturmanız gerekir. Doğru ve eksiksiz bilgi vermeyi, giriş bilgilerinizin gizliliğini korumayı ve hesabınız altındaki tüm etkinliklerden sorumlu olmayı kabul edersiniz. Immerse’ü misafir olarak da kullanabilirsiniz; bu, kütüphaneye salt okunur erişim sağlar.' }]},
    { title: '3. Uygulamanın tanımı', paras: [{ text: 'Immerse şunları sunar: birden çok gelenekten manevi, dinî, felsefi ve tarihî metinlerden oluşan seçilmiş bir kütüphane; vurgulama, etiket, not ve çapraz referans (“Xrefs”) gibi not alma araçları; okuma ilerlemesinin ve notların cihazlar arasında eşitlenmesi (Standart ve Pro hesaplar); herkese açık notları keşfetmek ve paylaşmak için bir topluluk özelliği; yapay zekâ destekli pasaj özetleri (Pro); ve kendi EPUB veya metin dosyalarınızı içe aktarma imkânı (Pro).' }]},
    { title: '4. Abonelik seviyeleri', paras: [
      { label: 'Misafir', text: 'Kütüphanenin tamamını okuyun ve alıntı paylaşın. Hesap gerekmez.' },
      { label: 'Standart (hesapla ücretsiz)', text: 'Tüm not alma özellikleri, cihazlar arası eşitleme ve içerik dışa aktarma.' },
      { label: 'Pro (ayda 0,99 $)', text: 'Yapay zekâ özetleri, kitap içe aktarma ve toplulukta paylaşım yapabilme.' },
      { text: 'Abonelikler Apple uygulama içi satın alma ve RevenueCat (iOS ve Android) veya Stripe (web) aracılığıyla yönetilir. Faturalandırma, iadeler ve iptaller ilgili platform sağlayıcısı tarafından yürütülür.' },
    ]},
    { title: '5. Kullanıcı içeriği', paras: [{ text: 'Uygulamada oluşturduğunuz tüm içeriğin sahibi siz olmaya devam edersiniz. Uygulamayı kullanarak Immerse Research’e, içeriğinizi yalnızca Uygulamayı işletmek amacıyla saklama, işleme ve görüntüleme konusunda sınırlı, münhasır olmayan bir lisans verirsiniz. İçeriği herkese açık yaparsanız diğer Immerse kullanıcıları tarafından görülebilir ve kullanıcı adınızla ilişkilendirilebilir.' }]},
    { title: '6. Keşfet özelliği', paras: [{ text: 'Herkese açık yaptığınız içerikten yalnızca siz sorumlusunuz. Geçerli herhangi bir yasayı ihlal eden, fikrî mülkiyet haklarını çiğneyen, taciz edici, karalayıcı, nefret içerikli veya zararlı ya da başka şekilde saldırgan veya uygunsuz içerik paylaşmamayı kabul edersiniz. Herhangi bir herkese açık içeriği kaldırma ve bu Koşulları ihlal eden hesapları kısıtlama veya kapatma hakkımız saklıdır.' }]},
    { title: '7. Fikrî mülkiyet', paras: [{ text: 'Immerse kütüphanesindeki metinler ya kamu malıdır ya da izinle kullanılır. Bu eserler üzerinde mülkiyet iddia etmeyiz. Kullanma hakkına yasal olarak sahip olmadığınız içeriği yüklememeyi veya paylaşmamayı kabul edersiniz. Uygulamadaki bir içeriğin haklarınızı ihlal ettiğini düşünüyorsanız support@immerseresearch.app adresine yazın.' }]},
    { title: '8. Kullanıcının içe aktardığı içerik', paras: [{ text: 'Pro aboneleri kendi kitaplarını veya belgelerini içe aktarabilir. İçe aktarılan dosyalar ve notları yalnızca cihazınızda kalır ve sunucularımızla eşitlenmez. İçe aktardığınız her içeriği kullanma ve saklama konusunda yasal hakkınız olduğundan emin olmak sizin sorumluluğunuzdadır. İçe aktarılan materyallerin mülkiyetini veya lisansını doğrulamayız.' }]},
    { title: '9. Kabul edilebilir kullanım', paras: [{ text: 'Uygulamayı yasa dışı amaçlarla kullanmamayı, Uygulamanın işleyişine veya güvenliğine müdahale etmemeyi, diğer kullanıcıların özel verilerine izinsiz erişmeye çalışmamayı ve Keşfet özelliğini kötüye kullanmamayı kabul edersiniz.' }]},
    { title: '10. Gizlilik', paras: [{ text: 'Uygulamayı kullanımınız ayrıca yukarıdaki Gizlilik Politikamıza tabidir; bu politika atıf yoluyla bu Koşulların bir parçasıdır.' }]},
    { title: '11. Fesih', paras: [{ text: 'Bu Koşulları ihlal ederseniz hesabınızı askıya alabilir veya kapatabiliriz. Hesabınızı istediğiniz zaman Uygulamanın ayarlarından silebilirsiniz.' }]},
    { title: '12. Sorumluluk reddi', paras: [{ text: 'Uygulama hiçbir garanti verilmeksizin “olduğu gibi” sunulur. Kütüphane içeriğinin doğruluğunu veya eksiksizliğini, Uygulamanın ya da yapay zekâ özelliklerinin kesintisiz kullanılabilirliğini veya kullanıcıların ya da topluluğun oluşturduğu içeriğin güvenilir ya da uygun olduğunu garanti etmeyiz.' }]},
    { title: '13. Sorumluluğun sınırlandırılması', paras: [{ text: 'Yasaların izin verdiği azami ölçüde Immerse Research; dolaylı, arızi veya sonuç olarak ortaya çıkan zararlardan, not verilerinin veya içeriğin kaybından ya da kullanıcıların oluşturduğu veya herkese açık içerikten kaynaklanan sorunlardan sorumlu tutulamaz.' }]},
    { title: '14. İçerik tarafsızlığı', paras: [{ text: 'Immerse farklı geleneklerden geniş bir manevi ve felsefi metin yelpazesine erişim sunar. Belirli bir inanç sistemini veya bu metinlerin herhangi bir yorumunu desteklemeyiz. Kullanıcıların oluşturduğu içerik, Immerse Research’ün değil, her bir kullanıcının görüşlerini yansıtır.' }]},
    { title: '15. Bu Koşullardaki değişiklikler', paras: [{ text: 'Bu Koşulları istediğimiz zaman güncelleyebiliriz. Uygulamayı kullanmaya devam etmeniz, güncellenmiş Koşulları kabul ettiğiniz anlamına gelir. Önemli değişiklikler “Yürürlük tarihi” güncellenerek belirtilir.' }]},
    { title: '16. Uygulanacak hukuk', paras: [{ text: 'Bu Koşullar, Kanada’nın British Columbia eyaletinin yasalarına tabidir ve bu yasalara göre yorumlanır.' }]},
    { title: '17. İletişim', paras: [{ text: 'Bu Koşullar hakkında sorularınız varsa bize şu adresten ulaşın: support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Topluluk kuralları',
  guidelinesIntro: 'Immerse topluluğuna hoş geldiniz: gelenekler arası okuma, tefekkür ve insanlığın manevi mirasından edinilen içgörüleri paylaşma alanı.',
  guidelines: [
    { title: 'Saygılı olun', text: 'Tüm geleneklere, metinlere ve diğer okurlara içten bir saygıyla yaklaşın. Taciz, hakaret ve küçümseyici sözlerin burada yeri yoktur.' },
    { title: 'Düşünerek paylaşın', text: 'Anlamlı bir etkileşime davet eden vurgular, etiketler ve düşünceler paylaşın. Tartışmaya değil, kavrayışa odaklanın.' },
    { title: 'Farklı bakış açılarına değer verin', text: 'Immerse pek çok gelenekten ve geçmişten okurları bir araya getirir. Farklılıklara merak ve alçakgönüllülükle yaklaşın. Saygılı bir şekilde farklı düşünmek hoş karşılanır; alay ve düşmanlık karşılanmaz.' },
    { title: 'Sorumlu paylaşın', text: 'Yalnızca paylaşma hakkına sahip olduğunuz içeriği paylaşın. Kütüphane metinlerinden yaptığınız alıntıları makul uzunlukta tutun. Telif hakkına ve fikrî mülkiyete saygı gösterin.' },
    { title: 'İyi niyetle katılın', text: 'Topluluğu ortak metinler üzerinden diğer okurlarla bağ kurmak için kullanın. Konuyla ilgisiz amaçları tanıtmaktan veya spam yaymaktan kaçının. Nicelikten önce nitelik.' },
  ],
};

export const support: SupportContent = {
  back: '← Immerse’e dön',
  home: 'immerseresearch.app’e git',
  language: 'Dil',
  title: 'Destek',
  intro: 'Immerse ile ilgili yardıma mı ihtiyacınız var? Yardımcı olmaktan memnuniyet duyarız. Bize e-posta gönderin, en kısa sürede dönüş yapalım.',
  contactLabel: 'İletişim',
  sections: [
    { title: 'Parolanızı sıfırlama', html: 'Giriş ekranında <b>Parolanızı mı unuttunuz?</b> seçeneğine dokunun ve e-posta adresinizi girin. Yeni bir parola belirlemeniz için bir bağlantı göndereceğiz. (Birkaç dakika içinde gelmezse istenmeyen e-posta klasörünüzü kontrol edin.)' },
    { title: 'Aboneliğinizi yönetme', html: 'Immerse Pro abonelikleri satın aldığınız yerden yönetilir: <b>iOS</b>’ta Apple Kimliği abonelikleriniz, <b>Android</b>’de Google Play abonelikleri ve <b>web</b>’de Ayarlar üzerinden. Yeni hesaplar ücretsiz deneme içerir; ücret alınmaması için deneme bitmeden istediğiniz zaman iptal edebilirsiniz.' },
    { title: 'Hesabınızı silme', html: 'Uygulamada <b>Ayarlar</b>’ı açın ve <b>Hesabı sil</b>’i seçin. Bu işlem hesabınızı ve sunucularımızda saklanan içeriği kalıcı olarak kaldırır.' },
    { title: 'Notlar eşitlenmiyor', html: 'Her cihazda aynı hesapla giriş yaptığınızdan ve internet bağlantınız olduğundan emin olun. Vurgularınız, derlemeleriniz, notlarınız, çapraz referanslarınız ve okuma ilerlemeniz otomatik olarak eşitlenir. Hâlâ bir sorun görüyorsanız ayrıntıları bize e-postayla gönderin, yardımcı olalım.' },
  ],
  privacyLinkIntro: 'Şunlara göz atın: ',
  privacyLinkText: 'Gizlilik Politikası, Hizmet Koşulları ve Topluluk kuralları',
  privacyTermsTitle: 'Gizlilik ve Koşullar',
};

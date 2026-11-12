import type { LegalContent, SupportContent } from '../legalContent';

// Portuguese (Brazil) — courtesy translation of the English legal texts and Support page.

export const legal: LegalContent = {
  back: '← Voltar ao Immerse',
  home: 'Ir para immerseresearch.app',
  language: 'Idioma',
  legalHeading: 'Informações legais',
  effectiveDate: 'Data de vigência: 4 de junho de 2026',
  translationNotice: 'Esta tradução é oferecida por cortesia. Em caso de divergência, prevalece a versão em inglês.',

  privacyTitle: 'Política de Privacidade do Immerse',
  privacyIntro: [
    'A Immerse Research (“nós”) opera o aplicativo Immerse (o “App”). Respeitamos sua privacidade e nos comprometemos a proteger suas informações pessoais. Esta Política de Privacidade explica como coletamos, usamos, armazenamos e compartilhamos informações quando você usa o Immerse no iOS, no Android e na web.',
    'Ao usar o App, você concorda com a coleta e o uso de informações conforme descrito nesta Política de Privacidade.',
  ],
  privacySections: [
    { title: '1. Informações que coletamos', paras: [
      { label: '1.1 Informações da conta', text: 'Ao criar uma conta, podemos coletar o nome completo que você informar, um nome de usuário exclusivo, seu e-mail e sua senha (tratada com segurança por serviços de autenticação). Você também pode usar o Immerse como visitante, sem criar uma conta.' },
      { label: '1.2 Dados de anotação e leitura', text: 'Coletamos e armazenamos o conteúdo que você cria no App, incluindo textos destacados e seleções, etiquetas e notas, referências cruzadas entre trechos (“Xrefs”) e seu progresso de leitura e preferências.' },
      { label: '1.3 Conteúdo público', text: 'Se você optar por compartilhar conteúdo com a comunidade do Immerse, suas etiquetas, notas e Xrefs poderão ficar visíveis para outros usuários, e seu nome de usuário será exibido junto a esse conteúdo.' },
      { label: '1.4 Livros importados', text: 'Assinantes do Immerse Pro podem importar seus próprios arquivos (por exemplo, EPUB ou arquivos de texto). Os livros importados e as anotações feitas neles ficam armazenados apenas localmente no seu dispositivo e nunca são enviados aos nossos servidores.' },
      { label: '1.5 Informações de assinatura e pagamento', text: 'Se você assinar o Immerse Pro, os pagamentos são processados por terceiros: compras no app da Apple e RevenueCat no iOS e no Android, e Stripe na web. Não armazenamos nem processamos diretamente os dados do seu cartão de pagamento.' },
      { label: '1.6 Dados de uso', text: 'Podemos coletar dados técnicos limitados para melhorar o App, incluindo métricas de desempenho, tipo de dispositivo e sistema operacional, e padrões gerais de uso.' },
    ]},
    { title: '2. Como usamos suas informações', paras: [{ text: 'Usamos as informações coletadas para fornecer, operar e melhorar o App; sincronizar seu progresso de leitura e suas anotações entre dispositivos; permitir os recursos de compartilhamento na comunidade; gerenciar assinaturas e acessos; e responder a pedidos de suporte. Não vendemos seus dados pessoais.' }]},
    { title: '3. Conteúdo público e privado', paras: [{ text: 'Todas as suas anotações e dados de leitura são privados por padrão. Você pode optar por tornar público um conteúdo específico. O conteúdo público pode ser visto por qualquer usuário do Immerse, pode incluir trechos de livros da biblioteca e ficará associado ao seu nome de usuário. Depois que um conteúdo é tornado público, não podemos garantir controle total sobre como outros usuários o usam ou compartilham.' }]},
    { title: '4. A biblioteca do Immerse', paras: [{ text: 'O App inclui uma biblioteca selecionada de textos espirituais, religiosos, filosóficos e históricos de diversas tradições do mundo. Esses textos são oferecidos apenas para estudo pessoal e uso educacional. A Immerse Research não reivindica a propriedade dessas obras. Todos os textos estão em domínio público ou são usados com a devida permissão.' }]},
    { title: '5. Conteúdo importado pelo usuário', paras: [{ text: 'Assinantes Pro podem importar seus próprios livros ou documentos. Os arquivos importados e as anotações feitas neles ficam armazenados apenas localmente no seu dispositivo: não são sincronizados com nossos servidores. Ao importar conteúdo, você reconhece que é o único responsável por todo conteúdo importado, que deve ter o direito legal de usar e armazenar esse conteúdo e que a Immerse Research não verifica a propriedade nem o licenciamento dos materiais importados.' }]},
    { title: '6. Recursos de IA', paras: [{ text: 'O Immerse Pro inclui recursos com IA, como resumos de trechos. Quando você usa esses recursos, o texto do trecho em questão pode ser processado por serviços de IA para gerar uma resposta. Não usamos suas anotações pessoais nem os dados da sua conta para treinar modelos de IA.' }]},
    { title: '7. Compartilhamento de conteúdo e direitos autorais', paras: [{ text: 'Quando você compartilha anotações publicamente, o conteúdo compartilhado pode incluir trechos de livros da biblioteca. Você é responsável por garantir que seu conteúdo compartilhado esteja de acordo com as leis de direitos autorais aplicáveis. Reservamo-nos o direito de remover conteúdo que viole as leis aplicáveis ou nossas políticas.' }]},
    { title: '8. Serviços de terceiros', paras: [{ text: 'Usamos os seguintes serviços de terceiros para operar o App: Supabase (banco de dados e autenticação), Apple e Google (distribuição nas plataformas e compras no app), RevenueCat (gestão de assinaturas no iOS e no Android) e Stripe (processamento de pagamentos na web). Esses serviços podem processar e armazenar seus dados de acordo com suas próprias políticas de privacidade.' }]},
    { title: '9. Armazenamento e segurança dos dados', paras: [{ text: 'Adotamos medidas razoáveis para proteger seus dados, incluindo transmissão segura (HTTPS), proteções de autenticação e acesso controlado aos dados armazenados. No entanto, nenhum sistema é totalmente seguro, e não podemos garantir segurança absoluta.' }]},
    { title: '10. Retenção de dados', paras: [{ text: 'Mantemos seus dados enquanto sua conta estiver ativa e pelo tempo necessário para fornecer os serviços do App. Se você excluir sua conta, excluiremos ou anonimizaremos seus dados em um prazo razoável, exceto quando a retenção for exigida por lei.' }]},
    { title: '11. Seus direitos e controles', paras: [{ text: 'A qualquer momento, você pode acessar, editar ou excluir suas anotações e seu conteúdo; alternar um conteúdo entre público e privado; ou excluir sua conta. Para obter ajuda, escreva para support@immerseresearch.app.' }]},
    { title: '12. Privacidade de crianças', paras: [{ text: 'O Immerse não se destina a crianças menores de 13 anos. Não coletamos intencionalmente informações pessoais de crianças menores de 13 anos. Se soubermos que esses dados foram coletados, vamos excluí-los imediatamente.' }]},
    { title: '13. Neutralidade de conteúdo', paras: [{ text: 'O Immerse oferece acesso a uma coleção diversificada de textos espirituais e filosóficos de muitas tradições. Não endossamos nenhum sistema de crenças específico nem nenhuma interpretação específica desses textos. O conteúdo gerado pelos usuários reflete a opinião de cada usuário, e não a da Immerse Research.' }]},
    { title: '14. Dados exportados', paras: [{ text: 'O App permite exportar suas anotações e dados de leitura. Depois de exportados, esses dados ficam fora do nosso controle, e não somos responsáveis pela forma como são usados, compartilhados ou armazenados.' }]},
    { title: '15. Alterações nesta política', paras: [{ text: 'Podemos atualizar esta Política de Privacidade periodicamente. As alterações serão indicadas pela atualização da “Data de vigência” acima. O uso contínuo do App constitui aceitação da política atualizada.' }]},
    { title: '16. Fale conosco', paras: [{ text: 'Se tiver dúvidas sobre esta Política de Privacidade, escreva para: support@immerseresearch.app' }]},
  ],

  termsTitle: 'Termos de Serviço do Immerse',
  termsIntro: 'Boas-vindas ao Immerse, desenvolvido pela Immerse Research. Estes Termos de Serviço (os “Termos”) regem o uso do aplicativo Immerse (o “App”) no iOS, no Android e na web. Ao acessar ou usar o App, você concorda em cumprir estes Termos. Se não concordar, não use o App.',
  termsSections: [
    { title: '1. Elegibilidade', paras: [{ text: 'Você precisa ter pelo menos 13 anos para usar o App.' }]},
    { title: '2. Cadastro de conta', paras: [{ text: 'Para acessar os recursos de anotação e de comunidade, é preciso criar uma conta. Você concorda em fornecer informações corretas e completas, manter a confidencialidade das suas credenciais de acesso e ser responsável por toda atividade realizada na sua conta. Você também pode usar o Immerse como visitante, com acesso somente leitura à biblioteca.' }]},
    { title: '3. Descrição do App', paras: [{ text: 'O Immerse oferece: uma biblioteca selecionada de textos espirituais, religiosos, filosóficos e históricos de várias tradições; ferramentas de anotação, incluindo destaques, etiquetas, notas e referências cruzadas (“Xrefs”); sincronização entre dispositivos do progresso de leitura e das anotações (contas Padrão e Pro); um recurso de comunidade para descobrir e compartilhar anotações públicas; resumos de trechos com IA (Pro); e a possibilidade de importar seus próprios arquivos EPUB ou de texto (Pro).' }]},
    { title: '4. Planos de assinatura', paras: [
      { label: 'Visitante', text: 'Leia toda a biblioteca e compartilhe citações. Não é preciso ter conta.' },
      { label: 'Padrão (grátis com uma conta)', text: 'Todos os recursos de anotação, sincronização entre dispositivos e exportação de conteúdo.' },
      { label: 'Pro (US$ 0,99/mês)', text: 'Resumos com IA, importação de livros e a possibilidade de publicar na comunidade.' },
      { text: 'As assinaturas são gerenciadas por compras no app da Apple e RevenueCat (iOS e Android) ou pela Stripe (web). Cobrança, reembolsos e cancelamentos são tratados pelo respectivo provedor da plataforma.' },
    ]},
    { title: '5. Conteúdo do usuário', paras: [{ text: 'Você continua sendo o proprietário de todo o conteúdo que cria no App. Ao usar o App, você concede à Immerse Research uma licença limitada e não exclusiva para armazenar, processar e exibir seu conteúdo exclusivamente para operar o App. Se você tornar um conteúdo público, ele poderá ser visto por outros usuários do Immerse e associado ao seu nome de usuário.' }]},
    { title: '6. Recurso Descobrir', paras: [{ text: 'Você é o único responsável pelo conteúdo que torna público. Você concorda em não publicar conteúdo que viole qualquer lei aplicável, infrinja direitos de propriedade intelectual, seja abusivo, difamatório, de ódio ou prejudicial, ou seja de outra forma ofensivo ou inadequado. Reservamo-nos o direito de remover qualquer conteúdo público e de restringir ou encerrar contas que violem estes Termos.' }]},
    { title: '7. Propriedade intelectual', paras: [{ text: 'Os textos da biblioteca do Immerse estão em domínio público ou são usados com permissão. Não reivindicamos a propriedade dessas obras. Você concorda em não enviar nem compartilhar conteúdo que não tenha o direito legal de usar. Se acredita que algum conteúdo do App infringe seus direitos, escreva para support@immerseresearch.app.' }]},
    { title: '8. Conteúdo importado pelo usuário', paras: [{ text: 'Assinantes Pro podem importar seus próprios livros ou documentos. Os arquivos importados e suas anotações permanecem apenas no seu dispositivo e não são sincronizados com nossos servidores. Você é responsável por garantir que tem o direito legal de usar e armazenar qualquer conteúdo importado. Não verificamos a propriedade nem o licenciamento dos materiais importados.' }]},
    { title: '9. Uso aceitável', paras: [{ text: 'Você concorda em não usar o App para fins ilícitos, não interferir no funcionamento ou na segurança do App, não tentar acessar sem autorização os dados privados de outros usuários e não fazer uso abusivo do recurso Descobrir.' }]},
    { title: '10. Privacidade', paras: [{ text: 'O uso do App também é regido pela nossa Política de Privacidade acima, que é incorporada a estes Termos por referência.' }]},
    { title: '11. Encerramento', paras: [{ text: 'Podemos suspender ou encerrar sua conta se você violar estes Termos. Você pode excluir sua conta a qualquer momento nos ajustes do App.' }]},
    { title: '12. Isenções de garantia', paras: [{ text: 'O App é fornecido “no estado em que se encontra”, sem garantias de qualquer tipo. Não garantimos a exatidão ou a integridade do conteúdo da biblioteca, a disponibilidade ininterrupta do App ou de seus recursos de IA, nem que o conteúdo gerado por usuários ou pela comunidade seja confiável ou adequado.' }]},
    { title: '13. Limitação de responsabilidade', paras: [{ text: 'Na máxima extensão permitida por lei, a Immerse Research não será responsável por danos indiretos, incidentais ou consequentes, pela perda de dados de anotação ou de conteúdo, nem por problemas decorrentes de conteúdo gerado por usuários ou público.' }]},
    { title: '14. Neutralidade de conteúdo', paras: [{ text: 'O Immerse oferece acesso a uma ampla variedade de textos espirituais e filosóficos de diversas tradições. Não endossamos nenhum sistema de crenças específico nem nenhuma interpretação desses textos. O conteúdo gerado pelos usuários reflete a opinião de cada usuário, e não a da Immerse Research.' }]},
    { title: '15. Alterações nestes Termos', paras: [{ text: 'Podemos atualizar estes Termos a qualquer momento. O uso contínuo do App constitui aceitação dos Termos atualizados. Alterações relevantes serão indicadas pela atualização da “Data de vigência”.' }]},
    { title: '16. Lei aplicável', paras: [{ text: 'Estes Termos são regidos e interpretados de acordo com as leis da Província da Colúmbia Britânica, no Canadá.' }]},
    { title: '17. Contato', paras: [{ text: 'Se tiver dúvidas sobre estes Termos, escreva para: support@immerseresearch.app' }]},
  ],

  guidelinesTitle: 'Diretrizes da comunidade',
  guidelinesIntro: 'Boas-vindas à comunidade do Immerse, um espaço para leitura entre tradições, reflexão e troca de percepções sobre o patrimônio espiritual da humanidade.',
  guidelines: [
    { title: 'Seja respeitoso', text: 'Trate todas as tradições, textos e demais leitores com respeito genuíno. Assédio, insultos e comentários depreciativos não têm lugar aqui.' },
    { title: 'Compartilhe com cuidado', text: 'Compartilhe destaques, etiquetas e reflexões que convidem a uma participação significativa. Priorize a compreensão em vez da discussão.' },
    { title: 'Valorize a diversidade de perspectivas', text: 'O Immerse reúne leitores de muitas tradições e origens. Encare as diferenças com curiosidade e humildade. A discordância respeitosa é bem-vinda; zombaria e hostilidade, não.' },
    { title: 'Compartilhe com responsabilidade', text: 'Compartilhe apenas conteúdo que você tem o direito de compartilhar. Mantenha as citações dos textos da biblioteca em um tamanho razoável. Respeite os direitos autorais e a propriedade intelectual.' },
    { title: 'Participe de boa-fé', text: 'Use a comunidade para se conectar com outros leitores em torno de textos em comum. Evite promover causas sem relação com o tema ou espalhar spam. Qualidade acima de quantidade.' },
  ],
};

export const support: SupportContent = {
  back: '← Voltar ao Immerse',
  home: 'Ir para immerseresearch.app',
  language: 'Idioma',
  title: 'Suporte',
  intro: 'Precisa de ajuda com o Immerse? Será um prazer ajudar. Mande um e-mail e responderemos o quanto antes.',
  contactLabel: 'Contato',
  sections: [
    { title: 'Redefinir sua senha', html: 'Na tela de login, toque em <b>Esqueceu a senha?</b> e digite seu e-mail. Enviaremos um link para você criar uma nova senha. (Confira a pasta de spam se ele não chegar em alguns minutos.)' },
    { title: 'Gerenciar sua assinatura', html: 'As assinaturas do Immerse Pro são gerenciadas onde foram compradas: no <b>iOS</b>, nas assinaturas do seu ID Apple; no <b>Android</b>, nas assinaturas do Google Play; e na <b>web</b>, em Ajustes. Contas novas incluem um teste grátis; você pode cancelar a qualquer momento antes do fim para não ser cobrado.' },
    { title: 'Excluir sua conta', html: 'Abra <b>Ajustes</b> no app e escolha <b>Excluir conta</b>. Isso remove de forma permanente sua conta e o conteúdo armazenado em nossos servidores.' },
    { title: 'Anotações não sincronizam', html: 'Verifique se você está conectado à mesma conta em cada dispositivo e se tem acesso à internet. Seus destaques, compilações, notas, referências cruzadas e progresso de leitura são sincronizados automaticamente. Se algo ainda parecer errado, mande os detalhes por e-mail e vamos ajudar.' },
  ],
  privacyLinkIntro: 'Veja nossa ',
  privacyLinkText: 'Política de Privacidade, Termos de Serviço e Diretrizes da comunidade',
  privacyTermsTitle: 'Privacidade e Termos',
};

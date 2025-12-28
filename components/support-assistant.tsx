'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type TopicId = 'account' | 'subscription' | 'features';

type FaqItem = {
  id: string;
  topic: TopicId;
  question: string;
  answer: string;
  action?: { label: string; href: string };
};

const topics: Record<TopicId, {
  title: string;
  description: string;
  tips: string[];
  actions: { label: string; href: string }[];
}> = {
  account: {
    title: 'Probleme de compte',
    description: 'Aide rapide pour acces et infos du compte.',
    tips: [
      'Verifiez que vous etes bien connecte.',
      'Deconnectez-vous puis reconnectez-vous.',
      'Completez votre profil si des champs manquent.',
    ],
    actions: [
      { label: 'Aller au profil', href: '/profil' },
      { label: 'Aller a la connexion', href: '/login' },
    ],
  },
  subscription: {
    title: 'Abonnement',
    description: 'Verifier le statut et l option premium.',
    tips: [
      'L abonnement doit etre actif pour debloquer les fonctions payantes.',
      'L option premium est bloquee pendant la periode d essai.',
      'Consultez la page Abonnement pour les details.',
    ],
    actions: [
      { label: 'Ouvrir Abonnement', href: '/abonnement' },
    ],
  },
  features: {
    title: 'Fonctions de la plateforme',
    description: 'Depannage rapide des actions bloquees.',
    tips: [
      'Rafraichissez la page si une action reste en chargement.',
      'Verifiez vos selections avant de valider.',
      'Essayez de vider le cache navigateur si besoin.',
    ],
    actions: [
      { label: 'Retour au tableau de bord', href: '/dashboard' },
    ],
  },
};

const faqItems: FaqItem[] = [
  {
    id: 'account-login',
    topic: 'account',
    question: 'Je ne peux pas me connecter.',
    answer: 'Verifiez votre email et mot de passe, puis essayez de vous reconnecter.',
    action: { label: 'Aller a la connexion', href: '/login' },
  },
  {
    id: 'account-profile',
    topic: 'account',
    question: 'On me demande de completer mon profil.',
    answer: 'Certains ecrans sont limites tant que le profil est incomplet.',
    action: { label: 'Completer mon profil', href: '/profil' },
  },
  {
    id: 'account-data',
    topic: 'account',
    question: 'Mes donnees ne s affichent pas.',
    answer: 'Rechargez la page. Si le probleme persiste, verifiez votre connexion.',
  },
  {
    id: 'subscription-trial',
    topic: 'subscription',
    question: 'Pourquoi l option premium est bloquee pendant l essai ?',
    answer: 'L option premium est disponible uniquement quand l abonnement principal est actif.',
    action: { label: 'Voir Abonnement', href: '/abonnement' },
  },
  {
    id: 'subscription-activate',
    topic: 'subscription',
    question: 'Comment activer l option premium ?',
    answer: 'Ouvrez la page Abonnement et choisissez le plan premium mensuel ou annuel.',
    action: { label: 'Ouvrir Abonnement', href: '/abonnement' },
  },
  {
    id: 'subscription-status',
    topic: 'subscription',
    question: 'Mon abonnement principal n est pas actif.',
    answer: 'Assurez-vous que votre paiement est valide et consultez la page Abonnement.',
    action: { label: 'Consulter Abonnement', href: '/abonnement' },
  },
  {
    id: 'features-premium',
    topic: 'features',
    question: 'Comptabilite ou stocks sont bloques.',
    answer: 'Ces pages demandent un abonnement actif + option premium active.',
    action: { label: 'Verifier Abonnement', href: '/abonnement' },
  },
  {
    id: 'features-loading',
    topic: 'features',
    question: 'Une action reste en chargement.',
    answer: 'Essayez de rafraichir la page et relancez l action.',
  },
  {
    id: 'features-create',
    topic: 'features',
    question: 'Je ne peux pas creer un devis ou une facture.',
    answer: 'Verifiez que votre profil est complete et que vous avez selectionne un client.',
    action: { label: 'Aller aux clients', href: '/clients' },
  },
];

export default function SupportAssistant() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTopic, setActiveTopic] = useState<TopicId | null>(null);
  const [faqQuery, setFaqQuery] = useState('');
  const [selectedFaq, setSelectedFaq] = useState<FaqItem | null>(null);

  const handleToggle = () => {
    setIsOpen((prev) => {
      if (prev) {
        setActiveTopic(null);
      }
      return !prev;
    });
  };

  const handleNavigate = (href: string) => {
    router.push(href);
    setIsOpen(false);
    setActiveTopic(null);
  };

  const handleSelectTopic = (topic: TopicId) => {
    setActiveTopic(topic);
    setSelectedFaq(null);
    setFaqQuery('');
  };

  const current = activeTopic ? topics[activeTopic] : null;
  const normalizedQuery = faqQuery.trim().toLowerCase();
  const filteredFaqs = faqItems.filter((item) => {
    const matchesTopic = activeTopic ? item.topic === activeTopic : true;
    const matchesQuery = normalizedQuery
      ? item.question.toLowerCase().includes(normalizedQuery)
      : true;
    return matchesTopic && matchesQuery;
  });

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {isOpen && (
        <div className="flex max-h-[calc(100vh-6rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-rose-100">
                <svg
                  viewBox="0 0 64 64"
                  role="img"
                  aria-hidden="true"
                  className="h-full w-full"
                >
                  <rect width="64" height="64" rx="32" fill="#fbe6e0" />
                  <path
                    d="M10 34c0-16 10-26 22-26s22 10 22 26v12c-6 8-13 12-22 12s-16-4-22-12z"
                    fill="#2f241f"
                  />
                  <circle cx="32" cy="28" r="12" fill="#f2c4a6" />
                  <path
                    d="M18 30c2-8 8-14 14-14s12 6 14 14c-3-3-7-5-14-5s-11 2-14 5z"
                    fill="#3a2a24"
                  />
                  <circle cx="27" cy="28" r="1.4" fill="#1f1b1a" />
                  <circle cx="37" cy="28" r="1.4" fill="#1f1b1a" />
                  <path
                    d="M27 33c2.2 1.8 7.8 1.8 10 0"
                    fill="none"
                    stroke="#a26b57"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 60c3-10 12-16 18-16s15 6 18 16"
                    fill="#e8a0b3"
                  />
                </svg>
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Assistante Lena</div>
                <div className="text-xs text-slate-500">Aide rapide</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700"
              aria-label="Fermer l'assistante"
            >
              Fermer
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 px-4 py-3">
              <p className="text-sm text-slate-600">
                Bonjour, je peux vous aider avec votre compte, votre abonnement ou les fonctions de la plateforme.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectTopic('account')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeTopic === 'account'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Compte
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTopic('subscription')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeTopic === 'subscription'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Abonnement
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectTopic('features')}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    activeTopic === 'features'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Fonctions
                </button>
              </div>

              {current && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-sm font-semibold text-slate-900">{current.title}</div>
                  <p className="mt-1 text-xs text-slate-600">{current.description}</p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    {current.tips.map((tip) => (
                      <li key={tip}>- {tip}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {current.actions.map((action) => (
                      <button
                        key={action.href}
                        type="button"
                        onClick={() => handleNavigate(action.href)}
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <label className="text-xs font-semibold text-slate-700" htmlFor="faq-search">
                  Recherche rapide
                </label>
                <input
                  id="faq-search"
                  type="text"
                  value={faqQuery}
                  onChange={(e) => {
                    setFaqQuery(e.target.value);
                    setSelectedFaq(null);
                  }}
                  placeholder="Rechercher une question"
                  className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />

                <div className="mt-3 space-y-2">
                  {filteredFaqs.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      Aucun resultat. Essayez un autre mot cle.
                    </p>
                  ) : (
                    filteredFaqs.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedFaq(item)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-xs font-medium ${
                          selectedFaq?.id === item.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {item.question}
                      </button>
                    ))
                  )}
                </div>

                {selectedFaq && (
                  <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">Reponse</div>
                    <p className="mt-1">{selectedFaq.answer}</p>
                    {selectedFaq.action && (
                      <button
                        type="button"
                        onClick={() => handleNavigate(selectedFaq.action!.href)}
                        className="mt-2 rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        {selectedFaq.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-xs font-semibold text-slate-700">
                Question importante ?
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Contactez le service technique par email.
              </p>
              <a
                href="mailto:devifact.fr@gmail.com?subject=Support%20DeviFact"
                className="mt-2 inline-flex items-center rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Ecrire au support
              </a>
              <p className="mt-2 text-[11px] text-slate-400">
                devifact.fr@gmail.com
              </p>
            </div>

            <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
              Conseils rapides, pas de support en temps reel.
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-full bg-rose-500 px-3 py-2 text-xs font-semibold text-white shadow-lg hover:bg-rose-600"
        aria-label="Ouvrir l'assistante"
      >
        💡 Lena
      </button>
    </div>
  );
}

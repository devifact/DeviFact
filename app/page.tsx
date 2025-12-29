import Link from 'next/link';
import { Logo } from '@/components/logo.tsx';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-gray-50 to-white">
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <Logo size="large" />
          </div>
          <p className="text-2xl text-gray-700 mb-8 font-medium">
            Créez vos devis et factures en quelques clics
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/register"
              className="bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-all shadow-md hover:shadow-lg"
            >
              Essai gratuit 30 jours
            </Link>
            <Link
              href="/login"
              className="bg-white text-orange-600 px-8 py-3 rounded-lg font-semibold border-2 border-orange-500 hover:bg-orange-50 transition-all shadow-sm hover:shadow-md"
            >
              Se connecter
            </Link>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Simple</h3>
            <p className="text-gray-600">
              Interface claire et intuitive, conçue pour les artisans
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100">
            <div className="text-4xl mb-4">🚀</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Rapide</h3>
            <p className="text-gray-600">
              Créez vos devis et factures en quelques minutes
            </p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow border border-gray-100">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Accessible</h3>
            <p className="text-gray-600">
              9,90€/mois ou 99€/an, sans engagement
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-10 text-center border border-gray-100">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Fonctionnalités
          </h2>
          <ul className="text-left max-w-2xl mx-auto space-y-4 text-gray-700">
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Gestion des clients</span>
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Bibliothèque de produits réutilisables</span>
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Création de devis professionnels</span>
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Génération de factures au format PDF</span>
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Calcul automatique des marges</span>
            </li>
            <li className="flex items-start">
              <span className="text-orange-500 mr-3 text-xl font-bold">✓</span>
              <span className="text-lg">Conformité légale française</span>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}

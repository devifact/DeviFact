'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context.tsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Logo } from '@/components/logo.tsx';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawNext = searchParams.get('next');
    if (!rawNext) return;

    let decodedNext = rawNext;
    try {
      decodedNext = decodeURIComponent(rawNext);
    } catch {
      return;
    }

    if (decodedNext.startsWith('/') && !decodedNext.startsWith('//')) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('postLoginRedirect', decodedNext);
      }
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Connexion réussie');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la connexion';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-gray-100 px-4" style={{ zIndex: 1 }}>
      <div className="max-w-md w-full space-y-8" style={{ position: 'relative', zIndex: 10 }}>
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Logo size="medium" />
          </div>
          <p className="text-gray-600 text-lg">Devis et factures pour artisans</p>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Connexion</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                autoComplete="email"
                required
                disabled={false}
                readOnly={false}
                style={{ pointerEvents: 'auto', userSelect: 'text' }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                  autoComplete="current-password"
                  required
                  disabled={false}
                  readOnly={false}
                  style={{ pointerEvents: 'auto', userSelect: 'text' }}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 3l18 18" />
                      <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                      <path d="M9.88 5.09A9.77 9.77 0 0 1 12 5c5 0 9 4 9 7a9.77 9.77 0 0 1-2.12 3.32" />
                      <path d="M6.1 6.1A9.77 9.77 0 0 0 3 12c0 3 4 7 9 7a9.77 9.77 0 0 0 5.9-2.1" />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-orange-600 hover:text-orange-700 font-semibold">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { useAuth } from '@/lib/auth-context.tsx';

type Produit = {
  id: string;
  designation: string;
  reference: string | null;
  categorie: string | null;
  unite: string | null;
  type: 'standard' | 'custom' | null;
  prix_ht_defaut: number | null;
  taux_tva_defaut: number | null;
  marge_defaut: number | null;
  fournisseur_defaut_id: string | null;
  fournisseur_nom?: string | null;
  actif: boolean | null;
  stock_actuel: number | null;
  stock_minimum: number | null;
  gestion_stock: boolean | null;
};

type ProduitWithFournisseur = Produit & {
  fournisseur?: { nom?: string | null } | { nom?: string | null }[] | null;
};

interface ProductSearchProps {
  onSelectProduct: (product: Produit) => void;
  placeholder?: string;
}

const normalizeProduct = (product: ProduitWithFournisseur): Produit => {
  const fournisseur =
    product.fournisseur_nom ??
    (Array.isArray(product.fournisseur)
      ? product.fournisseur[0]?.nom
      : product.fournisseur?.nom);

  return {
    ...product,
    prix_ht_defaut: product.prix_ht_defaut !== null ? Number(product.prix_ht_defaut) : null,
    taux_tva_defaut: product.taux_tva_defaut !== null ? Number(product.taux_tva_defaut) : null,
    marge_defaut: product.marge_defaut !== null ? Number(product.marge_defaut) : null,
    actif: product.actif ?? true,
    fournisseur_nom: fournisseur ?? null,
    stock_actuel: product.stock_actuel !== null ? Number(product.stock_actuel) : null,
    stock_minimum: product.stock_minimum !== null ? Number(product.stock_minimum) : null,
    gestion_stock: product.gestion_stock ?? false,
  };
};

export function ProductSearch({ onSelectProduct, placeholder = "Rechercher un produit..." }: ProductSearchProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Produit[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const searchProducts = async () => {
      if (!user || searchTerm.length < 1) {
        setResults([]);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .rpc('search_products', {
            p_user_id: user.id,
            p_search_term: searchTerm,
            p_active_only: true,
          });

        if (error) {
          const likeTerm = `%${searchTerm}%`;
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('produits')
            .select(`
              id,
              designation,
              reference,
              categorie,
              unite,
              type,
              prix_ht_defaut,
              taux_tva_defaut,
              marge_defaut,
              fournisseur_defaut_id,
              actif,
              stock_actuel,
              stock_minimum,
              gestion_stock,
              fournisseur:fournisseurs(nom)
            `)
            .eq('user_id', user.id)
            .eq('actif', true)
            .or(`designation.ilike.${likeTerm},reference.ilike.${likeTerm},categorie.ilike.${likeTerm}`);

          if (fallbackError) throw fallbackError;
          setResults((fallbackData || []).map(normalizeProduct));
          return;
        }

        setResults((data || []).map(normalizeProduct));
      } catch (error) {
        console.error('Erreur lors de la recherche de produits:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimeout = setTimeout(searchProducts, 300);
    return () => clearTimeout(debounceTimeout);
  }, [searchTerm, user]);

  const handleSelectProduct = (product: Produit) => {
    onSelectProduct(product);
    setSearchTerm('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setShowResults(true);
        }}
        onFocus={() => setShowResults(true)}
        placeholder={placeholder}
        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
      />

      {showResults && (searchTerm.length > 0 || results.length > 0) && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Recherche...
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              Aucun produit trouvé
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((product) => (
                <li
                  key={product.id}
                  onClick={() => handleSelectProduct(product)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {product.type === 'standard' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Standard
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900">
                          {product.designation}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {product.reference && (
                          <span>Réf: {product.reference}</span>
                        )}
                        {product.categorie && (
                          <span>{product.categorie}</span>
                        )}
                        <span>{product.unite}</span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {product.prix_ht_defaut?.toFixed(2) || '0.00'} € HT
                      </div>
                      <div className="text-xs text-gray-500">
                        TVA {(product.taux_tva_defaut ?? 20)}%
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/dashboard-layout.tsx';
import { useAuth } from '@/lib/auth-context.tsx';
import { useCompanySettings } from '@/lib/hooks/use-company-settings.ts';
import { supabase } from '@/lib/supabase.ts';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { SearchBar } from '@/components/search-bar.tsx';

type Produit = {
  id: string;
  designation: string;
  reference: string | null;
  categorie: string | null;
  unite: string | null;
  type: 'standard' | 'custom' | null;
  code_standard: string | null;
  prix_ht_defaut: number | null;
  taux_tva_defaut: number | null;
  marge_defaut: number | null;
  fournisseur_defaut_id: string | null;
  image_url: string | null;
  actif: boolean | null;
  created_at: string;
};

type Fournisseur = {
  id: string;
  nom: string;
};

type CsvImportMode = 'create' | 'update' | 'ignore';

type ImportRow = {
  lineNumber: number;
  data: {
    designation: string;
    reference: string;
    referenceNormalized: string;
    categorie: string | null;
    unite: string;
    prix_ht_defaut: number;
    taux_tva_defaut: number;
    marge_defaut: number;
    fournisseur_nom: string | null;
    stock: number | null;
    actif: boolean;
  };
  errors: string[];
  warnings: string[];
};

const CSV_HEADER = 'designation;reference;prix_ht;tva;unite;marge;fournisseur;stock;statut;categorie';
const CSV_TEMPLATE = [
  CSV_HEADER,
  'Exemple produit;REF-001;49.90;20;unite;10;Fournisseur A;5;actif;Divers',
].join('\n');

const TVA_OPTIONS = [0, 5.5, 10, 20];
const TVA_ALLOWED = new Set(TVA_OPTIONS);

export default function ProduitsPage() {
  const { user, loading: authLoading } = useAuth();
  const { settings } = useCompanySettings();
  const router = useRouter();
  const [produitsStandards, setProduitsStandards] = useState<Produit[]>([]);
  const [produitsCustom, setProduitsCustom] = useState<Produit[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduit, setEditingProduit] = useState<Produit | null>(null);
  const [createProductType, setCreateProductType] = useState<'standard' | 'custom'>('custom');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<CsvImportMode>('create');
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    imported: number;
    updated: number;
    ignored: number;
    errors: number;
  } | null>(null);
  const [importColumnPresence, setImportColumnPresence] = useState({
    marge: false,
    fournisseur: false,
    stock: false,
    statut: false,
    categorie: false,
  });
  const tvaOptions = TVA_OPTIONS;
  const normalizeReference = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed.toUpperCase() : '';
  };
  const defaultTva = typeof settings?.taux_tva_defaut === 'number' ? settings.taux_tva_defaut : 20;
  const defaultMarge = typeof settings?.marge_defaut === 'number' ? settings.marge_defaut : 0;
  const tvaAllowed = TVA_ALLOWED;

  const [formData, setFormData] = useState({
    designation: '',
    reference: '',
    categorie: '',
    unite: 'unité',
    prix_ht_defaut: 0,
    taux_tva_defaut: 20,
    marge_defaut: 0,
    fournisseur_defaut_id: '',
    image_url: '',
    actif: true,
  });

  const fetchProduits = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('produits')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const standards = (data || []).filter(p => p.type === 'standard');
      const customs = (data || []).filter(p => p.type !== 'standard');

      setProduitsStandards(standards);
      setProduitsCustom(customs);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du chargement des produits';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchFournisseurs = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('id, nom')
        .eq('user_id', user.id)
        .order('nom');

      if (error) throw error;
      setFournisseurs(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des fournisseurs:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchProduits();
      fetchFournisseurs();
    }
  }, [user, authLoading, router, fetchProduits, fetchFournisseurs]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => produitsCustom.some((produit) => produit.id === id))
    );
  }, [produitsCustom]);

  const selectedProduits = produitsCustom.filter((p) => selectedIds.includes(p.id));
  const selectedCount = selectedIds.length;
  const canEdit = selectedCount === 1;
  const canBulkAction = selectedCount > 0;
  const allSelectedActive = selectedProduits.length > 0 && selectedProduits.every((p) => p.actif);
  const toggleLabel = allSelectedActive ? 'Desactiver' : 'Activer';

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const fournisseurMap = new Map(fournisseurs.map((f) => [f.id, f.nom]));
  const getFournisseurName = (id?: string | null) => {
    if (!id) return '-';
    return fournisseurMap.get(id) || '-';
  };

  const normalizedSearch = debouncedSearch.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const matchesSearch = (produit: Produit) => {
    if (!normalizedSearch) return true;
    const designation = produit.designation?.toLowerCase() || '';
    const reference = produit.reference?.toLowerCase() || '';
    return designation.includes(normalizedSearch) || reference.includes(normalizedSearch);
  };
  const filteredStandards = produitsStandards.filter(matchesSearch);
  const filteredCustom = produitsCustom.filter(matchesSearch);
  const validImportRows = importRows.filter((row) => row.errors.length === 0);
  const errorImportRows = importRows.filter((row) => row.errors.length > 0);
  const warningCount = importRows.reduce((sum, row) => sum + row.warnings.length, 0);

  const fournisseurNameMap = useMemo(() => {
    return new Map(
      fournisseurs.map((fournisseur) => [fournisseur.nom.trim().toLowerCase(), fournisseur.id])
    );
  }, [fournisseurs]);

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ';' && !inQuotes) {
        values.push(current);
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current);
    return values;
  };

  const parseCsvNumber = (value: string) => {
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    return cleaned ? Number(cleaned) : Number.NaN;
  };

  const resetImportState = () => {
    setImportRows([]);
    setImportErrors([]);
    setImportFileName('');
    setImportSummary(null);
    setImportColumnPresence({
      marge: false,
      fournisseur: false,
      stock: false,
      statut: false,
      categorie: false,
    });
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-produits.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadBlankCsv = () => {
    const blob = new Blob([CSV_HEADER], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele-produits-vierge.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleParseCsv = (text: string) => {
    setImportSummary(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setImportErrors(['Le fichier CSV est vide.']);
      setImportRows([]);
      return;
    }

    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) {
      setImportErrors(['Le fichier doit contenir au moins une ligne de donnees.']);
      setImportRows([]);
      return;
    }

    const headers = parseCsvLine(lines[0]).map((header) =>
      header.trim().toLowerCase().replace(/^\ufeff/, '')
    );
    const requiredColumns = ['designation', 'reference', 'prix_ht', 'tva', 'unite'];
    const missing = requiredColumns.filter((column) => !headers.includes(column));

    if (missing.length > 0) {
      setImportErrors([`Colonnes obligatoires manquantes: ${missing.join(', ')}`]);
      setImportRows([]);
      return;
    }

    const columnPresence = {
      marge: headers.includes('marge'),
      fournisseur: headers.includes('fournisseur'),
      stock: headers.includes('stock'),
      statut: headers.includes('statut'),
      categorie: headers.includes('categorie'),
    };
    setImportColumnPresence(columnPresence);
    setImportErrors([]);

    const headerIndex = new Map(headers.map((header, index) => [header, index]));
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const values = parseCsvLine(lines[i]);
      const getValue = (column: string) => {
        const index = headerIndex.get(column);
        if (index === undefined) return '';
        return (values[index] ?? '').trim();
      };

      const errors: string[] = [];
      const warnings: string[] = [];

      const designation = getValue('designation');
      if (!designation) errors.push('designation: obligatoire');

      const reference = getValue('reference');
      if (!reference) errors.push('reference: obligatoire');
      const referenceNormalized = normalizeReference(reference);

      const prixValue = parseCsvNumber(getValue('prix_ht'));
      if (!Number.isFinite(prixValue) || prixValue < 0) {
        errors.push('prix_ht: invalide');
      }

      const tvaRaw = getValue('tva');
      const tvaValue = parseCsvNumber(tvaRaw);
      if (!Number.isFinite(tvaValue) || !tvaAllowed.has(tvaValue)) {
        errors.push('tva: invalide (0, 5.5, 10, 20)');
      }

      const unite = getValue('unite');
      if (!unite) errors.push('unite: obligatoire');

      const margeValue = columnPresence.marge ? parseCsvNumber(getValue('marge')) : defaultMarge;
      const margeDefaut = Number.isFinite(margeValue) ? margeValue : defaultMarge;

      const fournisseurNom = columnPresence.fournisseur ? getValue('fournisseur') : '';
      if (fournisseurNom && !fournisseurNameMap.has(fournisseurNom.toLowerCase())) {
        warnings.push(`fournisseur: introuvable (${fournisseurNom})`);
      }

      const stockValue = columnPresence.stock ? parseCsvNumber(getValue('stock')) : Number.NaN;
      let stock: number | null = null;
      if (columnPresence.stock) {
        if (!Number.isFinite(stockValue) || stockValue < 0) {
          errors.push('stock: invalide');
        } else {
          stock = stockValue;
        }
      }

      const statutRaw = columnPresence.statut ? getValue('statut') : '';
      let actif = true;
      if (columnPresence.statut && statutRaw) {
        const normalized = statutRaw.toLowerCase();
        if (normalized === 'actif') actif = true;
        else if (normalized === 'inactif') actif = false;
        else errors.push('statut: invalide (actif | inactif)');
      }

      const categorie = columnPresence.categorie ? getValue('categorie') : '';

      rows.push({
        lineNumber: i + 1,
        data: {
          designation,
          reference,
          referenceNormalized,
          categorie: categorie || null,
          unite,
          prix_ht_defaut: Number.isFinite(prixValue) ? prixValue : 0,
          taux_tva_defaut: Number.isFinite(tvaValue) ? tvaValue : defaultTva,
          marge_defaut: margeDefaut,
          fournisseur_nom: fournisseurNom || null,
          stock,
          actif,
        },
        errors,
        warnings,
      });
    }

    setImportRows(rows);
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportErrors(['Merci de choisir un fichier .csv']);
      setImportRows([]);
      setImportFileName('');
      return;
    }

    try {
      const text = await file.text();
      setImportFileName(file.name);
      handleParseCsv(text);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de la lecture du fichier';
      setImportErrors([message]);
      setImportRows([]);
    }
  };

  const handleConfirmImport = async () => {
    if (!user) return;
    const validRows = importRows.filter((row) => row.errors.length === 0);
    if (validRows.length === 0) return;

    const existingByReference = new Map<string, Produit>();
    [...produitsStandards, ...produitsCustom].forEach((produit) => {
      if (!produit.reference) return;
      const key = normalizeReference(produit.reference);
      if (!key) return;
      const current = existingByReference.get(key);
      if (!current || new Date(produit.created_at) > new Date(current.created_at)) {
        existingByReference.set(key, produit);
      }
    });

    const summary = {
      imported: 0,
      updated: 0,
      ignored: 0,
      errors: importRows.length - validRows.length,
    };

    try {
      setImporting(true);
      const createPayloads: Array<Record<string, unknown>> = [];
      const updateRows: Array<{ id: string; payload: Record<string, unknown> }> = [];

      for (const row of validRows) {
        const existing = existingByReference.get(row.data.referenceNormalized);

        if (importMode === 'ignore' && existing) {
          summary.ignored += 1;
          continue;
        }

        if (importMode === 'update') {
          if (!existing) {
            summary.ignored += 1;
            continue;
          }

          const updatePayload: Record<string, unknown> = {
            designation: row.data.designation,
            reference: row.data.referenceNormalized || null,
            unite: row.data.unite,
            prix_ht_defaut: row.data.prix_ht_defaut,
            taux_tva_defaut: row.data.taux_tva_defaut,
            actif: row.data.actif,
          };

          if (importColumnPresence.marge) {
            updatePayload.marge_defaut = row.data.marge_defaut;
          }
          if (importColumnPresence.categorie) {
            updatePayload.categorie = row.data.categorie || null;
          }
          if (importColumnPresence.stock) {
            updatePayload.stock_actuel = row.data.stock ?? 0;
            updatePayload.gestion_stock = true;
          }
          if (importColumnPresence.fournisseur) {
            const fournisseurId = row.data.fournisseur_nom
              ? fournisseurNameMap.get(row.data.fournisseur_nom.toLowerCase()) ?? null
              : null;
            updatePayload.fournisseur_defaut_id = fournisseurId;
          }

          updateRows.push({ id: existing.id, payload: updatePayload });
          continue;
        }

        const fournisseurId = row.data.fournisseur_nom
          ? fournisseurNameMap.get(row.data.fournisseur_nom.toLowerCase()) ?? null
          : null;

        createPayloads.push({
          user_id: user.id,
          type: 'custom',
          designation: row.data.designation,
          reference: row.data.referenceNormalized || null,
          categorie: row.data.categorie || null,
          unite: row.data.unite,
          prix_ht_defaut: row.data.prix_ht_defaut,
          taux_tva_defaut: row.data.taux_tva_defaut,
          marge_defaut: row.data.marge_defaut,
          fournisseur_defaut_id: fournisseurId,
          actif: row.data.actif,
          gestion_stock: true,
          stock_actuel: row.data.stock ?? 0,
          stock_minimum: 1,
        });
      }

      for (const updateRow of updateRows) {
        const { error } = await supabase
          .from('produits')
          .update(updateRow.payload)
          .eq('id', updateRow.id);

        if (error) {
          summary.errors += 1;
        } else {
          summary.updated += 1;
        }
      }

      const chunkSize = 100;
      for (let index = 0; index < createPayloads.length; index += chunkSize) {
        const chunk = createPayloads.slice(index, index + chunkSize);
        const { error } = await supabase.from('produits').insert(chunk);
        if (error) {
          summary.errors += chunk.length;
        } else {
          summary.imported += chunk.length;
        }
      }

      setImportSummary(summary);
      fetchProduits();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur lors de l\'import';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const openModal = (produit?: Produit, typeOverride?: 'standard' | 'custom') => {
    if (produit) {
      setEditingProduit(produit);
      setCreateProductType(produit.type ?? 'custom');
      setFormData({
        designation: produit.designation,
        reference: produit.reference || '',
        categorie: produit.categorie || '',
        unite: produit.unite || 'unité',
        prix_ht_defaut: produit.prix_ht_defaut ?? 0,
        taux_tva_defaut: typeof produit.taux_tva_defaut === 'number'
          ? produit.taux_tva_defaut
          : 20,
        marge_defaut: typeof produit.marge_defaut === 'number' ? produit.marge_defaut : 0,
        fournisseur_defaut_id: produit.fournisseur_defaut_id || '',
        image_url: produit.image_url || '',
        actif: produit.actif !== false,
      });
    } else {
      setEditingProduit(null);
      setCreateProductType(typeOverride ?? 'custom');
      setFormData({
        designation: '',
        reference: '',
        categorie: '',
        unite: 'unité',
        prix_ht_defaut: 0,
        taux_tva_defaut: 20,
        marge_defaut: 0,
        fournisseur_defaut_id: '',
        image_url: '',
        actif: true,
      });
    }
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setImageError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduit(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl('');
    setImageError('');
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreviewUrl('');
      setImageError('');
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setImageError('Format non supporte. Utilisez PNG, JPG, WEBP ou GIF.');
      setImageFile(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageError('Taille maximale 5 Mo.');
      setImageFile(null);
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageError('');
  };

  const uploadImageFile = async (file: File) => {
    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `produit-${Date.now()}.${fileExt}`;
    const filePath = `${user!.id}/${fileName}`;

    const { error: uploadError } = await supabase
      .storage
      .from('produits')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('produits').getPublicUrl(filePath);
    if (!data?.publicUrl) {
      throw new Error('Impossible de recuperer le lien de l image.');
    }

    return data.publicUrl;
  };

  const handleUploadImage = async () => {
    if (!imageFile || !user) {
      setImageError('Selectionnez une image avant de televerser.');
      return;
    }

    setImageUploading(true);
    setImageError('');

    try {
      const publicUrl = await uploadImageFile(imageFile);
      setFormData({ ...formData, image_url: publicUrl });
      setImageFile(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl('');
      }
      toast.success('Image televersee. Pensez a enregistrer le produit.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors du televersement.';
      setImageError(message);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const referenceNormalized = normalizeReference(formData.reference);
      const duplicateResult = referenceNormalized
        ? await supabase
            .from('produits')
            .select('id, stock_actuel, stock_minimum, gestion_stock')
            .eq('user_id', user!.id)
            .ilike('reference', referenceNormalized)
            .limit(1)
            .maybeSingle()
        : null;

      if (duplicateResult?.error) throw duplicateResult.error;
      const duplicateProduit = duplicateResult?.data ?? null;
      if (duplicateProduit && (!editingProduit || duplicateProduit.id !== editingProduit.id)) {
        toast.error('Reference deja utilisee');
        return;
      }
      const dataToSave = {
        ...formData,
        reference: referenceNormalized || null,
        fournisseur_defaut_id: formData.fournisseur_defaut_id || null,
        image_url: formData.image_url || null,
        gestion_stock: true,
      };

      let imageUrlForSave = dataToSave.image_url;
      if (imageFile) {
        setImageUploading(true);
        setImageError('');
        try {
          imageUrlForSave = await uploadImageFile(imageFile);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Erreur lors du televersement.';
          setImageError(message);
          throw error;
        } finally {
          setImageUploading(false);
        }
      }

      const payloadToSave = {
        ...dataToSave,
        image_url: imageUrlForSave || null,
      };

      if (editingProduit) {
        const { error } = await supabase
          .from('produits')
          .update({
            ...payloadToSave,
            stock_actuel: duplicateProduit?.stock_actuel === null ? 0 : undefined,
            stock_minimum: duplicateProduit?.stock_minimum === null ? 1 : undefined,
            gestion_stock: true,
          })
          .eq('id', editingProduit.id);

        if (error) {
          if (error.code === '23505') {
            toast.error('Reference deja utilisee');
            return;
          }
          throw error;
        }
        toast.success('Produit modifié');
      } else {
        const { error } = await supabase
          .from('produits')
          .insert([{
            ...payloadToSave,
            user_id: user!.id,
            type: createProductType,
            stock_actuel: 0,
            stock_minimum: 1,
            gestion_stock: true,
          }]);

        if (error) {
          if (error.code === '23505') {
            toast.error('Reference deja utilisee');
            return;
          }
          throw error;
        }
        toast.success('Produit ajouté');
      }

      closeModal();
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement du produit';
      toast.error(message);
    }
  };

  const handleAddCustom = () => {
    setCreateProductType('custom');
    openModal(undefined, 'custom');
  };

  const handleAddStandard = () => {
    setCreateProductType('standard');
    openModal(undefined, 'standard');
  };

  const openImportModal = () => {
    resetImportState();
    setImportMode('create');
    setShowImportModal(true);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    resetImportState();
  };

  const handleEditSelected = () => {
    if (!canEdit) return;
    openModal(selectedProduits[0]);
  };

  const handleToggleSelected = async () => {
    if (!canBulkAction) return;
    try {
      const nextActive = !allSelectedActive;
      const { error } = await supabase
        .from('produits')
        .update({ actif: nextActive })
        .in('id', selectedIds);

      if (error) throw error;
      toast.success(nextActive ? 'Produits actives' : 'Produits desactives');
      clearSelection();
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la mise a jour des produits';
      toast.error(message);
    }
  };

  const handleDeleteSelected = async () => {
    if (!canBulkAction) return;
    const confirmMessage =
      selectedCount === 1 ? 'Supprimer ce produit ?' : `Supprimer ${selectedCount} produits ?`;
    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from('produits')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;
      toast.success('Produits supprimes');
      clearSelection();
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la suppression des produits';
      toast.error(message);
    }
  };

  const handleRowClick = (produit: Produit) => (event: React.MouseEvent<HTMLTableRowElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    openModal(produit);
  };

  const handleToggleActif = async (produit: Produit) => {
    try {
      const { error } = await supabase
        .from('produits')
        .update({ actif: !produit.actif })
        .eq('id', produit.id);

      if (error) throw error;
      toast.success(produit.actif ? 'Produit désactivé' : 'Produit activé');
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la mise a jour du produit';
      toast.error(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce produit ?')) return;

    try {
      const { error } = await supabase
        .from('produits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Produit supprimé');
      fetchProduits();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Erreur lors de la suppression du produit';
      toast.error(message);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div>
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Produits et Prestations</h1>
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onDebouncedChange={setDebouncedSearch}
            placeholder="Rechercher un produit"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Produits Standards
              </h3>
              <p className="text-sm text-blue-700">
                Ces produits sont preconfigures et peuvent etre utilises directement dans vos devis.
                Vous pouvez modifier leurs prix et parametres selon vos besoins.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddStandard}
              className="text-xs font-medium text-orange-600 hover:text-orange-700 whitespace-nowrap"
            >
              Ajouter un produit standard
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Désignation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix HT
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Marge %
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TVA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unité
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStandards.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    {hasSearch ? 'Aucun resultat' : 'Aucun produit standard'}
                  </td>
                </tr>
              ) : (
                filteredStandards.map((produit) => (
                  <tr key={produit.id} className={!produit.actif ? 'bg-gray-50 opacity-60' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                          Standard
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {produit.designation}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {produit.prix_ht_defaut?.toFixed(2) || '0.00'} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(produit.marge_defaut ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(produit.taux_tva_defaut ?? 20)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {produit.unite}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {produit.actif ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActif(produit)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {produit.actif ? 'Désactiver' : 'Activer'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openModal(produit)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Produits Personnalisés</h2>
          <p className="text-sm text-gray-600 mt-1">
            Créez vos propres produits, prestations et postes pour les réutiliser dans vos devis.
          </p>
        </div>


        <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
          <button
            type="button"
            onClick={handleAddCustom}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Ajouter
          </button>
          <button
            type="button"
            onClick={handleToggleSelected}
            disabled={!canBulkAction}
            className={`font-medium ${canBulkAction ? 'text-gray-700 hover:text-gray-900' : 'text-gray-400 cursor-not-allowed'}`}
          >
            {toggleLabel}
          </button>
          <button
            type="button"
            onClick={handleEditSelected}
            disabled={!canEdit}
            className={`font-medium ${canEdit ? 'text-blue-600 hover:text-blue-700' : 'text-gray-400 cursor-not-allowed'}`}
          >
            Modifier
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!canBulkAction}
            className={`font-medium ${canBulkAction ? 'text-red-600 hover:text-red-700' : 'text-gray-400 cursor-not-allowed'}`}
          >
            Supprimer
          </button>
          <button
            type="button"
            onClick={openImportModal}
            className="text-gray-600 hover:text-gray-800 font-medium"
          >
            Importer (CSV)
          </button>
          <Link
            href="/fournisseurs"
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Fournisseurs
          </Link>
        </div>


        <div className="bg-white rounded-lg shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="sr-only">Selection</span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Reference
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fournisseur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Prix HT
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marge %
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    TVA
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unite
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustom.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      {hasSearch ? 'Aucun resultat' : 'Aucun produit personalise. Cliquez sur "Ajouter" pour commencer.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustom.map((produit) => (
                    <tr
                      key={produit.id}
                      onClick={handleRowClick(produit)}
                      className={`${!produit.actif ? 'bg-gray-50 opacity-60' : ''} cursor-pointer`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(produit.id)}
                          onChange={() => toggleSelection(produit.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Selectionner ${produit.designation}`}
                          className="h-4 w-4 text-orange-600 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {produit.image_url ? (
                            <img
                              src={produit.image_url}
                              alt={produit.designation}
                              className="w-9 h-9 rounded-md object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-[10px] text-gray-400">
                              IMG
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900">{produit.designation}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {produit.reference || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {getFournisseurName(produit.fournisseur_defaut_id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {produit.prix_ht_defaut?.toFixed(2) || '0.00'} EUR
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(produit.marge_defaut ?? 0).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(produit.taux_tva_defaut ?? 20)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {produit.unite}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {produit.actif ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            Inactif
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Importer des produits (CSV)</h2>
              <button
                type="button"
                onClick={closeImportModal}
                className="text-gray-600 hover:text-gray-900"
              >
                Fermer
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                type="button"
                onClick={handleDownloadBlankCsv}
                className="text-sm text-blue-600 underline hover:text-blue-700"
              >
                Telecharger un fichier CSV vierge
              </button>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleImportFile}
                className="text-sm text-gray-600"
              />
              {importFileName && (
                <span className="text-sm text-gray-500">Fichier: {importFileName}</span>
              )}
            </div>

            <div className="space-y-3">
              <div className="border border-gray-200 rounded-md p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Mode d&apos;import</p>
                <div className="flex flex-col gap-2 text-sm text-gray-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="import_mode"
                      value="create"
                      checked={importMode === 'create'}
                      onChange={() => setImportMode('create')}
                    />
                    Creer un nouveau produit (meme reference autorisee)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="import_mode"
                      value="update"
                      checked={importMode === 'update'}
                      onChange={() => setImportMode('update')}
                    />
                    Mettre a jour le produit existant (match sur reference)
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="import_mode"
                      value="ignore"
                      checked={importMode === 'ignore'}
                      onChange={() => setImportMode('ignore')}
                    />
                    Ignorer les references existantes
                  </label>
                </div>
              </div>

              {importErrors.length > 0 && (
                <div className="border border-red-200 bg-red-50 text-red-700 text-sm rounded-md p-3 space-y-1">
                  {importErrors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}

              {importRows.length > 0 && (
                <div className="border border-gray-200 rounded-md p-4">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-700 mb-3">
                    <span>Total lignes: {importRows.length}</span>
                    <span>Lignes valides: {validImportRows.length}</span>
                    <span>Lignes en erreur: {errorImportRows.length}</span>
                    <span>Alertes: {warningCount}</span>
                  </div>

                  {errorImportRows.length > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Erreurs detectees</h4>
                      <ul className="text-sm text-red-700 space-y-1">
                        {errorImportRows.map((row) => (
                          <li key={row.lineNumber}>
                            Ligne {row.lineNumber}: {row.errors.join(', ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {warningCount > 0 && (
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Alertes</h4>
                      <ul className="text-sm text-amber-700 space-y-1">
                        {importRows
                          .filter((row) => row.warnings.length > 0)
                          .map((row) => (
                            <li key={row.lineNumber}>
                              Ligne {row.lineNumber}: {row.warnings.join(', ')}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Ligne</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Designation</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Reference</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Prix HT</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">TVA</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-500">Unite</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importRows.slice(0, 8).map((row) => (
                          <tr key={row.lineNumber} className={row.errors.length ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-gray-700">{row.lineNumber}</td>
                            <td className="px-3 py-2 text-gray-700">{row.data.designation}</td>
                            <td className="px-3 py-2 text-gray-700">{row.data.reference}</td>
                            <td className="px-3 py-2 text-gray-700">{row.data.prix_ht_defaut.toFixed(2)}</td>
                            <td className="px-3 py-2 text-gray-700">{row.data.taux_tva_defaut}%</td>
                            <td className="px-3 py-2 text-gray-700">{row.data.unite}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importRows.length > 8 && (
                      <p className="text-xs text-gray-500 mt-2">
                        Apercu limite aux 8 premieres lignes.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importSummary && (
                <div className="border border-green-200 bg-green-50 text-green-700 text-sm rounded-md p-3">
                  <p>Produits importes: {importSummary.imported}</p>
                  <p>Produits mis a jour: {importSummary.updated}</p>
                  <p>Lignes ignorees: {importSummary.ignored}</p>
                  <p>Erreurs: {importSummary.errors}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeImportModal}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || validImportRows.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Import en cours...' : 'Importer les lignes valides'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {editingProduit ? 'Modifier le produit' : 'Ajouter un produit'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="produit_designation" className="block text-sm font-medium text-gray-700 mb-1">
                  Désignation *
                </label>
                <input
                  id="produit_designation"
                  type="text"
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  required
                  disabled={editingProduit?.type === 'standard'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                />
              </div>


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image du produit
                </label>
                <div className="flex flex-wrap items-center gap-4">
                  {(imagePreviewUrl || formData.image_url) ? (
                    <img
                      src={imagePreviewUrl || formData.image_url}
                      alt="Apercu du produit"
                      className="w-16 h-16 rounded-md object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-gray-400">
                      Aucun
                    </div>
                  )}
                  <div className="space-y-2">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleImageChange}
                      className="block text-sm text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={handleUploadImage}
                      disabled={!imageFile || imageUploading}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    >
                      {imageUploading ? 'Televersement...' : 'Televerser'}
                    </button>
                    {imageError && (
                      <p className="text-xs text-red-600">{imageError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="produit_reference" className="block text-sm font-medium text-gray-700 mb-1">
                    Référence
                  </label>
                  <input
                    id="produit_reference"
                    type="text"
                    value={formData.reference}
                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label htmlFor="produit_categorie" className="block text-sm font-medium text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <input
                    id="produit_categorie"
                    type="text"
                    value={formData.categorie}
                    onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                    placeholder="Ex: Matériel, Prestation, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label htmlFor="produit_prix_ht_defaut" className="block text-sm font-medium text-gray-700 mb-1">
                    Prix HT par défaut *
                  </label>
                  <input
                    id="produit_prix_ht_defaut"
                    type="number"
                    step="0.01"
                    value={formData.prix_ht_defaut}
                    onChange={(e) => setFormData({ ...formData, prix_ht_defaut: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>


                <div>
                  <label htmlFor="produit_marge_defaut" className="block text-sm font-medium text-gray-700 mb-1">
                    Marge par defaut (%)
                  </label>
                  <input
                    id="produit_marge_defaut"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.marge_defaut}
                    onChange={(e) => setFormData({ ...formData, marge_defaut: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label htmlFor="produit_taux_tva_defaut" className="block text-sm font-medium text-gray-700 mb-1">
                    TVA par défaut (%) *
                  </label>
                  <select
                    id="produit_taux_tva_defaut"
                    value={String(formData.taux_tva_defaut)}
                    onChange={(e) => {
                      const rate = Number.parseFloat(e.target.value);
                      setFormData({ ...formData, taux_tva_defaut: Number.isNaN(rate) ? 0 : rate });
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {tvaOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="produit_unite" className="block text-sm font-medium text-gray-700 mb-1">
                    Unité *
                  </label>
                  <select
                    id="produit_unite"
                    value={formData.unite}
                    onChange={(e) => setFormData({ ...formData, unite: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="unité">unité</option>
                    <option value="m">m</option>
                    <option value="m²">m²</option>
                    <option value="m³">m³</option>
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="heure">heure</option>
                    <option value="jour">jour</option>
                    <option value="forfait">forfait</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="produit_fournisseur_defaut_id" className="block text-sm font-medium text-gray-700 mb-1">
                    Fournisseur par défaut
                  </label>
                  <select
                    id="produit_fournisseur_defaut_id"
                    value={formData.fournisseur_defaut_id}
                    onChange={(e) => setFormData({ ...formData, fournisseur_defaut_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">Aucun</option>
                    {fournisseurs.map((f) => (
                      <option key={f.id} value={f.id}>{f.nom}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="actif"
                  checked={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="actif" className="ml-2 block text-sm text-gray-900">
                  Produit actif (disponible dans les devis)
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 shadow-sm hover:shadow-md transition-all"
                >
                  {editingProduit ? 'Enregistrer' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

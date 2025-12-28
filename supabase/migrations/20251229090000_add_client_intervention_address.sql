-- Add intervention address fields for clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS adresse_intervention text,
  ADD COLUMN IF NOT EXISTS code_postal_intervention text,
  ADD COLUMN IF NOT EXISTS ville_intervention text;

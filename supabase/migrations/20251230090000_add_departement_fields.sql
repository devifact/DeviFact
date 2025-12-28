-- Add departement fields for address autocomplete
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS departement text;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS departement text,
  ADD COLUMN IF NOT EXISTS departement_intervention text;

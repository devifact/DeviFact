/*
  # Add automatic user profile and subscription creation

  1. Changes
    - Creates a trigger function that automatically creates a profile and subscription for new users
    - Attaches the trigger to auth.users table
    
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS during automatic creation
    - Only creates records for the new user being registered
*/

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create profile for new user
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  
  -- Create trial subscription for new user
  INSERT INTO public.abonnements (user_id, statut, date_debut_trial, date_fin_trial)
  VALUES (
    new.id,
    'trial',
    now(),
    now() + interval '30 days'
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

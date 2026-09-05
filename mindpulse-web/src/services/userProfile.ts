import { User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';

export type AppRole = 'doctor' | 'admin';

export async function createUserProfile(user: User, role: AppRole) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const fullName = String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'MindPulse User').trim();
  const [firstName, ...lastNameParts] = fullName.split(/\s+/);
  const lastName = lastNameParts.join(' ') || firstName;
  const email = user.email || '';

  const { error } = await supabase.from('USER').upsert({
    USER_ID: user.id,
    USERNAME: email,
    EMAIL: email,
    ROLE: role.toUpperCase(),
    FIRST_NAME: firstName,
    LAST_NAME: lastName,
    ACCOUNT_STATUS: 'active',
  }, { onConflict: 'USER_ID' });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getUserProfileRole(): Promise<AppRole | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('USER')
    .select('ROLE')
    .eq('USER_ID', user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data?.ROLE === 'DOCTOR') return 'doctor';
  if (data?.ROLE === 'ADMIN') return 'admin';
  return null;
}

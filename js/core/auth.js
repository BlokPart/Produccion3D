// ============================================================================
// AUTH — Manejo de sesión, login, logout, guards
// ============================================================================

import { supabase } from '../config/supabase.js';

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email, password, nombre) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { nombre } }
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
}

/**
 * Protege una página: si no hay sesión, redirige a login.
 * Devuelve el user actual cuando hay sesión válida.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/index.html';
    return null;
  }
  return session.user;
}

/** Devuelve el perfil del usuario actual (de la tabla profiles). */
export async function getProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();
  if (error) {
    console.error('getProfile error', error);
    return null;
  }
  return data;
}

'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { supabaseAnon } from '@/lib/supabaseAnon';
import { genLinkToken, genAccessCode, onlyDigits } from '@/lib/rand';
import { telegramSendMessage, telegramDeepLink } from '@/lib/telegram';
import { createSessionToken, setSessionCookie, clearSessionCookie } from '@/lib/session';

const LINK_TOKEN_TTL_MIN = 15;
const CODE_TTL_MIN = 10;

async function issueAccessCode(employee) {
  const supabase = supabaseAdmin();
  const code = genAccessCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60000).toISOString();

  const { error } = await supabase.from('access_codes').insert({
    employee_id: employee.id,
    code,
    expires_at: expiresAt,
  });
  if (error) {
    console.error('Erro ao gerar código de acesso:', error);
    return { error: 'Não foi possível gerar o código de acesso.' };
  }

  await telegramSendMessage(
    employee.telegram_chat_id,
    `Seu código de acesso à intranet Arrey Hotels: <b>${code}</b>\nVálido por ${CODE_TTL_MIN} minutos.`
  );

  return { step: 'code', employeeId: employee.id };
}

// Passo 1: pessoa digita CPF (+ data de nascimento, só no 1º acesso)
export async function identify(formData) {
  const cpf = onlyDigits(formData.get('cpf'));
  const birthDate = (formData.get('birthDate') || '').toString();

  if (!cpf) return { error: 'Digite o CPF.' };

  const supabase = supabaseAdmin();
  const { data: emp, error } = await supabase
    .from('employees')
    .select('*')
    .eq('cpf', cpf)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('Erro ao identificar CPF:', error);
    return { error: 'Erro ao verificar CPF. Tente novamente.' };
  }
  if (!emp) {
    return { error: 'CPF não encontrado. Fale com o administrador.' };
  }

  // Já vinculado ao Telegram: só manda o código
  if (emp.telegram_chat_id) {
    return await issueAccessCode(emp);
  }

  // Primeiro acesso: exige confirmar data de nascimento
  if (!birthDate) {
    return { needBirthDate: true, cpf };
  }
  if (emp.birth_date !== birthDate) {
    return { error: 'Data de nascimento não confere.', needBirthDate: true, cpf };
  }

  const token = genLinkToken();
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MIN * 60000).toISOString();

  const { error: updError } = await supabase
    .from('employees')
    .update({ telegram_link_token: token, telegram_link_token_expires_at: expiresAt })
    .eq('id', emp.id);

  if (updError) {
    console.error('Erro ao gerar token de vínculo:', updError);
    return { error: 'Não foi possível gerar o link de vínculo.' };
  }

  return {
    step: 'link',
    employeeId: emp.id,
    link: telegramDeepLink(token),
  };
}

// Chamado quando a pessoa clica "Já vinculei" — confere se o webhook já recebeu o chat_id
export async function checkLinked(employeeId) {
  const supabase = supabaseAdmin();
  const { data: emp, error } = await supabase
    .from('employees')
    .select('*')
    .eq('id', employeeId)
    .maybeSingle();

  if (error || !emp) return { error: 'Cadastro não encontrado.' };
  if (!emp.telegram_chat_id) {
    return { linked: false };
  }
  return await issueAccessCode(emp);
}

// Passo final: confere o código de 6 dígitos e cria a sessão
export async function verifyCode(formData) {
  const employeeId = formData.get('employeeId');
  const code = (formData.get('code') || '').toString().trim();

  if (!employeeId || !code) return { error: 'Preencha o código.' };

  const supabase = supabaseAdmin();
  const { data: entry, error } = await supabase
    .from('access_codes')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('code', code)
    .is('used_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !entry) {
    return { error: 'Código inválido ou expirado.', step: 'code', employeeId };
  }

  await supabase.from('access_codes').update({ used_at: new Date().toISOString() }).eq('id', entry.id);

  const { data: emp } = await supabase.from('employees').select('*').eq('id', employeeId).single();
  if (!emp) return { error: 'Cadastro não encontrado.' };

  const token = createSessionToken({
    type: 'employee',
    id: emp.id,
    role: emp.role,
    areaId: emp.area_id,
    name: emp.name,
  });
  await setSessionCookie(token);

  return { success: true };
}

// Login do admin — e-mail/senha via Supabase Auth, mas emite a MESMA sessão custom depois
export async function adminLogin(formData) {
  const email = (formData.get('email') || '').toString();
  const password = (formData.get('password') || '').toString();

  if (!email || !password) return { error: 'Preencha e-mail e senha.' };

  const supabase = supabaseAnon();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    return { error: 'E-mail ou senha inválidos.' };
  }

  const token = createSessionToken({
    type: 'admin',
    id: data.user.id,
    role: 'admin',
    areaId: null,
    name: data.user.email,
  });
  await setSessionCookie(token);

  return { success: true };
}

export async function logout() {
  await clearSessionCookie();
  return { success: true };
}

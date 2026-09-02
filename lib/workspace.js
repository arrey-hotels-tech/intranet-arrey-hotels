const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getDefaultWorkspaceId() {
  const workspaceId = process.env.DEFAULT_WORKSPACE_ID?.trim();

  if (!workspaceId) throw new Error('DEFAULT_WORKSPACE_ID não está configurado.');
  if (!UUID_PATTERN.test(workspaceId)) {
    throw new Error('DEFAULT_WORKSPACE_ID não contém um UUID válido.');
  }

  return workspaceId;
}

export function logDatabaseError(context, error, metadata = {}) {
  console.error(`[Supabase] ${context}`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    ...metadata,
  });
}

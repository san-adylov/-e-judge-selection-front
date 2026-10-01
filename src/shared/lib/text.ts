const TAG = /<[a-z][\s\S]*>/i;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Текст из редактора (HTML из v1) или из обычного поля (v2) → HTML для `safeHtml`:
 * обычный текст экранируется, переносы строк становятся `<br>`.
 */
export function textToHtml(text: string | null | undefined): string {
  const value = text?.trim() ?? '';

  if (!value) return '';

  return TAG.test(value) ? value : escapeHtml(value).replace(/\r?\n/g, '<br>');
}

import type { HttpResponse } from '@angular/common/http';

/** Имя файла из `Content-Disposition: attachment; filename*=UTF-8''…` (заголовок открыт шлюзом для CORS). */
export function fileNameOf(response: HttpResponse<Blob>, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];

  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return fallback;
    }
  }

  return header.match(/filename="?([^";]+)"?/i)?.[1] ?? fallback;
}

export function saveBlob(response: HttpResponse<Blob>, fallbackName: string): void {
  if (!response.body) return;

  const url = URL.createObjectURL(response.body);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileNameOf(response, fallbackName);
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

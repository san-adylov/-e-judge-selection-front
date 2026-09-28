import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Не показывать тост об ошибке: вызывающий код обработает её сам. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

export function skipErrorToast(context = new HttpContext()): HttpContext {
  return context.set(SKIP_ERROR_TOAST, true);
}

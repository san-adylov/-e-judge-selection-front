export interface Environment {
  production: boolean;
  /** Шлюз v2 принимает только `/v1/**`. */
  API: string;
  AUTH_API: string;
  /** За сколько секунд до истечения токена предупреждать пользователя. */
  SESSION_WARNING_SECONDS: number;
}

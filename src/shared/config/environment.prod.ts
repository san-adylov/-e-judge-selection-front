import type { Environment } from './environment.model';

export const environment: Environment = {
  production: true,
  API: '/v1',
  AUTH_API: '/v1/auth',
  SESSION_WARNING_SECONDS: 5 * 60,
};

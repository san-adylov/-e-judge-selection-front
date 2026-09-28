import type { Role } from './access-groups';

export type Language = 'RU' | 'KG' | 'EN';

/** `UserSummary` из ответа входа. Остальные поля профиля — `GET /v1/users/me`. */
export interface UserSummary {
  id: number;
  username: string;
  fullName: string;
  roles: Role[];
  /** Устаревшее скалярное поле, в коде не используется — только `roles`. */
  role: Role | null;
  language: Language;
}

/** Ответ `POST /v1/auth/login`, `/otp-login`, `/esia/exchange`. Refresh-токена в v2 нет. */
export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Срок жизни токена в секундах. */
  expiresIn: number;
  user: UserSummary;
}

export type ExerciseType = 'TEST' | 'ESSAY';

/** Упражнение из claims токена этапа: один код — одно упражнение. */
export interface StageExercise {
  exerciseId: number;
  exerciseType: ExerciseType;
}

export type AuthMethod = 'password' | 'esia' | 'stage-code';

export interface Session {
  accessToken: string;
  /** Время истечения токена, мс с начала эпохи. */
  expiresAt: number;
  user: UserSummary;
  method: AuthMethod;
  stage: StageExercise | null;
}

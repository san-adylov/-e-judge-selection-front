import type { ExerciseType, StageExercise } from './auth.models';

/** Читает payload JWT без проверки подписи — подпись проверяет шлюз. */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split('.')[1];

  if (!payload) return null;

  try {
    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));

    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** `exerciseId` и `exerciseType` есть только в claims токена этапа (вход по коду). */
export function stageExerciseOf(token: string): StageExercise | null {
  const claims = decodeJwtPayload(token);
  const exerciseId = Number(claims?.['exerciseId']);
  const exerciseType = claims?.['exerciseType'];

  if (!Number.isFinite(exerciseId) || (exerciseType !== 'TEST' && exerciseType !== 'ESSAY')) return null;

  return { exerciseId, exerciseType: exerciseType satisfies ExerciseType };
}

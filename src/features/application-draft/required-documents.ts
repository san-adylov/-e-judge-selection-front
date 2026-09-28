import type { Schemas } from '@domain/api/api.types';

type CandidateDocument = Schemas['DocumentResponse'];

export interface RequiredDocumentRow {
  /** id записи справочника `DOCUMENT_TYPE`. */
  typeId: number;
  /** Документы кандидата этого типа (раздел `DOCUMENT` личного дела). */
  documents: CandidateDocument[];
  attached: boolean;
}

/**
 * Перечень документов конкурса (`requiredDocumentTypeIds`) против документов кандидата: порядок — как в конкурсе,
 * повторы типов схлопываются, документы без файла не засчитываются.
 */
export function requiredDocumentRows(
  requiredTypeIds: readonly number[] | null | undefined,
  documents: readonly CandidateDocument[],
): RequiredDocumentRow[] {
  const byType = new Map<number, CandidateDocument[]>();

  for (const document of documents) {
    if (document.documentTypeId === undefined || document.fileId == null) continue;

    const list = byType.get(document.documentTypeId) ?? [];

    list.push(document);
    byType.set(document.documentTypeId, list);
  }

  return [...new Set(requiredTypeIds ?? [])].map((typeId) => {
    const attached = byType.get(typeId) ?? [];

    return { typeId, documents: attached, attached: attached.length > 0 };
  });
}

/** Типы обязательных документов, которых у кандидата нет. */
export function missingDocumentTypeIds(rows: readonly RequiredDocumentRow[]): number[] {
  return rows.filter((row) => !row.attached).map((row) => row.typeId);
}

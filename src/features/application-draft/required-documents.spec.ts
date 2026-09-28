import { missingDocumentTypeIds, requiredDocumentRows } from './required-documents';

describe('required documents', () => {
  const documents = [
    { id: 1, documentTypeId: 10, fileId: 100 },
    { id: 2, documentTypeId: 10, fileId: 101 },
    { id: 3, documentTypeId: 30, fileId: 300 },
    // Без файла документ не засчитывается.
    { id: 4, documentTypeId: 20 },
    // Тип, которого нет в конкурсе, в перечень не попадает.
    { id: 5, documentTypeId: 99, fileId: 999 },
  ];

  it('keeps the contest order, groups candidate documents by type and marks attached ones', () => {
    const rows = requiredDocumentRows([30, 20, 10], documents);

    expect(rows.map((row) => [row.typeId, row.attached, row.documents.map((doc) => doc.id)])).toEqual([
      [30, true, [3]],
      [20, false, []],
      [10, true, [1, 2]],
    ]);
  });

  it('collapses duplicate type ids and tolerates a missing list', () => {
    expect(requiredDocumentRows([10, 10], documents)).toHaveLength(1);
    expect(requiredDocumentRows(undefined, documents)).toEqual([]);
    expect(requiredDocumentRows(null, [])).toEqual([]);
  });

  it('lists missing type ids', () => {
    expect(missingDocumentTypeIds(requiredDocumentRows([10, 20, 40], documents))).toEqual([20, 40]);
    expect(missingDocumentTypeIds(requiredDocumentRows([10, 30], documents))).toEqual([]);
  });
});

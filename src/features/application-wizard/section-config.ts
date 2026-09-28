import type { DirectoryCode, FileCategory, ProfileSection } from '@domain/api/api.types';

/** `relative` — выбор из записей раздела RELATIVE (`AssetRequest.relativeId`). */
export type SectionFieldType = 'text' | 'textarea' | 'date' | 'checkbox' | 'directory' | 'enum' | 'file' | 'relative';

/** Что нужно условию обязательности поля помимо значений формы. */
export interface SectionFieldContext {
  /** `code` записи справочника по id (например, `KG` в CITIZENSHIP). */
  directoryCode(directory: DirectoryCode, id: unknown): string | undefined;
}

export interface SectionField {
  /** Имя поля в теле запроса раздела. Подпись — ключ i18n `profile.field.<key>`. */
  key: string;
  type: SectionFieldType;
  required?: boolean;
  /** Условная обязательность: повторяет проверки бэкенда, которые не выражены аннотациями полей. */
  requiredWhen?: (value: Record<string, unknown>, context: SectionFieldContext) => boolean;
  maxLength?: number;
  pattern?: RegExp;
  directory?: DirectoryCode;
  /** Значения enum; подписи — `profile.enum.<VALUE>`. */
  options?: readonly string[];
  /** Поле на всю ширину формы. */
  wide?: boolean;
}

export interface SectionConfig {
  section: Exclude<ProfileSection, 'ADDITIONAL_INFO'>;
  /** Категория для `POST /v1/file/upload`. */
  fileCategory: FileCategory;
  fields: SectionField[];
  /** Поля заголовка и подзаголовка записи в списке. */
  titleKeys: string[];
  subtitleKeys: string[];
  /** Импорт из госреестра по ПИН: дипломы (EDUCATION) или кадастр (ASSET). */
  importAction?: 'diplomas' | 'cadastre';
  /** Пара дат «начало — окончание»: окончание не раньше начала. */
  dateRange?: readonly [start: string, end: string];
}

const RELATION_TYPES = [
  'SPOUSE',
  'FATHER',
  'MOTHER',
  'SON',
  'DAUGHTER',
  'BROTHER',
  'SISTER',
  'GRANDFATHER',
  'GRANDMOTHER',
  'FATHER_IN_LAW',
  'MOTHER_IN_LAW',
  'OTHER',
] as const;

/** Код гражданства КР в справочнике CITIZENSHIP (`KyrgyzCitizenship.KG_CODE`). */
export const KG_CITIZENSHIP_CODE = 'KG';

const file: SectionField = { key: 'fileId', type: 'file', wide: true };
const additionalInfo: SectionField = { key: 'additionalInfo', type: 'textarea', wide: true, maxLength: 4000 };
const text = (key: string, maxLength: number, extra: Partial<SectionField> = {}): SectionField => ({
  key,
  type: 'text',
  maxLength,
  ...extra,
});

/**
 * Поля разделов личного дела — по `*Request` бэкенда v2 (`/v1/candidate/sections/{section}`), длины — по `@Size`.
 * Один компонент «список + форма» вместо шагов 3–12 мастера v1 и их мобильных копий.
 * `ADDITIONAL_INFO` привязан к заявке (`applicationId` | `judgeApplicationId`) и заполняется в мастере заявки.
 */
export const SECTION_CONFIGS: readonly SectionConfig[] = [
  {
    section: 'EDUCATION',
    fileCategory: 'EDUCATION',
    titleKeys: ['institutionNameRu'],
    subtitleKeys: ['specialityRu', 'startDate', 'endDate'],
    importAction: 'diplomas',
    dateRange: ['startDate', 'endDate'],
    fields: [
      text('institutionNameRu', 500, { required: true, wide: true }),
      text('institutionNameKg', 500, { wide: true }),
      { key: 'universityId', type: 'directory', directory: 'UNIVERSITY' },
      { key: 'educationDegreeId', type: 'directory', directory: 'EDUCATION_DEGREE' },
      { key: 'studyFormId', type: 'directory', directory: 'STUDY_FORM' },
      text('specialityRu', 500),
      text('specialityKg', 500),
      text('qualificationRu', 500),
      text('qualificationKg', 500),
      { key: 'startDate', type: 'date' },
      { key: 'endDate', type: 'date' },
      { key: 'completed', type: 'checkbox' },
      text('diplomaSerial', 32),
      text('diplomaNumber', 64),
      { key: 'diplomaDate', type: 'date' },
      text('countryOfIssue', 255),
      text('cityOfIssue', 255),
      additionalInfo,
      file,
    ],
  },
  {
    section: 'ACADEMIC_DEGREE',
    fileCategory: 'ACADEMIC_DEGREE',
    titleKeys: ['qualificationDegree'],
    subtitleKeys: ['issuedBy', 'defenseDate'],
    fields: [
      text('qualificationDegree', 255, { required: true, wide: true }),
      { key: 'dissertationTopic', type: 'textarea', wide: true, maxLength: 1000 },
      text('issuedBy', 500),
      { key: 'defenseDate', type: 'date' },
      { key: 'publicationsLinks', type: 'textarea', wide: true, maxLength: 4000 },
      file,
    ],
  },
  {
    section: 'CERTIFICATE',
    fileCategory: 'CERTIFICATE',
    titleKeys: ['topic'],
    subtitleKeys: ['issuer', 'startDate', 'endDate'],
    dateRange: ['startDate', 'endDate'],
    fields: [
      text('topic', 500, { required: true, wide: true }),
      text('issuer', 500),
      { key: 'languageLevelId', type: 'directory', directory: 'LANGUAGE_LEVEL' },
      { key: 'startDate', type: 'date' },
      { key: 'endDate', type: 'date' },
      text('countryOfIssue', 255),
      text('cityOfIssue', 255),
      additionalInfo,
      file,
    ],
  },
  {
    section: 'EMPLOYMENT',
    fileCategory: 'WORK_EXPERIENCE',
    titleKeys: ['position'],
    subtitleKeys: ['organizationName', 'startDate', 'endDate'],
    dateRange: ['startDate', 'endDate'],
    fields: [
      text('organizationName', 500, { required: true, wide: true }),
      text('department', 500),
      text('position', 500, { required: true }),
      { key: 'employmentTypeId', type: 'directory', directory: 'EMPLOYMENT_TYPE' },
      { key: 'startDate', type: 'date', required: true },
      // `EmploymentRequest.isPeriodValid`: дата окончания обязательна, если не «по настоящее время».
      { key: 'endDate', type: 'date', requiredWhen: (value) => !value['current'] },
      { key: 'current', type: 'checkbox' },
      additionalInfo,
      file,
    ],
  },
  {
    section: 'AWARD',
    fileCategory: 'AWARD',
    titleKeys: ['awardType'],
    subtitleKeys: ['issuer', 'issueDate'],
    fields: [
      text('awardType', 500, { required: true, wide: true }),
      text('issuer', 500),
      { key: 'issueDate', type: 'date' },
      text('countryOfIssue', 255),
      additionalInfo,
      file,
    ],
  },
  {
    section: 'RELATIVE',
    fileCategory: 'RELATIVE',
    titleKeys: ['lastName', 'firstName', 'middleName'],
    subtitleKeys: ['relationType', 'birthDate'],
    fields: [
      { key: 'relationType', type: 'enum', required: true, options: RELATION_TYPES },
      text('lastName', 100, { required: true }),
      text('firstName', 100, { required: true }),
      text('middleName', 100),
      { key: 'birthDate', type: 'date' },
      { key: 'gender', type: 'enum', options: ['MALE', 'FEMALE'] },
      { key: 'citizenshipId', type: 'directory', directory: 'CITIZENSHIP' },
      // `RelativeSection.validate`: гражданину КР ПИН обязателен.
      text('pin', 14, {
        pattern: /^\d{14}$/,
        requiredWhen: (value, context) =>
          context.directoryCode('CITIZENSHIP', value['citizenshipId']) === KG_CITIZENSHIP_CODE,
      }),
      { key: 'employmentTypeId', type: 'directory', directory: 'EMPLOYMENT_TYPE' },
      text('workplace', 500),
      additionalInfo,
      file,
    ],
  },
  {
    section: 'ASSET',
    fileCategory: 'ASSET',
    titleKeys: ['typeName', 'description'],
    subtitleKeys: ['relativeId', 'address', 'registrationDate'],
    importAction: 'cadastre',
    fields: [
      // Пусто — имущество самого кандидата.
      { key: 'relativeId', type: 'relative', wide: true },
      { key: 'assetTypeId', type: 'directory', directory: 'ASSET_TYPE' },
      text('typeName', 255),
      { key: 'description', type: 'textarea', wide: true, maxLength: 2000 },
      text('address', 1000, { wide: true }),
      text('ownerName', 500),
      text('share', 64),
      text('shareType', 64),
      text('propertyCode', 64),
      { key: 'registrationDate', type: 'date' },
      { key: 'termDate', type: 'date' },
      text('document', 500, { wide: true }),
      file,
    ],
  },
  {
    section: 'DOCUMENT',
    fileCategory: 'CANDIDATE_DOCUMENT',
    titleKeys: ['documentTypeId'],
    subtitleKeys: ['additionalInfo'],
    fields: [
      { key: 'documentTypeId', type: 'directory', directory: 'DOCUMENT_TYPE', required: true, wide: true },
      additionalInfo,
      { ...file, required: true },
    ],
  },
];

export function sectionConfig(section: string): SectionConfig | undefined {
  return SECTION_CONFIGS.find((config) => config.section === section);
}

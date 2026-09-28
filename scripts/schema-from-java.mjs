#!/usr/bin/env node
/**
 * Временный генератор типов API из исходников бэкенда v2 (Java records + enums).
 *
 * Нужен, пока шлюз тестового стенда недоступен для `npm run api:gen`. Выход повторяет форму
 * openapi-typescript (`components['schemas']`), поэтому после перехода на `api:gen` сервисы
 * в `src/domain/api` менять не нужно.
 *
 * Запуск: `npm run api:java` (путь к бэкенду — аргумент или переменная BACKEND_DIR,
 * по умолчанию ../../IdeaProjects/e-judge-selection-backend-2).
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const backendRoot = process.argv[2] ?? process.env.BACKEND_DIR ?? '../../IdeaProjects/e-judge-selection-backend-2';

if (!existsSync(backendRoot)) {
  console.error(`Бэкенд не найден: ${backendRoot}. Укажите путь аргументом или в BACKEND_DIR.`);
  process.exit(1);
}

const OUT = {
  api: 'src/domain/api/api.schema.ts',
  auth: 'src/domain/api/auth.schema.ts',
};

const NUMBER = new Set(['Long', 'long', 'Integer', 'int', 'Short', 'short', 'Double', 'double', 'Float', 'float', 'BigDecimal', 'BigInteger', 'Number']);
const STRING = new Set(['String', 'UUID', 'LocalDate', 'LocalDateTime', 'OffsetDateTime', 'Instant', 'ZonedDateTime', 'LocalTime', 'Duration', 'Character', 'char', 'URI']);
const BOOLEAN = new Set(['Boolean', 'boolean']);
const UNKNOWN = new Set(['Object', 'JsonNode', 'ObjectNode', 'Resource', 'MultipartFile', 'byte[]']);
const ARRAY = new Set(['List', 'Set', 'Collection', 'SortedSet', 'LinkedHashSet']);
const MAP = new Set(['Map', 'LinkedHashMap', 'HashMap', 'SortedMap', 'EnumMap']);
const REQUIRED_ANNOTATIONS = /@(NotNull|NotBlank|NotEmpty)\b/;
/** Records outside `dto` packages that are still part of the public contract. */
const EXTRA_RECORDS = new Set([
  'StoredFileRef',
  'ErrorResponse',
  'PageResponse',
  'DecisionResponse',
  'GenerateDocumentRequest',
  'SendPinRequest',
  'AuthenticateRequest',
  'SignRequest',
  'SignatureResponse',
  'SessionResponse',
  'MetricValue',
  'AuditLogResponse',
  'Selection',
  'SignatureMethod',
  'ImportReport',
]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'target' || name === 'node_modules' || name.startsWith('.')) continue;

    const full = join(dir, name);

    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith('.java') && !full.includes(`${sep}src${sep}test${sep}`)) acc.push(full);
  }

  return acc;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Removes annotations, including ones with balanced-parenthesis arguments; returns [clean, annotationsText]. */
function stripAnnotations(text) {
  let out = '';
  let annotations = '';

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '@' && /[A-Za-z]/.test(text[i + 1] ?? '')) {
      let j = i + 1;

      while (j < text.length && /[\w.]/.test(text[j])) j++;

      let k = j;

      while (k < text.length && /\s/.test(text[k])) k++;

      if (text[k] === '(') {
        let depth = 0;
        let inStr = false;

        for (; k < text.length; k++) {
          const c = text[k];

          if (c === '"' && text[k - 1] !== '\\') inStr = !inStr;
          if (inStr) continue;
          if (c === '(') depth++;
          if (c === ')' && --depth === 0) break;
        }

        j = k + 1;
      }

      annotations += text.slice(i, j) + ' ';
      i = j - 1;
      continue;
    }

    out += text[i];
  }

  return [out, annotations];
}

function splitTopLevel(text, delimiter = ',') {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const c of text) {
    if (c === '<' || c === '(' || c === '[' || c === '{') depth++;
    if (c === '>' || c === ')' || c === ']' || c === '}') depth--;

    if (c === delimiter && depth === 0) {
      parts.push(current);
      current = '';
    } else current += c;
  }

  if (current.trim()) parts.push(current);

  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Finds `record Name<T>(...)` headers and returns their component lists. */
function parseRecords(src, file) {
  const records = [];
  const re = /\brecord\s+(\w+)\s*(<[^>]*>)?\s*\(/g;
  let m;

  while ((m = re.exec(src))) {
    let depth = 1;
    let i = re.lastIndex;

    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '(') depth++;
      if (src[i] === ')') depth--;
    }

    records.push({ name: m[1], generics: m[2] ?? '', body: src.slice(re.lastIndex, i - 1), file });
  }

  return records;
}

function parseEnums(src) {
  const enums = [];
  const re = /\benum\s+(\w+)(?:\s+implements\s+[\w.,\s<>]+)?\s*\{/g;
  let m;

  while ((m = re.exec(src))) {
    let depth = 0;
    let body = '';

    for (let i = re.lastIndex; i < src.length; i++) {
      const c = src[i];

      if (depth === 0 && (c === ';' || c === '}')) break;
      if (c === '(' || c === '{') depth++;
      if (c === ')' || c === '}') depth--;
      if (depth === 0 && c !== ')' && c !== '}') body += c;
    }

    const values = splitTopLevel(stripAnnotations(body)[0])
      .map((v) => v.trim().split(/\s|\(/)[0])
      .filter((v) => /^[A-Z][A-Z0-9_]*$/.test(v));

    if (values.length) enums.push({ name: m[1], values });
  }

  return enums;
}

const files = walk(backendRoot);
const enums = new Map();
const records = [];

for (const file of files) {
  const src = stripComments(readFileSync(file, 'utf8'));
  const rel = relative(backendRoot, file).split(sep).join('/');

  for (const e of parseEnums(src)) {
    const known = enums.get(e.name);

    if (known && known.join() !== e.values.join()) console.warn(`enum ${e.name}: разные значения в нескольких файлах, взят первый`);
    if (!known) enums.set(e.name, e.values);
  }

  const isAuth = rel.startsWith('auth-service/');
  const isDto = rel.includes('/dto/') || (isAuth && /\/(login|esia|otp|user|token)\//.test(rel));

  for (const r of parseRecords(src, rel)) {
    if (isDto || EXTRA_RECORDS.has(r.name)) records.push({ ...r, target: isAuth ? 'auth' : 'api' });
  }
}

const recordNames = new Set(records.map((r) => r.name));

for (const name of recordNames) {
  const same = records.filter((r) => r.name === name);

  if (same.length > 1) console.warn(`record ${name}: ${same.length} объявления (${same.map((r) => r.file).join(', ')}), взято первое`);
}

const arrayOf = (t) => (t.includes(' | ') || t.includes(' & ') ? `(${t})[]` : `${t}[]`);

function mapType(raw, generics) {
  const type = raw.replace(/\s+/g, '').replace(/^final/, '');

  if (type.endsWith('[]')) return type === 'byte[]' ? 'string' : arrayOf(mapType(type.slice(0, -2), generics));

  const g = type.match(/^([\w.]+)<(.*)>$/);

  if (g) {
    const base = g[1].split('.').pop();
    const args = splitTopLevel(g[2]);

    if (ARRAY.has(base)) return arrayOf(mapType(args[0], generics));
    if (MAP.has(base)) return `{ [key: string]: ${mapType(args[1] ?? 'Object', generics)} }`;
    if (base === 'Optional') return mapType(args[0], generics);
    if (base === 'PageResponse') return `components['schemas']['PageResponse'] & { content?: ${arrayOf(mapType(args[0], generics))} }`;

    return 'unknown';
  }

  const base = type.split('.').pop();

  if (generics.includes(base)) return 'unknown';
  if (NUMBER.has(base)) return 'number';
  if (STRING.has(base)) return 'string';
  if (BOOLEAN.has(base)) return 'boolean';
  if (UNKNOWN.has(base)) return 'unknown';
  if (enums.has(base)) return enums.get(base).map((v) => `"${v}"`).join(' | ');
  if (recordNames.has(base)) return `components['schemas']['${base}']`;

  return 'unknown';
}

function renderRecord(r) {
  const generics = r.generics.replace(/[<>\s]/g, '').split(',').filter(Boolean);
  const lines = splitTopLevel(r.body).map((component) => {
    const [clean, annotations] = stripAnnotations(component);
    const tokens = clean.trim().split(/\s+/);
    const name = tokens.pop();
    const javaType = tokens.join('');
    const jsonName = annotations.match(/@JsonProperty\(\s*(?:value\s*=\s*)?"([^"]+)"/)?.[1] ?? name;
    const required = REQUIRED_ANNOTATIONS.test(annotations);

    return `            ${jsonName}${required ? '' : '?'}: ${mapType(javaType, generics)};`;
  });

  return [`        /** ${r.file} */`, `        ${r.name}: {`, ...lines, '        };'].join('\n');
}

function renderFile(target) {
  const seen = new Set();
  const own = records
    .filter((r) => r.target === target || (target === 'api' && EXTRA_RECORDS.has(r.name)))
    .filter((r) => !seen.has(r.name) && seen.add(r.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  // Records referenced from this file but declared in the other one are copied in, so each file stays standalone.
  const referenced = new Set();
  const collect = (r) => {
    for (const n of r.body.match(/\b[A-Z]\w+/g) ?? []) {
      const dep = records.find((x) => x.name === n);

      if (dep && !seen.has(n) && !referenced.has(n)) {
        referenced.add(n);
        collect(dep);
      }
    }
  };

  own.forEach(collect);

  const all = [...own, ...records.filter((r) => referenced.has(r.name))];

  return [
    '/**',
    ' * Сгенерировано scripts/schema-from-java.mjs из исходников бэкенда v2 — не редактировать вручную.',
    ' * Форма совпадает с openapi-typescript: после `npm run api:gen` файл перезаписывается.',
    ' */',
    '',
    'export type paths = Record<string, never>;',
    'export type webhooks = Record<string, never>;',
    'export interface components {',
    '    schemas: {',
    all.map(renderRecord).join('\n'),
    '    };',
    '    responses: never;',
    '    parameters: never;',
    '    requestBodies: never;',
    '    headers: never;',
    '    pathItems: never;',
    '}',
    'export type $defs = Record<string, never>;',
    'export type operations = Record<string, never>;',
    '',
  ].join('\n');
}

for (const target of Object.keys(OUT)) {
  writeFileSync(OUT[target], renderFile(target));
  console.log(`${OUT[target]}: ${records.filter((r) => r.target === target).length} records`);
}

console.log(`enums: ${enums.size}`);

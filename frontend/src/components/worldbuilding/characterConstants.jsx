import React from 'react';
import { Input, Select, Slider } from 'antd';
import { getMergedTemplateFromRegistry } from '../../config/characterPanelTemplates';

// ── 预设选项 ──

export const BLOOD_TYPE_OPTIONS = ['A', 'B', 'AB', 'O', 'Rh-', '特殊血型', '未知'];

export const SPECIES_OPTIONS = [
  '人类', '精灵', '矮人', '兽人', '龙族', '吸血鬼',
  '狼人', '天使', '恶魔', '半神', '妖族', '机械体', '异形',
];

export const ALIGNMENT_OPTIONS = [
  '守序善良', '中立善良', '混乱善良',
  '守序中立', '绝对中立', '混乱中立',
  '守序邪恶', '中立邪恶', '混乱邪恶',
];

export const DIMENSION_KEYS = [
  { key: '智力', color: 'var(--primary-color)' },
  { key: '体力', color: 'var(--success-color)' },
  { key: '魅力', color: 'var(--error-color)' },
  { key: '敏捷', color: 'var(--warning-color)' },
  { key: '意志', color: 'var(--primary-hover)' },
  { key: '幸运', color: 'var(--primary-color)' },
];

export const GENDER_PROFILE_KEY = 'identity.gender_profile';

export const GENDER_INITIAL_OPTIONS = ['男', '女'];

export const GENDER_TRANSITION_BASE_OPTIONS = ['男', '女'];

export const GENDER_TRANSITION_ADVANCED_OPTIONS = [
  '性别流体',
  '生理双性人',
  '非二元',
  '无性别',
  '未知 / 不明',
];

export const GENDER_TRANSITION_METHOD_OPTIONS = [
  '魔法式完全转变',
  '存在转变',
  '魔法式存在转变',
  '现代医疗式外观重塑',
  '神秘力量完全转变',
  '神秘力量存在转变',
  '神秘力量外表转变',
  '科技改造完全转变',
  '科技改造存在转变',
  '科技改造外表转变',
];

export const EXTERNAL_CHANGE_METHODS = new Set([
  '现代医疗式外观重塑',
  '神秘力量外表转变',
  '科技改造外表转变',
]);

export const EXISTENCE_CHANGE_METHODS = new Set([
  '魔法式存在转变',
  '神秘力量存在转变',
  '科技改造存在转变',
  '存在转变',
]);

export const GENITAL_RETENTION_OPTIONS = [
  { label: '未设定 / 未说明', value: 'unknown' },
  { label: '保留原性器官', value: 'yes' },
  { label: '不保留原性器官', value: 'no' },
  { label: '部分改变 / 混合状态', value: 'partial' },
];

export const CHEST_SIZE_OPTIONS = [
  '平胸',
  'AA',
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G+',
  '可变',
  '未设定 / 不明',
];

export const HAIR_LENGTH_OPTIONS = [
  '寸头',
  '短发',
  '齐耳',
  '齐下巴',
  '齐肩',
  '锁骨长度',
  '过胸',
  '及腰',
  '及臀',
  '超长',
  '可变',
  '未设定 / 不明',
];

export const EXTRA_ATTR_RESERVED_KEYS = new Set([
  '__template_base',
  '__template_deltas',
  '__template_version',
]);

export const EXTRA_ATTR_SPECIAL_HIDDEN_KEYS = new Set([
  GENDER_PROFILE_KEY,
]);

export const DYNAMIC_FIELD_TYPE_HINTS = {
  list_of_objects: '（可先输入文本描述或 JSON 数组）',
  reference: '（当前先保存文本，后续可升级为实体引用）',
  number_with_unit: '（建议带单位，如 300 年 / 2 甲子）',
};

export function parseJsonObject(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function normalizeStringValue(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s || null;
}

export function normalizeGenderComparable(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return null;
  return String(normalized).trim().toLowerCase();
}

export function normalizeSingleTagValue(value) {
  if (Array.isArray(value)) return value.find(v => `${v}`.trim()) || null;
  if (typeof value === 'string') return value.trim() || null;
  return value ?? null;
}

export function isEmptyDynamicValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every(v => `${v}`.trim() === '');
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function coerceSingleSelectToFormTags(value) {
  const normalized = normalizeSingleTagValue(value);
  return normalized ? [normalized] : [];
}

export function coerceDynamicValueForForm(field, value) {
  if (!field) return value;
  if (value == null) return value;

  switch (field.value_type) {
    case 'combobox':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) return [value];
      return value;
    case 'multi_select':
    case 'tags':
      if (Array.isArray(value)) return value;
      if (typeof value === 'string' && value.trim()) return [value];
      return [];
    case 'rating': {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    default:
      return value;
  }
}

export function normalizeDynamicValueForStorage(field, value) {
  if (!field) return value;

  switch (field.value_type) {
    case 'combobox':
    case 'select':
      return normalizeSingleTagValue(value);
    case 'multi_select':
    case 'tags':
      return Array.isArray(value)
        ? value.map(v => `${v}`.trim()).filter(Boolean)
        : (typeof value === 'string' && value.trim() ? [value.trim()] : []);
    case 'rating': {
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    default:
      return value;
  }
}

export function extractExtraAttributeFormState(character, templateRegistry) {
  const extraRaw = parseJsonObject(character?.extra_attributes);
  const templateDeltas = Array.isArray(extraRaw.__template_deltas)
    ? extraRaw.__template_deltas.filter(Boolean)
    : [];

  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, templateDeltas);
  const fieldMap = new Map((mergedTemplate?.fields || []).map(field => [field.key, field]));

  const extraFieldValues = {};
  for (const [key, value] of Object.entries(extraRaw)) {
    if (EXTRA_ATTR_RESERVED_KEYS.has(key) || EXTRA_ATTR_SPECIAL_HIDDEN_KEYS.has(key)) continue;
    extraFieldValues[key] = coerceDynamicValueForForm(fieldMap.get(key), value);
  }

  return { templateDeltas, extraFieldValues };
}

export function parseLegacyGenderStringToProfile(genderValue) {
  const raw = normalizeStringValue(genderValue);
  if (!raw) return null;

  let chainText = raw;
  const bracketMatch = raw.match(/[（(]([^（）()]+→[^（）()]+)[)）]/);
  if (bracketMatch?.[1]) {
    chainText = bracketMatch[1];
  }

  const arrowParts = chainText
    .split(/→|->|=>/)
    .map(part => part.trim())
    .filter(Boolean);

  if (arrowParts.length >= 2) {
    return {
      initial_gender: arrowParts[0],
      transitions: arrowParts.slice(1).map(toGender => ({
        to_gender: toGender,
        method: null,
        appearance_only: false,
        retain_original_genitals: 'unknown',
      })),
      notes: raw,
    };
  }

  return {
    initial_gender: raw,
    transitions: [],
  };
}

export function sanitizeGenderTransitionStep(step) {
  if (!step || typeof step !== 'object') return null;

  const toGender = normalizeSingleTagValue(step.to_gender);
  const method = normalizeSingleTagValue(step.method);
  const appearanceOnly = isExistenceGenderTransitionMethod(method)
    ? false
    : Boolean(step.appearance_only);
  const notes = normalizeStringValue(step.notes);
  const genitalRetention = normalizeStringValue(step.retain_original_genitals);
  const chestSize = normalizeSingleTagValue(step.chest_size);
  const bust = normalizeStringValue(step.bust);
  const waist = normalizeStringValue(step.waist);
  const hips = normalizeStringValue(step.hips);
  const hairLength = normalizeSingleTagValue(step.hair_length);
  const hairNotes = normalizeStringValue(step.hair_notes);

  if (!toGender && !method && !notes) return null;

  const result = {
    to_gender: toGender,
    method,
    appearance_only: appearanceOnly,
  };

  if (appearanceOnly || (method && EXTERNAL_CHANGE_METHODS.has(method))) {
    result.retain_original_genitals = genitalRetention || 'unknown';
  }
  if (toGender && !isMaleGenderValue(toGender) && chestSize) {
    result.chest_size = chestSize;
  }
  if (toGender && isFemaleGenderValue(toGender)) {
    if (bust) result.bust = bust;
    if (waist) result.waist = waist;
    if (hips) result.hips = hips;
    if (hairLength) result.hair_length = hairLength;
    if (hairNotes) result.hair_notes = hairNotes;
  }
  if (notes) result.notes = notes;

  return result;
}

export function sanitizeFemaleTraits(traits) {
  if (!traits || typeof traits !== 'object') return null;

  const chestSize = normalizeSingleTagValue(traits.chest_size);
  const bust = normalizeStringValue(traits.bust);
  const waist = normalizeStringValue(traits.waist);
  const hips = normalizeStringValue(traits.hips);
  const hairLength = normalizeSingleTagValue(traits.hair_length);
  const hairNotes = normalizeStringValue(traits.hair_notes);

  const result = {};
  if (chestSize) result.chest_size = chestSize;
  if (bust) result.bust = bust;
  if (waist) result.waist = waist;
  if (hips) result.hips = hips;
  if (hairLength) result.hair_length = hairLength;
  if (hairNotes) result.hair_notes = hairNotes;

  return Object.keys(result).length > 0 ? result : null;
}

export function sanitizeGenderProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;

  const initialGender = normalizeStringValue(profile.initial_gender);
  const notes = normalizeStringValue(profile.notes);
  const initialFemaleTraits = sanitizeFemaleTraits(profile.initial_female_traits);
  const transitions = Array.isArray(profile.transitions)
    ? profile.transitions.map(sanitizeGenderTransitionStep).filter(Boolean)
    : [];

  if (!initialGender && transitions.length === 0 && !notes && !initialFemaleTraits) return null;

  const result = {
    initial_gender: initialGender || null,
    transitions,
  };
  if (initialFemaleTraits && isFemaleGenderValue(initialGender)) {
    result.initial_female_traits = initialFemaleTraits;
  }
  if (notes) result.notes = notes;
  return result;
}

export function toGenderProfileFormValue(profile) {
  const safe = sanitizeGenderProfile(profile);
  if (!safe) {
    return {
      initial_gender: undefined,
      initial_female_traits: {},
      transitions: [],
      notes: undefined,
    };
  }

  return {
    initial_gender: safe.initial_gender,
    initial_female_traits: {
      chest_size: coerceSingleSelectToFormTags(safe.initial_female_traits?.chest_size),
      bust: safe.initial_female_traits?.bust,
      waist: safe.initial_female_traits?.waist,
      hips: safe.initial_female_traits?.hips,
      hair_length: coerceSingleSelectToFormTags(safe.initial_female_traits?.hair_length),
      hair_notes: safe.initial_female_traits?.hair_notes,
    },
    transitions: (safe.transitions || []).map(step => ({
      ...step,
      to_gender: coerceSingleSelectToFormTags(step.to_gender),
      method: coerceSingleSelectToFormTags(step.method),
      appearance_only: Boolean(step.appearance_only),
      retain_original_genitals: step.retain_original_genitals || 'unknown',
      chest_size: coerceSingleSelectToFormTags(step.chest_size),
      hair_length: coerceSingleSelectToFormTags(step.hair_length),
      bust: step.bust,
      waist: step.waist,
      hips: step.hips,
      hair_notes: step.hair_notes,
    })),
    notes: safe.notes,
  };
}

export function extractGenderProfileFormState(character) {
  const extraRaw = parseJsonObject(character?.extra_attributes);
  const fromExtra = sanitizeGenderProfile(extraRaw[GENDER_PROFILE_KEY]);
  if (fromExtra) return toGenderProfileFormValue(fromExtra);

  const legacy = parseLegacyGenderStringToProfile(character?.gender);
  return toGenderProfileFormValue(legacy);
}

export function getGenderTimelineLabels(profile) {
  const safe = sanitizeGenderProfile(profile);
  if (!safe) return [];

  const labels = [];
  if (safe.initial_gender) labels.push(safe.initial_gender);
  for (const step of safe.transitions || []) {
    if (step?.to_gender) labels.push(step.to_gender);
  }
  return labels;
}

export function deriveCurrentGenderFromProfile(profile) {
  const labels = getGenderTimelineLabels(profile);
  if (labels.length === 0) return null;
  return labels[labels.length - 1] || null;
}

export function getPreviousGenderForTransition(profile, index) {
  if (!profile || typeof profile !== 'object') return null;
  if (index <= 0) return profile.initial_gender || null;
  const prev = profile?.transitions?.[index - 1];
  return prev?.to_gender || null;
}

export function isNoOpGenderTransition(profile, index, nextTargetGender) {
  const previousGender = getPreviousGenderForTransition(profile, index);
  const prevNorm = normalizeGenderComparable(previousGender);
  const nextNorm = normalizeGenderComparable(nextTargetGender);
  if (!prevNorm || !nextNorm) return false;
  return prevNorm === nextNorm;
}

export function shouldShowGenitalRetentionField(step) {
  if (!step || typeof step !== 'object') return false;
  const method = normalizeSingleTagValue(step.method);
  if (isExistenceGenderTransitionMethod(method)) return false;
  return Boolean(step.appearance_only) || (method && EXTERNAL_CHANGE_METHODS.has(method));
}

export function isExistenceGenderTransitionMethod(methodValue) {
  const method = normalizeSingleTagValue(methodValue);
  if (!method) return false;
  return EXISTENCE_CHANGE_METHODS.has(method);
}

export function isMaleGenderValue(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return false;
  const text = String(normalized).trim();
  const lower = text.toLowerCase();
  return text === '男' || text === '男性' || lower === 'male' || lower === 'man';
}

export function isFemaleGenderValue(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return false;
  const text = String(normalized).trim();
  const lower = text.toLowerCase();
  if (text === '女' || text === '女性' || lower === 'female' || lower === 'woman') return true;
  if (lower.includes('female') || lower.includes('woman')) return true;
  if (text.includes('女')) return true;
  return false;
}

export function shouldShowChestSizeField(step) {
  if (!step || typeof step !== 'object') return false;
  const toGender = normalizeSingleTagValue(step.to_gender);
  if (!toGender) return false;
  return !isMaleGenderValue(toGender);
}

export function shouldShowFemaleSpecificFields(step) {
  if (!step || typeof step !== 'object') return false;
  const toGender = normalizeSingleTagValue(step.to_gender);
  if (!toGender) return false;
  return isFemaleGenderValue(toGender);
}

export function shouldShowInitialFemaleTraits(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return isFemaleGenderValue(profile.initial_gender);
}

export function formatThreeSizes(step) {
  if (!step || typeof step !== 'object') return null;
  const bust = normalizeStringValue(step.bust);
  const waist = normalizeStringValue(step.waist);
  const hips = normalizeStringValue(step.hips);
  if (!bust && !waist && !hips) return null;
  return `三围：${bust || '-'} / ${waist || '-'} / ${hips || '-'}`;
}

export function formatFemaleTraitsSummary(traits) {
  const safe = sanitizeFemaleTraits(traits);
  if (!safe) return [];
  return [
    safe.chest_size ? `胸部大小：${safe.chest_size}` : null,
    formatThreeSizes(safe),
    safe.hair_length ? `头发长度：${safe.hair_length}` : null,
    safe.hair_notes ? `头发特征：${safe.hair_notes}` : null,
  ].filter(Boolean);
}

export function buildExtraAttributesJson({ templateRegistry, templateDeltas, extraFieldValues }) {
  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, templateDeltas);
  const fieldMap = new Map((mergedTemplate?.fields || []).map(field => [field.key, field]));

  const payload = {
    __template_base: templateRegistry?.base_template?.template_id || 'character.base.v1',
    __template_deltas: Array.isArray(templateDeltas) ? templateDeltas : [],
  };

  for (const [key, rawValue] of Object.entries(extraFieldValues || {})) {
    const normalized = normalizeDynamicValueForStorage(fieldMap.get(key), rawValue);
    if (isEmptyDynamicValue(normalized)) continue;
    payload[key] = normalized;
  }

  const nonMetaCount = Object.keys(payload).filter(key => !EXTRA_ATTR_RESERVED_KEYS.has(key)).length;
  if (nonMetaCount === 0 && payload.__template_deltas.length === 0) return null;
  return JSON.stringify(payload);
}

export function formatDynamicValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export function normalizeCoreCharacterPayload(values) {
  const payload = { ...values };
  payload.species = normalizeSingleTagValue(payload.species);
  payload.alignment = normalizeSingleTagValue(payload.alignment);
  return payload;
}

export function groupDynamicFields(fields = []) {
  const grouped = new Map();
  for (const field of fields) {
    const group = field.group || '扩展属性';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(field);
  }
  return Array.from(grouped.entries());
}

export function renderDynamicFieldInput(field) {
  const options = Array.isArray(field.options)
    ? field.options.map(opt => ({ label: opt, value: opt }))
    : [];

  switch (field.value_type) {
    case 'textarea':
      return (
        <Input.TextArea
          rows={3}
          placeholder={field.placeholder || ''}
        />
      );
    case 'select':
      return (
        <Select
          allowClear
          showSearch
          options={options}
          placeholder={field.placeholder || '请选择'}
        />
      );
    case 'combobox':
      return (
        <Select
          mode="tags"
          maxCount={1}
          allowClear
          showSearch
          options={options}
          placeholder={field.placeholder || '选择或输入'}
        />
      );
    case 'multi_select':
      return (
        <Select
          mode={field.allow_custom ? 'tags' : 'multiple'}
          allowClear
          showSearch
          options={options}
          placeholder={field.placeholder || '可多选'}
        />
      );
    case 'tags':
      return (
        <Select
          mode="tags"
          allowClear
          showSearch
          placeholder={field.placeholder || '输入标签后回车'}
        />
      );
    case 'rating':
      return (
        <Slider
          min={Number.isFinite(field.min) ? field.min : 0}
          max={Number.isFinite(field.max) ? field.max : 100}
          tooltip={{ formatter: v => `${v}` }}
        />
      );
    case 'number':
      return <Input type="number" placeholder={field.placeholder || ''} />;
    case 'number_with_unit': {
      const unitText = Array.isArray(field.unit_options) && field.unit_options.length > 0
        ? `，单位示例：${field.unit_options.join(' / ')}`
        : '';
      return (
        <Input placeholder={field.placeholder || `请输入数值与单位${unitText}`} />
      );
    }
    case 'list_of_objects':
      return (
        <Input.TextArea
          rows={4}
          placeholder={field.placeholder || field.item_hint || '可用文本或 JSON 数组记录'}
        />
      );
    case 'reference':
      return <Input placeholder={field.placeholder || '输入关联对象名称/ID'} />;
    case 'text':
    default:
      return <Input placeholder={field.placeholder || ''} />;
  }
}

import React, { useState, useEffect } from 'react';
import {
  Button, Card, Form, Input, Modal, Spin, Empty,
  notification, Popconfirm, Tag, Space, Typography, Tooltip,
  Select, Slider, Row, Col, Divider, Checkbox
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, SearchOutlined, ArrowRightOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import {
  getCharacters, createCharacter, updateCharacter, deleteCharacter
  , getCharacterTemplates
} from '../services/characterService';
import {
  FALLBACK_CHARACTER_TEMPLATE_REGISTRY,
  TEMPLATE_DELTA_OPTIONS,
  getMergedTemplateFromRegistry,
  getTemplateDeltaLabel,
} from '../config/characterPanelTemplates';
import './CharacterManager.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ── 预设选项 ──

const BLOOD_TYPE_OPTIONS = ['A', 'B', 'AB', 'O', 'Rh-', '特殊血型', '未知'];

const SPECIES_OPTIONS = [
  '人类', '精灵', '矮人', '兽人', '龙族', '吸血鬼',
  '狼人', '天使', '恶魔', '半神', '妖族', '机械体', '异形',
];

const ALIGNMENT_OPTIONS = [
  '守序善良', '中立善良', '混乱善良',
  '守序中立', '绝对中立', '混乱中立',
  '守序邪恶', '中立邪恶', '混乱邪恶',
];

const DIMENSION_KEYS = [
  { key: '智力', color: '#1890ff' },
  { key: '体力', color: '#52c41a' },
  { key: '魅力', color: '#eb2f96' },
  { key: '敏捷', color: '#faad14' },
  { key: '意志', color: '#722ed1' },
  { key: '幸运', color: '#13c2c2' },
];

const GENDER_PROFILE_KEY = 'identity.gender_profile';

const GENDER_INITIAL_OPTIONS = ['男', '女'];

const GENDER_TRANSITION_BASE_OPTIONS = ['男', '女'];

const GENDER_TRANSITION_ADVANCED_OPTIONS = [
  '性别流体',
  '生理双性人',
  '非二元',
  '无性别',
  '未知 / 不明',
];

const GENDER_TRANSITION_METHOD_OPTIONS = [
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

const EXTERNAL_CHANGE_METHODS = new Set([
  '现代医疗式外观重塑',
  '神秘力量外表转变',
  '科技改造外表转变',
]);

const EXISTENCE_CHANGE_METHODS = new Set([
  '魔法式存在转变',
  '神秘力量存在转变',
  '科技改造存在转变',
  '存在转变',
]);

const GENITAL_RETENTION_OPTIONS = [
  { label: '未设定 / 未说明', value: 'unknown' },
  { label: '保留原性器官', value: 'yes' },
  { label: '不保留原性器官', value: 'no' },
  { label: '部分改变 / 混合状态', value: 'partial' },
];

const CHEST_SIZE_OPTIONS = [
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

const HAIR_LENGTH_OPTIONS = [
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

const EXTRA_ATTR_RESERVED_KEYS = new Set([
  '__template_base',
  '__template_deltas',
  '__template_version',
]);

const EXTRA_ATTR_SPECIAL_HIDDEN_KEYS = new Set([
  GENDER_PROFILE_KEY,
]);

const DYNAMIC_FIELD_TYPE_HINTS = {
  list_of_objects: '（可先输入文本描述或 JSON 数组）',
  reference: '（当前先保存文本，后续可升级为实体引用）',
  number_with_unit: '（建议带单位，如 300 年 / 2 甲子）',
};

function parseJsonObject(value) {
  if (!value || typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeStringValue(value) {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s || null;
}

function normalizeGenderComparable(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return null;
  return String(normalized).trim().toLowerCase();
}

function normalizeSingleTagValue(value) {
  if (Array.isArray(value)) return value.find(v => `${v}`.trim()) || null;
  if (typeof value === 'string') return value.trim() || null;
  return value ?? null;
}

function isEmptyDynamicValue(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0 || value.every(v => `${v}`.trim() === '');
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function coerceSingleSelectToFormTags(value) {
  const normalized = normalizeSingleTagValue(value);
  return normalized ? [normalized] : [];
}

function coerceDynamicValueForForm(field, value) {
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

function normalizeDynamicValueForStorage(field, value) {
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

function extractExtraAttributeFormState(character, templateRegistry) {
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

function parseLegacyGenderStringToProfile(genderValue) {
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

function sanitizeGenderTransitionStep(step) {
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

function sanitizeFemaleTraits(traits) {
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

function sanitizeGenderProfile(profile) {
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

function toGenderProfileFormValue(profile) {
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

function extractGenderProfileFormState(character) {
  const extraRaw = parseJsonObject(character?.extra_attributes);
  const fromExtra = sanitizeGenderProfile(extraRaw[GENDER_PROFILE_KEY]);
  if (fromExtra) return toGenderProfileFormValue(fromExtra);

  const legacy = parseLegacyGenderStringToProfile(character?.gender);
  return toGenderProfileFormValue(legacy);
}

function getGenderTimelineLabels(profile) {
  const safe = sanitizeGenderProfile(profile);
  if (!safe) return [];

  const labels = [];
  if (safe.initial_gender) labels.push(safe.initial_gender);
  for (const step of safe.transitions || []) {
    if (step?.to_gender) labels.push(step.to_gender);
  }
  return labels;
}

function deriveCurrentGenderFromProfile(profile) {
  const labels = getGenderTimelineLabels(profile);
  if (labels.length === 0) return null;
  return labels[labels.length - 1] || null;
}

function getPreviousGenderForTransition(profile, index) {
  if (!profile || typeof profile !== 'object') return null;
  if (index <= 0) return profile.initial_gender || null;
  const prev = profile?.transitions?.[index - 1];
  return prev?.to_gender || null;
}

function isNoOpGenderTransition(profile, index, nextTargetGender) {
  const previousGender = getPreviousGenderForTransition(profile, index);
  const prevNorm = normalizeGenderComparable(previousGender);
  const nextNorm = normalizeGenderComparable(nextTargetGender);
  if (!prevNorm || !nextNorm) return false;
  return prevNorm === nextNorm;
}

function shouldShowGenitalRetentionField(step) {
  if (!step || typeof step !== 'object') return false;
  const method = normalizeSingleTagValue(step.method);
  if (isExistenceGenderTransitionMethod(method)) return false;
  return Boolean(step.appearance_only) || (method && EXTERNAL_CHANGE_METHODS.has(method));
}

function isExistenceGenderTransitionMethod(methodValue) {
  const method = normalizeSingleTagValue(methodValue);
  if (!method) return false;
  return EXISTENCE_CHANGE_METHODS.has(method);
}

function isMaleGenderValue(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return false;
  const text = String(normalized).trim();
  const lower = text.toLowerCase();
  return text === '男' || text === '男性' || lower === 'male' || lower === 'man';
}

function isFemaleGenderValue(value) {
  const normalized = normalizeSingleTagValue(value);
  if (!normalized) return false;
  const text = String(normalized).trim();
  const lower = text.toLowerCase();
  if (text === '女' || text === '女性' || lower === 'female' || lower === 'woman') return true;
  if (lower.includes('female') || lower.includes('woman')) return true;
  if (text.includes('女')) return true;
  return false;
}

function shouldShowChestSizeField(step) {
  if (!step || typeof step !== 'object') return false;
  const toGender = normalizeSingleTagValue(step.to_gender);
  if (!toGender) return false;
  return !isMaleGenderValue(toGender);
}

function shouldShowFemaleSpecificFields(step) {
  if (!step || typeof step !== 'object') return false;
  const toGender = normalizeSingleTagValue(step.to_gender);
  if (!toGender) return false;
  return isFemaleGenderValue(toGender);
}

function shouldShowInitialFemaleTraits(profile) {
  if (!profile || typeof profile !== 'object') return false;
  return isFemaleGenderValue(profile.initial_gender);
}

function formatThreeSizes(step) {
  if (!step || typeof step !== 'object') return null;
  const bust = normalizeStringValue(step.bust);
  const waist = normalizeStringValue(step.waist);
  const hips = normalizeStringValue(step.hips);
  if (!bust && !waist && !hips) return null;
  return `三围：${bust || '-'} / ${waist || '-'} / ${hips || '-'}`;
}

function formatFemaleTraitsSummary(traits) {
  const safe = sanitizeFemaleTraits(traits);
  if (!safe) return [];
  return [
    safe.chest_size ? `胸部大小：${safe.chest_size}` : null,
    formatThreeSizes(safe),
    safe.hair_length ? `头发长度：${safe.hair_length}` : null,
    safe.hair_notes ? `头发特征：${safe.hair_notes}` : null,
  ].filter(Boolean);
}

function buildExtraAttributesJson({ templateRegistry, templateDeltas, extraFieldValues }) {
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

function formatDynamicValue(value) {
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

function normalizeCoreCharacterPayload(values) {
  const payload = { ...values };
  payload.species = normalizeSingleTagValue(payload.species);
  payload.alignment = normalizeSingleTagValue(payload.alignment);
  return payload;
}

function groupDynamicFields(fields = []) {
  const grouped = new Map();
  for (const field of fields) {
    const group = field.group || '扩展属性';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(field);
  }
  return Array.from(grouped.entries());
}

function renderDynamicFieldInput(field) {
  const options = Array.isArray(field.options)
    ? field.options.map(opt => ({ label: opt, value: opt }))
    : [];

  switch (field.value_type) {
    case 'textarea':
      return (
        <TextArea
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
        <TextArea
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

const GenderJourneyEditor = ({ form }) => {
  const watchedProfile = Form.useWatch('__gender_profile', form) || {};
  const timelineLabels = getGenderTimelineLabels(watchedProfile);
  const currentGender = deriveCurrentGenderFromProfile(watchedProfile);

  return (
    <>
      <Divider orientation="left" plain>性别设定（轨迹）</Divider>

      <Form.Item
        name={['__gender_profile', 'initial_gender']}
        label="初始性别"
        tooltip="从初始性别出发，后续可无限追加“转变”步骤"
      >
        <Select
          allowClear
          options={GENDER_INITIAL_OPTIONS.map(v => ({ label: v, value: v }))}
          placeholder="选择初始性别（男 / 女）"
        />
      </Form.Item>

      <Form.Item noStyle shouldUpdate>
        {() => {
          const profileValue = form.getFieldValue(['__gender_profile']);
          if (!shouldShowInitialFemaleTraits(profileValue)) return null;

          return (
            <>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item
                    name={['__gender_profile', 'initial_female_traits', 'chest_size']}
                    label="初始胸部大小"
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      allowClear
                      showSearch
                      options={CHEST_SIZE_OPTIONS.map(v => ({ label: v, value: v }))}
                      placeholder="选择或输入胸部大小"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={['__gender_profile', 'initial_female_traits', 'hair_length']}
                    label="初始头发长度"
                  >
                    <Select
                      mode="tags"
                      maxCount={1}
                      allowClear
                      showSearch
                      options={HAIR_LENGTH_OPTIONS.map(v => ({ label: v, value: v }))}
                      placeholder="选择或输入头发长度"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name={['__gender_profile', 'initial_female_traits', 'bust']}
                    label="初始胸围（Bust）"
                  >
                    <Input placeholder="如：88cm / 34B" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['__gender_profile', 'initial_female_traits', 'waist']}
                    label="初始腰围（Waist）"
                  >
                    <Input placeholder="如：60cm" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name={['__gender_profile', 'initial_female_traits', 'hips']}
                    label="初始臀围（Hips）"
                  >
                    <Input placeholder="如：90cm" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name={['__gender_profile', 'initial_female_traits', 'hair_notes']}
                label="初始头发特征补充"
              >
                <Input placeholder="如：黑长直 / 金色波浪卷 / 常扎高马尾" />
              </Form.Item>
            </>
          );
        }}
      </Form.Item>

      <Form.List name={['__gender_profile', 'transitions']}>
        {(fields, { add, remove }) => (
          <>
            {fields.map((field, index) => {
              const previousGender = getPreviousGenderForTransition(watchedProfile, index);
              const previousGenderNorm = normalizeGenderComparable(previousGender);
              const targetGenderOptions = [
                ...GENDER_TRANSITION_BASE_OPTIONS,
                ...GENDER_TRANSITION_ADVANCED_OPTIONS,
              ].filter(option => {
                if (!previousGenderNorm) return true;
                return normalizeGenderComparable(option) !== previousGenderNorm;
              });

              return (
                <Card
                  key={field.key}
                  size="small"
                  className="gender-transition-card"
                  style={{ marginBottom: 12 }}
                  title={(
                    <Space size={8}>
                      <ArrowRightOutlined />
                      <span>第 {index + 1} 次转变</span>
                    </Space>
                  )}
                  extra={(
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => remove(field.name)}
                    >
                      删除
                    </Button>
                  )}
                >
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item
                        name={[field.name, 'to_gender']}
                        label="转变后性别"
                        extra={previousGender ? `当前性别：${normalizeSingleTagValue(previousGender)}（不可原地转变）` : null}
                        rules={[
                          { required: true, message: '请选择或输入转变后性别' },
                          {
                            validator: async (_, value) => {
                              const profileValue = form.getFieldValue(['__gender_profile']) || {};
                              if (isNoOpGenderTransition(profileValue, field.name, value)) {
                                throw new Error('不能原地转变为当前性别，请选择不同的目标性别');
                              }
                            },
                          },
                        ]}
                      >
                        <Select
                          mode="tags"
                          maxCount={1}
                          allowClear
                          showSearch
                          options={targetGenderOptions.map(v => ({ label: v, value: v }))}
                          placeholder="选择或输入转变后性别"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name={[field.name, 'method']}
                        label="转变方式"
                        rules={[{ required: true, message: '请选择或输入转变方式' }]}
                      >
                        <Select
                          mode="tags"
                          maxCount={1}
                          allowClear
                          showSearch
                          options={GENDER_TRANSITION_METHOD_OPTIONS.map(v => ({ label: v, value: v }))}
                          placeholder="选择或输入转变方式"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const stepValue = form.getFieldValue(['__gender_profile', 'transitions', field.name]);
                      if (!isExistenceGenderTransitionMethod(stepValue?.method)) return null;

                      return (
                        <div style={{ marginBottom: 12 }}>
                          <Text type="secondary">
                            存在转变：除身体完全转变外，还包含概念级改写（如他人记忆、社会记录、身份认知同步为转变后性别）。
                          </Text>
                        </div>
                      );
                    }}
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const stepValue = form.getFieldValue(['__gender_profile', 'transitions', field.name]);
                      if (!shouldShowChestSizeField(stepValue)) return null;

                      return (
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item
                              name={[field.name, 'chest_size']}
                              label="胸部大小"
                            >
                              <Select
                                mode="tags"
                                maxCount={1}
                                allowClear
                                showSearch
                                options={CHEST_SIZE_OPTIONS.map(v => ({ label: v, value: v }))}
                                placeholder="选择或输入胸部大小"
                              />
                            </Form.Item>
                          </Col>
                        </Row>
                      );
                    }}
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const stepValue = form.getFieldValue(['__gender_profile', 'transitions', field.name]);
                      if (!shouldShowFemaleSpecificFields(stepValue)) return null;

                      return (
                        <>
                          <Row gutter={12}>
                            <Col span={8}>
                              <Form.Item
                                name={[field.name, 'bust']}
                                label="胸围（Bust）"
                              >
                                <Input placeholder="如：88cm / 34B" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item
                                name={[field.name, 'waist']}
                                label="腰围（Waist）"
                              >
                                <Input placeholder="如：60cm" />
                              </Form.Item>
                            </Col>
                            <Col span={8}>
                              <Form.Item
                                name={[field.name, 'hips']}
                                label="臀围（Hips）"
                              >
                                <Input placeholder="如：90cm" />
                              </Form.Item>
                            </Col>
                          </Row>

                          <Row gutter={12}>
                            <Col span={12}>
                              <Form.Item
                                name={[field.name, 'hair_length']}
                                label="头发长度"
                              >
                                <Select
                                  mode="tags"
                                  maxCount={1}
                                  allowClear
                                  showSearch
                                  options={HAIR_LENGTH_OPTIONS.map(v => ({ label: v, value: v }))}
                                  placeholder="选择或输入头发长度"
                                />
                              </Form.Item>
                            </Col>
                            <Col span={12}>
                              <Form.Item
                                name={[field.name, 'hair_notes']}
                                label="头发特征补充"
                              >
                                <Input placeholder="如：黑色及腰微卷 / 金色高马尾" />
                              </Form.Item>
                            </Col>
                          </Row>
                        </>
                      );
                    }}
                  </Form.Item>

                  <Form.Item
                    name={[field.name, 'appearance_only']}
                    valuePropName="checked"
                    style={{ marginBottom: 8 }}
                  >
                    <Checkbox>仅外观 / 体表转变（非完全转变）</Checkbox>
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const stepValue = form.getFieldValue(['__gender_profile', 'transitions', field.name]);
                      if (!shouldShowGenitalRetentionField(stepValue)) return null;

                      return (
                        <Row gutter={12}>
                          <Col span={12}>
                            <Form.Item
                              name={[field.name, 'retain_original_genitals']}
                              label="是否保留原性器官"
                              initialValue="unknown"
                            >
                              <Select
                                allowClear
                                options={GENITAL_RETENTION_OPTIONS}
                                placeholder="请选择"
                              />
                            </Form.Item>
                          </Col>
                          <Col span={12}>
                            <Form.Item
                              name={[field.name, 'notes']}
                              label="外观转变细节"
                            >
                              <Input placeholder="如：保留原器官，仅体型/声线/面部改变" />
                            </Form.Item>
                          </Col>
                        </Row>
                      );
                    }}
                  </Form.Item>

                  <Form.Item noStyle shouldUpdate>
                    {() => {
                      const stepValue = form.getFieldValue(['__gender_profile', 'transitions', field.name]);
                      if (shouldShowGenitalRetentionField(stepValue)) return null;

                      return (
                        <Form.Item
                          name={[field.name, 'notes']}
                          label="补充说明"
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="如：完全重塑 / 短暂形态切换 / 需付出代价" />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Card>
              );
            })}

            <Button
              type="dashed"
              block
              icon={<PlusOutlined />}
              onClick={() => add({ appearance_only: false, retain_original_genitals: 'unknown' })}
            >
              新增转变
            </Button>
          </>
        )}
      </Form.List>

      <Form.Item name={['__gender_profile', 'notes']} label="性别设定补充说明">
        <TextArea rows={2} placeholder="可记录时间点、触发条件、角色认同变化等" />
      </Form.Item>

      <div className="gender-journey-preview">
        <Text type="secondary">
          {timelineLabels.length > 0
            ? `性别轨迹：${timelineLabels.join(' → ')}`
            : '性别轨迹：未设定'}
        </Text>
        {currentGender && (
          <Tag color="geekblue" style={{ marginLeft: 8 }}>
            当前性别：{currentGender}
          </Tag>
        )}
      </div>
    </>
  );
};

const DynamicCharacterFieldsSection = ({ form, templateRegistry, loading }) => {
  const selectedDeltaKeys = Form.useWatch('__template_deltas', form) || [];
  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, selectedDeltaKeys);
  const dynamicFields = Array.isArray(mergedTemplate?.fields) ? mergedTemplate.fields : [];
  const groupedFields = groupDynamicFields(dynamicFields);

  return (
    <>
      <Divider orientation="left" plain>模板增量（基础模板 + 题材增量）</Divider>

      <Form.Item
        name="__template_deltas"
        label="题材模板增量"
        tooltip="可叠加多个增量模板，例如“奇幻 + 科幻”"
        initialValue={[]}
      >
        <Select
          mode="multiple"
          allowClear
          options={TEMPLATE_DELTA_OPTIONS}
          placeholder={loading ? '模板加载中...' : '选择题材增量模板（可选）'}
        />
      </Form.Item>

      {groupedFields.length === 0 ? (
        <Text type="secondary">当前没有可用扩展字段（模板接口不可用时会隐藏）。</Text>
      ) : (
        groupedFields.map(([groupName, fields]) => (
          <div key={groupName}>
            <Divider orientation="left" plain>{groupName}</Divider>
            {fields.map(field => (
              <Form.Item
                key={field.key}
                name={['__extra_attrs', field.key]}
                label={field.label}
                extra={field.help_text || DYNAMIC_FIELD_TYPE_HINTS[field.value_type] || null}
              >
                {renderDynamicFieldInput(field)}
              </Form.Item>
            ))}
          </div>
        ))
      )}
    </>
  );
};

const CharacterManager = ({ projectId }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [templateRegistry, setTemplateRegistry] = useState(FALLBACK_CHARACTER_TEMPLATE_REGISTRY);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) loadCharacters();
  }, [projectId]);

  useEffect(() => {
    loadCharacterTemplates();
  }, []);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const data = await getCharacters(projectId);
      setCharacters(data);
    } catch (error) {
      notification.error({ message: '加载角色失败', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const loadCharacterTemplates = async () => {
    try {
      setTemplateLoading(true);
      const data = await getCharacterTemplates();
      if (data && typeof data === 'object') {
        setTemplateRegistry({
          ...FALLBACK_CHARACTER_TEMPLATE_REGISTRY,
          ...data,
        });
      }
    } catch (error) {
      notification.warning({
        message: '角色模板加载失败',
        description: '将继续使用基础表单。可稍后重试。',
      });
    } finally {
      setTemplateLoading(false);
    }
  };

  const showModal = (character = null) => {
    setEditingCharacter(character);
    if (character) {
      let dims = {};
      try { dims = character.dimensions ? JSON.parse(character.dimensions) : {}; } catch { /* ignore */ }
      const { templateDeltas, extraFieldValues } = extractExtraAttributeFormState(character, templateRegistry);
      const genderProfileFormValue = extractGenderProfileFormState(character);
      form.setFieldsValue({
        ...character,
        species: character.species ? [character.species] : undefined,
        alignment: character.alignment ? [character.alignment] : undefined,
        ...dims,
        __gender_profile: genderProfileFormValue,
        __template_deltas: templateDeltas,
        __extra_attrs: extraFieldValues,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        __gender_profile: {
          initial_gender: undefined,
          initial_female_traits: {},
          transitions: [],
          notes: undefined,
        },
        __template_deltas: [],
        __extra_attrs: {},
      });
    }
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = normalizeCoreCharacterPayload(values);

      // 把三维 Slider 值收集成 JSON
      const dims = {};
      DIMENSION_KEYS.forEach(d => {
        if (payload[d.key] != null) {
          dims[d.key] = payload[d.key];
          delete payload[d.key];
        }
      });
      if (Object.keys(dims).length > 0) {
        payload.dimensions = JSON.stringify(dims);
      }

      const selectedTemplateDeltas = Array.isArray(payload.__template_deltas) ? payload.__template_deltas : [];
      const extraFieldValues = payload.__extra_attrs && typeof payload.__extra_attrs === 'object'
        ? payload.__extra_attrs
        : {};
      const genderProfile = sanitizeGenderProfile(payload.__gender_profile);
      if (genderProfile) {
        extraFieldValues[GENDER_PROFILE_KEY] = genderProfile;
      }
      payload.gender = deriveCurrentGenderFromProfile(genderProfile) || null;
      payload.extra_attributes = buildExtraAttributesJson({
        templateRegistry,
        templateDeltas: selectedTemplateDeltas,
        extraFieldValues,
      });

      delete payload.__gender_profile;
      delete payload.__template_deltas;
      delete payload.__extra_attrs;

      if (editingCharacter) {
        await updateCharacter(editingCharacter.id, payload);
        notification.success({ message: `角色「${payload.name}」已更新` });
      } else {
        await createCharacter(projectId, payload);
        notification.success({ message: `角色「${payload.name}」已创建` });
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingCharacter(null);
      await loadCharacters();
    } catch (error) {
      if (error.errorFields) return; // form validation error
      notification.error({ message: '保存失败', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (character) => {
    try {
      await deleteCharacter(character.id);
      notification.success({ message: `角色「${character.name}」已删除` });
      if (expandedId === character.id) setExpandedId(null);
      await loadCharacters();
    } catch (error) {
      notification.error({ message: '删除失败', description: error.message });
    }
  };

  const filteredCharacters = characters.filter(c =>
    c.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div className="character-manager">
      <div className="character-manager-header">
        <div className="header-left">
          <Title level={4} style={{ margin: 0 }}>角色管理</Title>
          <Text type="secondary">共 {characters.length} 个角色</Text>
        </div>
        <Space>
          <Input
            placeholder="搜索角色..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            新建角色
          </Button>
        </Space>
      </div>

      {loading ? (
        <div className="character-loading"><Spin size="large" tip="加载中..." /></div>
      ) : filteredCharacters.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchText ? '没有匹配的角色' : '暂无角色，点击上方按钮创建'}
        >
          {!searchText && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
              创建第一个角色
            </Button>
          )}
        </Empty>
      ) : (
        <div className="character-grid">
          {filteredCharacters.map(character => (
            <CharacterCard
              key={character.id}
              character={character}
              templateRegistry={templateRegistry}
              expanded={expandedId === character.id}
              onToggleExpand={() => setExpandedId(expandedId === character.id ? null : character.id)}
              onEdit={() => showModal(character)}
              onDelete={() => handleDelete(character)}
            />
          ))}
        </div>
      )}

      <CharacterFormModal
        visible={isModalVisible}
        editing={!!editingCharacter}
        form={form}
        saving={saving}
        templateRegistry={templateRegistry}
        templateLoading={templateLoading}
        onSave={handleSave}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); setEditingCharacter(null); }}
      />
    </div>
  );
};

// ── 角色卡片组件 ──

const CharacterCard = ({ character, templateRegistry, expanded, onToggleExpand, onEdit, onDelete }) => {
  // 基础描述字段
  const descFields = [
    { label: '性格', value: character.personality, color: 'blue' },
    { label: '外貌', value: character.appearance, color: 'purple' },
    { label: '背景', value: character.background, color: 'green' },
  ];
  // 参数字段
  const paramFields = [
    { label: '性别', value: character.gender },
    { label: '年龄', value: character.age },
    { label: '身高', value: character.height },
    { label: '体重', value: character.weight },
    { label: '生日', value: character.birthday },
    { label: '血型', value: character.blood_type },
    { label: '种族', value: character.species },
    { label: '阵营', value: character.alignment },
  ];
  const filledParams = paramFields.filter(f => f.value);
  const allFilled = [...descFields, ...paramFields].filter(f => f.value).length;
  const totalFields = descFields.length + paramFields.length;

  // 解析三维属性
  let dims = null;
  try { dims = character.dimensions ? JSON.parse(character.dimensions) : null; } catch { /* ignore */ }

  const extraAttrs = parseJsonObject(character.extra_attributes);
  const genderProfile = sanitizeGenderProfile(extraAttrs[GENDER_PROFILE_KEY]) || parseLegacyGenderStringToProfile(character.gender);
  const genderTimeline = getGenderTimelineLabels(genderProfile);
  const initialFemaleTraitsSummary = formatFemaleTraitsSummary(genderProfile?.initial_female_traits);
  const selectedTemplateDeltas = Array.isArray(extraAttrs.__template_deltas)
    ? extraAttrs.__template_deltas.filter(Boolean)
    : [];
  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, selectedTemplateDeltas);
  const extraFieldLabelMap = new Map((mergedTemplate?.fields || []).map(field => [field.key, field.label]));
  const extraEntries = Object.entries(extraAttrs)
    .filter(([key, value]) => (
      !EXTRA_ATTR_RESERVED_KEYS.has(key)
      && !EXTRA_ATTR_SPECIAL_HIDDEN_KEYS.has(key)
      && !isEmptyDynamicValue(value)
    ));

  return (
    <Card
      className={`character-card ${expanded ? 'expanded' : ''}`}
      hoverable
      onClick={onToggleExpand}
    >
      <div className="character-card-header">
        <div className="character-avatar">
          <UserOutlined />
        </div>
        <div className="character-card-info">
          <div className="character-card-name">
            {character.name}
            {character.gender && <Tag className="gender-tag">{character.gender}</Tag>}
          </div>
          <Text type="secondary" className="character-card-desc" ellipsis={{ rows: 1 }}>
            {character.description || '暂无简介'}
          </Text>
        </div>
        <Space className="character-card-actions" onClick={e => e.stopPropagation()}>
          <Tooltip title="编辑">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={onEdit} />
          </Tooltip>
          <Popconfirm
            title="确定删除该角色？"
            description="删除后不可恢复"
            onConfirm={onDelete}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      {/* 快捷信息条 */}
      <div className="character-card-quick">
        {filledParams.slice(0, 4).map(f => (
          <span key={f.label} className="quick-item">{f.label}: {f.value}</span>
        ))}
      </div>

      <div className="character-card-tags">
        <Tag color="default">完善度 {allFilled}/{totalFields}</Tag>
        {descFields.map(f => f.value && <Tag key={f.label} color={f.color}>{f.label}</Tag>)}
        {character.species && <Tag color="orange">{character.species}</Tag>}
        {character.alignment && <Tag color="red">{character.alignment}</Tag>}
        {genderTimeline.length > 1 && <Tag color="purple">性别轨迹 {genderTimeline.length - 1} 次转变</Tag>}
        {selectedTemplateDeltas.map(deltaKey => (
          <Tag key={`tpl-${deltaKey}`} color="geekblue">{getTemplateDeltaLabel(deltaKey)}</Tag>
        ))}
        {extraEntries.length > 0 && <Tag color="cyan">扩展属性 {extraEntries.length}</Tag>}
      </div>

      {expanded && (
        <div className="character-card-detail">
          {/* 参数区 */}
          {filledParams.length > 0 && (
            <div className="detail-params">
              {filledParams.map(f => (
                <div key={f.label} className="param-item">
                  <Text type="secondary" className="param-label">{f.label}</Text>
                  <Text className="param-value">{f.value}</Text>
                </div>
              ))}
            </div>
          )}

          {/* 三维属性 */}
          {dims && Object.keys(dims).length > 0 && (
            <div className="detail-dimensions">
              <Text strong className="detail-label">三维属性</Text>
              <div className="dimension-bars">
                {DIMENSION_KEYS.map(d => dims[d.key] != null && (
                  <div key={d.key} className="dimension-row">
                    <span className="dim-name">{d.key}</span>
                    <div className="dim-bar-bg">
                      <div className="dim-bar-fill" style={{ width: `${dims[d.key]}%`, background: d.color }} />
                    </div>
                    <span className="dim-val">{dims[d.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 描述区 */}
          {descFields.map(f => (
            <div key={f.label} className="detail-section">
              <Text strong className="detail-label">{f.label}</Text>
              <Paragraph className="detail-content">
                {f.value || <Text type="secondary">未填写</Text>}
              </Paragraph>
            </div>
          ))}

          {/* 能力 & 弱点 */}
          {character.abilities && (
            <div className="detail-section">
              <Text strong className="detail-label">能力 / 技能</Text>
              <Paragraph className="detail-content">{character.abilities}</Paragraph>
            </div>
          )}
          {character.weaknesses && (
            <div className="detail-section">
              <Text strong className="detail-label">弱点 / 缺陷</Text>
              <Paragraph className="detail-content">{character.weaknesses}</Paragraph>
            </div>
          )}

          {genderTimeline.length > 0 && (
            <div className="detail-section">
              <Text strong className="detail-label">性别轨迹</Text>
              <Paragraph className="detail-content">
                {genderTimeline.join(' → ')}
              </Paragraph>
              {initialFemaleTraitsSummary.length > 0 && (
                <div className="detail-params">
                  {initialFemaleTraitsSummary.map((item, idx) => (
                    <div key={`gender-initial-female-${idx}`} className="param-item">
                      <Text type="secondary" className="param-label">初始女性特征</Text>
                      <Text className="param-value">{item}</Text>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(genderProfile?.transitions) && genderProfile.transitions.length > 0 && (
                <div className="detail-params">
                  {genderProfile.transitions.map((step, idx) => (
                    <div key={`gender-step-${idx}`} className="param-item">
                      <Text type="secondary" className="param-label">
                        第 {idx + 1} 次 · {step.to_gender || '未设定目标'}
                      </Text>
                      <Text className="param-value">
                        {[
                          step.method,
                          isExistenceGenderTransitionMethod(step.method)
                            ? '存在转变（概念级改写：他人记忆/记录/身份认知同步）'
                            : null,
                          step.appearance_only ? '仅外观/体表转变' : null,
                          step.retain_original_genitals
                            ? ({
                              yes: '保留原性器官',
                              no: '不保留原性器官',
                              partial: '部分改变/混合状态',
                              unknown: '性器官状态未设定',
                            }[step.retain_original_genitals] || null)
                            : null,
                          step.chest_size ? `胸部大小：${step.chest_size}` : null,
                          formatThreeSizes(step),
                          step.hair_length ? `头发长度：${step.hair_length}` : null,
                          step.hair_notes ? `头发特征：${step.hair_notes}` : null,
                        ].filter(Boolean).join(' / ') || '未填写方式'}
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedTemplateDeltas.length > 0 || extraEntries.length > 0) && (
            <div className="detail-section">
              <Text strong className="detail-label">扩展属性</Text>
              {selectedTemplateDeltas.length > 0 && (
                <Paragraph className="detail-content">
                  模板增量：{selectedTemplateDeltas.map(getTemplateDeltaLabel).join(' / ')}
                </Paragraph>
              )}
              {extraEntries.length > 0 ? (
                <div className="detail-params">
                  {extraEntries.slice(0, 12).map(([key, value]) => (
                    <div key={key} className="param-item">
                      <Text type="secondary" className="param-label">
                        {extraFieldLabelMap.get(key) || key}
                      </Text>
                      <Text className="param-value">{formatDynamicValue(value)}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无扩展字段值</Text>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// ── 角色表单弹窗 ──

const CharacterFormModal = ({
  visible, editing, form, saving, onSave, onCancel,
  templateRegistry, templateLoading,
}) => (
  <Modal
    title={editing ? '编辑角色' : '新建角色'}
    open={visible}
    onOk={onSave}
    onCancel={onCancel}
    confirmLoading={saving}
    okText={editing ? '保存' : '创建'}
    cancelText="取消"
    width={720}
    destroyOnClose
    styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
  >
    <Form form={form} layout="vertical" requiredMark="optional">
      {/* ── 基础信息 ── */}
      <Divider orientation="left" plain>基础信息</Divider>

      <Form.Item
        name="name"
        label="角色名称"
        rules={[{ required: true, message: '请输入角色名称' }]}
      >
        <Input placeholder="如：林默" maxLength={100} showCount />
      </Form.Item>

      <Form.Item name="description" label="简介">
        <TextArea rows={2} placeholder="一句话概括角色定位" maxLength={500} showCount />
      </Form.Item>

      {/* ── 角色参数 ── */}
      <Divider orientation="left" plain>角色参数</Divider>

      <GenderJourneyEditor form={form} />

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="age" label="年龄">
            <Input placeholder="如：25 / 永生 / 少年" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="species" label="种族">
            <Select
              placeholder="选择或输入"
              options={SPECIES_OPTIONS.map(s => ({ label: s, value: s }))}
              allowClear
              showSearch
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="height" label="身高">
            <Input placeholder="如：175cm / 很高" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="weight" label="体重">
            <Input placeholder="如：65kg / 纤瘦" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="birthday" label="生日">
            <Input placeholder="如：3月14日 / 春分" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="blood_type" label="血型">
            <Select
              placeholder="选择血型"
              options={BLOOD_TYPE_OPTIONS.map(b => ({ label: b, value: b }))}
              allowClear
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Form.Item name="alignment" label="阵营">
            <Select
              placeholder="选择或输入阵营"
              options={ALIGNMENT_OPTIONS.map(a => ({ label: a, value: a }))}
              allowClear
              showSearch
              mode="tags"
              maxCount={1}
            />
          </Form.Item>
        </Col>
      </Row>

      {/* ── 三维属性 ── */}
      <Divider orientation="left" plain>三维属性（0-100）</Divider>

      <Row gutter={16}>
        {DIMENSION_KEYS.map(d => (
          <Col span={8} key={d.key}>
            <Form.Item name={d.key} label={d.key} initialValue={50}>
              <Slider
                min={0} max={100}
                trackStyle={{ background: d.color }}
                tooltip={{ formatter: v => `${v}` }}
              />
            </Form.Item>
          </Col>
        ))}
      </Row>

      {/* ── 详细描述 ── */}
      <Divider orientation="left" plain>详细描述</Divider>

      <Form.Item name="personality" label="性格特点">
        <TextArea rows={3} placeholder="描述角色的性格、习惯、口头禅等" />
      </Form.Item>

      <Form.Item name="appearance" label="外貌描述">
        <TextArea rows={3} placeholder="描述角色的外貌特征、穿着风格等" />
      </Form.Item>

      <Form.Item name="background" label="背景故事">
        <TextArea rows={3} placeholder="角色的身世、经历、动机等" />
      </Form.Item>

      <Form.Item name="abilities" label="能力 / 技能">
        <TextArea rows={2} placeholder="角色擅长的能力、特殊技能等" />
      </Form.Item>

      <Form.Item name="weaknesses" label="弱点 / 缺陷">
        <TextArea rows={2} placeholder="角色的弱点、性格缺陷等" />
      </Form.Item>

      <DynamicCharacterFieldsSection
        form={form}
        templateRegistry={templateRegistry}
        loading={templateLoading}
      />
    </Form>
  </Modal>
);

export default CharacterManager;

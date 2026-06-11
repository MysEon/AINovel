export const FALLBACK_CHARACTER_TEMPLATE_REGISTRY = {
  base_template: {
    template_id: 'character.base.v1',
    label: '通用角色模板',
    fields: [],
    field_groups: ['世界观专属'],
    default_visible_groups: ['世界观专属'],
  },
  delta_templates: {},
  merged_templates: {},
};

export const TEMPLATE_DELTA_LABELS = {
  fantasy: '奇幻增量',
  scifi: '科幻增量',
  xianxia: '修仙增量',
};

export const TEMPLATE_DELTA_OPTIONS = [
  { label: '奇幻增量', value: 'fantasy' },
  { label: '科幻增量', value: 'scifi' },
  { label: '修仙增量', value: 'xianxia' },
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function mergeCharacterTemplate(baseTemplate, ...deltaTemplates) {
  const base = clone(baseTemplate || FALLBACK_CHARACTER_TEMPLATE_REGISTRY.base_template);
  base.fields = Array.isArray(base.fields) ? base.fields : [];
  base.field_groups = Array.isArray(base.field_groups) ? base.field_groups : [];
  base.default_visible_groups = Array.isArray(base.default_visible_groups) ? base.default_visible_groups : [];
  base.applied_deltas = [];

  const fieldByKey = new Map(base.fields.map(field => [field.key, field]));

  for (const delta of deltaTemplates) {
    if (!delta) continue;
    base.applied_deltas.push(delta.template_id);

    for (const field of delta.add_fields || []) {
      const existing = fieldByKey.get(field.key);
      if (!existing) {
        const nextField = clone(field);
        base.fields.push(nextField);
        fieldByKey.set(nextField.key, nextField);
        continue;
      }

      if (Array.isArray(field.options)) {
        const mergedOptions = new Set(Array.isArray(existing.options) ? existing.options : []);
        for (const option of field.options) mergedOptions.add(option);
        existing.options = Array.from(mergedOptions);
      }

      for (const k of ['label', 'placeholder', 'help_text']) {
        if (!existing[k] && field[k]) existing[k] = field[k];
      }
    }

    for (const group of delta.add_groups || []) {
      if (!base.field_groups.includes(group)) base.field_groups.push(group);
    }
    for (const group of delta.default_visible_groups || []) {
      if (!base.default_visible_groups.includes(group)) base.default_visible_groups.push(group);
    }
  }

  for (const field of base.fields) {
    if (field.group && !base.field_groups.includes(field.group)) {
      base.field_groups.push(field.group);
    }
  }

  return base;
}

export function getMergedTemplateFromRegistry(registry, deltaKeys = []) {
  const safeRegistry = registry || FALLBACK_CHARACTER_TEMPLATE_REGISTRY;
  const base = safeRegistry.base_template || FALLBACK_CHARACTER_TEMPLATE_REGISTRY.base_template;
  const deltas = Array.isArray(deltaKeys)
    ? deltaKeys.map(key => safeRegistry.delta_templates?.[key]).filter(Boolean)
    : [];

  if (deltas.length === 1) {
    const singleKey = deltaKeys[0];
    if (safeRegistry.merged_templates?.[singleKey]) {
      return safeRegistry.merged_templates[singleKey];
    }
  }

  return mergeCharacterTemplate(base, ...deltas);
}

export function getTemplateDeltaLabel(key) {
  return TEMPLATE_DELTA_LABELS[key] || key;
}


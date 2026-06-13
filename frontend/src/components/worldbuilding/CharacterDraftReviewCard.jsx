import React, { useEffect } from 'react';
import { Button, Card, Empty, Form, Input, Progress, Select } from 'antd';
import {
  normalizeCoreCharacterPayload,
  normalizeSingleTagValue,
} from './characterConstants';
import './CharacterDraftReviewCard.css';

const { TextArea } = Input;

const EXTRA_FIELD_LABELS = {
  core_conflict: '核心冲突',
  inner_monologue: '内心独白',
  relationships: '关系网络',
  habits: '习惯',
  catchphrase: '口头禅',
  dreams: '梦想',
  tags: '标签',
};

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDimensionValue(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.min(100, Math.max(0, Math.round(numberValue)));
}

function formatExtraObjectValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatEditableJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function parseEditableJsonValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function buildExtraFieldFormValues(extraFields) {
  if (!isPlainObject(extraFields)) return {};

  return Object.fromEntries(
    Object.entries(extraFields).map(([key, value]) => {
      if (isPlainObject(value)) {
        return [
          key,
          {
            __entries: Object.entries(value).map(([entryKey, entryValue]) => ({
              key: entryKey,
              value: formatExtraObjectValue(entryValue),
            })),
          },
        ];
      }
      if (Array.isArray(value)) {
        return [key, value.map(item => `${item}`).filter(Boolean)];
      }
      if (typeof value === 'string') {
        return [key, value];
      }
      return [key, formatEditableJson(value)];
    })
  );
}

function buildInitialValues(draft) {
  const dimensions = draft?.dimensions && typeof draft.dimensions === 'object'
    ? draft.dimensions
    : {};

  return {
    name: draft?.name || '',
    description: draft?.description || '',
    personality: draft?.personality || '',
    background: draft?.background || '',
    appearance: draft?.appearance || '',
    age: draft?.age || '',
    species: draft?.species || '',
    alignment: draft?.alignment || '',
    abilities: draft?.abilities || '',
    weaknesses: draft?.weaknesses || '',
    dimensions,
    extra_fields: buildExtraFieldFormValues(draft?.extra_fields),
  };
}

function buildExtraFieldsPayload(valuesExtraFields, sourceExtraFields) {
  if (!isPlainObject(sourceExtraFields)) return {};

  const result = {};
  for (const [key, originalValue] of Object.entries(sourceExtraFields)) {
    const formValue = valuesExtraFields?.[key];

    if (typeof originalValue === 'string') {
      const text = typeof formValue === 'string' ? formValue.trim() : '';
      if (text) result[key] = text;
      continue;
    }

    if (Array.isArray(originalValue)) {
      const items = Array.isArray(formValue)
        ? formValue.map(item => `${item}`.trim()).filter(Boolean)
        : [];
      if (items.length > 0) result[key] = items;
      continue;
    }

    if (isPlainObject(originalValue)) {
      const entries = Array.isArray(formValue?.__entries) ? formValue.__entries : [];
      const objectValue = {};
      entries.forEach(entry => {
        const entryKey = typeof entry?.key === 'string' ? entry.key.trim() : '';
        if (!entryKey) return;
        objectValue[entryKey] = typeof entry?.value === 'string' ? entry.value.trim() : entry?.value;
      });
      if (Object.keys(objectValue).length > 0) result[key] = objectValue;
      continue;
    }

    const parsedValue = parseEditableJsonValue(formValue);
    if (parsedValue !== undefined) result[key] = parsedValue;
  }

  return result;
}

function buildPayload(values, sourceExtraFields) {
  const payload = normalizeCoreCharacterPayload({
    name: values.name,
    description: values.description,
    personality: values.personality,
    background: values.background,
    appearance: values.appearance,
    age: values.age,
    species: normalizeSingleTagValue(values.species),
    alignment: normalizeSingleTagValue(values.alignment),
    abilities: values.abilities,
    weaknesses: values.weaknesses,
  });

  const dims = values.dimensions && typeof values.dimensions === 'object'
    ? Object.fromEntries(
      Object.entries(values.dimensions)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => [key, normalizeDimensionValue(value)])
    )
    : {};

  if (Object.keys(dims).length > 0) {
    payload.dimensions = JSON.stringify(dims);
  }

  const extraFields = buildExtraFieldsPayload(values.extra_fields, sourceExtraFields);
  if (Object.keys(extraFields).length > 0) {
    payload.extra_attributes = JSON.stringify(extraFields);
  }

  return payload;
}

function getExtraFieldLabel(key) {
  return EXTRA_FIELD_LABELS[key] || key;
}

function renderExtraFieldInput(fieldKey, value) {
  const label = <span className="character-draft-field-label">{getExtraFieldLabel(fieldKey)}</span>;

  if (typeof value === 'string') {
    return (
      <Form.Item key={fieldKey} name={['extra_fields', fieldKey]} label={label}>
        <TextArea rows={3} placeholder={`请输入${getExtraFieldLabel(fieldKey)}`} />
      </Form.Item>
    );
  }

  if (Array.isArray(value)) {
    return (
      <Form.Item key={fieldKey} name={['extra_fields', fieldKey]} label={label}>
        <Select mode="tags" allowClear placeholder={`输入${getExtraFieldLabel(fieldKey)}后回车`} />
      </Form.Item>
    );
  }

  if (isPlainObject(value)) {
    return (
      <div className="character-draft-extra-object" key={fieldKey}>
        <span className="character-draft-field-label">{getExtraFieldLabel(fieldKey)}</span>
        <Form.List name={['extra_fields', fieldKey, '__entries']}>
          {(fields, { add, remove }) => (
            <div className="character-draft-kv-list">
              {fields.map(({ key, name, ...restField }) => (
                <div className="character-draft-kv-row" key={key}>
                  <Form.Item
                    {...restField}
                    name={[name, 'key']}
                    className="character-draft-kv-key"
                    rules={[{ required: true, message: '请输入键名' }]}
                  >
                    <Input placeholder="键名" />
                  </Form.Item>
                  <Form.Item
                    {...restField}
                    name={[name, 'value']}
                    className="character-draft-kv-value"
                  >
                    <Input placeholder="内容" />
                  </Form.Item>
                  <Button type="link" danger onClick={() => remove(name)}>
                    删除
                  </Button>
                </div>
              ))}
              <Button type="dashed" onClick={() => add({ key: '', value: '' })}>
                添加一项
              </Button>
            </div>
          )}
        </Form.List>
      </div>
    );
  }

  return (
    <Form.Item key={fieldKey} name={['extra_fields', fieldKey]} label={label}>
      <TextArea rows={3} className="character-draft-readonly-json" placeholder="可编辑 JSON 或文本" />
    </Form.Item>
  );
}

const CharacterDraftReviewCard = ({ draft, onConfirm, onRegenerate, onCancel }) => {
  const [form] = Form.useForm();
  const watchedDimensions = Form.useWatch('dimensions', form) || {};
  const dimensionKeys = Object.keys(watchedDimensions);
  const extraFields = isPlainObject(draft?.extra_fields) ? draft.extra_fields : {};
  const extraFieldEntries = Object.entries(extraFields);

  useEffect(() => {
    if (draft) {
      form.setFieldsValue(buildInitialValues(draft));
    }
  }, [draft, form]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    await onConfirm(buildPayload(values, extraFields));
  };

  return (
    <Card className="character-draft-review-card" bordered={false}>
      <div className="character-draft-review-head">
        <div>
          <h3 className="character-draft-review-title">简历预览</h3>
          <p className="character-draft-review-subtitle">
            AI 已生成角色档案。你可以直接编辑每个字段，确认后创建到当前项目。
          </p>
        </div>
      </div>

      <Form form={form} layout="vertical" requiredMark="optional">
        <div className="character-draft-review-grid">
          <div className="character-draft-basic-panel">
            <Form.Item
              name="name"
              label={<span className="character-draft-field-label">姓名</span>}
              rules={[{ required: true, message: '请输入角色名称' }]}
            >
              <Input placeholder="角色名称" maxLength={100} />
            </Form.Item>
            <Form.Item name="age" label={<span className="character-draft-field-label">年龄</span>}>
              <Input placeholder="年龄" />
            </Form.Item>
            <Form.Item name="species" label={<span className="character-draft-field-label">种族</span>}>
              <Input placeholder="种族" />
            </Form.Item>
            <Form.Item name="alignment" label={<span className="character-draft-field-label">阵营</span>}>
              <Input placeholder="阵营" />
            </Form.Item>
          </div>

          <div className="character-draft-detail-panel">
            <Form.Item name="description" label={<span className="character-draft-field-label">简介</span>}>
              <TextArea rows={2} placeholder="一句话概括角色定位" />
            </Form.Item>
            <Form.Item name="personality" label={<span className="character-draft-field-label">性格</span>}>
              <TextArea rows={3} placeholder="性格特点" />
            </Form.Item>
            <Form.Item name="background" label={<span className="character-draft-field-label">背景</span>}>
              <TextArea rows={3} placeholder="背景故事" />
            </Form.Item>
            <Form.Item name="appearance" label={<span className="character-draft-field-label">外貌</span>}>
              <TextArea rows={3} placeholder="外貌描述" />
            </Form.Item>
            <Form.Item name="abilities" label={<span className="character-draft-field-label">能力 / 技能</span>}>
              <TextArea rows={2} placeholder="能力或技能" />
            </Form.Item>
            <Form.Item name="weaknesses" label={<span className="character-draft-field-label">弱点 / 缺陷</span>}>
              <TextArea rows={2} placeholder="弱点或缺陷" />
            </Form.Item>
          </div>

          {extraFieldEntries.length > 0 && (
            <div className="character-draft-extra-panel">
              <h4 className="character-draft-section-title">扩展属性</h4>
              <div className="character-draft-extra-grid">
                {extraFieldEntries.map(([fieldKey, value]) => renderExtraFieldInput(fieldKey, value))}
              </div>
            </div>
          )}

          <div className="character-draft-dimensions-panel">
            <h4 className="character-draft-section-title">三维 / 能力维度</h4>
            {dimensionKeys.length > 0 ? (
              <div className="character-draft-dimensions-grid">
                {dimensionKeys.map(key => (
                  <div className="character-draft-dimension-item" key={key}>
                    <span className="character-draft-field-label">{key}</span>
                    <Progress
                      percent={normalizeDimensionValue(watchedDimensions[key])}
                      size="small"
                      strokeColor="var(--primary-color)"
                    />
                    <Form.Item name={['dimensions', key]} noStyle>
                      <Input type="number" min={0} max={100} placeholder="0-100" />
                    </Form.Item>
                  </div>
                ))}
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无维度评分" />
            )}
          </div>
        </div>
      </Form>

      <div className="character-draft-actions">
        <Button onClick={onRegenerate}>重新生成</Button>
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleCreate}>创建角色</Button>
      </div>
    </Card>
  );
};

export default CharacterDraftReviewCard;

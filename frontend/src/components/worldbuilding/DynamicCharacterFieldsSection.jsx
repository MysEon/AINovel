import React from 'react';
import {
  Form, Divider, Typography, Select,
} from 'antd';
import {
  TEMPLATE_DELTA_OPTIONS,
  getMergedTemplateFromRegistry,
} from '../../config/characterPanelTemplates';
import {
  DYNAMIC_FIELD_TYPE_HINTS,
  groupDynamicFields,
  renderDynamicFieldInput,
} from './characterConstants';

const { Text } = Typography;

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

export default DynamicCharacterFieldsSection;

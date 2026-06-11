import React from 'react';
import {
  Card, Button, Space, Row, Col, Form, Select, Input, Checkbox, Typography,
} from 'antd';
import { ArrowRightOutlined, MinusCircleOutlined } from '@ant-design/icons';
import {
  GENDER_TRANSITION_BASE_OPTIONS,
  GENDER_TRANSITION_ADVANCED_OPTIONS,
  GENDER_TRANSITION_METHOD_OPTIONS,
  GENITAL_RETENTION_OPTIONS,
  CHEST_SIZE_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  getPreviousGenderForTransition,
  normalizeGenderComparable,
  normalizeSingleTagValue,
  isNoOpGenderTransition,
  isExistenceGenderTransitionMethod,
  shouldShowChestSizeField,
  shouldShowFemaleSpecificFields,
  shouldShowGenitalRetentionField,
  EXTERNAL_CHANGE_METHODS,
} from './characterConstants';

const { Text } = Typography;

const GenderTransitionCard = ({ field, index, form, watchedProfile, remove }) => {
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
};

export default GenderTransitionCard;

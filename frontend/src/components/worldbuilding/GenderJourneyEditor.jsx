import React from 'react';
import {
  Button, Form, Select, Input, Row, Col, Divider, Typography, Tag,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import GenderTransitionCard from './GenderTransitionCard';
import {
  GENDER_INITIAL_OPTIONS,
  CHEST_SIZE_OPTIONS,
  HAIR_LENGTH_OPTIONS,
  getGenderTimelineLabels,
  deriveCurrentGenderFromProfile,
  shouldShowInitialFemaleTraits,
} from './characterConstants';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

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
            {fields.map((field, index) => (
              <GenderTransitionCard
                key={field.key}
                field={field}
                index={index}
                form={form}
                watchedProfile={watchedProfile}
                remove={remove}
              />
            ))}

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

export default GenderJourneyEditor;

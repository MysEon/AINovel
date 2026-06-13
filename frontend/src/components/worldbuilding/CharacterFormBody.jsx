import React from 'react';
import {
  Form, Divider, Row, Col, Input, Select, Slider,
} from 'antd';
import GenderJourneyEditor from './GenderJourneyEditor';
import DynamicCharacterFieldsSection from './DynamicCharacterFieldsSection';
import {
  SPECIES_OPTIONS,
  ALIGNMENT_OPTIONS,
  BLOOD_TYPE_OPTIONS,
  DIMENSION_KEYS,
} from './characterConstants';

const { TextArea } = Input;

const CharacterFormBody = ({ form, templateRegistry, templateLoading, includeDynamicFields = true }) => (
  <>
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

    {includeDynamicFields && (
      <DynamicCharacterFieldsSection
        form={form}
        templateRegistry={templateRegistry}
        loading={templateLoading}
      />
    )}
  </>
);

export default CharacterFormBody;

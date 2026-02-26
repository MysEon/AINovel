import React, { useState, useEffect } from 'react';
import {
  Button, Card, Form, Input, Modal, Spin, Empty,
  notification, Popconfirm, Tag, Space, Typography, Tooltip,
  Select, Slider, Row, Col, Divider
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  UserOutlined, SearchOutlined
} from '@ant-design/icons';
import {
  getCharacters, createCharacter, updateCharacter, deleteCharacter
} from '../services/characterService';
import './CharacterManager.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ── 预设选项 ──

const GENDER_OPTIONS = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '跨性别（男→女）', value: '跨性别（男→女）' },
  { label: '跨性别（女→男）', value: '跨性别（女→男）' },
  { label: '双性 / 雌雄同体', value: '双性' },
  { label: '非二元', value: '非二元' },
  { label: '性别流动', value: '性别流动' },
  { label: '无性别', value: '无性别' },
  { label: '未知 / 不明', value: '未知' },
];

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

const CharacterManager = ({ projectId }) => {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (projectId) loadCharacters();
  }, [projectId]);

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

  const showModal = (character = null) => {
    setEditingCharacter(character);
    if (character) {
      let dims = {};
      try { dims = character.dimensions ? JSON.parse(character.dimensions) : {}; } catch { /* ignore */ }
      form.setFieldsValue({ ...character, ...dims });
    } else {
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // 把三维 Slider 值收集成 JSON
      const dims = {};
      DIMENSION_KEYS.forEach(d => {
        if (values[d.key] != null) {
          dims[d.key] = values[d.key];
          delete values[d.key];
        }
      });
      if (Object.keys(dims).length > 0) {
        values.dimensions = JSON.stringify(dims);
      }

      if (editingCharacter) {
        await updateCharacter(editingCharacter.id, values);
        notification.success({ message: `角色「${values.name}」已更新` });
      } else {
        await createCharacter(projectId, values);
        notification.success({ message: `角色「${values.name}」已创建` });
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
        onSave={handleSave}
        onCancel={() => { setIsModalVisible(false); form.resetFields(); setEditingCharacter(null); }}
      />
    </div>
  );
};

// ── 角色卡片组件 ──

const CharacterCard = ({ character, expanded, onToggleExpand, onEdit, onDelete }) => {
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
        </div>
      )}
    </Card>
  );
};

// ── 角色表单弹窗 ──

const CharacterFormModal = ({ visible, editing, form, saving, onSave, onCancel }) => (
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

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="gender" label="性别">
            <Select
              placeholder="选择性别"
              options={GENDER_OPTIONS}
              allowClear
              showSearch
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="age" label="年龄">
            <Input placeholder="如：25 / 永生 / 少年" />
          </Form.Item>
        </Col>
        <Col span={8}>
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
        <Col span={8}>
          <Form.Item name="height" label="身高">
            <Input placeholder="如：175cm / 很高" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="weight" label="体重">
            <Input placeholder="如：65kg / 纤瘦" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="birthday" label="生日">
            <Input placeholder="如：3月14日 / 春分" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="blood_type" label="血型">
            <Select
              placeholder="选择血型"
              options={BLOOD_TYPE_OPTIONS.map(b => ({ label: b, value: b }))}
              allowClear
            />
          </Form.Item>
        </Col>
        <Col span={16}>
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
    </Form>
  </Modal>
);

export default CharacterManager;

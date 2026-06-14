import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Spin, Tag, notification } from 'antd';
import {
  FaBuilding,
  FaGlobe,
  FaLightbulb,
  FaMapMarkedAlt,
  FaPen,
  FaPlus,
  FaRobot,
  FaSearch,
  FaSyncAlt,
  FaTrash,
} from 'react-icons/fa';
import aiService from '../../services/aiService';
import { worldbuildingServices } from '../../services/worldbuildingService';
import './WorldbuildingManager.css';

const { TextArea } = Input;

const ENTITY_CONFIGS = {
  worldviews: {
    Icon: FaGlobe,
    eyebrow: 'WORLD MEMORY',
    title: '世界观管理',
    singular: '世界观',
    plural: '世界观',
    description: '沉淀规则、力量体系、技术边界和历史时间线，让 AI 写作时有稳定的世界底座。',
    emptyTitle: '还没有世界观设定',
    emptyDescription: '先写下这个世界最不能被违反的规则，后面的角色、地点和冲突才会站稳。',
    addText: '新增世界观',
    searchPlaceholder: '搜索世界规则、魔法、科技或时间线',
    aiIntent: 'worldview-expansion',
    promptHints: ['核心规则是否清楚', '力量/科技代价是否明确', '时间线是否能支撑冲突'],
    fields: [
      { name: 'description', label: '核心概念', shortLabel: '概念', placeholder: '这个世界最重要的前提、氛围和题材承诺。' },
      { name: 'rules', label: '世界规则', shortLabel: '规则', placeholder: '不可违背的物理、社会、超自然或叙事规则。' },
      { name: 'magic_system', label: '力量体系', shortLabel: '力量', placeholder: '魔法、异能、信仰、资源或其他超常机制的来源、限制和代价。' },
      { name: 'technology', label: '技术水平', shortLabel: '技术', placeholder: '科技阶段、关键设备、文明能力边界。' },
      { name: 'timeline', label: '历史时间线', shortLabel: '时间线', placeholder: '重大历史节点、灾变、王朝更替、战争或文明断层。' },
    ],
  },
  locations: {
    Icon: FaMapMarkedAlt,
    eyebrow: 'SCENE MAP',
    title: '地点管理',
    singular: '地点',
    plural: '地点',
    description: '管理城市、遗迹、据点与场景空间，把地理、文化和历史变成可复用的剧情舞台。',
    emptyTitle: '还没有地点资料',
    emptyDescription: '先建立一个角色会反复回到、或冲突会爆发的地点。',
    addText: '新增地点',
    searchPlaceholder: '搜索地点、地理、文化或历史',
    aiIntent: 'location-expansion',
    promptHints: ['地点是否有可拍摄的视觉锚点', '文化是否会影响角色选择', '历史是否埋着剧情钩子'],
    fields: [
      { name: 'description', label: '地点摘要', shortLabel: '摘要', placeholder: '地点的定位、视觉印象和剧情功能。' },
      { name: 'geography', label: '地理结构', shortLabel: '地理', placeholder: '方位、地貌、交通、资源、空间层级。' },
      { name: 'culture', label: '文化气质', shortLabel: '文化', placeholder: '居民习俗、语言、禁忌、审美、日常秩序。' },
      { name: 'history', label: '地点历史', shortLabel: '历史', placeholder: '过往事件、传说、旧主人、灾难或被掩盖的真相。' },
    ],
  },
  organizations: {
    Icon: FaBuilding,
    eyebrow: 'FACTION BOARD',
    title: '组织管理',
    singular: '组织',
    plural: '组织',
    description: '管理势力、机构、教团、公司和秘密团体，让人物关系和剧情冲突有可追踪的权力结构。',
    emptyTitle: '还没有组织资料',
    emptyDescription: '先建立一个会推动资源、任务、追杀、庇护或阴谋的组织。',
    addText: '新增组织',
    searchPlaceholder: '搜索组织、结构、目的或影响力',
    aiIntent: 'organization-expansion',
    promptHints: ['组织目的是否会制造冲突', '层级结构是否能产生背叛', '影响力边界是否清楚'],
    fields: [
      { name: 'description', label: '组织摘要', shortLabel: '摘要', placeholder: '组织的定位、公开形象和隐藏面。' },
      { name: 'structure', label: '组织结构', shortLabel: '结构', placeholder: '层级、职位、派系、成员来源、管理方式。' },
      { name: 'purpose', label: '组织目的', shortLabel: '目的', placeholder: '公开目标、真实目标、短期任务与长期野心。' },
      { name: 'influence', label: '影响力', shortLabel: '影响', placeholder: '控制的资源、地盘、人脉、舆论、武力或制度权力。' },
    ],
  },
};

const normalizeItems = (value) => (Array.isArray(value) ? value : []);

const truncate = (text, length = 120) => {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

const normalizeAiText = (payload) => {
  if (!payload) return '';
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return payload.map(normalizeAiText).filter(Boolean).join('\n');
  if (payload.ideas) return normalizeAiText(payload.ideas);
  if (payload.message) return payload.message;
  return JSON.stringify(payload, null, 2);
};

const getFilledFields = (item, fields) =>
  fields.filter((field) => String(item?.[field.name] || '').trim().length > 0);

const buildSearchText = (item, fields) =>
  [item.name, ...fields.map((field) => item[field.name])].filter(Boolean).join(' ').toLowerCase();

const buildAiPrompt = ({ config, items, selectedItem }) => {
  const lines = [
    `你是 AI 小说项目的${config.singular}设定顾问。`,
    `请基于当前${config.plural}资料，给出可直接用于完善小说知识库的建议。`,
    '输出请包含：1）最强可用设定；2）最明显缺口；3）三条可立即补写的资料；4）一个能推动剧情冲突的增强建议。',
    '',
    `当前聚焦${config.singular}：${selectedItem?.name || '无'}`,
  ];

  if (selectedItem) {
    config.fields.forEach((field) => {
      lines.push(`${field.label}：${selectedItem[field.name] || '未填写'}`);
    });
  }

  lines.push('', `全部${config.plural}：`);
  items.slice(0, 12).forEach((item, index) => {
    const summary = config.fields
      .map((field) => `${field.shortLabel}:${truncate(item[field.name], 70) || '空'}`)
      .join('；');
    lines.push(`${index + 1}. ${item.name || '未命名'} - ${summary}`);
  });

  return lines.join('\n');
};

const WorldbuildingManager = ({ projectId, type }) => {
  const config = ENTITY_CONFIGS[type] || ENTITY_CONFIGS.worldviews;
  const service = worldbuildingServices[type];
  const [form] = Form.useForm();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');

  const loadItems = useCallback(async () => {
    if (!projectId || !service) return;
    setLoading(true);
    try {
      const data = await service.list(projectId);
      const nextItems = normalizeItems(data);
      setItems(nextItems);
      setSelectedId((currentId) => {
        if (nextItems.some((item) => item.id === currentId)) return currentId;
        return nextItems[0]?.id || null;
      });
    } catch (error) {
      notification.error({
        message: `${config.singular}加载失败`,
        description: error.message,
      });
      setItems([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [config.singular, projectId, service]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => buildSearchText(item, config.fields).includes(keyword));
  }, [config.fields, items, searchText]);

  const selectedItem = useMemo(() => {
    if (!filteredItems.length) return null;
    return filteredItems.find((item) => item.id === selectedId) || filteredItems[0];
  }, [filteredItems, selectedId]);

  const metrics = useMemo(() => {
    const fieldTotal = items.length * config.fields.length;
    const filledTotal = items.reduce((sum, item) => sum + getFilledFields(item, config.fields).length, 0);
    const completion = fieldTotal ? Math.round((filledTotal / fieldTotal) * 100) : 0;
    const denseItems = items.filter((item) => getFilledFields(item, config.fields).length >= Math.min(3, config.fields.length)).length;

    return {
      total: items.length,
      filledTotal,
      fieldTotal,
      completion,
      denseItems,
    };
  }, [config.fields, items]);

  const openCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name || '',
      ...config.fields.reduce((acc, field) => ({ ...acc, [field.name]: item[field.name] || '' }), {}),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const handleSave = async (values) => {
    const payload = {
      name: values.name.trim(),
    };

    config.fields.forEach((field) => {
      payload[field.name] = values[field.name]?.trim() || null;
    });

    setSaving(true);
    try {
      if (editingItem) {
        await service.update(editingItem.id, payload);
        notification.success({ message: `${config.singular}已更新` });
      } else {
        const created = await service.create(projectId, payload);
        notification.success({ message: `${config.singular}已创建` });
        if (created?.id) setSelectedId(created.id);
      }
      closeModal();
      await loadItems();
    } catch (error) {
      notification.error({
        message: `${config.singular}保存失败`,
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    try {
      await service.remove(item.id);
      notification.success({ message: `${config.singular}已删除` });
      if (selectedId === item.id) setSelectedId(null);
      await loadItems();
    } catch (error) {
      notification.error({
        message: `${config.singular}删除失败`,
        description: error.message,
      });
    }
  };

  const handleGenerateInsight = async () => {
    setAiLoading(true);
    try {
      const result = await aiService.generateCreativeIdeas(
        projectId,
        buildAiPrompt({ config, items, selectedItem }),
        config.aiIntent,
      );
      setAiResult(normalizeAiText(result));
      notification.success({ message: 'AI 设定建议已生成' });
    } catch (error) {
      notification.error({
        message: 'AI 设定建议生成失败',
        description: error.message,
      });
    } finally {
      setAiLoading(false);
    }
  };

  const Icon = config.Icon;
  const selectedFilledFields = getFilledFields(selectedItem, config.fields);

  return (
    <section className={`worldbuilding-manager worldbuilding-manager--${type}`}>
      <header className="worldbuilding-header">
        <div className="worldbuilding-title-block">
          <span className="worldbuilding-eyebrow">{config.eyebrow}</span>
          <h2>{config.title}</h2>
          <p>{config.description}</p>
        </div>
        <div className="worldbuilding-actions" aria-label={`${config.singular}操作`}>
          <Button icon={<FaSyncAlt />} onClick={loadItems} loading={loading}>
            刷新
          </Button>
          <Button icon={<FaRobot />} onClick={handleGenerateInsight} loading={aiLoading} disabled={!items.length}>
            AI 补全建议
          </Button>
          <Button type="primary" icon={<FaPlus />} onClick={openCreateModal}>
            {config.addText}
          </Button>
        </div>
      </header>

      <section className="worldbuilding-metrics" aria-label={`${config.singular}概览`}>
        <article className="worldbuilding-metric worldbuilding-metric-primary">
          <div className="worldbuilding-metric-icon">
            <Icon />
          </div>
          <div>
            <span>资料数量</span>
            <strong>{metrics.total}</strong>
          </div>
        </article>
        <article className="worldbuilding-metric">
          <span>字段完整度</span>
          <strong>{metrics.completion}%</strong>
          <div className="worldbuilding-progress" aria-hidden="true">
            <span className={`worldbuilding-progress-fill worldbuilding-progress-fill-${Math.min(10, Math.round(metrics.completion / 10))}`} />
          </div>
        </article>
        <article className="worldbuilding-metric">
          <span>可直接供 AI 引用</span>
          <strong>{metrics.denseItems}</strong>
          <small>至少填写 3 个关键字段</small>
        </article>
        <article className="worldbuilding-metric">
          <span>已沉淀字段</span>
          <strong>{metrics.filledTotal}/{metrics.fieldTotal || config.fields.length}</strong>
          <small>名称不计入完整度</small>
        </article>
      </section>

      <section className="worldbuilding-workspace">
        <aside className="worldbuilding-list-panel">
          <div className="worldbuilding-search">
            <FaSearch />
            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={config.searchPlaceholder}
              allowClear
            />
          </div>

          <div className="worldbuilding-list">
            {loading ? (
              <div className="worldbuilding-loading">
                <Spin />
              </div>
            ) : filteredItems.length ? (
              filteredItems.map((item) => {
                const filled = getFilledFields(item, config.fields);
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={`worldbuilding-row ${selectedItem?.id === item.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className="worldbuilding-row-title">{item.name}</span>
                    <span className="worldbuilding-row-summary">
                      {truncate(config.fields.map((field) => item[field.name]).find(Boolean) || '暂无摘要', 88)}
                    </span>
                    <span className="worldbuilding-row-meta">{filled.length}/{config.fields.length} 字段</span>
                  </button>
                );
              })
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchText ? '没有匹配的资料' : config.emptyTitle}
              />
            )}
          </div>
        </aside>

        <main className="worldbuilding-detail-panel">
          {selectedItem ? (
            <>
              <div className="worldbuilding-detail-head">
                <div>
                  <span>{config.singular}</span>
                  <h3>{selectedItem.name}</h3>
                </div>
                <div className="worldbuilding-detail-actions">
                  <Button icon={<FaPen />} onClick={() => openEditModal(selectedItem)}>
                    编辑
                  </Button>
                  <Popconfirm
                    title={`删除${config.singular}`}
                    description={`确定删除「${selectedItem.name}」吗？`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(selectedItem)}
                  >
                    <Button danger icon={<FaTrash />}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>

              <div className="worldbuilding-field-tags">
                {config.fields.map((field) => (
                  <Tag key={field.name} className={selectedItem[field.name] ? 'is-filled' : ''}>
                    {selectedItem[field.name] ? '已录入' : '待补充'} · {field.shortLabel}
                  </Tag>
                ))}
              </div>

              <div className="worldbuilding-section-grid">
                {config.fields.map((field) => (
                  <article key={field.name} className="worldbuilding-section-card">
                    <span>{field.label}</span>
                    <p>{selectedItem[field.name] || '暂未填写。'}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="worldbuilding-empty-detail">
              <Icon />
              <h3>{config.emptyTitle}</h3>
              <p>{config.emptyDescription}</p>
              <Button type="primary" icon={<FaPlus />} onClick={openCreateModal}>
                {config.addText}
              </Button>
            </div>
          )}
        </main>

        <aside className="worldbuilding-side-panel">
          <section className="worldbuilding-hint-card">
            <div className="worldbuilding-side-title">
              <FaLightbulb />
              <span>写作检查</span>
            </div>
            <ul>
              {config.promptHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </section>

          <section className="worldbuilding-hint-card">
            <div className="worldbuilding-side-title">
              <FaRobot />
              <span>AI 设定建议</span>
            </div>
            {aiResult ? (
              <div className="worldbuilding-ai-result">
                {aiResult.split('\n').filter(Boolean).map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="worldbuilding-muted">
                点击 AI 补全建议后，会使用你的模型配置读取当前{config.plural}资料，生成可直接补写的方向。
              </p>
            )}
          </section>

          <section className="worldbuilding-hint-card">
            <div className="worldbuilding-side-title">
              <Icon />
              <span>当前聚焦</span>
            </div>
            {selectedItem ? (
              <dl className="worldbuilding-focus-list">
                <dt>名称</dt>
                <dd>{selectedItem.name}</dd>
                <dt>完成度</dt>
                <dd>{selectedFilledFields.length}/{config.fields.length}</dd>
              </dl>
            ) : (
              <p className="worldbuilding-muted">选择或创建一个{config.singular}开始整理。</p>
            )}
          </section>
        </aside>
      </section>

      <Modal
        open={modalOpen}
        title={editingItem ? `编辑${config.singular}` : config.addText}
        onCancel={closeModal}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText={editingItem ? '保存修改' : '创建'}
        cancelText="取消"
        destroyOnHidden
        className="worldbuilding-modal"
        width={760}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item
            name="name"
            label={`${config.singular}名称`}
            rules={[{ required: true, message: `请输入${config.singular}名称` }]}
          >
            <Input placeholder={`例如：${config.singular}名称`} maxLength={100} showCount />
          </Form.Item>
          {config.fields.map((field) => (
            <Form.Item key={field.name} name={field.name} label={field.label}>
              <TextArea placeholder={field.placeholder} autoSize={{ minRows: 3, maxRows: 7 }} />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </section>
  );
};

export default WorldbuildingManager;

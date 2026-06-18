import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Empty,
  Form,
  Input,
  Select,
  Spin,
  Tabs,
  notification,
} from 'antd';
import modelConfigService from '../../services/modelConfigService';
import {
  aiGenerateCharacter,
  createCharacter,
  getCharacterTemplates,
  getCharacters,
} from '../../services/characterService';
import { FALLBACK_CHARACTER_TEMPLATE_REGISTRY } from '../../config/characterPanelTemplates';
import CharacterFormBody from './CharacterFormBody';
import CharacterDraftReviewCard from './CharacterDraftReviewCard';
import {
  DIMENSION_KEYS,
  GENDER_PROFILE_KEY,
  buildExtraAttributesJson,
  deriveCurrentGenderFromProfile,
  normalizeCoreCharacterPayload,
  sanitizeGenderProfile,
} from './characterConstants';
import './FirstCharacterOnboardingModal.css';

const { TextArea } = Input;

// AI 生成时关联已有角色的数量上限（与后端 MAX_REFERENCES_PER_REQUEST 对齐）
const MAX_REFERENCES = 10
// 选项里 description 摘要的截断长度
const REF_DESC_PREVIEW_LEN = 30

function truncate(text, max) {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function buildManualPayload(values, templateRegistry) {
  const payload = normalizeCoreCharacterPayload(values);

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

  return payload;
}

const CharacterCreatorTabs = ({
  projectId,
  templateRegistry: templateRegistryProp,
  templateLoading: templateLoadingProp,
  onCreated,
  onCancel,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('manual');
  const [manualForm] = Form.useForm();
  const [aiForm] = Form.useForm();
  const [savingManual, setSavingManual] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [modelConfigs, setModelConfigs] = useState([]);
  const [modelLoading, setModelLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  // 多角色草稿状态：drafts 数组 + 当前编辑 tab 索引 + 已确认入库的索引集合 + 规划元信息
  const [drafts, setDrafts] = useState([]);
  const [activeDraftIdx, setActiveDraftIdx] = useState(0);
  const [confirmedIdxSet, setConfirmedIdxSet] = useState(() => new Set());
  const [draftPlan, setDraftPlan] = useState(null);
  const [batchSaving, setBatchSaving] = useState(false);
  const [existingCharacters, setExistingCharacters] = useState([]);
  const [templateRegistry, setTemplateRegistry] = useState(
    templateRegistryProp || FALLBACK_CHARACTER_TEMPLATE_REGISTRY
  );
  const [templateLoading, setTemplateLoading] = useState(Boolean(templateLoadingProp));

  useEffect(() => {
    if (templateRegistryProp) {
      setTemplateRegistry(templateRegistryProp);
    }
  }, [templateRegistryProp]);

  useEffect(() => {
    if (templateLoadingProp !== undefined) {
      setTemplateLoading(Boolean(templateLoadingProp));
    }
  }, [templateLoadingProp]);

  useEffect(() => {
    if (templateRegistryProp) return undefined;

    let cancelled = false;
    const loadTemplates = async () => {
      try {
        setTemplateLoading(true);
        const data = await getCharacterTemplates();
        if (!cancelled && data && typeof data === 'object') {
          setTemplateRegistry({
            ...FALLBACK_CHARACTER_TEMPLATE_REGISTRY,
            ...data,
          });
        }
      } catch {
        if (!cancelled) {
          notification.warning({
            message: '角色模板加载失败',
            description: '将继续使用基础表单。可稍后重试。',
          });
        }
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    };

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [templateRegistryProp]);

  useEffect(() => {
    manualForm.setFieldsValue({
      __gender_profile: {
        initial_gender: undefined,
        initial_female_traits: {},
        transitions: [],
        notes: undefined,
      },
      __template_deltas: [],
      __extra_attrs: {},
    });
  }, [manualForm]);

  const loadCharacterGenerationModels = useCallback(async () => {
    try {
      setModelLoading(true);
      const data = await modelConfigService.getModelConfigs({ scenario: 'character_generation' });
      setModelConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      notification.error({ message: '加载角色生成模型失败', description: error.message });
      setModelConfigs([]);
    } finally {
      setModelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ai') {
      loadCharacterGenerationModels();
    }
  }, [activeTab, loadCharacterGenerationModels]);

  // AI tab 激活时拉取项目下已有角色，作为「关联已有角色」选择器的数据源
  // 不在初始化阶段拉，避免还没切到 AI tab 就发一次请求
  useEffect(() => {
    if (activeTab !== 'ai' || !projectId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await getCharacters(projectId);
        if (!cancelled) {
          setExistingCharacters(Array.isArray(data) ? data : []);
        }
      } catch {
        // 拉取失败时静默降级为「无已有角色」状态，不打断主流程
        if (!cancelled) setExistingCharacters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, projectId]);

  const handleManualCreate = async () => {
    try {
      const values = await manualForm.validateFields();
      setSavingManual(true);
      const payload = buildManualPayload(values, templateRegistry);
      await createCharacter(projectId, payload);
      notification.success({ message: `角色「${payload.name}」已创建` });
      manualForm.resetFields();
      await onCreated?.();
    } catch (error) {
      if (error.errorFields) return;
      notification.error({ message: '创建角色失败', description: error.message });
    } finally {
      setSavingManual(false);
    }
  };

  const resetDraftState = () => {
    setDrafts([]);
    setActiveDraftIdx(0);
    setConfirmedIdxSet(new Set());
    setDraftPlan(null);
  };

  const handleGenerate = async () => {
    try {
      const values = await aiForm.validateFields();
      setGenerating(true);
      const referencedIds = Array.isArray(values.__referenced_character_ids)
        ? values.__referenced_character_ids
        : [];
      const references = referencedIds.map(id => ({ type: 'character', id }));
      const result = await aiGenerateCharacter(projectId, {
        description: values.description,
        model_config_id: values.model_config_id,
        ...(references.length > 0 ? { references } : {}),
      });
      // 后端响应：{ plan: CharacterPlan, characters: list[CharacterDraftSchema] }
      const newDrafts = Array.isArray(result?.characters) ? result.characters : [];
      setDrafts(newDrafts);
      setDraftPlan(result?.plan || null);
      setActiveDraftIdx(0);
      setConfirmedIdxSet(new Set());
    } catch (error) {
      if (error.errorFields) return;
      notification.error({ message: 'AI 生成失败', description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateDraft = async () => {
    // MVP：重新生成 = 整批重生（清掉所有 draft 后重发）
    resetDraftState();
    await handleGenerate();
  };

  // 单角色入库（来自 CharacterDraftReviewCard 的 onConfirm 回调）
  const handleConfirmDraft = async (payload) => {
    const idx = activeDraftIdx;
    try {
      setSavingDraft(true);
      await createCharacter(projectId, payload);
      notification.success({ message: `角色「${payload.name}」已创建` });
      // 标记当前 idx 已确认；如果还有未确认的角色，自动跳到第一个未确认的 tab
      const nextConfirmed = new Set(confirmedIdxSet);
      nextConfirmed.add(idx);
      setConfirmedIdxSet(nextConfirmed);
      const nextUnconfirmedIdx = drafts.findIndex((_, i) => !nextConfirmed.has(i));
      if (nextUnconfirmedIdx === -1) {
        // 全部已确认 → 关闭审阅面板并通知父组件
        aiForm.resetFields();
        resetDraftState();
        await onCreated?.();
      } else {
        setActiveDraftIdx(nextUnconfirmedIdx);
        // 不调 onCreated，避免关闭弹窗；用户还需继续审阅剩余角色
      }
    } catch (error) {
      notification.error({ message: '创建角色失败', description: error.message });
    } finally {
      setSavingDraft(false);
    }
  };

  // 丢弃当前 tab 的角色（仅前端剔除，不调后端）
  const handleDiscardCurrent = () => {
    if (drafts.length === 0) return;
    const idx = activeDraftIdx;
    const newDrafts = drafts.filter((_, i) => i !== idx);
    if (newDrafts.length === 0) {
      resetDraftState();
      return;
    }
    // 重映射 confirmedIdxSet：被删除位置之后的索引整体 -1
    const newConfirmed = new Set();
    confirmedIdxSet.forEach((cIdx) => {
      if (cIdx < idx) newConfirmed.add(cIdx);
      else if (cIdx > idx) newConfirmed.add(cIdx - 1);
      // cIdx === idx 直接丢弃
    });
    setDrafts(newDrafts);
    setConfirmedIdxSet(newConfirmed);
    setActiveDraftIdx(Math.min(idx, newDrafts.length - 1));
  };

  // 将 AI 返回的 draft 原始数据转换为 createCharacter API 兼容的 payload
  const buildDraftPayload = (draft) => {
    const payload = normalizeCoreCharacterPayload({
      name: draft.name,
      description: draft.description,
      personality: draft.personality,
      background: draft.background,
      appearance: draft.appearance,
      age: draft.age,
      species: draft.species,
      alignment: draft.alignment,
      abilities: draft.abilities,
      weaknesses: draft.weaknesses,
    });
    if (draft.dimensions && typeof draft.dimensions === 'object') {
      payload.dimensions = JSON.stringify(
        Object.fromEntries(
          Object.entries(draft.dimensions)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, Math.min(100, Math.max(0, Math.round(Number(v) || 0)))])
        )
      );
    }
    if (draft.extra_fields && typeof draft.extra_fields === 'object') {
      payload.extra_attributes = JSON.stringify(draft.extra_fields);
    }
    return payload;
  };

  // 一次性确认所有未入库的角色
  const handleConfirmAll = async () => {
    const pendingIndices = drafts
      .map((_, i) => i)
      .filter(i => !confirmedIdxSet.has(i));
    if (pendingIndices.length === 0) return;

    setBatchSaving(true);
    const successIndices = [];
    const failed = [];
    for (const i of pendingIndices) {
      const draft = drafts[i];
      try {
        const payload = buildDraftPayload(draft);
        await createCharacter(projectId, payload);
        successIndices.push(i);
      } catch (err) {
        failed.push({ idx: i, name: draft?.name || `角色 ${i + 1}`, error: err });
      }
    }
    setBatchSaving(false);

    if (successIndices.length > 0) {
      const nextConfirmed = new Set(confirmedIdxSet);
      successIndices.forEach(i => nextConfirmed.add(i));
      setConfirmedIdxSet(nextConfirmed);
      notification.success({
        message: `已批量入库 ${successIndices.length} 个角色`,
      });
    }
    if (failed.length > 0) {
      notification.error({
        message: `${failed.length} 个角色入库失败，请单独处理`,
        description: failed.map(f => f.name).join('、'),
      });
      // 跳到第一个失败的 tab
      setActiveDraftIdx(failed[0].idx);
    } else if (successIndices.length === pendingIndices.length) {
      // 全部成功 → 关闭审阅面板并通知父组件
      aiForm.resetFields();
      resetDraftState();
      await onCreated?.();
    }
  };

  const handleCancelDraftReview = () => {
    resetDraftState();
  };

  const handleGoModelConfig = () => {
    navigate(`/project/${projectId}/models`);
  };

  const renderManualTab = () => (
    <div className="first-character-manual-panel">
      <Form form={manualForm} layout="vertical" requiredMark="optional" onFinish={handleManualCreate}>
        <CharacterFormBody
          form={manualForm}
          templateRegistry={templateRegistry}
          templateLoading={templateLoading}
        />
      </Form>
      <div className="first-character-manual-actions">
        {onCancel && <Button onClick={onCancel}>取消</Button>}
        <Button type="primary" loading={savingManual} onClick={() => manualForm.submit()}>
          创建角色
        </Button>
      </div>
    </div>
  );

  const renderDraftReviewBody = () => {
    if (drafts.length === 0) return null;
    const isMulti = drafts.length > 1;
    const activeDraft = drafts[activeDraftIdx] || drafts[0];
    const isActiveConfirmed = confirmedIdxSet.has(activeDraftIdx);
    const allConfirmed = drafts.length > 0 && drafts.every((_, i) => confirmedIdxSet.has(i));

    const reviewCardNode = (
      <CharacterDraftReviewCard
        // key 让切换 tab 时 form 重新初始化
        key={`draft-${activeDraftIdx}-${activeDraft?.name || ''}`}
        draft={activeDraft}
        readOnly={isActiveConfirmed}
        onConfirm={handleConfirmDraft}
        onRegenerate={handleRegenerateDraft}
        onCancel={isMulti ? handleDiscardCurrent : handleCancelDraftReview}
        cancelLabel={isMulti ? '丢弃本角色' : undefined}
      />
    );

    return (
      <Spin
        spinning={savingDraft || generating || batchSaving}
        tip={
          batchSaving
            ? '正在批量入库...'
            : generating
              ? '正在重新生成角色档案...'
              : '正在创建角色...'
        }
      >
        {draftPlan?.reasoning ? (
          <div className="character-multi-draft-plan-banner">
            <span className="character-multi-draft-plan-banner__count">
              AI 判断要生成 {draftPlan.count || drafts.length} 个角色
            </span>
            <span className="character-multi-draft-plan-banner__reasoning">{draftPlan.reasoning}</span>
          </div>
        ) : null}

        {isMulti ? (
          <>
            <Tabs
              type="card"
              activeKey={String(activeDraftIdx)}
              onChange={key => setActiveDraftIdx(Number(key))}
              items={drafts.map((d, i) => ({
                key: String(i),
                label: `${confirmedIdxSet.has(i) ? '✓ ' : ''}角色 ${i + 1}：${d?.name || '未命名'}`,
              }))}
            />
            <div className="character-multi-draft-batch-actions">
              <Button
                type="primary"
                disabled={allConfirmed || batchSaving}
                loading={batchSaving}
                onClick={handleConfirmAll}
              >
                {allConfirmed ? '已全部入库' : `全部确认入库（${drafts.length - confirmedIdxSet.size} 个待处理）`}
              </Button>
              <Button onClick={handleCancelDraftReview} disabled={batchSaving}>
                关闭审阅
              </Button>
            </div>
            {reviewCardNode}
          </>
        ) : (
          reviewCardNode
        )}
      </Spin>
    );
  };

  const renderAiTab = () => {
    if (drafts.length > 0) {
      return renderDraftReviewBody();
    }

    if (modelLoading) {
      return (
        <div className="first-character-ai-spin">
          <Spin tip="正在加载可用于角色生成的模型..." />
        </div>
      );
    }

    if (modelConfigs.length === 0) {
      return (
        <div className="first-character-empty-panel">
          <Empty description="还没有授权用于角色生成的模型" />
          <div className="first-character-empty-actions">
            <Button onClick={handleGoModelConfig}>去模型管理配置</Button>
            <Button type="primary" onClick={() => setActiveTab('manual')}>改用手动创建</Button>
          </div>
        </div>
      );
    }

    return (
      <div className="first-character-ai-panel">
        <Form form={aiForm} layout="vertical" className="first-character-ai-form" onFinish={handleGenerate}>
          <Form.Item
            name="model_config_id"
            label="选择模型"
            rules={[{ required: true, message: '请选择用于角色生成的模型' }]}
          >
            <Select
              placeholder="选择已授权角色生成的模型"
              options={modelConfigs.map(config => ({
                value: config.id,
                label: `${config.name} (${config.model_name || '默认模型'})`,
              }))}
            />
          </Form.Item>
          {existingCharacters.length > 0 && (
            <Form.Item
              name="__referenced_character_ids"
              label={`关联已有角色（可选，最多 ${MAX_REFERENCES} 个）`}
              tooltip="选中的角色会作为 AI 生成的上下文参考。例如：选中『苏清』并在描述里写『生成苏清的母亲』，AI 会保持家世/外貌/背景的一致性。"
            >
              <Select
                mode="multiple"
                allowClear
                maxCount={MAX_REFERENCES}
                placeholder="可选：让 AI 在生成时参考这些已有角色"
                optionFilterProp="label"
                options={existingCharacters.map(c => ({
                  value: c.id,
                  label: c.description
                    ? `${c.name} — ${truncate(c.description, REF_DESC_PREVIEW_LEN)}`
                    : c.name,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item
            name="description"
            label="角色描述"
            rules={[
              { required: true, message: '请输入角色描述' },
              { min: 5, message: '描述至少 5 个字符' },
              { max: 2000, message: '描述最多 2000 个字符' },
            ]}
          >
            <TextArea
              rows={6}
              showCount
              maxLength={2000}
              placeholder="用一段话描述你的角色，比如：一个内向的图书管理员，秘密拥有读心术能力，渴望被看见但又害怕被理解…"
            />
          </Form.Item>
        </Form>
        <div className="first-character-ai-actions">
          {onCancel && <Button onClick={onCancel}>取消</Button>}
          <Button
            type="primary"
            loading={generating}
            disabled={generating}
            onClick={() => aiForm.submit()}
          >
            {generating ? 'AI 正在生成角色档案…' : '让 AI 生成'}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Tabs
      activeKey={activeTab}
      onChange={setActiveTab}
      items={[
        { key: 'manual', label: '手动创建', children: renderManualTab() },
        { key: 'ai', label: 'AI 生成', children: renderAiTab() },
      ]}
    />
  );
};

export default CharacterCreatorTabs;

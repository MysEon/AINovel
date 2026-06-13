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
  const [draft, setDraft] = useState(null);
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

  const handleGenerate = async () => {
    try {
      const values = await aiForm.validateFields();
      setGenerating(true);
      const result = await aiGenerateCharacter(projectId, {
        description: values.description,
        model_config_id: values.model_config_id,
      });
      setDraft(result);
    } catch (error) {
      if (error.errorFields) return;
      notification.error({ message: 'AI 生成失败', description: error.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateDraft = async () => {
    await handleGenerate();
  };

  const handleConfirmDraft = async (payload) => {
    try {
      setSavingDraft(true);
      await createCharacter(projectId, payload);
      notification.success({ message: `角色「${payload.name}」已创建` });
      aiForm.resetFields();
      setDraft(null);
      await onCreated?.();
    } catch (error) {
      notification.error({ message: '创建角色失败', description: error.message });
    } finally {
      setSavingDraft(false);
    }
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

  const renderAiTab = () => {
    if (draft) {
      return (
        <Spin spinning={savingDraft || generating} tip={generating ? '正在重新生成角色档案...' : '正在创建角色...'}>
          <CharacterDraftReviewCard
            draft={draft}
            onConfirm={handleConfirmDraft}
            onRegenerate={handleRegenerateDraft}
            onCancel={() => setDraft(null)}
          />
        </Spin>
      );
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

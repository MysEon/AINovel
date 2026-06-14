import React from 'react';
import {
  Button, Popconfirm, Tag, Tooltip,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, UserOutlined,
} from '@ant-design/icons';
import {
  getMergedTemplateFromRegistry,
  getTemplateDeltaLabel,
} from '../../config/characterPanelTemplates';
import {
  DIMENSION_KEYS,
  parseJsonObject,
  sanitizeGenderProfile,
  parseLegacyGenderStringToProfile,
  getGenderTimelineLabels,
  GENDER_PROFILE_KEY,
  formatFemaleTraitsSummary,
  isExistenceGenderTransitionMethod,
  formatThreeSizes,
  EXTRA_ATTR_RESERVED_KEYS,
  EXTRA_ATTR_SPECIAL_HIDDEN_KEYS,
  isEmptyDynamicValue,
  formatDynamicValue,
} from './characterConstants';

const getText = (value) => String(value || '').trim();

const getDimensionRows = (dimensions) => {
  if (!dimensions || typeof dimensions !== 'object') return [];
  const known = DIMENSION_KEYS
    .filter((dimension) => dimensions[dimension.key] != null)
    .map((dimension) => [dimension.key, dimensions[dimension.key]]);
  const knownKeys = new Set(known.map(([key]) => key));
  const extra = Object.entries(dimensions).filter(([key]) => !knownKeys.has(key));
  return [...known, ...extra].slice(0, 10);
};

const CharacterDetail = ({ character, templateRegistry, onEdit, onDelete }) => {
  const coreFields = [
    { label: '角色简介', value: character.description },
    { label: '性格', value: character.personality },
    { label: '外貌', value: character.appearance },
    { label: '背景', value: character.background },
    { label: '能力 / 技能', value: character.abilities },
    { label: '弱点 / 缺陷', value: character.weaknesses },
  ];

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

  const filledCore = coreFields.filter((field) => getText(field.value));
  const filledParams = paramFields.filter((field) => getText(field.value));

  let parsedDimensions = null;
  try {
    parsedDimensions = character.dimensions ? JSON.parse(character.dimensions) : null;
  } catch {
    parsedDimensions = null;
  }
  const dimensionRows = getDimensionRows(parsedDimensions);

  const extraAttrs = parseJsonObject(character.extra_attributes);
  const genderProfile = sanitizeGenderProfile(extraAttrs[GENDER_PROFILE_KEY]) || parseLegacyGenderStringToProfile(character.gender);
  const genderTimeline = getGenderTimelineLabels(genderProfile);
  const initialFemaleTraitsSummary = formatFemaleTraitsSummary(genderProfile?.initial_female_traits);
  const selectedTemplateDeltas = Array.isArray(extraAttrs.__template_deltas)
    ? extraAttrs.__template_deltas.filter(Boolean)
    : [];
  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, selectedTemplateDeltas);
  const extraFieldLabelMap = new Map((mergedTemplate?.fields || []).map((field) => [field.key, field.label]));
  const extraEntries = Object.entries(extraAttrs)
    .filter(([key, value]) => (
      !EXTRA_ATTR_RESERVED_KEYS.has(key)
      && !EXTRA_ATTR_SPECIAL_HIDDEN_KEYS.has(key)
      && !isEmptyDynamicValue(value)
    ));

  return (
    <article className="character-profile-panel">
      <header className="character-profile-head">
        <div className="character-profile-identity">
          <div className="character-profile-avatar">
            <UserOutlined />
          </div>
          <div>
            <span>角色档案</span>
            <h3>{character.name}</h3>
            <p>{character.description || '暂未填写角色简介。'}</p>
          </div>
        </div>
        <div className="character-profile-actions">
          <Tooltip title="编辑角色">
            <Button icon={<EditOutlined />} onClick={onEdit}>
              编辑
            </Button>
          </Tooltip>
          <Popconfirm
            title="删除角色"
            description={`确定删除「${character.name}」吗？删除后不可恢复。`}
            onConfirm={onDelete}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </div>
      </header>

      <div className="character-profile-tags">
        <Tag className={character.description ? 'is-filled' : ''}>简介</Tag>
        <Tag className={character.personality ? 'is-filled' : ''}>性格</Tag>
        <Tag className={character.background ? 'is-filled' : ''}>背景</Tag>
        <Tag className={character.appearance ? 'is-filled' : ''}>外貌</Tag>
        {character.species && <Tag className="is-filled">{character.species}</Tag>}
        {character.alignment && <Tag className="is-filled">{character.alignment}</Tag>}
        {genderTimeline.length > 1 && <Tag className="is-filled">性别轨迹 {genderTimeline.length - 1} 次转变</Tag>}
        {selectedTemplateDeltas.map((deltaKey) => (
          <Tag key={`tpl-${deltaKey}`} className="is-filled">{getTemplateDeltaLabel(deltaKey)}</Tag>
        ))}
        {extraEntries.length > 0 && <Tag className="is-filled">扩展字段 {extraEntries.length}</Tag>}
      </div>

      {filledParams.length > 0 && (
        <section className="character-profile-params">
          {filledParams.map((field) => (
            <div key={field.label} className="character-param">
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </div>
          ))}
        </section>
      )}

      {dimensionRows.length > 0 && (
        <section className="character-profile-section character-dimensions-section">
          <h4>能力维度</h4>
          <div className="character-dimension-list">
            {dimensionRows.map(([key, value]) => {
              const numericValue = Number(value);
              const progressValue = Number.isFinite(numericValue) ? Math.max(0, Math.min(100, numericValue)) : 0;
              return (
                <div key={key} className="character-dimension-row">
                  <span>{key}</span>
                  <progress value={progressValue} max="100" />
                  <strong>{String(value)}</strong>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="character-profile-grid">
        {coreFields.map((field) => (
          <article key={field.label} className="character-profile-section">
            <h4>{field.label}</h4>
            <p>{field.value || '暂未填写。'}</p>
          </article>
        ))}
      </section>

      {genderTimeline.length > 0 && (
        <section className="character-profile-section character-profile-wide">
          <h4>性别轨迹</h4>
          <p>{genderTimeline.join(' -> ')}</p>
          {initialFemaleTraitsSummary.length > 0 && (
            <div className="character-profile-params compact">
              {initialFemaleTraitsSummary.map((item, index) => (
                <div key={`gender-initial-female-${index}`} className="character-param">
                  <span>初始女性特征</span>
                  <strong>{item}</strong>
                </div>
              ))}
            </div>
          )}
          {Array.isArray(genderProfile?.transitions) && genderProfile.transitions.length > 0 && (
            <div className="character-profile-params compact">
              {genderProfile.transitions.map((step, index) => (
                <div key={`gender-step-${index}`} className="character-param">
                  <span>第 {index + 1} 次 · {step.to_gender || '未设定目标'}</span>
                  <strong>
                    {[
                      step.method,
                      isExistenceGenderTransitionMethod(step.method)
                        ? '存在级转变'
                        : null,
                      step.appearance_only ? '仅外观 / 体表转变' : null,
                      step.retain_original_genitals
                        ? ({
                          yes: '保留原性器官',
                          no: '不保留原性器官',
                          partial: '部分改变/混合状态',
                          unknown: '性器官状态未设定',
                        }[step.retain_original_genitals] || null)
                        : null,
                      step.chest_size ? `胸部大小：${step.chest_size}` : null,
                      formatThreeSizes(step),
                      step.hair_length ? `头发长度：${step.hair_length}` : null,
                      step.hair_notes ? `头发特征：${step.hair_notes}` : null,
                    ].filter(Boolean).join(' / ') || '未填写方式'}
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {(selectedTemplateDeltas.length > 0 || extraEntries.length > 0) && (
        <section className="character-profile-section character-profile-wide">
          <h4>扩展属性</h4>
          {selectedTemplateDeltas.length > 0 && (
            <p>模板增量：{selectedTemplateDeltas.map(getTemplateDeltaLabel).join(' / ')}</p>
          )}
          {extraEntries.length > 0 ? (
            <div className="character-profile-params compact">
              {extraEntries.slice(0, 12).map(([key, value]) => (
                <div key={key} className="character-param">
                  <span>{extraFieldLabelMap.get(key) || key}</span>
                  <strong>{formatDynamicValue(value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p>暂无扩展字段值。</p>
          )}
        </section>
      )}
    </article>
  );
};

export default CharacterDetail;

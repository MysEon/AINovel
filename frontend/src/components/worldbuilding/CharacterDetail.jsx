import React from 'react';
import {
  Card, Tag, Space, Typography, Tooltip, Button, Popconfirm,
} from 'antd';
import {
  UserOutlined, EditOutlined, DeleteOutlined,
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
  formatFemaleTraitsSummary,
  isExistenceGenderTransitionMethod,
  formatThreeSizes,
  EXTRA_ATTR_RESERVED_KEYS,
  EXTRA_ATTR_SPECIAL_HIDDEN_KEYS,
  isEmptyDynamicValue,
  formatDynamicValue,
} from './characterConstants';

const { Text, Paragraph } = Typography;

const CharacterDetail = ({ character, templateRegistry, expanded, onToggleExpand, onEdit, onDelete }) => {
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

  const extraAttrs = parseJsonObject(character.extra_attributes);
  const genderProfile = sanitizeGenderProfile(extraAttrs[GENDER_PROFILE_KEY]) || parseLegacyGenderStringToProfile(character.gender);
  const genderTimeline = getGenderTimelineLabels(genderProfile);
  const initialFemaleTraitsSummary = formatFemaleTraitsSummary(genderProfile?.initial_female_traits);
  const selectedTemplateDeltas = Array.isArray(extraAttrs.__template_deltas)
    ? extraAttrs.__template_deltas.filter(Boolean)
    : [];
  const mergedTemplate = getMergedTemplateFromRegistry(templateRegistry, selectedTemplateDeltas);
  const extraFieldLabelMap = new Map((mergedTemplate?.fields || []).map(field => [field.key, field.label]));
  const extraEntries = Object.entries(extraAttrs)
    .filter(([key, value]) => (
      !EXTRA_ATTR_RESERVED_KEYS.has(key)
      && !EXTRA_ATTR_SPECIAL_HIDDEN_KEYS.has(key)
      && !isEmptyDynamicValue(value)
    ));

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
        {genderTimeline.length > 1 && <Tag color="purple">性别轨迹 {genderTimeline.length - 1} 次转变</Tag>}
        {selectedTemplateDeltas.map(deltaKey => (
          <Tag key={`tpl-${deltaKey}`} color="geekblue">{getTemplateDeltaLabel(deltaKey)}</Tag>
        ))}
        {extraEntries.length > 0 && <Tag color="cyan">扩展属性 {extraEntries.length}</Tag>}
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

          {genderTimeline.length > 0 && (
            <div className="detail-section">
              <Text strong className="detail-label">性别轨迹</Text>
              <Paragraph className="detail-content">
                {genderTimeline.join(' → ')}
              </Paragraph>
              {initialFemaleTraitsSummary.length > 0 && (
                <div className="detail-params">
                  {initialFemaleTraitsSummary.map((item, idx) => (
                    <div key={`gender-initial-female-${idx}`} className="param-item">
                      <Text type="secondary" className="param-label">初始女性特征</Text>
                      <Text className="param-value">{item}</Text>
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(genderProfile?.transitions) && genderProfile.transitions.length > 0 && (
                <div className="detail-params">
                  {genderProfile.transitions.map((step, idx) => (
                    <div key={`gender-step-${idx}`} className="param-item">
                      <Text type="secondary" className="param-label">
                        第 {idx + 1} 次 · {step.to_gender || '未设定目标'}
                      </Text>
                      <Text className="param-value">
                        {[
                          step.method,
                          isExistenceGenderTransitionMethod(step.method)
                            ? '存在转变（概念级改写：他人记忆/记录/身份认知同步）'
                            : null,
                          step.appearance_only ? '仅外观/体表转变' : null,
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
                      </Text>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(selectedTemplateDeltas.length > 0 || extraEntries.length > 0) && (
            <div className="detail-section">
              <Text strong className="detail-label">扩展属性</Text>
              {selectedTemplateDeltas.length > 0 && (
                <Paragraph className="detail-content">
                  模板增量：{selectedTemplateDeltas.map(getTemplateDeltaLabel).join(' / ')}
                </Paragraph>
              )}
              {extraEntries.length > 0 ? (
                <div className="detail-params">
                  {extraEntries.slice(0, 12).map(([key, value]) => (
                    <div key={key} className="param-item">
                      <Text type="secondary" className="param-label">
                        {extraFieldLabelMap.get(key) || key}
                      </Text>
                      <Text className="param-value">{formatDynamicValue(value)}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无扩展字段值</Text>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default CharacterDetail;

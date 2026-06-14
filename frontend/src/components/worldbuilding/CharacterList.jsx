import React, { useMemo } from 'react';
import {
  Button, Empty, Input, Spin, Tag,
} from 'antd';
import {
  FaBrain,
  FaPenNib,
  FaPlus,
  FaRobot,
  FaSearch,
  FaUserFriends,
} from 'react-icons/fa';
import CharacterDetail from './CharacterDetail';

const getText = (value) => String(value || '').trim();

const CHARACTER_FIELDS = [
  'description',
  'personality',
  'background',
  'appearance',
  'gender',
  'age',
  'species',
  'alignment',
  'abilities',
  'weaknesses',
];

const getFilledFieldCount = (character) =>
  CHARACTER_FIELDS.filter((field) => getText(character[field]).length > 0).length;

const getExtraCount = (character) => {
  try {
    const parsed = character.extra_attributes ? JSON.parse(character.extra_attributes) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed).filter((key) => !key.startsWith('__')).length
      : 0;
  } catch {
    return 0;
  }
};

const buildSearchText = (character) => [
  character.name,
  character.description,
  character.personality,
  character.background,
  character.appearance,
  character.species,
  character.alignment,
  character.abilities,
  character.weaknesses,
].filter(Boolean).join(' ').toLowerCase();

const truncate = (value, length = 96) => {
  const text = getText(value);
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}...` : text;
};

const CharacterList = ({
  characters, loading, searchText, onSearchChange,
  expandedId, onToggleExpand, onEdit, onDelete, onCreate,
  templateRegistry,
}) => {
  const filteredCharacters = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return characters;
    return characters.filter((character) => buildSearchText(character).includes(keyword));
  }, [characters, searchText]);

  const selectedCharacter = useMemo(() => {
    if (!filteredCharacters.length) return null;
    return filteredCharacters.find((character) => character.id === expandedId) || filteredCharacters[0];
  }, [expandedId, filteredCharacters]);

  const metrics = useMemo(() => {
    const fieldTotal = characters.length * CHARACTER_FIELDS.length;
    const filledTotal = characters.reduce((sum, character) => sum + getFilledFieldCount(character), 0);
    const completion = fieldTotal ? Math.round((filledTotal / fieldTotal) * 100) : 0;
    const aiReady = characters.filter((character) => (
      getText(character.description)
      && (getText(character.personality) || getText(character.background))
    )).length;
    const extraTotal = characters.reduce((sum, character) => sum + getExtraCount(character), 0);

    return {
      total: characters.length,
      completion,
      filledTotal,
      fieldTotal,
      aiReady,
      extraTotal,
    };
  }, [characters]);

  const selectedFilled = selectedCharacter ? getFilledFieldCount(selectedCharacter) : 0;
  const progressClass = `character-progress-fill character-progress-fill-${Math.min(10, Math.round(metrics.completion / 10))}`;

  return (
    <section className="character-manager character-console">
      <header className="character-console-header">
        <div className="character-console-title">
          <span className="character-console-eyebrow">CHARACTER MEMORY</span>
          <h2>角色管理</h2>
          <p>管理人物档案、性格动机、背景关系和能力弱点，让 AI 写作时能稳定调用角色记忆。</p>
        </div>
        <div className="character-console-actions" aria-label="角色操作">
          <Button icon={<FaRobot />} onClick={onCreate}>
            AI 生成角色
          </Button>
          <Button type="primary" icon={<FaPlus />} onClick={onCreate}>
            新增角色
          </Button>
        </div>
      </header>

      <section className="character-metrics" aria-label="角色概览">
        <article className="character-metric character-metric-primary">
          <div className="character-metric-icon">
            <FaUserFriends />
          </div>
          <div>
            <span>角色数量</span>
            <strong>{metrics.total}</strong>
          </div>
        </article>
        <article className="character-metric">
          <span>字段完整度</span>
          <strong>{metrics.completion}%</strong>
          <div className="character-progress" aria-hidden="true">
            <span className={progressClass} />
          </div>
        </article>
        <article className="character-metric">
          <span>可直接供 AI 引用</span>
          <strong>{metrics.aiReady}</strong>
          <small>简介 + 性格/背景已录入</small>
        </article>
        <article className="character-metric">
          <span>扩展字段</span>
          <strong>{metrics.extraTotal}</strong>
          <small>题材模板与自定义设定</small>
        </article>
      </section>

      <section className="character-workspace">
        <aside className="character-list-panel">
          <div className="character-search">
            <FaSearch />
            <Input
              placeholder="搜索角色、性格、背景、能力..."
              value={searchText}
              onChange={(event) => onSearchChange(event.target.value)}
              allowClear
            />
          </div>

          <div className="character-list">
            {loading ? (
              <div className="character-loading"><Spin size="large" /></div>
            ) : filteredCharacters.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchText ? '没有匹配的角色' : '还没有角色档案'}
              >
                {!searchText && (
                  <Button type="primary" icon={<FaPlus />} onClick={onCreate}>
                    创建第一个角色
                  </Button>
                )}
              </Empty>
            ) : (
              filteredCharacters.map((character) => {
                const filled = getFilledFieldCount(character);
                const active = selectedCharacter?.id === character.id;
                return (
                  <button
                    type="button"
                    key={character.id}
                    className={`character-row ${active ? 'is-active' : ''}`}
                    onClick={() => onToggleExpand(character.id)}
                  >
                    <span className="character-row-title">{character.name}</span>
                    <span className="character-row-summary">
                      {truncate(character.description || character.personality || character.background || '暂无角色摘要')}
                    </span>
                    <span className="character-row-meta">
                      {filled}/{CHARACTER_FIELDS.length} 字段
                      {character.species && <Tag>{character.species}</Tag>}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="character-detail-shell">
          {selectedCharacter ? (
            <CharacterDetail
              character={selectedCharacter}
              templateRegistry={templateRegistry}
              onEdit={() => onEdit(selectedCharacter)}
              onDelete={() => onDelete(selectedCharacter)}
            />
          ) : (
            <div className="character-empty-detail">
              <FaUserFriends />
              <h3>还没有角色档案</h3>
              <p>先创建一个能承载视角、冲突或秘密的人物，后续章节和 AI 对话都会更稳定。</p>
              <Button type="primary" icon={<FaPlus />} onClick={onCreate}>
                新增角色
              </Button>
            </div>
          )}
        </main>

        <aside className="character-side-panel">
          <section className="character-side-card">
            <div className="character-side-title">
              <FaPenNib />
              <span>写作检查</span>
            </div>
            <ul>
              <li>角色是否有明确欲望和阻力</li>
              <li>性格是否会影响场景选择</li>
              <li>背景是否埋下后续冲突</li>
            </ul>
          </section>

          <section className="character-side-card">
            <div className="character-side-title">
              <FaRobot />
              <span>AI 角色入口</span>
            </div>
            <p>新增角色会打开现有角色创建器，可继续使用手动录入、模板字段和 AI 批量生成。</p>
            <Button icon={<FaBrain />} onClick={onCreate}>
              打开角色生成
            </Button>
          </section>

          <section className="character-side-card">
            <div className="character-side-title">
              <FaUserFriends />
              <span>当前聚焦</span>
            </div>
            {selectedCharacter ? (
              <dl className="character-focus-list">
                <dt>名称</dt>
                <dd>{selectedCharacter.name}</dd>
                <dt>完成度</dt>
                <dd>{selectedFilled}/{CHARACTER_FIELDS.length}</dd>
                <dt>角色类型</dt>
                <dd>{selectedCharacter.species || selectedCharacter.alignment || '待补充'}</dd>
              </dl>
            ) : (
              <p>选择或创建一个角色开始整理。</p>
            )}
          </section>
        </aside>
      </section>
    </section>
  );
};

export default CharacterList;

import React from 'react';
import {
  Button, Input, Space, Spin, Empty, Typography,
} from 'antd';
import {
  PlusOutlined, SearchOutlined,
} from '@ant-design/icons';
import CharacterDetail from './CharacterDetail';

const { Title, Text } = Typography;

const CharacterList = ({
  characters, loading, searchText, onSearchChange,
  expandedId, onToggleExpand, onEdit, onDelete, onCreate,
  templateRegistry,
}) => {
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
            onChange={e => onSearchChange(e.target.value)}
            allowClear
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
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
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              创建第一个角色
            </Button>
          )}
        </Empty>
      ) : (
        <div className="character-grid">
          {filteredCharacters.map(character => (
            <CharacterDetail
              key={character.id}
              character={character}
              templateRegistry={templateRegistry}
              expanded={expandedId === character.id}
              onToggleExpand={() => onToggleExpand(character.id)}
              onEdit={() => onEdit(character)}
              onDelete={() => onDelete(character)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CharacterList;

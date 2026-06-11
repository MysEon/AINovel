import React, { useState, useEffect } from 'react';
import { notification } from 'antd';
import {
  getCharacterTemplates,
} from '../services/characterService';
import {
  FALLBACK_CHARACTER_TEMPLATE_REGISTRY,
} from '../config/characterPanelTemplates';
import { useCharacters } from '../hooks/useCharacters';
import { useCharacterForm } from '../hooks/useCharacterForm';
import CharacterList from './worldbuilding/CharacterList';
import CharacterForm from './worldbuilding/CharacterForm';
import './CharacterManager.css';

const CharacterManager = ({ projectId }) => {
  const {
    characters, loading, searchText, setSearchText,
    expandedId, setExpandedId, loadCharacters, handleDelete,
  } = useCharacters(projectId);

  const [templateRegistry, setTemplateRegistry] = useState(FALLBACK_CHARACTER_TEMPLATE_REGISTRY);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => {
    loadCharacterTemplates();
  }, []);

  const loadCharacterTemplates = async () => {
    try {
      setTemplateLoading(true);
      const data = await getCharacterTemplates();
      if (data && typeof data === 'object') {
        setTemplateRegistry({
          ...FALLBACK_CHARACTER_TEMPLATE_REGISTRY,
          ...data,
        });
      }
    } catch (error) {
      notification.warning({
        message: '角色模板加载失败',
        description: '将继续使用基础表单。可稍后重试。',
      });
    } finally {
      setTemplateLoading(false);
    }
  };

  const {
    form, isModalVisible, editingCharacter, saving,
    showModal, handleSave, handleCancel,
  } = useCharacterForm({ projectId, templateRegistry, loadCharacters });

  return (
    <>
      <CharacterList
        characters={characters}
        loading={loading}
        searchText={searchText}
        onSearchChange={setSearchText}
        expandedId={expandedId}
        onToggleExpand={(id) => setExpandedId(expandedId === id ? null : id)}
        onEdit={showModal}
        onDelete={handleDelete}
        onCreate={() => showModal()}
        templateRegistry={templateRegistry}
      />

      <CharacterForm
        visible={isModalVisible}
        editing={!!editingCharacter}
        form={form}
        saving={saving}
        templateRegistry={templateRegistry}
        templateLoading={templateLoading}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </>
  );
};

export default CharacterManager;

import { useState, useEffect, useCallback } from 'react';
import { notification } from 'antd';
import { getCharacters, deleteCharacter } from '../services/characterService';

export function useCharacters(projectId) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadCharacters = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCharacters(projectId);
      setCharacters(data);
    } catch (error) {
      notification.error({ message: '加载角色失败', description: error.message });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) loadCharacters();
  }, [projectId, loadCharacters]);

  const handleDelete = useCallback(async (character) => {
    try {
      await deleteCharacter(character.id);
      notification.success({ message: `角色「${character.name}」已删除` });
      if (expandedId === character.id) setExpandedId(null);
      await loadCharacters();
    } catch (error) {
      notification.error({ message: '删除失败', description: error.message });
    }
  }, [expandedId, loadCharacters]);

  return {
    characters,
    loading,
    searchText,
    setSearchText,
    expandedId,
    setExpandedId,
    loadCharacters,
    handleDelete,
  };
}

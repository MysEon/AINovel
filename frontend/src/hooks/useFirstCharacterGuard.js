import { useCallback, useEffect, useState } from 'react';
import { notification } from 'antd';
import { getCharacters } from '../services/characterService';

export default function useFirstCharacterGuard(projectId) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(Boolean(projectId));

  const refresh = useCallback(async () => {
    if (!projectId) {
      setCharacters([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await getCharacters(projectId);
      setCharacters(Array.isArray(data) ? data : []);
    } catch (error) {
      notification.error({ message: '检查角色信息失败', description: error.message });
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    needsOnboarding: !loading && characters.length === 0,
    loading,
    refresh,
  };
}

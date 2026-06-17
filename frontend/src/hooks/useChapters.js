import { useState, useEffect, useCallback } from 'react';
import { getChapters, updateChapter, createChapter, getChapter, batchUpdateChapterStatus, batchPublishChapters } from '../services/chapterService';
import { getChapterAnalysisStatus } from '../services/knowledgeService';

const useChapters = ({ projectId, initialChapterId, onChapterChange, addNotification, onProjectsChange, showConfirmDialog }) => {
  const [currentChapter, setCurrentChapter] = useState(null);
  const [content, setContent] = useState('');
  const [chapters, setChapters] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const [newChapterTitle, setNewChapterTitle] = useState('');

  // 当 currentChapter 改变时，也更新 content 和锁定状态
  useEffect(() => {
    if (currentChapter) {
      setContent(currentChapter.content || '');
      setIsEditorLocked(currentChapter.status === 'published');
    } else {
      setContent('');
      setIsEditorLocked(false);
    }
  }, [currentChapter]);

  const fetchChapters = async () => {
    try {
      const chaptersData = await getChapters(projectId);
      setChapters(chaptersData);

      let chapterToSet = null;

      // 1. 优先从 initialChapterId 加载
      if (initialChapterId) {
        chapterToSet = chaptersData.find(ch => ch.id === initialChapterId);
      }

      // 2. 如果没有，则使用默认逻辑
      if (!chapterToSet) {
        const lastPublished = chaptersData
          .filter(chapter => chapter.status === 'published')
          .sort((a, b) => b.chapter_number - a.chapter_number)[0];

        if (lastPublished) {
          const nextChapterNumber = lastPublished.chapter_number + 1;
          const nextChapter = chaptersData.find(ch => ch.chapter_number === nextChapterNumber);
          if (nextChapter) {
            chapterToSet = nextChapter;
          } else {
            // 如果没有下一章，就显示最后一章（已发布的章节）
            chapterToSet = lastPublished;
          }
        } else if (chaptersData.length > 0) {
          // 如果没有已发布章节，选择第一个草稿章节
          const draftChapters = chaptersData.filter(ch => ch.status === 'draft');
          chapterToSet = draftChapters.length > 0 ? draftChapters[0] : chaptersData[0];
        } else {
          // 如果没有任何章节，创建一个默认的
          chapterToSet = { id: null, title: '第一章', chapter_number: 1, status: 'draft' };
        }
      }

      setCurrentChapter(chapterToSet);
    } catch (error) {
      console.error('Error fetching chapters:', error);
      addNotification({
        message: '获取章节列表失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
    }
  };

  // 保存功能
  const saveContent = useCallback(async () => {
    if (isSaving || !currentChapter) return null;

    setIsSaving(true);
    try {
      // 调用后端API保存内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: currentChapter.status
      };

      const updatedChapter = await updateChapter(currentChapter.id, chapterData);

      // 使用全局通知组件显示保存成功的通知
      addNotification({
        message: '内容已保存',
        type: 'success',
        duration: 3000
      });

      // 更新当前章节数据
      setCurrentChapter(updatedChapter);

      // 更新章节列表中的对应章节
      setChapters(prevChapters =>
        prevChapters.map(chapter =>
          chapter.id === updatedChapter.id ? updatedChapter : chapter
        )
      );
      return updatedChapter;
    } catch (error) {
      addNotification({
        message: '保存失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, content, currentChapter, addNotification]);

  // 发布功能
  const publishChapterContent = useCallback(async () => {
    if (isPublishing || !currentChapter) return null;

    setIsPublishing(true);
    try {
      // 先保存当前内容
      const chapterData = {
        content: content,
        title: currentChapter.title,
        outline: currentChapter.outline || '',
        order_index: currentChapter.order_index,
        status: 'published'
      };

      const updatedChapter = await updateChapter(currentChapter.id, chapterData);

      // 使用全局通知组件显示发布成功的通知
      addNotification({
        message: '章节已发布',
        type: 'success',
        duration: 3000
      });

      // 重新获取最新的章节数据以确保状态同步
      const latestChapters = await getChapters(projectId);
      setChapters(latestChapters);

      // 重新获取当前章节的最新状态
      const latestChapter = await getChapter(currentChapter.id);
      setCurrentChapter(latestChapter);

      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }
      return latestChapter;
    } catch (error) {
      addNotification({
        message: '发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
      return null;
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, content, currentChapter, addNotification, projectId, onProjectsChange]);

  const handleContentChange = (newContent) => {
    setContent(newContent);
  };

  const handleChapterChange = async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      try {
        const chapterId = parseInt(selectedId);
        const chapterDetails = await getChapter(chapterId);
        setCurrentChapter(chapterDetails);
        if (onChapterChange) {
          onChapterChange(chapterDetails.id);
        }
      } catch (error) {
        addNotification({
          message: '获取章节详情失败: ' + error.message,
          type: 'error',
          duration: 3000
        });
      }
    }
  };

  const handleUnlockClick = () => {
    if (!currentChapter || !projectId) return;

    showConfirmDialog({
      title: '确认解锁章节',
      message: `您确定要解锁章节 "${currentChapter.title}" 吗？这将导致该章节及其之后的所有已发布章节状态变更为"草稿"，以便您可以重新编辑。`,
      type: 'warning',
      showResultNotification: true,
      successMessage: '章节已成功解锁，您可以开始编辑了',
      errorMessage: '解锁失败',
      onConfirm: async () => {
        try {
          await batchUpdateChapterStatus({
            project_id: projectId,
            from_order_index: currentChapter.chapter_number,
            new_status: 'draft'
          });

          await fetchChapters(); // Re-fetch all chapters to update list statuses

          // Re-fetch current chapter to get its updated status and unlock the editor
          const reloadedChapter = await getChapter(currentChapter.id);
          setCurrentChapter(reloadedChapter);

          if (onProjectsChange) {
            onProjectsChange();
          }
        } catch (error) {
          // The component will show the generic errorMessage.
          // Throwing the original error is good for debugging in the console.
          throw new Error(`解锁失败: ${error.message}`);
        }
      }
    });
  };

  // 开启新章
  const handleStartNewChapter = async (title) => {
    if (!title.trim() || !projectId) {
      throw new Error('章节标题不能为空或项目ID无效');
    }

    const newChapterData = {
      title: title,
      content: '',
      outline: '',
      status: 'draft'
    };

    try {
      const newChapter = await createChapter(projectId, newChapterData);

      setChapters(prev => [...prev, newChapter].sort((a, b) => a.chapter_number - b.chapter_number));
      setCurrentChapter(newChapter);
      setNewChapterTitle('');

      if (onProjectsChange) {
        onProjectsChange();
      }
    } catch (error) {
      console.error('创建章节失败:', error);
      throw error; // 重新抛出错误，让NotificationManager处理
    }
  };

  // 轮询章节知识分析后台任务状态（批量发布场景，轻量版，不操作 editor state）
  const _pollChapterAnalysis = useCallback(async (chapterId, chapterTitle) => {
    if (!projectId || !chapterId) return;
    const TERMINAL = new Set(['succeeded', 'failed', 'cancelled', 'interrupted']);
    const MAX_POLLS = 60; // 约 5 分钟上限
    const INTERVAL = 5000;
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        await new Promise((r) => setTimeout(r, INTERVAL));
        const result = await getChapterAnalysisStatus(projectId, chapterId);
        const status = result?.status;
        if (status && TERMINAL.has(status)) {
          if (status === 'succeeded') {
            addNotification({
              message: `《${chapterTitle}》知识变更分析完成，请审阅提案`,
              type: 'success',
              duration: 3000,
            });
          } else {
            const reason = result?.error_message || '分析未成功完成';
            addNotification({
              message: `《${chapterTitle}》知识变更分析: ${reason}`,
              type: 'warning',
              duration: 4000,
            });
          }
          return;
        }
      } catch (error) {
        addNotification({
          message: `《${chapterTitle}》查询分析状态失败: ${error.message || '未知错误'}`,
          type: 'warning',
          duration: 4000,
        });
        return;
      }
    }
    addNotification({
      message: `《${chapterTitle}》知识分析超时，请稍后在知识总览查看`,
      type: 'warning',
      duration: 4000,
    });
  }, [addNotification, projectId]);

  // 处理批量发布
  const handleBatchPublish = async (chaptersToPublish, onProgress) => {
    try {
      const chapterIds = chaptersToPublish.map(ch => ch.id);
      const results = await batchPublishChapters(projectId, chapterIds, onProgress);

      // 刷新章节列表
      await fetchChapters();

      // 如果当前章节在发布的章节中，更新其状态
      const publishedChapterIds = results.results
        .filter(r => r.success)
        .map(r => r.chapterId);

      if (currentChapter && publishedChapterIds.includes(currentChapter.id)) {
        const updatedChapter = await getChapter(currentChapter.id);
        setCurrentChapter(updatedChapter);
      }

      // 通知父组件更新项目状态
      if (onProjectsChange) {
        onProjectsChange();
      }

      // 显示结果通知
      if (results.errorCount === 0) {
        addNotification({
          message: `成功发布 ${results.successCount} 个章节`,
          type: 'success',
          duration: 3000
        });
      } else {
        addNotification({
          message: `发布完成：成功 ${results.successCount} 个，失败 ${results.errorCount} 个`,
          type: 'warning',
          duration: 5000
        });
      }

      // 对成功发布的章节并行启动知识分析轮询（fire-and-forget）
      const successIds = new Set(results.results.filter(r => r.success).map(r => r.chapterId));
      chaptersToPublish.filter(ch => successIds.has(ch.id)).forEach(ch => {
        _pollChapterAnalysis(ch.id, ch.title);
      });
    } catch (error) {
      addNotification({
        message: '批量发布失败: ' + error.message,
        type: 'error',
        duration: 3000
      });
      throw error;
    }
  };

  return {
    currentChapter,
    setCurrentChapter,
    content,
    setContent,
    chapters,
    setChapters,
    isSaving,
    isPublishing,
    isEditorLocked,
    newChapterTitle,
    setNewChapterTitle,
    fetchChapters,
    saveContent,
    publishChapterContent,
    handleContentChange,
    handleChapterChange,
    handleUnlockClick,
    handleStartNewChapter,
    handleBatchPublish
  };
};

export default useChapters;

import React, { Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useNavigate, useParams } from 'react-router-dom';
import { STORAGE_KEYS } from '../services/core/authStorage';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Loading from '../components/Loading';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import EditorLayout from '../layouts/EditorLayout';

// 页面级组件懒加载
const AuthPage = React.lazy(() => import('../components/AuthPage'));
const ProjectDashboard = React.lazy(() => import('../components/ProjectDashboard'));

// 编辑器子页面懒加载
const WritingEditor = React.lazy(() => import('../components/writing/WritingEditor'));
const CharacterManager = React.lazy(() => import('../components/CharacterManager'));
const KnowledgeBase = React.lazy(() => import('../components/KnowledgeBase'));
const AIWorkflowManager = React.lazy(() => import('../components/AIWorkflowManager'));
const ProjectOverview = React.lazy(() => import('../components/ProjectOverview'));
const KanbanBoard = React.lazy(() => import('../components/KanbanBoard'));
const ModelConfigManager = React.lazy(() => import('../components/ModelConfigManager'));
const PromptManager = React.lazy(() => import('../components/PromptManager'));
const PublishedChapters = React.lazy(() => import('../components/writing/PublishedChapters'));

/**
 * 根路由重定向 + 旧状态迁移
 * 启动时检查 localStorage 中的旧状态，自动跳转到对应路由
 */
const RootRedirect = () => {
  const navigate = useNavigate();
  const { user, isInitializing } = useAuth();

  useEffect(() => {
    if (isInitializing) return;

    // 未登录时跳转到登录页
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }

    // 已登录时检查旧状态迁移
    try {
      const lastView = localStorage.getItem(STORAGE_KEYS.LAST_VIEW);
      const currentProjectRaw = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT);

      if (lastView === 'editor' && currentProjectRaw) {
        const currentProject = JSON.parse(currentProjectRaw);
        if (currentProject && currentProject.id) {
          // 清除旧状态，避免重复跳转
          localStorage.removeItem(STORAGE_KEYS.LAST_VIEW);
          localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT);
          navigate(`/project/${currentProject.id}/writing`, { replace: true });
          return;
        }
      }

      // 默认清除旧状态并跳转到仪表盘
      if (lastView) localStorage.removeItem(STORAGE_KEYS.LAST_VIEW);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate, user, isInitializing]);

  return <Loading text="初始化中..." />;
};

// ── 带 projectId 注入的包装组件 ──

const WritingEditorWrapper = () => {
  const { id } = useParams();
  const { fetchProjects } = useAuth();
  const [initialChapterId, setInitialChapterId] = React.useState(null);

  useEffect(() => {
    const lastChapterId = localStorage.getItem(`lastChapter_${id}`);
    if (lastChapterId) {
      setInitialChapterId(parseInt(lastChapterId, 10));
    }
  }, [id]);

  return (
    <WritingEditor
      projectId={parseInt(id, 10)}
      initialChapterId={initialChapterId}
      onChapterChange={(chapterId) => {
        if (chapterId) {
          localStorage.setItem(`lastChapter_${id}`, chapterId);
        } else {
          localStorage.removeItem(`lastChapter_${id}`);
        }
      }}
      onProjectsChange={fetchProjects}
    />
  );
};

const PublishedChaptersWrapper = () => {
  const { id } = useParams();
  const { fetchProjects } = useAuth();
  return <PublishedChapters projectId={parseInt(id, 10)} onProjectsChange={fetchProjects} />;
};

const CharacterManagerWrapper = () => {
  const { id } = useParams();
  return <CharacterManager projectId={parseInt(id, 10)} />;
};

const KnowledgeBaseWrapper = () => {
  const { id } = useParams();
  return <KnowledgeBase projectId={parseInt(id, 10)} />;
};

const AIWorkflowManagerWrapper = () => {
  const { id } = useParams();
  return <AIWorkflowManager projectId={parseInt(id, 10)} />;
};

const ProjectOverviewWrapper = () => {
  const { id } = useParams();
  const { projects } = useAuth();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === parseInt(id, 10));

  return (
    <ProjectOverview
      project={project || { id: parseInt(id, 10), name: '加载中...' }}
      onNavigateToDrafts={() => navigate(`/project/${id}/writing`)}
    />
  );
};

// ── 路由配置 ──

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/login',
    element: (
      <AuthLayout>
        <Suspense fallback={<Loading text="加载中..." />}>
          <AuthPage />
        </Suspense>
      </AuthLayout>
    ),
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <Suspense fallback={<Loading text="加载中..." />}>
            <ProjectDashboard />
          </Suspense>
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/project/:id',
    element: (
      <ProtectedRoute>
        <EditorLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="writing" replace /> },
      {
        path: 'writing',
        element: (
          <Suspense fallback={<Loading text="加载编辑器..." />}>
            <WritingEditorWrapper />
          </Suspense>
        ),
      },
      {
        path: 'worldbuilding',
        element: (
          <Suspense fallback={<Loading text="加载世界观..." />}>
            <CharacterManagerWrapper />
          </Suspense>
        ),
      },
      {
        path: 'knowledge',
        element: (
          <Suspense fallback={<Loading text="加载知识库..." />}>
            <KnowledgeBaseWrapper />
          </Suspense>
        ),
      },
      {
        path: 'ai-workflow',
        element: (
          <Suspense fallback={<Loading text="加载 AI 工作流..." />}>
            <AIWorkflowManagerWrapper />
          </Suspense>
        ),
      },
      {
        path: 'overview',
        element: (
          <Suspense fallback={<Loading text="加载项目概览..." />}>
            <ProjectOverviewWrapper />
          </Suspense>
        ),
      },
      {
        path: 'kanban',
        element: (
          <Suspense fallback={<Loading text="加载看板..." />}>
            <KanbanBoard />
          </Suspense>
        ),
      },
      {
        path: 'models',
        element: (
          <Suspense fallback={<Loading text="加载模型配置..." />}>
            <ModelConfigManager />
          </Suspense>
        ),
      },
      {
        path: 'prompts',
        element: (
          <Suspense fallback={<Loading text="加载提示词管理..." />}>
            <PromptManager />
          </Suspense>
        ),
      },
      {
        path: 'published',
        element: (
          <Suspense fallback={<Loading text="加载已发布章节..." />}>
            <PublishedChaptersWrapper />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);

const AppRouter = () => {
  return <RouterProvider router={router} />;
};

export default AppRouter;

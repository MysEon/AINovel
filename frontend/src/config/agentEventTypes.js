export const EVENT_TYPES = {
  NODE_START: 'node_start',
  NODE_END: 'node_end',
  TOOL_START: 'tool_start',
  TOOL_END: 'tool_end',
  TEXT: 'text',
  ERROR: 'error',
  DONE: 'done',
};

// 与后端 NODE_LABELS 镜像；如果后端 type 是中文则前端无需翻译
export const NODE_LABELS = {
  inject_context: '加载项目上下文',
  agent: '推理回复',
  tools: '调用工具',
};

// tool name → 中文友好名（前端独立映射，便于 UI 美化）
export const TOOL_LABELS = {
  get_character_detail: '查询角色详情',
  list_locations: '列出地点',
  list_organizations: '列出组织',
  get_chapter_summary: '查询章节摘要',
};

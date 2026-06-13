export const MODEL_SCENARIOS = [
  { value: 'writing', label: '写作辅助' },
  { value: 'character_generation', label: '角色生成' },
  { value: 'worldview_generation', label: '世界观构建' },
  { value: 'outline_generation', label: '大纲生成' },
  { value: 'chat', label: 'AI 对话' },
];

export const DEFAULT_SCENARIOS = ['writing', 'chat'];

export const MODEL_SCENARIO_LABEL_MAP = MODEL_SCENARIOS.reduce((acc, scenario) => {
  acc[scenario.value] = scenario.label;
  return acc;
}, {});

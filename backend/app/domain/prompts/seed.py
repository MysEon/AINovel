"""系统预设提示词模板种子数据"""

import json


def get_system_templates() -> list[dict]:
    """返回系统预设模板数据列表"""
    return [
        {
            "name": "章节大纲生成",
            "category": "outline",
            "template": (
                "基于以下信息生成详细的章节大纲：\n\n"
                "项目信息：{{project_info}}\n"
                "章节号：第{{chapter_number}}章\n"
                "用户需求：{{user_requirements}}\n\n"
                "请生成包含以下要素的章节大纲：\n"
                "1. 章节标题建议\n"
                "2. 主要情节发展\n"
                "3. 重要角色出场\n"
                "4. 关键冲突或转折\n"
                "5. 章节结尾设计\n\n"
                "输出格式：结构化的章节大纲，便于后续章节内容写作。"
            ),
            "description": "用于生成小说章节大纲的提示词模板",
            "variables": json.dumps(["project_info", "chapter_number", "user_requirements"]),
            "tags": "大纲,章节,规划",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "情节发展建议",
            "category": "suggestions",
            "template": (
                "基于以下当前章节内容，提供情节发展建议：\n\n"
                "项目背景：{{project_info}}\n"
                "当前章节内容：\n{{current_chapter_content}}\n\n"
                "请提供以下方面的建议：\n"
                "1. 情节推进方向\n2. 角色关系发展\n"
                "3. 冲突升级建议\n4. 悬念设置技巧\n5. 下一章节衔接\n\n"
                "建议应该符合整体故事逻辑，保持角色一致性。"
            ),
            "description": "为当前章节内容提供情节发展建议",
            "variables": json.dumps(["project_info", "current_chapter_content"]),
            "tags": "建议,情节,发展",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "内容优化改进",
            "category": "optimization",
            "template": (
                "对以下内容进行{{optimization_type}}优化：\n\n"
                "原始内容：\n{{content}}\n\n项目背景：{{project_info}}\n\n"
                "请从以下角度进行优化：\n"
                "1. 文字表达和语言流畅性\n2. 情节逻辑和连贯性\n"
                "3. 人物刻画的生动性\n4. 场景描写的画面感\n"
                "5. 对话的自然度和个性化\n\n"
                "输出优化后的内容，保持原有故事核心不变。"
            ),
            "description": "对章节内容进行优化改进",
            "variables": json.dumps(["content", "project_info", "optimization_type"]),
            "tags": "优化,改进,文字",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "创意灵感生成",
            "category": "creative",
            "template": (
                "基于以下信息提供创意灵感：\n\n"
                "项目背景：{{project_info}}\n创意需求：{{prompt}}\n创意类别：{{category}}\n\n"
                "请生成多个有创意的想法，包括：\n"
                "1. 新的情节元素或转折\n2. 有趣的角色设定或互动\n"
                "3. 独特的场景或世界观细节\n4. 富有张力的冲突设置\n"
                "5. 引人入胜的细节描写\n\n"
                "创意应该新颖有趣，符合项目整体风格和设定。"
            ),
            "description": "生成各种创意灵感和想法",
            "variables": json.dumps(["project_info", "prompt", "category"]),
            "tags": "创意,灵感,想法",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "AI写作助手对话",
            "category": "chat",
            "template": (
                "你是一个专业的小说写作助手。\n\n"
                "当前项目信息：{{project_info}}\n对话历史：{{history}}\n\n"
                "用户说：{{message}}\n\n"
                "请以专业、友好的语气回复，提供有价值的写作指导和建议。"
            ),
            "description": "AI写作助手的对话提示词模板",
            "variables": json.dumps(["project_info", "history", "message"]),
            "tags": "对话,助手,指导",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "写作技巧建议",
            "category": "writing_advice",
            "template": (
                "基于以下内容和上下文，提供专业的写作技巧建议：\n\n"
                "内容：{{content}}\n项目背景：{{project_info}}\n"
                "上下文信息：{{context}}\n\n"
                "请从以下方面提供建议：\n"
                "1. 叙述技巧和节奏控制\n2. 对话写作和人物声音\n"
                "3. 场景描写和氛围营造\n4. 情感表达和内心刻画\n"
                "5. 文学手法的运用\n\n"
                "建议应该针对具体内容，提供可实施的改进方案。"
            ),
            "description": "提供专业的写作技巧和建议",
            "variables": json.dumps(["content", "project_info", "context"]),
            "tags": "技巧,建议,专业",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "辅助优化型AI助手",
            "category": "ai_mode_assist",
            "template": (
                "你是一个辅助优化型AI写作助手，采用建议式的协助方式：\n\n"
                "## 当前项目信息\n"
                "项目名称：{{project_name}}\n项目描述：{{project_description}}\n"
                "当前章节：{{current_chapter}}\n\n"
                "## 用户消息\n{{user_message}}\n\n"
                "请以建议和引导的方式回复，提供2-3个可行的改进建议，"
                "解释每个建议的理由和预期效果。记住：你是助手，作者是创作的主导者。"
            ),
            "description": "辅助优化型AI模式的专用提示词模板，强调建议式协助",
            "variables": json.dumps(["project_name", "project_description", "current_chapter", "user_message"]),
            "tags": "AI模式,辅助优化型,建议式,协助",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
        {
            "name": "全面接管型AI助手",
            "category": "ai_mode_takeover",
            "template": (
                "你是一个全面接管型AI写作助手，采用主动创作的协助方式：\n\n"
                "## 当前项目信息\n"
                "项目名称：{{project_name}}\n项目描述：{{project_description}}\n"
                "当前章节：{{current_chapter}}\n当前内容：{{current_content}}\n\n"
                "## 用户需求\n{{user_message}}\n\n"
                "请直接提供具体的创作内容，包括对现有内容的改进和重写、"
                "完整的新内容创作、具体的对话和场景描写。"
            ),
            "description": "全面接管型AI模式的专用提示词模板，强调主动创作和深度参与",
            "variables": json.dumps(
                ["project_name", "project_description", "current_chapter", "current_content", "user_message"]
            ),
            "tags": "AI模式,全面接管型,主动创作,深度参与",
            "is_system": True,
            "is_active": True,
            "usage_count": 0,
        },
    ]

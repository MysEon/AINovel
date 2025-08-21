"""
OpenAI AI服务适配器
用于调用OpenAI API进行文本生成
"""

import openai
import json
import asyncio
from typing import Dict, Any, Optional, List
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()


class OpenAIAdapter:
    """OpenAI API适配器"""
    
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self.default_model = os.getenv("OPENAI_MODEL", "gpt-4")
        
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        self.client = openai.AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
    
    async def generate_text(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.7,
        **kwargs
    ) -> str:
        """生成文本"""
        try:
            response = await self.client.chat.completions.create(
                model=model or self.default_model,
                messages=[
                    {"role": "system", "content": "你是一个专业的小说写作助手。"},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=max_tokens,
                temperature=temperature,
                **kwargs
            )
            
            return response.choices[0].message.content or ""
            
        except Exception as e:
            print(f"Error generating text: {e}")
            raise e
    
    async def generate_outline(
        self,
        project_context: Dict[str, Any],
        chapter_number: int,
        user_requirements: str = ""
    ) -> Dict[str, Any]:
        """生成章节大纲"""
        try:
            prompt = f"""
基于以下项目信息，为第{chapter_number}章生成详细的章节大纲：

项目名称：{project_context.get('name', '')}
项目描述：{project_context.get('description', '')}

用户要求：{user_requirements}

请生成一个结构化的章节大纲，包括：
1. 章节标题
2. 主要情节要点
3. 角色发展
4. 场景设置
5. 冲突和解决

格式要求：
- 使用JSON格式返回
- 包含title, plot_points, character_development, setting, conflicts字段
"""

            response = await self.generate_text(
                prompt=prompt,
                model="gpt-4",
                max_tokens=2000,
                temperature=0.7
            )
            
            # 尝试解析JSON
            try:
                outline = json.loads(response)
                return outline
            except json.JSONDecodeError:
                # 如果不是JSON格式，手动构造
                return {
                    "title": f"第{chapter_number}章",
                    "plot_points": [response],
                    "character_development": "待完善",
                    "setting": "待完善",
                    "conflicts": "待完善"
                }
            
        except Exception as e:
            print(f"Error generating outline: {e}")
            raise e
    
    async def generate_draft(
        self,
        outline: Dict[str, Any],
        project_context: Dict[str, Any],
        chapter_number: int
    ) -> str:
        """生成章节草稿"""
        try:
            prompt = f"""
基于以下章节大纲，生成完整的章节草稿：

大纲：{json.dumps(outline, ensure_ascii=False)}

项目背景：{project_context.get('description', '')}

写作要求：
1. 保持风格一致性
2. 注重细节描写
3. 推动情节发展
4. 体现角色特点

请生成一个完整的章节草稿，约2000-3000字。
"""

            response = await self.generate_text(
                prompt=prompt,
                model="gpt-4",
                max_tokens=3000,
                temperature=0.8
            )
            
            return response
            
        except Exception as e:
            print(f"Error generating draft: {e}")
            raise e
    
    async def refine_content(
        self,
        content: str,
        refinement_instructions: str
    ) -> str:
        """优化内容"""
        try:
            prompt = f"""
请根据以下要求优化提供的文本内容：

优化要求：{refinement_instructions}

原文内容：
{content}

请返回优化后的内容，保持原文的主要情节和风格。
"""

            response = await self.generate_text(
                prompt=prompt,
                model="gpt-4",
                max_tokens=3000,
                temperature=0.6
            )
            
            return response
            
        except Exception as e:
            print(f"Error refining content: {e}")
            raise e
    
    async def generate_character_dialogue(
        self,
        characters: List[str],
        situation: str,
        context: str = ""
    ) -> str:
        """生成角色对话"""
        try:
            prompt = f"""
为以下角色生成对话：

角色：{', '.join(characters)}
情境：{situation}
背景：{context}

写作要求：
1. 体现每个角色的性格特点
2. 对话自然流畅
3. 推动情节发展
4. 保持风格一致

请生成完整的对话内容。
"""

            response = await self.generate_text(
                prompt=prompt,
                model="gpt-4",
                max_tokens=2000,
                temperature=0.7
            )
            
            return response
            
        except Exception as e:
            print(f"Error generating character dialogue: {e}")
            raise e
    
    async def analyze_writing_quality(
        self,
        content: str
    ) -> Dict[str, Any]:
        """分析写作质量"""
        try:
            prompt = f"""
请分析以下文本的写作质量：

文本内容：
{content}

请从以下几个方面进行分析：
1. 语言表达（语法、词汇、句式）
2. 情节构建（逻辑性、吸引力、节奏）
3. 角色塑造（性格、对话、发展）
4. 场景描写（细节、氛围、连贯性）
5. 整体评价（优点、不足、建议）

请以JSON格式返回分析结果，包含scores（1-10分）和feedback字段。
"""

            response = await self.generate_text(
                prompt=prompt,
                model="gpt-4",
                max_tokens=1500,
                temperature=0.3
            )
            
            # 尝试解析JSON
            try:
                analysis = json.loads(response)
                return analysis
            except json.JSONDecodeError:
                return {
                    "scores": {
                        "language": 7,
                        "plot": 7,
                        "character": 7,
                        "setting": 7,
                        "overall": 7
                    },
                    "feedback": response
                }
            
        except Exception as e:
            print(f"Error analyzing writing quality: {e}")
            raise e


# 全局AI服务适配器实例
ai_adapter = OpenAIAdapter()


async def get_ai_adapter():
    """获取AI适配器实例"""
    return ai_adapter
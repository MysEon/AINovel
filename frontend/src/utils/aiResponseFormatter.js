/**
 * 增强的AI响应格式化工具
 * 基于Cherry Studio的格式化理念，提供更智能的文本处理
 * 
 * 主要功能：
 * 1. 智能段落分割
 * 2. Markdown语法识别和格式化  
 * 3. 中文友好处理
 * 4. 代码块和列表优化
 * 5. 引用和标题处理
 */

/**
 * 智能检测文本类型
 * @param {string} text - 输入文本
 * @returns {Object} 检测结果
 */
export const detectTextType = (text) => {
  if (!text || typeof text !== 'string') {
    return { type: 'unknown', confidence: 0 };
  }

  const patterns = {
    markdown: [
      /#{1,6}\s+/,           // 标题
      /\*\*[^*]+\*\*/,       // 加粗
      /\*[^*]+\*/,           // 斜体
      /`[^`]+`/,             // 行内代码
      /```[\s\S]*?```/,      // 代码块
      /^\s*[-*+]\s+/m,       // 列表
      /^\s*\d+\.\s+/m,       // 数字列表
      /^\s*>\s+/m            // 引用
    ],
    code: [
      /function\s+\w+\s*\(/,
      /class\s+\w+\s*{/,
      /import\s+.+\s+from/,
      /console\.(log|error|warn)/,
      /<\w+[^>]*>/,          // HTML标签
      /\$\{[^}]+\}/          // 模板字符串
    ],
    mathematical: [
      /\$\$[\s\S]*?\$\$/,    // LaTeX块
      /\$[^$]+\$/,           // LaTeX行内
      /\\[a-zA-Z]+\{[^}]*\}/, // LaTeX命令
      /\d+\s*[+\-*/=]\s*\d+/, // 数学表达式
    ]
  };

  let maxScore = 0;
  let detectedType = 'plain';

  for (const [type, typePatterns] of Object.entries(patterns)) {
    let score = 0;
    for (const pattern of typePatterns) {
      if (pattern.test(text)) {
        score += 1;
      }
    }
    
    const confidence = score / typePatterns.length;
    if (confidence > maxScore) {
      maxScore = confidence;
      detectedType = type;
    }
  }

  return {
    type: detectedType,
    confidence: maxScore,
    length: text.length,
    hasMarkdown: patterns.markdown.some(p => p.test(text)),
    hasCode: patterns.code.some(p => p.test(text)),
    hasMath: patterns.mathematical.some(p => p.test(text))
  };
};

/**
 * 智能分段处理
 * @param {string} text - 输入文本
 * @param {Object} options - 配置选项
 * @returns {string} 格式化后的文本
 */
export const enhancedFormatAIResponse = (text, options = {}) => {
  const {
    preserveCodeBlocks = true,
    enhanceHeaders = true,
    optimizeLists = true,
    improveQuotes = true,
    chineseFriendly = true,
    debug = false
  } = options;

  if (!text || typeof text !== 'string') return text;

  let formatted = text;
  const detection = detectTextType(text);

  if (debug) {
    console.log('🔍 [EnhancedFormatter] 文本分析:', detection);
  }

  // 1. 保护代码块，避免被误格式化
  const codeBlocks = [];
  let codeBlockIndex = 0;
  
  if (preserveCodeBlocks) {
    formatted = formatted.replace(/(```[\s\S]*?```)/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlockIndex++}__`;
    });
  }

  // 2. 处理标题格式化
  if (enhanceHeaders) {
    // 清理标题前的装饰符号，只保留标题标记
    formatted = formatted.replace(/[-*=_]{2,}\s*(#{1,6}\s+)/g, '$1');
    
    // 确保标题前后有适当的空行
    formatted = formatted.replace(/(^|[^\n])(#{1,6}\s+[^\n]+)/gm, '$1\n\n$2\n');
    // 处理文档开头的标题
    formatted = formatted.replace(/^\n*(#{1,6}\s+[^\n]+)/gm, '$1\n');
  }

  // 3. 优化列表格式
  if (optimizeLists) {
    // 处理无序列表 - 更精确的匹配，避免过度分行
    formatted = formatted.replace(/([.!?。！？])\s{2,}([\-*+·•]\s+[^\n]+)/g, '$1\n$2');
    formatted = formatted.replace(/(^|\n)([^\-*+·•\n\s][^\n]*[^\-*+·•:\s\n]{15,})\s+([\-*+·•]\s+)/gm, '$1$2\n$3');
    
    // 处理有序列表 - 更精确的匹配
    formatted = formatted.replace(/([.!?。！？])\s{2,}(\d+\.\s+[^\n]+)/g, '$1\n$2');
    formatted = formatted.replace(/(^|\n)([^\d\n\s][^\n]*[^\d:\s\n]{15,})\s+(\d+\.\s+)/gm, '$1$2\n$3');
  }

  // 4. 处理引用块
  if (improveQuotes) {
    // 确保引用块前有换行，但不过度
    formatted = formatted.replace(/(^|\n)(\s*)(>\s+)/gm, '$1$2$3');
  }

  // 5. 处理加粗文本 - 更保守
  // formatted = formatted.replace(/([^*\n])(\*\*[^*]+\*\*)([^*\n])/g, '$1\n\n$2\n\n$3');

  // 6. 中文友好处理
  if (chineseFriendly) {
    // 中英文之间添加适当空格（可选）
    // formatted = formatted.replace(/([\u4e00-\u9fff])([a-zA-Z])/g, '$1 $2');
    // formatted = formatted.replace(/([a-zA-Z])([\u4e00-\u9fff])/g, '$1 $2');
    
    // 处理中文标点后的列表 - 更保守的处理
    formatted = formatted.replace(/([\u4e00-\u9fff][。！？])\s*([\-*+·•]\s+)/g, '$1\n$2');
    
    // 处理中文句子结构 - 只在长句子后添加换行，避免短句过度分割
    formatted = formatted.replace(/([。！？])\s*([^。！？\s\n][^:\n\-*+·•]{20,})/g, '$1\n\n$2');
  }

  // 7. 处理重要标记和关键词 - 更保守的处理
  formatted = formatted.replace(/([.!?。！？])\s{2,}([^:\n]*[：:])/g, '$1\n$2');
  formatted = formatted.replace(/(^|\n)([^:\n]*[：:]\s*$)/gm, '$1$2');

  // 8. 数学公式处理
  if (detection.hasMath) {
    // 确保数学公式块前后有换行
    formatted = formatted.replace(/(\$\$[\s\S]*?\$\$)/g, '\n\n$1\n\n');
  }

  // 9. 清理多余的换行符 - 更严格的控制
  formatted = formatted.replace(/\n{3,}/g, '\n\n');
  
  // 10. 去除不必要的单独换行
  formatted = formatted.replace(/([^\n])\n([^\n•\-*+\d#>])/g, '$1 $2');
  
  // 11. 恢复代码块
  if (preserveCodeBlocks) {
    for (let i = 0; i < codeBlocks.length; i++) {
      formatted = formatted.replace(`__CODE_BLOCK_${i}__`, codeBlocks[i]);
    }
  }

  // 12. 最终清理
  formatted = formatted.trim();
  
  // 13. 最后的换行优化 - 确保格式合理
  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n'); // 最多两个换行

  if (debug) {
    console.log('🔧 [EnhancedFormatter] 格式化结果:', {
      原文长度: text.length,
      格式化后长度: formatted.length,
      换行数量: (formatted.match(/\n/g) || []).length,
      检测类型: detection.type,
      包含Markdown: detection.hasMarkdown,
      包含代码: detection.hasCode,
      包含数学: detection.hasMath
    });
  }

  return formatted;
};

/**
 * 安全的中文文本拼接
 * 改进版本，更好地处理UTF-8编码和中文字符
 * @param {string} existingText - 现有文本
 * @param {string} newText - 新增文本
 * @returns {string} 拼接后的文本
 */
export const safeConcatChineseText = (existingText, newText) => {
  if (!existingText) return newText || '';
  if (!newText) return existingText;

  // 检查是否包含中文字符
  const hasChinese = /[\u4e00-\u9fff]/.test(existingText + newText);
  
  if (!hasChinese) {
    // 非中文文本，直接拼接
    return existingText + newText;
  }

  // 中文文本处理
  const lastChar = existingText.slice(-1);
  const firstChar = newText.slice(0, 1);
  
  // 检查边界字符是否为完整的Unicode字符
  try {
    // 使用正则检查字符完整性
    if (/[\u4e00-\u9fff]/.test(lastChar) && /[\u4e00-\u9fff]/.test(firstChar)) {
      // 两边都是中文字符，直接拼接
      return existingText + newText;
    }
    
    // 处理可能的编码问题
    const combined = existingText + newText;
    
    // 验证拼接后的文本是否有效
    if (combined.length >= existingText.length && combined.includes(existingText.slice(0, 10))) {
      return combined;
    }
  } catch (error) {
    console.warn('[SafeConcat] 中文拼接警告:', error);
  }

  // 回退方案：直接拼接
  return existingText + newText;
};

/**
 * 流式文本处理优化
 * 专门用于处理流式AI回复中的文本chunk
 * @param {string} accumulatedText - 累积的文本
 * @param {string} newChunk - 新的chunk
 * @param {Object} options - 配置选项
 * @returns {Object} 处理结果
 */
export const processStreamChunk = (accumulatedText, newChunk, options = {}) => {
  const {
    enableFormatting = true,
    enableSafeConcat = true,
    debug = false
  } = options;

  // 安全拼接
  const newText = enableSafeConcat 
    ? safeConcatChineseText(accumulatedText, newChunk)
    : accumulatedText + newChunk;

  // 可选的实时格式化（可能影响性能）
  const formattedText = enableFormatting
    ? enhancedFormatAIResponse(newText, { debug })
    : newText;

  const result = {
    rawText: newText,
    formattedText,
    chunkInfo: {
      chunkLength: newChunk?.length || 0,
      totalLength: newText.length,
      hasNewContent: newChunk && newChunk.length > 0,
      containsChinese: /[\u4e00-\u9fff]/.test(newChunk || ''),
      containsMarkdown: /[#*`>]/.test(newChunk || '')
    }
  };

  if (debug) {
    console.log('📝 [StreamChunk] 处理结果:', result.chunkInfo);
  }

  return result;
};

/**
 * 批量文本预处理
 * 用于处理完整的AI回复文本
 * @param {string} text - 完整文本
 * @param {Object} options - 配置选项
 * @returns {Object} 处理结果
 */
export const preprocessAIResponse = (text, options = {}) => {
  const detection = detectTextType(text);
  const formatted = enhancedFormatAIResponse(text, options);

  return {
    original: text,
    formatted,
    detection,
    metadata: {
      length: text.length,
      formattedLength: formatted.length,
      lineCount: (formatted.match(/\n/g) || []).length + 1,
      wordCount: formatted.split(/\s+/).length,
      chineseCharCount: (formatted.match(/[\u4e00-\u9fff]/g) || []).length
    }
  };
};

export default {
  detectTextType,
  enhancedFormatAIResponse,
  safeConcatChineseText,
  processStreamChunk,
  preprocessAIResponse
};
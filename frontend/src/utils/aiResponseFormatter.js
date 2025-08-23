/**
 * 简化的AI响应处理工具
 * Streamdown已处理大部分格式化工作，这里只保留基本的流式文本处理
 */

/**
 * 处理流式文本块
 * @param {string} existingText - 已有文本
 * @param {string} newChunk - 新的文本块
 * @param {Object} options - 选项
 * @returns {Object} 处理结果
 */
export const processStreamChunk = (existingText, newChunk, options = {}) => {
  const {
    enableSafeConcat = true,
    debug = false
  } = options;

  if (debug) {
    console.log('🔄 [Stream Processing] 处理文本块:', {
      existingLength: existingText?.length || 0,
      chunkLength: newChunk?.length || 0,
      chunk: newChunk
    });
  }

  // 基本的安全拼接
  let result = existingText || '';
  
  if (newChunk !== null && newChunk !== undefined) {
    if (enableSafeConcat) {
      // 安全的中文文本拼接
      result = safeConcatChineseText(result, newChunk);
    } else {
      result += newChunk;
    }
  }

  return {
    rawText: result,
    success: true
  };
};

/**
 * 安全的中文文本拼接
 * @param {string} existingText - 已有文本  
 * @param {string} newText - 新文本
 * @returns {string} 拼接结果
 */
export const safeConcatChineseText = (existingText, newText) => {
  if (!existingText) return newText || '';
  if (!newText) return existingText;
  
  // 直接拼接，Streamdown会处理markdown语法
  return existingText + newText;
};
/**
 * 紧急Token清理脚本
 * 在浏览器控制台运行这个脚本来清理损坏的token
 */

(function() {
  console.log('🔧 开始Token清理...');
  
  // 获取当前token
  const currentToken = localStorage.getItem('ainovel_token');
  console.log('当前token:', currentToken);
  
  if (currentToken) {
    // 检查是否有引号包装
    if (currentToken.startsWith('"') && currentToken.endsWith('"')) {
      console.log('❌ 发现token有引号包装问题');
      
      // 清理引号
      const cleanToken = currentToken.replace(/^"|"$/g, '');
      console.log('✅ 清理后的token:', cleanToken.substring(0, 20) + '...');
      
      // 保存清理后的token
      localStorage.setItem('ainovel_token', cleanToken);
      console.log('✅ Token已清理并保存');
      
      // 刷新页面
      console.log('🔄 刷新页面以应用更改...');
      setTimeout(() => {
        location.reload();
      }, 1000);
      
    } else {
      console.log('✅ Token格式正常，无需清理');
    }
  } else {
    console.log('ℹ️ 没有找到token');
  }
})();
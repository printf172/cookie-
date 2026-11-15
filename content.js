// 网站Cookie获取器的content script

// 获取当前网站域名
function getCurrentDomain() {
  return window.location.hostname;
}

// 复制文本到剪贴板
function copyTextToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch (err) {
    // 静默失败
  }
  
  document.body.removeChild(textarea);
  return success;
}

// 监听来自background.js的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'cookiesUpdated') {
    sendResponse({ received: true });
  }
}); 
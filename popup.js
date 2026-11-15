document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('status');
  const cookieContainer = document.getElementById('cookieContainer');
  const refreshBtn = document.getElementById('refreshBtn');
  const copyBtn = document.getElementById('copyBtn');
  const domainInfo = document.getElementById('domainInfo');
  const configBtn = document.getElementById('configBtn');
  const backendIndicator = document.getElementById('backendIndicator');
  const backendStatus = document.getElementById('backendStatus');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  
  // 存储当前的Cookie数据
  let currentCookies = {
    all: [],
    firstParty: [],
    thirdParty: []
  };
  
  // 复制文本到剪贴板
  function copyTextToClipboard(text) {
    return navigator.clipboard.writeText(text).then(
      function() {
        return true;
      }, 
      function() {
        return false;
      }
    );
  }
  
  // 创建单个Cookie的复制按钮
  function createCopyButton(cookieStr) {
    const btn = document.createElement('button');
    btn.textContent = '复制';
    btn.className = 'copy-btn';
    btn.addEventListener('click', function() {
      copyTextToClipboard(cookieStr).then(function(success) {
        if (success) {
          btn.textContent = '已复制';
          btn.classList.add('copied');
          setTimeout(function() {
            btn.textContent = '复制';
            btn.classList.remove('copied');
          }, 1500);
        } else {
          btn.textContent = '失败';
          btn.classList.add('error');
          setTimeout(function() {
            btn.textContent = '复制';
            btn.classList.remove('error');
          }, 1500);
        }
      });
    });
    return btn;
  }
  
  // 获取后台配置状态
  function getBackendStatus() {
    chrome.storage.local.get(['backendConfig'], function(result) {
      if (chrome.runtime.lastError) {
        updateBackendStatusUI(false);
        return;
      }
      
      const config = result.backendConfig || {};
      updateBackendStatusUI(config.enabled);
    });
  }
  
  // 更新后台状态UI
  function updateBackendStatusUI(enabled) {
    if (enabled) {
      backendIndicator.classList.add('enabled');
      backendIndicator.classList.remove('disabled');
      backendStatus.textContent = '后台传输: 已启用';
    } else {
      backendIndicator.classList.add('disabled');
      backendIndicator.classList.remove('enabled');
      backendStatus.textContent = '后台传输: 已禁用';
    }
  }
  
  // 获取当前标签页的Cookie
  function getCurrentTabCookies() {
    statusElement.textContent = '正在获取Cookie...';
    statusElement.style.backgroundColor = '#f5f5f5';
    
    try {
      chrome.runtime.sendMessage({action: 'getCurrentTabCookies'}, function(response) {
        if (chrome.runtime.lastError) {
          statusElement.textContent = '获取Cookie时出错，请刷新';
          statusElement.style.backgroundColor = '#fce8e6';
          return;
        }
        
        if (response.error) {
          statusElement.textContent = response.error;
          statusElement.style.backgroundColor = '#fce8e6';
          return;
        }
        
        if (response && response.domain) {
          domainInfo.textContent = `当前网站: ${response.domain}`;
          statusElement.textContent = `已获取 ${response.cookies.length} 个Cookie`;
          statusElement.style.backgroundColor = '#e6f4ea';
          
          // 存储当前Cookie数据
          currentCookies = {
            all: response.cookies || [],
            firstParty: response.firstPartyCookies || [],
            thirdParty: response.thirdPartyCookies || []
          };
          
          displayCookies(
            currentCookies.all, 
            currentCookies.firstParty, 
            currentCookies.thirdParty
          );
        } else {
          statusElement.textContent = '未能获取到Cookie数据';
          statusElement.style.backgroundColor = '#fce8e6';
          cookieContainer.innerHTML = '<p>未能获取到Cookie数据</p>';
        }
      });
    } catch (error) {
      statusElement.textContent = '通信错误，请重新加载扩展';
      statusElement.style.backgroundColor = '#fce8e6';
    }
  }
  
  // 搜索Cookie
  function searchCookies() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (!searchTerm) {
      // 如果搜索词为空，显示所有Cookie
      displayCookies(
        currentCookies.all, 
        currentCookies.firstParty, 
        currentCookies.thirdParty
      );
      return;
    }
    
    // 过滤Cookie
    const filteredFirstParty = currentCookies.firstParty.filter(cookie => 
      cookie.name.toLowerCase().includes(searchTerm) || 
      cookie.value.toLowerCase().includes(searchTerm)
    );
    
    const filteredThirdParty = currentCookies.thirdParty.filter(cookie => 
      cookie.name.toLowerCase().includes(searchTerm) || 
      cookie.value.toLowerCase().includes(searchTerm)
    );
    
    const allFiltered = [...filteredFirstParty, ...filteredThirdParty];
    
    if (allFiltered.length === 0) {
      cookieContainer.innerHTML = '<div class="no-results">没有找到匹配的Cookie</div>';
      return;
    }
    
    // 显示过滤后的Cookie
    displayCookies(
      allFiltered, 
      filteredFirstParty, 
      filteredThirdParty, 
      searchTerm
    );
    
    // 更新状态
    statusElement.textContent = `找到 ${allFiltered.length} 个匹配的Cookie`;
    statusElement.style.backgroundColor = '#e6f4ea';
  }
  
  // 清除搜索
  function clearSearch() {
    searchInput.value = '';
    displayCookies(
      currentCookies.all, 
      currentCookies.firstParty, 
      currentCookies.thirdParty
    );
    statusElement.textContent = `已获取 ${currentCookies.all.length} 个Cookie`;
    statusElement.style.backgroundColor = '#e6f4ea';
  }
  
  // 高亮显示匹配的文本
  function highlightText(text, searchTerm) {
    if (!searchTerm) return text;
    
    const lowerText = text.toLowerCase();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    if (!lowerText.includes(lowerSearchTerm)) return text;
    
    const startIndex = lowerText.indexOf(lowerSearchTerm);
    const endIndex = startIndex + searchTerm.length;
    
    return text.substring(0, startIndex) + 
           '<span class="highlight">' + text.substring(startIndex, endIndex) + '</span>' + 
           text.substring(endIndex);
  }
  
  // 初始化时获取当前标签页的Cookie
  getCurrentTabCookies();
  
  // 获取后台配置状态
  getBackendStatus();
  
  // 刷新按钮点击事件
  refreshBtn.addEventListener('click', function() {
    getCurrentTabCookies();
    getBackendStatus();
  });
  
  // 配置按钮点击事件
  configBtn.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });
  
  // 搜索按钮点击事件
  searchBtn.addEventListener('click', searchCookies);
  
  // 清除搜索按钮点击事件
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // 搜索输入框回车事件
  searchInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchCookies();
    }
  });
  
  // 复制按钮点击事件
  copyBtn.addEventListener('click', function() {
    try {
      chrome.storage.local.get(['current_cookies'], function(result) {
        if (chrome.runtime.lastError) {
          statusElement.textContent = '获取Cookie时出错';
          statusElement.style.backgroundColor = '#fce8e6';
          return;
        }
        
        const cookies = result.current_cookies || [];
        
        if (cookies.length > 0) {
          // 将cookie转换为字符串格式
          const cookieStr = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
          
          // 复制到剪贴板
          navigator.clipboard.writeText(cookieStr).then(function() {
            statusElement.textContent = 'Cookie已复制到剪贴板';
            statusElement.style.backgroundColor = '#e6f4ea';
          }, function(err) {
            statusElement.textContent = '复制失败，请手动复制';
            statusElement.style.backgroundColor = '#fce8e6';
          });
        } else {
          statusElement.textContent = '没有可复制的Cookie';
          statusElement.style.backgroundColor = '#fce8e6';
        }
      });
    } catch (error) {
      statusElement.textContent = '复制Cookie时出错';
      statusElement.style.backgroundColor = '#fce8e6';
    }
  });
  
  // 显示cookie的函数
  function displayCookies(cookies, firstPartyCookies, thirdPartyCookies, searchTerm) {
    if (cookies && cookies.length > 0) {
      let cookieHtml = '';
      
      // 添加Chrome Cookie政策提示
      if (thirdPartyCookies.length > 0) {
        cookieHtml += `<div style="background-color: #fff3cd; padding: 8px; margin-bottom: 10px; border-radius: 4px; font-size: 12px;">
          <strong>注意:</strong> 检测到 ${thirdPartyCookies.length} 个第三方Cookie。Chrome正在逐步淘汰第三方Cookie，这些Cookie在未来可能无法正常工作。
        </div>`;
      }
      
      // 显示第一方Cookie
      cookieHtml += `<div style="margin-bottom: 10px;">
        <h3 style="font-size: 14px; margin: 5px 0;">第一方Cookie (${firstPartyCookies.length})</h3>
        <ul class="cookie-list">`;
      
      if (firstPartyCookies.length > 0) {
        firstPartyCookies.forEach(cookie => {
          const cookieStr = `${cookie.name}=${cookie.value}`;
          const highlightedName = highlightText(cookie.name, searchTerm);
          const displayValue = cookie.value.length > 20 ? 
            highlightText(cookie.value.substring(0, 20), searchTerm) + '...' : 
            highlightText(cookie.value, searchTerm);
          
          cookieHtml += `<li class="cookie-item">
            <div class="cookie-info">
              <strong>${highlightedName}</strong>: ${displayValue}
              <br><span class="cookie-meta">SameSite: ${cookie.sameSite || '未设置'}, Secure: ${cookie.secure ? '是' : '否'}</span>
            </div>
            <div class="cookie-copy" data-cookie="${cookieStr}">复制</div>
          </li>`;
        });
      } else {
        cookieHtml += '<li>没有第一方Cookie</li>';
      }
      
      cookieHtml += `</ul></div>`;
      
      // 显示第三方Cookie
      cookieHtml += `<div>
        <h3 style="font-size: 14px; margin: 5px 0;">第三方Cookie (${thirdPartyCookies.length})</h3>
        <ul class="cookie-list">`;
      
      if (thirdPartyCookies.length > 0) {
        thirdPartyCookies.forEach(cookie => {
          const cookieStr = `${cookie.name}=${cookie.value}`;
          const highlightedName = highlightText(cookie.name, searchTerm);
          const displayValue = cookie.value.length > 20 ? 
            highlightText(cookie.value.substring(0, 20), searchTerm) + '...' : 
            highlightText(cookie.value, searchTerm);
          
          cookieHtml += `<li class="cookie-item">
            <div class="cookie-info">
              <strong>${highlightedName}</strong>: ${displayValue}
              <br><span class="cookie-meta">SameSite: ${cookie.sameSite || '未设置'}, Secure: ${cookie.secure ? '是' : '否'}</span>
            </div>
            <div class="cookie-copy" data-cookie="${cookieStr}">复制</div>
          </li>`;
        });
      } else {
        cookieHtml += '<li>没有第三方Cookie</li>';
      }
      
      cookieHtml += `</ul></div>`;
      
      cookieContainer.innerHTML = cookieHtml;
      
      // 为所有复制按钮添加事件监听
      document.querySelectorAll('.cookie-copy').forEach(btn => {
        btn.addEventListener('click', function() {
          const cookieStr = this.getAttribute('data-cookie');
          copyTextToClipboard(cookieStr).then(success => {
            if (success) {
              this.textContent = '已复制';
              this.classList.add('copied');
              setTimeout(() => {
                this.textContent = '复制';
                this.classList.remove('copied');
              }, 1500);
            } else {
              this.textContent = '失败';
              this.classList.add('error');
              setTimeout(() => {
                this.textContent = '复制';
                this.classList.remove('error');
              }, 1500);
            }
          });
        });
      });
    } else {
      cookieContainer.innerHTML = '<p>尚未获取到Cookie数据</p>';
    }
  }
}); 
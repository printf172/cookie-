document.addEventListener('DOMContentLoaded', function() {
  const enableBackendCheckbox = document.getElementById('enableBackend');
  const backendUrlInput = document.getElementById('backendUrl');
  const requestMethodSelect = document.getElementById('requestMethod');
  const customHeadersTextarea = document.getElementById('customHeaders');
  const dataFormatTextarea = document.getElementById('dataFormat');
  const testBtn = document.getElementById('testBtn');
  const saveBtn = document.getElementById('saveBtn');
  const resetBtn = document.getElementById('resetBtn');
  const statusDiv = document.getElementById('status');
  const testResultDiv = document.getElementById('testResult');
  
  // 过滤相关元素
  const urlFilterInput = document.getElementById('urlFilterInput');
  const addUrlFilterBtn = document.getElementById('addUrlFilter');
  const urlFilterList = document.getElementById('urlFilterList');
  const urlFilterTypeCheckbox = document.getElementById('urlFilterType');
  
  const cookieKeyFilterInput = document.getElementById('cookieKeyFilterInput');
  const addCookieKeyFilterBtn = document.getElementById('addCookieKeyFilter');
  const cookieKeyFilterList = document.getElementById('cookieKeyFilterList');
  const cookieFilterTypeCheckbox = document.getElementById('cookieFilterType');
  
  // 标签页切换
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // 初始化
  loadConfig();
  
  // 标签页切换事件
  tabButtons.forEach(button => {
    button.addEventListener('click', function() {
      const tabId = this.getAttribute('data-tab');
      
      // 更新按钮状态
      tabButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      
      // 更新内容显示
      tabContents.forEach(content => content.classList.remove('active'));
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
  
  // 加载配置
  function loadConfig() {
    chrome.storage.local.get(['backendConfig'], function(result) {
      if (chrome.runtime.lastError) {
        showStatus('加载配置时出错: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      const config = result.backendConfig || getDefaultConfig();
      
      enableBackendCheckbox.checked = config.enabled;
      backendUrlInput.value = config.url || '';
      requestMethodSelect.value = config.method || 'POST';
      customHeadersTextarea.value = config.headers ? JSON.stringify(config.headers, null, 2) : '';
      dataFormatTextarea.value = config.dataFormat || '';
      
      // 加载URL过滤器
      urlFilterTypeCheckbox.checked = config.urlFilterUseRegex || false;
      renderFilterTags(urlFilterList, config.urlFilters || [], 'url');
      
      // 加载Cookie键过滤器
      cookieFilterTypeCheckbox.checked = config.cookieFilterExcludeMode || false;
      renderFilterTags(cookieKeyFilterList, config.cookieKeyFilters || [], 'cookie');
    });
  }
  
  // 保存配置
  function saveConfig() {
    // 验证URL
    if (enableBackendCheckbox.checked) {
      if (!backendUrlInput.value) {
        showStatus('请输入后台接口地址', 'error');
        return;
      }
      
      try {
        new URL(backendUrlInput.value);
      } catch (e) {
        showStatus('后台接口地址格式无效', 'error');
        return;
      }
    }
    
    // 验证自定义请求头
    let headers = { 'Content-Type': 'application/json' };
    if (customHeadersTextarea.value.trim()) {
      try {
        headers = JSON.parse(customHeadersTextarea.value);
        if (typeof headers !== 'object' || headers === null) {
          throw new Error('请求头必须是一个对象');
        }
      } catch (e) {
        showStatus('自定义请求头格式无效: ' + e.message, 'error');
        return;
      }
    }
    
    // 验证数据格式
    if (!dataFormatTextarea.value.trim()) {
      showStatus('请输入数据格式', 'error');
      return;
    }
    
    // 获取过滤器数据
    const urlFilters = Array.from(urlFilterList.querySelectorAll('.filter-tag'))
      .map(tag => tag.getAttribute('data-value'));
    
    const cookieKeyFilters = Array.from(cookieKeyFilterList.querySelectorAll('.filter-tag'))
      .map(tag => tag.getAttribute('data-value'));
    
    // 创建配置对象
    const config = {
      enabled: enableBackendCheckbox.checked,
      url: backendUrlInput.value,
      method: requestMethodSelect.value,
      headers: headers,
      dataFormat: dataFormatTextarea.value,
      urlFilters: urlFilters,
      urlFilterUseRegex: urlFilterTypeCheckbox.checked,
      cookieKeyFilters: cookieKeyFilters,
      cookieFilterExcludeMode: cookieFilterTypeCheckbox.checked
    };
    
    // 保存配置
    chrome.storage.local.set({ 'backendConfig': config }, function() {
      if (chrome.runtime.lastError) {
        showStatus('保存配置时出错: ' + chrome.runtime.lastError.message, 'error');
        return;
      }
      
      showStatus('配置已保存', 'success');
      
      // 通知后台脚本重新加载配置
      chrome.runtime.sendMessage({ action: 'reloadBackendConfig' });
    });
  }
  
  // 测试连接
  function testConnection() {
    if (!backendUrlInput.value) {
      showStatus('请输入后台接口地址', 'error');
      return;
    }
    
    try {
      new URL(backendUrlInput.value);
    } catch (e) {
      showStatus('后台接口地址格式无效', 'error');
      return;
    }
    
    // 验证自定义请求头
    let headers = { 'Content-Type': 'application/json' };
    if (customHeadersTextarea.value.trim()) {
      try {
        headers = JSON.parse(customHeadersTextarea.value);
        if (typeof headers !== 'object' || headers === null) {
          throw new Error('请求头必须是一个对象');
        }
      } catch (e) {
        showStatus('自定义请求头格式无效: ' + e.message, 'error');
        return;
      }
    }
    
    // 验证数据格式
    if (!dataFormatTextarea.value.trim()) {
      showStatus('请输入数据格式', 'error');
      return;
    }
    
    // 准备测试数据
    const testDomain = 'example.com';
    const testCookies = [
      { name: 'test_cookie1', value: 'test_value1', domain: testDomain },
      { name: 'test_cookie2', value: 'test_value2', domain: testDomain }
    ];
    
    // 应用过滤器
    let filteredCookies = testCookies;
    
    // 应用Cookie键过滤
    const cookieKeyFilters = Array.from(cookieKeyFilterList.querySelectorAll('.filter-tag'))
      .map(tag => tag.getAttribute('data-value'));
    
    if (cookieKeyFilters.length > 0) {
      if (cookieFilterTypeCheckbox.checked) {
        // 排除模式
        filteredCookies = filteredCookies.filter(cookie => 
          !cookieKeyFilters.includes(cookie.name)
        );
      } else {
        // 包含模式
        filteredCookies = filteredCookies.filter(cookie => 
          cookieKeyFilters.includes(cookie.name)
        );
      }
    }
    
    // 格式化数据
    let formattedData = dataFormatTextarea.value
      .replace('{domain}', testDomain)
      .replace('{cookies}', JSON.stringify(filteredCookies));
    
    // 显示测试请求信息
    testResultDiv.style.display = 'block';
    testResultDiv.innerHTML = `
      <p><strong>测试请求信息:</strong></p>
      <p>URL: ${backendUrlInput.value}</p>
      <p>方法: ${requestMethodSelect.value}</p>
      <p>请求头: ${JSON.stringify(headers, null, 2)}</p>
      <p>数据: ${formattedData}</p>
      <p><em>正在发送请求...</em></p>
    `;
    
    // 发送测试请求
    fetch(backendUrlInput.value, {
      method: requestMethodSelect.value,
      headers: headers,
      body: formattedData
    })
    .then(response => {
      if (!response.ok) {
        throw new Error('HTTP错误，状态码: ' + response.status);
      }
      return response.text();
    })
    .then(data => {
      testResultDiv.innerHTML += `
        <p style="color: #0f9d58;"><strong>测试成功!</strong></p>
        <p>响应: ${data.substring(0, 200)}${data.length > 200 ? '...' : ''}</p>
      `;
      showStatus('测试连接成功', 'success');
    })
    .catch(error => {
      testResultDiv.innerHTML += `
        <p style="color: #db4437;"><strong>测试失败!</strong></p>
        <p>错误: ${error.message}</p>
      `;
      showStatus('测试连接失败: ' + error.message, 'error');
    });
  }
  
  // 重置配置
  function resetConfig() {
    if (confirm('确定要重置所有配置吗？这将清除所有设置。')) {
      const defaultConfig = getDefaultConfig();
      
      enableBackendCheckbox.checked = defaultConfig.enabled;
      backendUrlInput.value = defaultConfig.url;
      requestMethodSelect.value = defaultConfig.method;
      customHeadersTextarea.value = JSON.stringify(defaultConfig.headers, null, 2);
      dataFormatTextarea.value = defaultConfig.dataFormat;
      
      // 重置过滤器
      urlFilterList.innerHTML = '';
      cookieKeyFilterList.innerHTML = '';
      urlFilterTypeCheckbox.checked = false;
      cookieFilterTypeCheckbox.checked = false;
      
      // 保存默认配置
      chrome.storage.local.set({ 'backendConfig': defaultConfig }, function() {
        if (chrome.runtime.lastError) {
          showStatus('重置配置时出错: ' + chrome.runtime.lastError.message, 'error');
          return;
        }
        
        showStatus('配置已重置为默认值', 'success');
        
        // 通知后台脚本重新加载配置
        chrome.runtime.sendMessage({ action: 'reloadBackendConfig' });
      });
    }
  }
  
  // 获取默认配置
  function getDefaultConfig() {
    return {
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
  }
  
  // 显示状态消息
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    
    // 3秒后隐藏
    setTimeout(function() {
      statusDiv.style.display = 'none';
    }, 3000);
  }
  
  // 添加URL过滤器
  function addUrlFilter() {
    const value = urlFilterInput.value.trim();
    if (!value) return;
    
    // 检查是否已存在
    const existingTags = Array.from(urlFilterList.querySelectorAll('.filter-tag'))
      .map(tag => tag.getAttribute('data-value'));
    
    if (existingTags.includes(value)) {
      showStatus('此URL过滤器已存在', 'error');
      return;
    }
    
    // 创建过滤标签
    createFilterTag(urlFilterList, value, 'url');
    urlFilterInput.value = '';
  }
  
  // 添加Cookie键过滤器
  function addCookieKeyFilter() {
    const value = cookieKeyFilterInput.value.trim();
    if (!value) return;
    
    // 检查是否已存在
    const existingTags = Array.from(cookieKeyFilterList.querySelectorAll('.filter-tag'))
      .map(tag => tag.getAttribute('data-value'));
    
    if (existingTags.includes(value)) {
      showStatus('此Cookie键过滤器已存在', 'error');
      return;
    }
    
    // 创建过滤标签
    createFilterTag(cookieKeyFilterList, value, 'cookie');
    cookieKeyFilterInput.value = '';
  }
  
  // 创建过滤标签
  function createFilterTag(container, value, type) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    tag.setAttribute('data-value', value);
    tag.innerHTML = `${value} <span class="remove">&times;</span>`;
    
    // 添加删除事件
    tag.querySelector('.remove').addEventListener('click', function() {
      container.removeChild(tag);
    });
    
    container.appendChild(tag);
  }
  
  // 渲染过滤标签
  function renderFilterTags(container, values, type) {
    container.innerHTML = '';
    values.forEach(value => {
      createFilterTag(container, value, type);
    });
  }
  
  // 事件监听
  saveBtn.addEventListener('click', saveConfig);
  testBtn.addEventListener('click', testConnection);
  resetBtn.addEventListener('click', resetConfig);
  
  // 过滤器事件
  addUrlFilterBtn.addEventListener('click', addUrlFilter);
  urlFilterInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addUrlFilter();
  });
  
  addCookieKeyFilterBtn.addEventListener('click', addCookieKeyFilter);
  cookieKeyFilterInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') addCookieKeyFilter();
  });
}); 
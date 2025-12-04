const { contextBridge, ipcRenderer } = require('electron')

// 暴露安全的API给渲染进程
try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Token管理
    getTokens: () => ipcRenderer.invoke('get-tokens'),
    saveToken: (token) => ipcRenderer.invoke('save-token', token),
    deleteToken: (id) => ipcRenderer.invoke('delete-token', id),
    setActiveToken: (id) => ipcRenderer.invoke('set-active-token', id),
    
    // 窗口控制
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    
    // 设置管理
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // Cursor 程序路径选择
    pickCursorAppPath: () => ipcRenderer.invoke('pick-cursor-app-path'),
    
    // 扫描 Cursor 路径
    scanCursorPaths: () => ipcRenderer.invoke('scan-cursor-paths'),
    
    // 同步 Cursor 账号
    syncCursorAccount: () => ipcRenderer.invoke('sync-cursor-account'),
    
    // Token 解析
    parseToken: (token) => ipcRenderer.invoke('parse-token', token),
    
    // Token 格式转换（长期 Token -> Cookie 格式）
    convertTokenToCookie: (token) => ipcRenderer.invoke('convert-token-to-cookie', token),

    // 独立功能
    resetMachineId: () => ipcRenderer.invoke('reset-machine-id'),
    clearHistory: () => ipcRenderer.invoke('clear-history'),

    // 事件监听
    onSwitchAccountProgress: (callback) => {
      const subscription = (_, data) => callback(data)
      ipcRenderer.on('switch-account-progress', subscription)
      return () => {
        ipcRenderer.removeListener('switch-account-progress', subscription)
      }
    },

    // Cursor 账号切换 & 相关 API（供前端调用）
    switchCursorAccount: (id, options) => ipcRenderer.invoke('switch-cursor-account', id, options),
    getAccountInfo: (token) => ipcRenderer.invoke('get-account-info', token),
    checkTokenUsage: (id) => ipcRenderer.invoke('check-token-usage', id)
  })
  
  console.log('electronAPI 已成功暴露到 window 对象')
} catch (error) {
  console.error('暴露 electronAPI 失败:', error)
}

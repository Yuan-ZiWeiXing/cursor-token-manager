import { useState, useEffect } from 'react'
import '../styles/SettingsPage.css'

interface SettingsPageProps {
  settings: {
    cursorDbPath?: string
    cursorAppPath?: string
    batchRefreshSize?: number
    switchResetMachineId?: boolean
    switchClearHistory?: boolean
  }
  tokensCount?: number
  onSave: (settings: { cursorAppPath?: string; batchRefreshSize?: number; switchResetMachineId?: boolean; switchClearHistory?: boolean }) => void
}

const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  tokensCount = 0,
  onSave
}) => {
  const [cursorAppPath, setCursorAppPath] = useState(settings.cursorAppPath || '')
  const [batchRefreshSize, setBatchRefreshSize] = useState(settings.batchRefreshSize || 5)
  const [switchResetMachineId, setSwitchResetMachineId] = useState(settings.switchResetMachineId !== undefined ? settings.switchResetMachineId : true)
  const [switchClearHistory, setSwitchClearHistory] = useState(settings.switchClearHistory || false)
  
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{
    success: boolean
    message: string
    scannedCount?: number
    foundCount?: number
  } | null>(null)
  
  const [toolStatus, setToolStatus] = useState<{
    isProcessing: boolean
    message: string
    type: 'success' | 'error' | 'info' | null
  }>({
    isProcessing: false,
    message: '',
    type: null
  })

  useEffect(() => {
    setCursorAppPath(settings.cursorAppPath || '')
    setBatchRefreshSize(settings.batchRefreshSize || 5)
    setSwitchResetMachineId(settings.switchResetMachineId !== undefined ? settings.switchResetMachineId : true)
    setSwitchClearHistory(settings.switchClearHistory || false)
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      cursorAppPath: cursorAppPath.trim(),
      batchRefreshSize: batchRefreshSize,
      switchResetMachineId: switchResetMachineId,
      switchClearHistory: switchClearHistory
    })
  }

  const handleAutoDetectCursorAppPath = async () => {
    try {
      if (!window.electronAPI) return
      
      setIsScanning(true)
      setScanResult(null)
      
      const scanApi = (window.electronAPI as any).scanCursorPaths
      if (scanApi) {
        const result = await scanApi()
        
        if (result.success && result.cursorAppPath) {
          setCursorAppPath(result.cursorAppPath)
          setScanResult({
            success: true,
            message: `扫描成功！已找到 Cursor 程序`,
            scannedCount: result.scannedPaths?.length || 0,
            foundCount: result.foundPaths?.length || 0
          })
        } else if (result.success) {
          setScanResult({
            success: false,
            message: `未找到 Cursor 安装路径，请手动选择`,
            scannedCount: result.scannedPaths?.length || 0,
            foundCount: 0
          })
        } else {
          setScanResult({
            success: false,
            message: result.error || '扫描失败，请手动选择路径'
          })
        }
      }
    } catch (e) {
      console.error('自动获取 Cursor 程序路径失败:', e)
      setScanResult({
        success: false,
        message: '扫描出错，请手动选择路径'
      })
    } finally {
      setIsScanning(false)
    }
  }

  const handlePickCursorAppPath = async () => {
    try {
      if (!window.electronAPI?.pickCursorAppPath) return
      
      setScanResult(null)
      const res = await window.electronAPI.pickCursorAppPath()
      
      if (res?.success && res.path) {
        setCursorAppPath(res.path)
        setScanResult({
          success: true,
          message: '已选择 Cursor 程序路径'
        })
      }
    } catch (e) {
      console.error('手动选择 Cursor 程序路径失败:', e)
    }
  }

  const handleResetMachineId = async () => {
    if (!window.electronAPI) return
    
    setToolStatus({
      isProcessing: true,
      message: '正在重置机器码（包括 main.js 补丁）...',
      type: 'info'
    })
    
    try {
      const result = await window.electronAPI.resetMachineId()
      
      if (result.success) {
        setToolStatus({
          isProcessing: false,
          message: '✓ 机器码已重置！storage.json 已更新，main.js 已打补丁（如找到），请重启 Cursor 生效。',
          type: 'success'
        })
      } else {
        setToolStatus({
          isProcessing: false,
          message: `✗ 重置失败：${result.error || '未知错误'}`,
          type: 'error'
        })
      }
      
      setTimeout(() => {
        setToolStatus({ isProcessing: false, message: '', type: null })
      }, 5000)
    } catch (error: any) {
      setToolStatus({
        isProcessing: false,
        message: `✗ 操作失败：${error.message || '未知错误'}`,
        type: 'error'
      })
      
      setTimeout(() => {
        setToolStatus({ isProcessing: false, message: '', type: null })
      }, 5000)
    }
  }

  const handleClearHistory = async () => {
    if (!window.electronAPI) return
    
    const confirmed = window.confirm(
      '⚠️ 警告：此操作将清除所有历史记录和工作区存储，并删除 Cursor 数据库。\n\n' +
      '这将会：\n' +
      '1. 清除所有聊天历史\n' +
      '2. 清除工作区存储\n' +
      '3. 删除 state.vscdb 数据库\n' +
      '4. 自动关闭 Cursor 进程\n\n' +
      '是否继续？'
    )
    
    if (!confirmed) return
    
    setToolStatus({
      isProcessing: true,
      message: '正在清理历史会话...',
      type: 'info'
    })
    
    try {
      const result = await window.electronAPI.clearHistory()
      
      if (result.success) {
        setToolStatus({
          isProcessing: false,
          message: '✓ 历史会话已清除！Cursor 已关闭，请重新启动。',
          type: 'success'
        })
      } else {
        setToolStatus({
          isProcessing: false,
          message: `✗ 清理失败：${result.error || '未知错误'}`,
          type: 'error'
        })
      }
      
      setTimeout(() => {
        setToolStatus({ isProcessing: false, message: '', type: null })
      }, 5000)
    } catch (error: any) {
      setToolStatus({
        isProcessing: false,
        message: `✗ 操作失败：${error.message || '未知错误'}`,
        type: 'error'
      })
      
      setTimeout(() => {
        setToolStatus({ isProcessing: false, message: '', type: null })
      }, 5000)
    }
  }

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">设置</h1>
          <p className="page-subtitle">配置 Cursor 路径和工具选项</p>
        </div>
      </div>

      <div className="page-content">
        <form className="settings-form" onSubmit={handleSubmit}>
          {/* Cursor 路径设置 */}
          <div className="settings-section">
            <h3 className="section-title">Cursor 路径设置</h3>
            <p className="section-warning">
              ⚠️ 修改 Cursor 数据库需要以<strong>管理员身份</strong>运行本程序（特别是 Windows），否则可能无法写入登录信息。
            </p>

            <div className="form-group">
              <label className="form-label">Cursor 程序路径</label>
              <div className="input-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="例如：C:\Users\xxx\AppData\Local\Programs\cursor\Cursor.exe"
                  value={cursorAppPath}
                  onChange={(e) => {
                    setCursorAppPath(e.target.value)
                    setScanResult(null)
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleAutoDetectCursorAppPath}
                  disabled={isScanning}
                >
                  {isScanning ? '扫描中...' : '自动扫描'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handlePickCursorAppPath}
                  disabled={isScanning}
                >
                  手动添加
                </button>
              </div>
              
              {scanResult && (
                <div className={`scan-result ${scanResult.success ? 'success' : 'error'}`}>
                  <span>{scanResult.message}</span>
                  {scanResult.scannedCount !== undefined && (
                    <span className="scan-stats">
                      （扫描了 {scanResult.scannedCount} 个路径，找到 {scanResult.foundCount || 0} 个）
                    </span>
                  )}
                </div>
              )}
              
              <p className="form-hint">
                用于切换账号后自动重启 Cursor；点击「自动扫描」会搜索常见安装位置，或点击「手动添加」选择文件。
              </p>
              
              {cursorAppPath && (
                <p className={`path-validation ${cursorAppPath.toLowerCase().includes('cursor') ? 'valid' : 'invalid'}`}>
                  {cursorAppPath.toLowerCase().includes('cursor') 
                    ? '✓ 路径看起来正确' 
                    : '⚠ 路径中未包含 "cursor"，请确认是否正确'}
                </p>
              )}
            </div>
          </div>

          {/* 批量刷新设置 */}
          <div className="settings-section">
            <h3 className="section-title">批量刷新设置</h3>
            
            <div className="form-group">
              <label className="form-label">并发刷新数量</label>
              <input
                type="number"
                className="form-input"
                style={{ maxWidth: '200px' }}
                min="1"
                max="50"
                value={batchRefreshSize}
                onChange={(e) => setBatchRefreshSize(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
              />
              <p className="form-hint">
                批量刷新时同时处理的账号数量（1-50）。设置过高可能导致请求被限流，建议 5-10。
                {tokensCount > 0 && (
                  <span className="estimate-time">
                    当前共 {tokensCount} 个账号，预计刷新时间：{Math.ceil(tokensCount / batchRefreshSize * 0.5)} 秒
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* 切换账号设置 */}
          <div className="settings-section">
            <h3 className="section-title">切换账号设置</h3>
            <p className="section-desc">配置切换账号时的自动操作</p>
            
            <div className="form-group">
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={switchResetMachineId}
                    onChange={(e) => setSwitchResetMachineId(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">
                    <span className="checkbox-title">切换时重置机器码</span>
                    <span className="checkbox-desc">自动重置设备标识和 main.js 补丁（推荐）</span>
                  </span>
                </label>
              </div>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={switchClearHistory}
                    onChange={(e) => setSwitchClearHistory(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-text">
                    <span className="checkbox-title">切换时清理历史会话</span>
                    <span className="checkbox-desc">清除所有聊天历史和工作区存储（谨慎使用）</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* 高级工具 */}
          <div className="settings-section">
            <h3 className="section-title">高级工具</h3>
            <p className="section-desc">以下操作会直接修改 Cursor 配置，请谨慎使用。</p>
            
            <div className="tools-grid">
              <button
                type="button"
                className="tool-btn"
                onClick={handleResetMachineId}
                disabled={toolStatus.isProcessing}
              >
                🔄 重置机器码
              </button>
              
              <button
                type="button"
                className="tool-btn danger"
                onClick={handleClearHistory}
                disabled={toolStatus.isProcessing}
              >
                🗑️ 清理历史会话
              </button>
            </div>
            
            {toolStatus.message && (
              <div className={`tool-status ${toolStatus.type}`}>
                {toolStatus.message}
              </div>
            )}
            
            <div className="tools-info">
              <p><strong>🔄 重置机器码：</strong>从根源重置你的"数字身份"</p>
              <p className="tool-detail">• 修改 storage.json 中的设备标识（machineId、devDeviceId、sqmId）</p>
              <p className="tool-detail">• 对 main.js 打补丁，防止启动时从真实硬件读取信息</p>
              <p className="tool-detail">• 自动备份原始 main.js 文件（.backup）</p>
              
              <p style={{ marginTop: '16px' }}><strong>🗑️ 清理历史会话：</strong>安全高效的无痕清理</p>
              <p className="tool-detail">• 清空 History 和 workspaceStorage 目录</p>
              <p className="tool-detail">• 删除 state.vscdb 数据库及其备份</p>
              <p className="tool-detail">• 自动关闭 Cursor 进程，清理后需重启</p>
              <p className="tool-detail">• 不会删除个人设置和扩展</p>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary-large">
              💾 保存设置
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SettingsPage


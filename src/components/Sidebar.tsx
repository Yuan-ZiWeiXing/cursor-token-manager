import '../styles/Sidebar.css'
import packageJson from '../../package.json'
import { useState, useEffect } from 'react'

interface SidebarProps {
  currentPage: 'home' | 'accounts' | 'settings' | 'faq' | 'system'
  onPageChange: (page: 'home' | 'accounts' | 'settings' | 'faq' | 'system') => void
  tokensCount?: number
  updateInfo?: {
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
    manualDownload?: boolean
  }
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, tokensCount = 0, updateInfo }) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloaded, setIsDownloaded] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (!window.electronAPI) return

    // 监听下载进度
    const unsubProgress = window.electronAPI.onUpdateDownloadProgress?.((progress) => {
      setIsDownloading(true)
      setDownloadProgress(progress.percent)
      setError('')
    })

    // 监听下载完成
    const unsubDownloaded = window.electronAPI.onUpdateDownloaded?.(() => {
      setIsDownloading(false)
      setIsDownloaded(true)
      setError('')
    })

    // 监听错误
    const unsubError = window.electronAPI.onUpdateError?.((errorMsg) => {
      console.error('更新错误:', errorMsg)
      setIsDownloading(false)
      setIsDownloaded(false)
      setError('更新失败')
      
      // 3秒后清除错误，恢复显示"发现新版本"
      setTimeout(() => {
        setError('')
      }, 3000)
    })

    return () => {
      unsubProgress?.()
      unsubDownloaded?.()
      unsubError?.()
    }
  }, [])

  const handleUpdateClick = async () => {
    console.log('点击更新，当前状态:', { isDownloading, isDownloaded, manualDownload: updateInfo?.manualDownload })
    
    // 如果已下载，直接安装
    if (isDownloaded) {
      console.log('执行安装...')
      try {
        await window.electronAPI.installUpdate()
      } catch (err) {
        console.error('安装失败:', err)
        setError('安装失败')
        setTimeout(() => setError(''), 3000)
      }
      return
    }

    // 如果正在下载，忽略点击
    if (isDownloading) {
      console.log('正在下载中，忽略点击')
      return
    }

    // 如果是手动下载模式或开发环境，打开浏览器
    if (updateInfo?.manualDownload && updateInfo?.releaseUrl) {
      console.log('手动下载模式，打开浏览器:', updateInfo.releaseUrl)
      window.open(updateInfo.releaseUrl, '_blank')
      return
    }

    // 自动下载模式
    console.log('开始自动下载...')
    setIsDownloading(true)
    setError('')
    
    try {
      const result = await window.electronAPI.downloadUpdate()
      console.log('下载结果:', result)
      
      if (!result.success) {
        console.error('下载失败:', result.error)
        setIsDownloading(false)
        setError('下载失败')
        
        // 3秒后清除错误并回退到手动下载
        setTimeout(() => {
          setError('')
          // 如果失败，打开手动下载
          if (updateInfo?.releaseUrl) {
            window.open(updateInfo.releaseUrl, '_blank')
          }
        }, 3000)
      }
    } catch (err: any) {
      console.error('下载异常:', err)
      setIsDownloading(false)
      setError('下载异常')
      
      // 3秒后打开手动下载
      setTimeout(() => {
        setError('')
        if (updateInfo?.releaseUrl) {
          window.open(updateInfo.releaseUrl, '_blank')
        }
      }, 3000)
    }
  }
  const version = `v${packageJson.version}`
  return (
    <div className="sidebar-container">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">C</div>
          <div className="logo-text">
            <span className="logo-title">Yuan</span>
            <span className="logo-subtitle">账号管理器</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <button
            className={`nav-item ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => onPageChange('home')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">主页</span>
          </button>

          <button
            className={`nav-item ${currentPage === 'accounts' ? 'active' : ''}`}
            onClick={() => onPageChange('accounts')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">账号管理</span>
            {tokensCount > 0 && (
              <span className="nav-badge">{tokensCount}</span>
            )}
          </button>

          <button
            className={`nav-item ${currentPage === 'faq' ? 'active' : ''}`}
            onClick={() => onPageChange('faq')}
          >
            <span className="nav-icon">❓</span>
            <span className="nav-label">常见问题</span>
          </button>

          <button
            className={`nav-item ${currentPage === 'settings' ? 'active' : ''}`}
            onClick={() => onPageChange('settings')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">设置</span>
          </button>

          <button
            className={`nav-item ${currentPage === 'system' ? 'active' : ''}`}
            onClick={() => onPageChange('system')}
          >
            <span className="nav-icon">🔧</span>
            <span className="nav-label">系统管理</span>
          </button>
        </div>

        <div className="nav-footer">
          {updateInfo?.hasUpdate ? (
            <div 
              className="sidebar-update-notice" 
              onClick={handleUpdateClick}
              style={{ 
                cursor: isDownloading && !error ? 'wait' : 'pointer',
                opacity: isDownloading && !error ? 0.8 : 1
              }}
              title={
                error ? error :
                isDownloaded ? '点击安装更新并重启' :
                isDownloading ? `下载中... ${downloadProgress.toFixed(0)}%` :
                updateInfo?.manualDownload ? '点击前往下载页面' :
                '点击立即下载更新'
              }
            >
              {error ? (
                <>
                  <div className="update-icon">❌</div>
                  <div className="update-content">
                    <div className="update-title" style={{ fontSize: '12px' }}>{error}</div>
                    <div className="update-version" style={{ fontSize: '11px' }}>点击重试</div>
                  </div>
                </>
              ) : isDownloading ? (
                <>
                  <div className="update-icon">⏬</div>
                  <div className="update-content">
                    <div className="update-title">下载中...</div>
                    <div className="update-version">{downloadProgress.toFixed(0)}%</div>
                  </div>
                </>
              ) : isDownloaded ? (
                <>
                  <div className="update-icon">✅</div>
                  <div className="update-content">
                    <div className="update-title">点击安装</div>
                    <div className="update-version">{updateInfo.latestVersion}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="update-icon">🎉</div>
                  <div className="update-content">
                    <div className="update-title">发现新版本</div>
                    <div className="update-version">{updateInfo.latestVersion}</div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="sidebar-version">{version}</div>
          )}
        </div>
      </nav>
    </div>
  )
}

export default Sidebar

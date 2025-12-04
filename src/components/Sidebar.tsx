import '../styles/Sidebar.css'

interface SidebarProps {
  currentPage: 'home' | 'accounts' | 'settings' | 'faq' | 'system'
  onPageChange: (page: 'home' | 'accounts' | 'settings' | 'faq' | 'system') => void
  tokensCount?: number
  updateInfo?: {
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
  }
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onPageChange, tokensCount = 0, updateInfo }) => {
  const handleUpdateClick = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank')
    }
  }
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
      </nav>

      <div className="sidebar-footer">
        {updateInfo?.hasUpdate ? (
          <div className="sidebar-update-notice" onClick={handleUpdateClick}>
            <div className="update-icon">🎉</div>
            <div className="update-content">
              <div className="update-title">发现新版本</div>
              <div className="update-version">{updateInfo.latestVersion}</div>
            </div>
          </div>
        ) : (
          <div className="sidebar-version">v1.0.0</div>
        )}
      </div>
    </div>
  )
}

export default Sidebar


import '../styles/SystemManagePage.css'
import packageJson from '../../package.json'

interface SystemManagePageProps {
  updateInfo?: {
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
    releaseNotes?: string
  }
}

const SystemManagePage: React.FC<SystemManagePageProps> = ({ updateInfo }) => {
  const handleDownloadUpdate = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank')
    }
  }
  const version = `v${packageJson.version}`
  const releaseDate = packageJson.releaseDate ?? ''
  
  const updateLogs = [
    {
      version,
      date: releaseDate,
      type: 'major',
      updates: [
        '🎉 首个正式版本发布',
        '✨ 支持添加和管理 Cursor 账号令牌',
        '🔄 支持同步本地 Cursor 账号',
        '📊 实时查看账号用量统计',
        '🔀 一键切换账号功能',
        '⚡ 批量刷新用量信息',
        '🗑️ 清理 Free 账号功能',
        '🔧 重置机器码和清理历史会话',
        '🎨 现代化的 macOS 风格界面设计',
        '📋 支持长效 Token 和 Cookies 两种格式',
        '❓ 内置常见问题解答',
        '🏠 主页数据统计展示'
      ]
    }
  ]

  return (
    <div className="system-manage-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">系统管理</h1>
          <p className="page-subtitle">系统信息与版本更新记录</p>
        </div>
      </div>

      <div className="page-content">
        {/* 更新提示横幅 */}
        {updateInfo?.hasUpdate && (
          <div className="update-banner">
            <div className="update-banner-icon">🎉</div>
            <div className="update-banner-content">
              <div className="update-banner-title">
                发现新版本 {updateInfo.latestVersion}
              </div>
              <div className="update-banner-desc">
                当前版本 {version} · 点击下载最新版本获取更多功能和修复
              </div>
            </div>
            <button className="update-banner-button" onClick={handleDownloadUpdate}>
              立即下载
            </button>
          </div>
        )}

        {/* 系统信息卡片 */}
        <div className="system-info-card">
          <div className="info-header">
            <div className="app-logo">
              <div className="logo-circle">C</div>
              <div className="app-name">
                <h2>Yuan-cursor账号管理器</h2>
                <p>Yuan Cursor Account Manager</p>
              </div>
            </div>
            <div className="version-badge">{version}</div>
          </div>
          
          <div className="info-details">
            <div className="info-item">
              <span className="info-icon">📦</span>
              <div className="info-content">
                <span className="info-label">当前版本</span>
                <span className="info-value">{version}</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">📅</span>
              <div className="info-content">
                <span className="info-label">发布日期</span>
                <span className="info-value">{releaseDate}</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">👨‍💻</span>
              <div className="info-content">
                <span className="info-label">开发者</span>
                <span className="info-value">Q：1400700713</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">⚙️</span>
              <div className="info-content">
                <span className="info-label">技术栈</span>
                <span className="info-value">Electron + React + TypeScript</span>
              </div>
            </div>
          </div>
        </div>

        {/* 更新日志 */}
        <div className="update-logs-section">
          <h3 className="section-title">📝 更新日志</h3>
          
          {updateLogs.map((log, index) => (
            <div key={index} className={`update-log-card update-${log.type}`}>
              <div className="log-header">
                <div className="log-version">
                  <span className="version-number">{log.version}</span>
                  <span className={`version-type type-${log.type}`}>
                    {log.type === 'major' && '重大更新'}
                    {log.type === 'minor' && '功能更新'}
                    {log.type === 'patch' && '修复更新'}
                  </span>
                </div>
                <span className="log-date">{log.date}</span>
              </div>
              
              <div className="log-content">
                <ul className="update-list">
                  {log.updates.map((update, idx) => (
                    <li key={idx}>{update}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* 功能特性 */}
        <div className="features-section">
          <h3 className="section-title">✨ 核心功能</h3>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎫</div>
              <h4 className="feature-title">账号管理</h4>
              <p className="feature-desc">支持添加、编辑、删除和查看 Cursor 账号信息</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h4 className="feature-title">同步功能</h4>
              <p className="feature-desc">一键同步本地 Cursor 账号到管理器</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔀</div>
              <h4 className="feature-title">切换账号</h4>
              <p className="feature-desc">快速切换不同账号，自动配置环境</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h4 className="feature-title">用量统计</h4>
              <p className="feature-desc">实时查看账号使用情况和配额信息</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h4 className="feature-title">批量操作</h4>
              <p className="feature-desc">支持批量刷新用量和清理账号</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h4 className="feature-title">高级工具</h4>
              <p className="feature-desc">重置机器码、清理历史会话等工具</p>
            </div>
          </div>
        </div>

        {/* 感谢卡片 */}
        <div className="thanks-card">
          <div className="thanks-icon">💝</div>
          <h3 className="thanks-title">感谢使用</h3>
          <p className="thanks-text">
            感谢您使用 Yuan-cursor账号管理器！如有任何问题或建议，欢迎联系开发者。
          </p>
          <div className="thanks-contact">
            <span>📧 联系方式：Q：1400700713</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemManagePage


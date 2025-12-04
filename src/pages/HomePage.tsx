import { Token } from '../App'
import '../styles/HomePage.css'

interface HomePageProps {
  tokens: Token[]
  onNavigate: (page: 'accounts' | 'settings') => void
  onAddAccount: () => void
  onRefreshAll: () => void
  onSyncLocal: () => void
}

const HomePage: React.FC<HomePageProps> = ({ 
  tokens, 
  onNavigate, 
  onAddAccount,
  onRefreshAll,
  onSyncLocal 
}) => {
  const activeToken = tokens.find(t => t.isActive)
  const totalTokens = tokens.length
  const tokensWithUsage = tokens.filter(t => t.usage).length
  const failedTokens = tokens.filter(t => t.lastRefreshError).length
  
  // 计算 Free 账号数量（只统计订阅类型严格等于 free 的账号）
  const freeTokens = tokens.filter(t => {
    const plan = t.accountInfo?.plan?.toLowerCase() || ''
    const subscription = t.accountInfo?.subscriptionStatus?.toLowerCase() || ''
    return plan === 'free' || subscription === 'free'
  }).length
  
  // 计算总用量
  const totalUsed = tokens.reduce((sum, t) => sum + (t.usage?.used || 0), 0)
  const avgUsage = tokensWithUsage > 0 ? Math.round(totalUsed / tokensWithUsage) : 0

  // 复制QQ号
  const handleCopyQQ = () => {
    const qqNumber = '1400700713'
    navigator.clipboard.writeText(qqNumber).then(() => {
      // 创建临时提示
      const button = document.querySelector('.author-contact') as HTMLElement
      if (button) {
        const originalText = button.textContent
        button.textContent = '已复制！'
        button.style.color = '#10b981'
        setTimeout(() => {
          button.textContent = originalText
          button.style.color = '#3b82f6'
        }, 1500)
      }
    }).catch(err => {
      console.error('复制失败:', err)
    })
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <div>
          <h1 className="home-title">欢迎使用 Yuan-cursor账号管理器</h1>
          <p className="home-subtitle">高效管理你的 Cursor 账号和令牌</p>
        </div>
      </div>

      <div className="home-content">
        {/* 统计卡片 */}
        <div className="stats-grid">
        <div className="stat-card stat-primary">
          <div className="stat-icon">🎫</div>
          <div className="stat-content">
            <div className="stat-label">账号总数</div>
            <div className="stat-value">{totalTokens}</div>
          </div>
        </div>

        <div className="stat-card stat-info">
          <div className="stat-icon">🆓</div>
          <div className="stat-content">
            <div className="stat-label">Free 账号</div>
            <div className="stat-value">{freeTokens}</div>
          </div>
        </div>

        <div className="stat-card stat-warning">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">平均用量</div>
            <div className="stat-value">{avgUsage}</div>
          </div>
        </div>

        {failedTokens > 0 && (
          <div className="stat-card stat-danger">
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <div className="stat-label">刷新失败</div>
              <div className="stat-value">{failedTokens}</div>
            </div>
          </div>
        )}
      </div>

      {/* 当前活跃账号 */}
      {activeToken && (
        <div className="active-account-card">
          <div className="card-header">
            <h3 className="card-title">🔹 当前活跃账号</h3>
            <span className="active-badge">活跃中</span>
          </div>
          <div className="account-info">
            <div className="info-row">
              <span className="info-label">邮箱：</span>
              <span className="info-value">{activeToken.accountInfo?.email || activeToken.name || '未命名'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">订阅：</span>
              <span className="info-value">{activeToken.accountInfo?.plan || '未知'}</span>
            </div>
            {activeToken.usage && (
              <div className="info-row">
                <span className="info-label">用量：</span>
                <span className="info-value">
                  {activeToken.usage.used || 0} / {activeToken.usage.limit || '∞'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 快捷操作 */}
      <div className="quick-actions-section">
        <h3 className="section-title">快捷操作</h3>
        <div className="actions-grid">
          <button className="action-card" onClick={onAddAccount}>
            <div className="action-icon">➕</div>
            <div className="action-content">
              <div className="action-title">添加账号</div>
              <div className="action-desc">导入新的令牌</div>
            </div>
          </button>

          <button className="action-card" onClick={onSyncLocal}>
            <div className="action-icon">🔄</div>
            <div className="action-content">
              <div className="action-title">同步本地</div>
              <div className="action-desc">读取 Cursor 账号</div>
            </div>
          </button>

          <button className="action-card" onClick={onRefreshAll}>
            <div className="action-icon">⌛</div>
            <div className="action-content">
              <div className="action-title">刷新用量</div>
              <div className="action-desc">批量更新所有账号</div>
            </div>
          </button>

          <button className="action-card" onClick={() => onNavigate('accounts')}>
            <div className="action-icon">👥</div>
            <div className="action-content">
              <div className="action-title">管理账号</div>
              <div className="action-desc">查看所有账号</div>
            </div>
          </button>
        </div>
      </div>

      {/* 作者信息 */}
      <div className="home-footer">
        <div className="author-info" onClick={handleCopyQQ} title="点击复制QQ号">
          <span className="author-label">作者：</span>
          <span className="author-contact">Q：1400700713</span>
          <span className="copy-icon">📋</span>
        </div>
      </div>
      </div>
    </div>
  )
}

export default HomePage



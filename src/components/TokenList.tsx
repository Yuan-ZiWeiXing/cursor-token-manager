import React from 'react'
import { Token } from '../App'
import '../styles/TokenList.css'

interface TokenListProps {
  tokens: Token[]
  onEdit: (token: Token) => void
  onDelete: (id: string) => void
  onSetActive: (id: string) => void
  onCheckUsage: (id: string) => void
  onShowDialog: (options: {
    title?: string
    message: string
    type?: 'info' | 'confirm' | 'warning' | 'error'
    onConfirm?: () => void
    onCancel?: () => void
    confirmText?: string
    cancelText?: string
  }) => void
}

const TokenList: React.FC<TokenListProps> = ({
  tokens,
  onEdit,
  onDelete,
  onSetActive,
  onCheckUsage,
  onShowDialog
}) => {
  if (tokens.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔑</div>
        <h2>还没有Token</h2>
        <p>点击"添加新Token"按钮开始管理你的Cursor账号</p>
      </div>
    )
  }

  // 获取额度显示文本
  const getQuotaText = (token: Token) => {
    if (token.usage) {
      return `${token.usage.used || 0} / ${token.usage.limit || '∞'}`
    }
    if (token.accountInfo?.quota) {
      const quota = token.accountInfo.quota
      const used = quota.used !== undefined 
        ? quota.used 
        : (quota.total !== undefined && quota.remaining !== undefined)
          ? quota.total - quota.remaining
          : 0
      const limit = quota.limit !== undefined 
        ? quota.limit 
        : quota.total !== undefined 
          ? quota.total 
          : '∞'
      return `${used} / ${limit}`
    }
    if (token.accountInfo?.usage) {
      const usage = token.accountInfo.usage
      return `${usage.used || 0} / ${usage.limit || '∞'}`
    }
    return '未检测'
  }

  // 获取用量百分比
  const getUsagePercentage = (token: Token) => {
    if (token.usage?.percentage !== undefined) {
      return token.usage.percentage
    }
    if (token.usage && token.usage.limit && token.usage.limit > 0) {
      return (token.usage.used || 0) / token.usage.limit * 100
    }
    if (token.accountInfo?.quota?.limit && token.accountInfo.quota.limit > 0) {
      const used = token.accountInfo.quota.used !== undefined 
        ? token.accountInfo.quota.used 
        : (token.accountInfo.quota.total !== undefined && token.accountInfo.quota.remaining !== undefined)
          ? token.accountInfo.quota.total - token.accountInfo.quota.remaining
          : 0
      return (used / token.accountInfo.quota.limit) * 100
    }
    return null
  }

  const [openDropdownId, setOpenDropdownId] = React.useState<string | null>(null)

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.action-dropdown-container')) {
        setOpenDropdownId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenDropdownId(openDropdownId === id ? null : id)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    console.log(`已复制 ${label}`)
  }

  return (
    <div className="token-table-container">
      <table className="token-table">
        <thead>
          <tr>
            <th className="col-name">账号名称</th>
            <th className="col-plan">订阅类型</th>
            <th className="col-quota">额度</th>
            <th className="col-usage">用量进度</th>
            <th className="col-expiry">到期时间</th>
            <th className="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => {
            const usagePercentage = getUsagePercentage(token)
            const isDropdownOpen = openDropdownId === token.id
            
            return (
              <tr
                key={token.id}
                className={`token-table-row ${token.isActive ? 'active' : ''} ${token.lastRefreshError ? 'refresh-failed' : ''}`}
              >
                <td className="col-name">
                  <div className="token-name-cell">
                    <span className="token-name-text">
                      {token.accountInfo?.email || '未命名账号'}
                    </span>
                    {token.isActive && (
                      <span className="token-badge active-badge">当前使用</span>
                    )}
                    {token.lastRefreshError && (
                      <span className="token-badge error-badge" title={`刷新失败: ${token.lastRefreshError}`}>
                        刷新失败
                      </span>
                    )}
                  </div>
                </td>
                <td className="col-plan">
                  {token.accountInfo?.plan ? (
                    <span className={`plan-badge ${token.accountInfo.isTrial ? 'plan-badge-trial' : ''}`}>
                      {token.accountInfo.plan}
                    </span>
                  ) : (
                    <span className="info-placeholder">未获取</span>
                  )}
                </td>
                <td className="col-quota">
                  <span className={getQuotaText(token) === '未检测' ? 'info-placeholder' : ''}>
                    {getQuotaText(token)}
                  </span>
                </td>
                <td className="col-usage">
                  {usagePercentage !== null ? (
                    <div className="usage-cell">
                      <div className="usage-bar">
                        <div 
                          className="usage-bar-fill" 
                          style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                        />
                      </div>
                      <span className="usage-percentage-text">
                        {usagePercentage.toFixed(1)}%
                      </span>
                    </div>
                  ) : (
                    <span className="info-placeholder">-</span>
                  )}
                </td>
                <td className="col-expiry">
                  {token.accountInfo?.isTrial && token.accountInfo?.trialExpiryDate ? (
                    <div className="expiry-cell">
                      <span className="expiry-date-text">
                        {new Date(token.accountInfo.trialExpiryDate).toLocaleDateString('zh-CN', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                      <span className="days-remaining">
                        （剩余 {token.accountInfo.daysRemainingOnTrial} 天）
                      </span>
                    </div>
                  ) : (
                    <span className="info-placeholder">-</span>
                  )}
                </td>
                <td className="col-actions">
                  <div className="token-item-actions">
                    {/* 切换按钮 - 仅在非活动状态显示，且最优先 */}
                    {!token.isActive && (
                      <button
                        className="btn-icon-text btn-primary-text"
                        onClick={() => onSetActive(token.id)}
                        title="切换到此账号"
                      >
                        <span className="text">切换</span>
                      </button>
                    )}
                    
                    {/* 刷新按钮 */}
                    <button
                      className="btn-icon"
                      onClick={() => onCheckUsage(token.id)}
                      title="刷新用量"
                    >
                      🔄
                    </button>

                    {/* 更多菜单 */}
                    <div className="action-dropdown-container">
                      <button 
                        className={`btn-icon ${isDropdownOpen ? 'active' : ''}`}
                        onClick={(e) => toggleDropdown(token.id, e)}
                        title="更多操作"
                      >
                        ⋯
                      </button>
                      
                      {isDropdownOpen && (
                        <div className="action-dropdown-menu">
                          <button 
                            className="dropdown-item"
                            onClick={() => {
                              onEdit(token)
                              setOpenDropdownId(null)
                            }}
                          >
                            📄 查看详情
                          </button>
                          
                          <div className="dropdown-divider" />
                          
                          {token.accountInfo?.longTermToken && (
                            <button 
                              className="dropdown-item"
                              onClick={() => {
                                handleCopy(token.accountInfo!.longTermToken!, '长效 Token')
                                setOpenDropdownId(null)
                              }}
                            >
                              📋 复制长效 Token
                            </button>
                          )}
                          
                          {token.accountInfo?.cookieFormat && (
                            <button 
                              className="dropdown-item"
                              onClick={() => {
                                handleCopy(token.accountInfo!.cookieFormat!, 'Cookie')
                                setOpenDropdownId(null)
                              }}
                            >
                              🍪 复制 Cookie
                            </button>
                          )}
                          
                          <div className="dropdown-divider" />
                          
                          <button 
                            className="dropdown-item danger"
                            onClick={() => {
                              setOpenDropdownId(null)
                              const tokenName = token.accountInfo?.email || '未命名账号'
                              onShowDialog({
                                title: '确认删除',
                                message: `确定要删除 "${tokenName}" 吗？\n\n此操作无法撤销。`,
                                type: 'warning',
                                confirmText: '删除',
                                cancelText: '取消',
                                onConfirm: () => onDelete(token.id)
                              })
                            }}
                          >
                            🗑️ 删除账号
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default TokenList


import { useState, useMemo } from 'react'
import { Token, DialogOptions } from '../App'
import TokenList from '../components/TokenList'
import '../styles/AccountManagePage.css'

interface AccountManagePageProps {
  tokens: Token[]
  onAddAccount: () => void
  onEditToken: (token: Token) => void
  onDeleteToken: (id: string) => void
  onSetActive: (id: string) => void
  onRefreshUsage: (id: string) => void
  onSyncLocal: () => void
  onRefreshAll: () => void
  onClearFreeAccounts: () => void
  onShowDialog: (options: DialogOptions) => void
}

const AccountManagePage: React.FC<AccountManagePageProps> = ({
  tokens,
  onAddAccount,
  onEditToken,
  onDeleteToken,
  onSetActive,
  onRefreshUsage,
  onSyncLocal,
  onRefreshAll,
  onClearFreeAccounts,
  onShowDialog
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  // 计算分页数据
  const { paginatedTokens, totalPages, freeAccountsCount } = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedTokens = tokens.slice(startIndex, endIndex)
    const totalPages = Math.ceil(tokens.length / pageSize)
    
    // 统计 free 账号数量（只统计订阅类型严格等于 free 的账号）
    const freeAccountsCount = tokens.filter(t => {
      const plan = t.accountInfo?.plan?.toLowerCase() || ''
      const subscription = t.accountInfo?.subscriptionStatus?.toLowerCase() || ''
      return plan === 'free' || subscription === 'free'
    }).length

    return { paginatedTokens, totalPages, freeAccountsCount }
  }, [tokens, currentPage])

  // 页码变化时重置到第一页（如果当前页超出范围）
  if (currentPage > totalPages && totalPages > 0) {
    setCurrentPage(1)
  }

  const handleClearFree = () => {
    if (freeAccountsCount === 0) {
      alert('没有 Free 账号需要清理')
      return
    }
    
    const confirmed = window.confirm(
      `⚠️ 确认清理 ${freeAccountsCount} 个 Free 账号？\n\n` +
      '此操作将删除所有订阅类型为 Free/Free Trial 的账号，且不可恢复！'
    )
    
    if (confirmed) {
      onClearFreeAccounts()
    }
  }

  return (
    <div className="account-manage-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">账号管理</h1>
          <p className="page-subtitle">管理你的所有 Cursor 账号和令牌 · 共 {tokens.length} 个账号</p>
        </div>
        <div className="page-actions">
          <button className="btn-secondary" onClick={onSyncLocal}>
            🔄 同步本地账号
          </button>
          <button className="btn-secondary" onClick={onRefreshAll}>
            ⌛ 刷新用量
          </button>
          {freeAccountsCount > 0 && (
            <button className="btn-danger-outline" onClick={handleClearFree}>
              🗑️ 清理 Free ({freeAccountsCount})
            </button>
          )}
          <button className="btn-primary" onClick={onAddAccount}>
            ➕ 添加账号
          </button>
        </div>
      </div>

      <div className="page-content">
        {tokens.length > 0 && (
          <div className="content-header">
            <div className="content-stats">
              显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, tokens.length)} 条，共 {tokens.length} 条
            </div>
          </div>
        )}
        
        <TokenList
          tokens={paginatedTokens}
          onEdit={onEditToken}
          onDelete={onDeleteToken}
          onSetActive={onSetActive}
          onCheckUsage={onRefreshUsage}
          onShowDialog={onShowDialog}
        />

        {/* 分页控件 */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              ← 上一页
            </button>
            
            <div className="pagination-info">
              {totalPages <= 7 ? (
                // 如果页数少于等于7，显示所有页码
                Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))
              ) : (
                // 如果页数多，显示省略号
                <>
                  {currentPage > 3 && (
                    <>
                      <button
                        className="pagination-number"
                        onClick={() => setCurrentPage(1)}
                      >
                        1
                      </button>
                      <span className="pagination-ellipsis">...</span>
                    </>
                  )}
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      return page === currentPage ||
                             page === currentPage - 1 ||
                             page === currentPage + 1 ||
                             (currentPage <= 2 && page <= 3) ||
                             (currentPage >= totalPages - 1 && page >= totalPages - 2)
                    })
                    .map(page => (
                      <button
                        key={page}
                        className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))
                  }
                  
                  {currentPage < totalPages - 2 && (
                    <>
                      <span className="pagination-ellipsis">...</span>
                      <button
                        className="pagination-number"
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
            
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              下一页 →
            </button>
            
            <div className="pagination-jump">
              <span>跳转到</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value)
                  if (page >= 1 && page <= totalPages) {
                    setCurrentPage(page)
                  }
                }}
                className="pagination-input"
              />
              <span>页</span>
            </div>
          </div>
        )}

        {tokens.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>还没有账号</h3>
            <p>点击"添加账号"开始导入你的 Cursor 令牌</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default AccountManagePage


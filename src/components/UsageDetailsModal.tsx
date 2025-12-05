import React, { useState, useEffect } from 'react'
import '../styles/UsageDetailsModal.css'

interface UsageEvent {
  timestamp: string
  model: string
  kind: string
  requestsCosts: number
  tokenUsage: {
    inputTokens: number
    outputTokens: number
    cacheWriteTokens?: number
    cacheReadTokens?: number
    totalCents?: number
  }
  customSubscriptionName?: string
  isTokenBasedCall?: boolean
  owningUser?: string
  usageBasedCosts?: string
  cursorTokenFee?: number
}

interface UsageDetailsResponse {
  totalUsageEventsCount: number
  usageEventsDisplay: UsageEvent[]
}

interface UsageDetailsModalProps {
  show: boolean
  accountName: string
  cookieFormat: string | undefined
  onClose: () => void
  onShowDialog: (options: {
    title?: string
    message: string
    type?: 'info' | 'confirm' | 'warning' | 'error'
    onConfirm?: () => void
  }) => void
}

const UsageDetailsModal: React.FC<UsageDetailsModalProps> = ({
  show,
  accountName,
  cookieFormat,
  onClose,
  onShowDialog
}) => {
  const [selectedDays, setSelectedDays] = useState<number>(7)
  const [loading, setLoading] = useState(false)
  const [usageData, setUsageData] = useState<UsageDetailsResponse | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // 每次弹窗打开时重置数据
  useEffect(() => {
    if (show) {
      setUsageData(null)
      setSelectedDays(7)
      setCurrentPage(1)
    }
  }, [show, accountName, cookieFormat])

  if (!show) return null

  const handleFetchUsage = async () => {
    if (!cookieFormat) {
      onShowDialog({
        title: '错误',
        message: '此账号缺少 Cookie 格式，无法查询使用详情',
        type: 'error',
        onConfirm: () => {}
      })
      return
    }

    setLoading(true)
    try {
      const now = Date.now()
      const startDate = now - selectedDays * 24 * 60 * 60 * 1000
      
      if (!window.electronAPI?.fetchUsageDetails) {
        throw new Error('fetchUsageDetails API 不可用')
      }

      const result = await window.electronAPI.fetchUsageDetails({
        cookieFormat,
        startDate: startDate.toString(),
        endDate: now.toString(),
        page: currentPage,
        pageSize: 100,
        teamId: 0
      })

      if (result.success && result.data) {
        // 检查返回的数据结构
        if (!result.data.usageEventsDisplay || !Array.isArray(result.data.usageEventsDisplay)) {
          console.warn('API 返回的数据缺少 usageEventsDisplay 字段:', result.data)
          // 设置为空数组，而不是报错
          setUsageData({
            totalUsageEventsCount: 0,
            usageEventsDisplay: []
          })
        } else {
          setUsageData(result.data)
        }
      } else {
        onShowDialog({
          title: '查询失败',
          message: result.error || '无法获取使用详情',
          type: 'error',
          onConfirm: () => {}
        })
        setUsageData(null)
      }
    } catch (error: any) {
      console.error('获取使用详情失败:', error)
      onShowDialog({
        title: '错误',
        message: `获取使用详情时发生错误: ${error.message}`,
        type: 'error',
        onConfirm: () => {}
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(parseInt(timestamp))
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString('zh-CN')
  }

  const getTotalTokens = (tokenUsage: UsageEvent['tokenUsage']) => {
    const input = tokenUsage.inputTokens || 0
    const output = tokenUsage.outputTokens || 0
    const cacheWrite = tokenUsage.cacheWriteTokens || 0
    const cacheRead = tokenUsage.cacheReadTokens || 0
    return input + output + cacheWrite + cacheRead
  }

  // 计算汇总统计
  const getStatistics = () => {
    if (!usageData || !usageData.usageEventsDisplay || !Array.isArray(usageData.usageEventsDisplay)) {
      return null
    }

    const totalRequests = usageData.totalUsageEventsCount || 0
    const totalCost = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.requestsCosts || 0), 0)
    const totalInputTokens = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.tokenUsage.inputTokens || 0), 0)
    const totalOutputTokens = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.tokenUsage.outputTokens || 0), 0)
    const totalCacheRead = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.tokenUsage.cacheReadTokens || 0), 0)
    const totalCacheWrite = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.tokenUsage.cacheWriteTokens || 0), 0)
    const totalAmount = usageData.usageEventsDisplay.reduce((sum, event) => sum + (event.tokenUsage.totalCents || 0), 0)
    
    // 统计模型使用次数
    const modelCounts: Record<string, number> = {}
    usageData.usageEventsDisplay.forEach(event => {
      modelCounts[event.model] = (modelCounts[event.model] || 0) + 1
    })

    return {
      totalRequests,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalCacheRead,
      totalCacheWrite,
      totalAmount,
      modelCounts
    }
  }

  const stats = getStatistics()

  return (
    <div className="usage-details-modal-backdrop" onClick={handleBackdropClick}>
      <div className="usage-details-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="usage-details-modal-header">
          <h3 className="usage-details-modal-title">
            📊 使用详情 - {accountName}
          </h3>
          <button 
            className="usage-details-modal-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        
        <div className="usage-details-modal-content">
          {/* 查询选项 */}
          <div className="usage-query-section">
            <div className="usage-date-tabs">
              <button
                className={`usage-date-tab ${selectedDays === 1 ? 'active' : ''}`}
                onClick={() => setSelectedDays(1)}
              >
                最近 1 天
              </button>
              <button
                className={`usage-date-tab ${selectedDays === 7 ? 'active' : ''}`}
                onClick={() => setSelectedDays(7)}
              >
                最近 7 天
              </button>
              <button
                className={`usage-date-tab ${selectedDays === 30 ? 'active' : ''}`}
                onClick={() => setSelectedDays(30)}
              >
                最近 30 天
              </button>
            </div>
            <button
              className="usage-query-btn"
              onClick={handleFetchUsage}
              disabled={loading}
            >
              {loading ? '查询中...' : '🔍 查询'}
            </button>
          </div>

          {/* 统计概览 */}
          {stats && (
            <div className="usage-stats-section">
              <div className="usage-stat-card highlight-card">
                <div className="usage-stat-label">💰 总金额</div>
                <div className="usage-stat-value">${(stats.totalAmount / 100).toFixed(4)}</div>
              </div>
              <div className="usage-stat-card">
                <div className="usage-stat-label">总请求数</div>
                <div className="usage-stat-value">{formatNumber(stats.totalRequests)}</div>
              </div>
              <div className="usage-stat-card">
                <div className="usage-stat-label">总消耗</div>
                <div className="usage-stat-value">{stats.totalCost.toFixed(2)} 次</div>
              </div>
              <div className="usage-stat-card">
                <div className="usage-stat-label">输入 Token</div>
                <div className="usage-stat-value">{formatNumber(stats.totalInputTokens)}</div>
              </div>
              <div className="usage-stat-card">
                <div className="usage-stat-label">输出 Token</div>
                <div className="usage-stat-value">{formatNumber(stats.totalOutputTokens)}</div>
              </div>
              {stats.totalCacheRead > 0 && (
                <div className="usage-stat-card">
                  <div className="usage-stat-label">缓存读取</div>
                  <div className="usage-stat-value">{formatNumber(stats.totalCacheRead)}</div>
                </div>
              )}
              {stats.totalCacheWrite > 0 && (
                <div className="usage-stat-card">
                  <div className="usage-stat-label">缓存写入</div>
                  <div className="usage-stat-value">{formatNumber(stats.totalCacheWrite)}</div>
                </div>
              )}
            </div>
          )}

          {/* 模型使用统计 */}
          {stats && Object.keys(stats.modelCounts).length > 0 && (
            <div className="usage-models-section">
              <h4 className="usage-section-title">📈 模型使用统计</h4>
              <div className="usage-models-grid">
                {Object.entries(stats.modelCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([model, count]) => (
                    <div key={model} className="usage-model-item">
                      <span className="usage-model-name">{model}</span>
                      <span className="usage-model-count">{count} 次</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 使用详情列表 */}
          {usageData && usageData.usageEventsDisplay.length > 0 ? (
            <div className="usage-events-section">
              <h4 className="usage-section-title">📝 使用记录 (共 {usageData.totalUsageEventsCount || 0} 条)</h4>
              <div className="usage-events-list">
                {usageData.usageEventsDisplay.map((event, index) => (
                  <div key={index} className="usage-event-item">
                    <div className="usage-event-header">
                      <span className="usage-event-model">{event.model}</span>
                      <div className="usage-event-header-right">
                        {event.tokenUsage.totalCents !== undefined && event.tokenUsage.totalCents > 0 && (
                          <span className="usage-event-amount">${(event.tokenUsage.totalCents / 100).toFixed(4)}</span>
                        )}
                        <span className="usage-event-time">{formatTimestamp(event.timestamp)}</span>
                      </div>
                    </div>
                    <div className="usage-event-details">
                      <div className="usage-event-detail">
                        <span className="usage-detail-label">请求消耗:</span>
                        <span className="usage-detail-value">{event.requestsCosts.toFixed(2)} 次</span>
                      </div>
                      <div className="usage-event-detail">
                        <span className="usage-detail-label">输入 Token:</span>
                        <span className="usage-detail-value">{formatNumber(event.tokenUsage.inputTokens)}</span>
                      </div>
                      <div className="usage-event-detail">
                        <span className="usage-detail-label">输出 Token:</span>
                        <span className="usage-detail-value">{formatNumber(event.tokenUsage.outputTokens)}</span>
                      </div>
                      {event.tokenUsage.cacheReadTokens !== undefined && event.tokenUsage.cacheReadTokens > 0 && (
                        <div className="usage-event-detail">
                          <span className="usage-detail-label">缓存读取:</span>
                          <span className="usage-detail-value">{formatNumber(event.tokenUsage.cacheReadTokens)}</span>
                        </div>
                      )}
                      {event.tokenUsage.cacheWriteTokens !== undefined && event.tokenUsage.cacheWriteTokens > 0 && (
                        <div className="usage-event-detail">
                          <span className="usage-detail-label">缓存写入:</span>
                          <span className="usage-detail-value">{formatNumber(event.tokenUsage.cacheWriteTokens)}</span>
                        </div>
                      )}
                      <div className="usage-event-detail">
                        <span className="usage-detail-label">总 Token:</span>
                        <span className="usage-detail-value highlight">{formatNumber(getTotalTokens(event.tokenUsage))}</span>
                      </div>
                    </div>
                    {event.customSubscriptionName && (
                      <div className="usage-event-subscription">
                        订阅: {event.customSubscriptionName}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : usageData && usageData.usageEventsDisplay.length === 0 ? (
            <div className="usage-empty-state">
              <div className="usage-empty-icon">📭</div>
              <h3 style={{ margin: '16px 0 8px', fontSize: '18px', color: '#374151' }}>该时间段内没有使用记录</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
                {selectedDays === 1 ? '最近 1 天' : selectedDays === 7 ? '最近 7 天' : '最近 30 天'}内暂无 API 调用记录
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#9ca3af' }}>
                尝试选择其他时间范围查询
              </p>
            </div>
          ) : !loading && !usageData && (
            <div className="usage-empty-state">
              <div className="usage-empty-icon">👆</div>
              <p>请选择时间范围并点击"查询"按钮</p>
            </div>
          )}

          {loading && (
            <div className="usage-loading-state">
              <div className="usage-loading-spinner"></div>
              <p>正在查询使用详情...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UsageDetailsModal


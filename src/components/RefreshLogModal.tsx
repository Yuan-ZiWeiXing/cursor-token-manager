import React from 'react'
import '../styles/RefreshLogModal.css'

interface LogEntry {
  account: string
  status: 'processing' | 'success' | 'failed'
  message?: string
}

interface RefreshLogModalProps {
  show: boolean
  logs: LogEntry[]
  progress: {
    current: number
    total: number
  }
  onClose?: () => void
}

const RefreshLogModal: React.FC<RefreshLogModalProps> = ({ show, logs, progress, onClose }) => {
  if (!show) return null

  const isComplete = progress.current >= progress.total

  return (
    <div className="refresh-log-modal-backdrop">
      <div className="refresh-log-modal-container">
        <div className="refresh-log-modal-header">
          <h3 className="refresh-log-modal-title">
            批量刷新用量
          </h3>
          <div className="refresh-log-modal-progress">
            {progress.current} / {progress.total}
          </div>
        </div>
        
        <div className="refresh-log-modal-content">
          <div className="refresh-log-list">
            {logs.map((log, index) => (
              <div 
                key={index} 
                className={`refresh-log-item refresh-log-item-${log.status}`}
              >
                <div className="refresh-log-icon">
                  {log.status === 'processing' && '⏳'}
                  {log.status === 'success' && '✅'}
                  {log.status === 'failed' && '❌'}
                </div>
                <div className="refresh-log-content">
                  <div className="refresh-log-account">{log.account}</div>
                  {log.message && (
                    <div className="refresh-log-message">{log.message}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isComplete && onClose && (
          <div className="refresh-log-modal-footer">
            <button className="btn-primary" onClick={onClose}>
              关闭
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default RefreshLogModal



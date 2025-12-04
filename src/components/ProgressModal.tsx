import React from 'react'
import '../styles/ProgressModal.css'

interface ProgressModalProps {
  show: boolean
  step: string
  progress: number
  message: string
}

const ProgressModal: React.FC<ProgressModalProps> = ({
  show,
  step,
  progress,
  message
}) => {
  if (!show) return null

  return (
    <div className="progress-modal-backdrop">
      <div className="progress-modal-container">
        <div className="progress-modal-header">
          <h3 className="progress-modal-title">正在切换账号</h3>
        </div>
        <div className="progress-modal-content">
          <div className="progress-message">{message}</div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
            />
          </div>
          <div className="progress-steps">
            <div className={`step-item ${['INIT', 'GET_TOKEN'].includes(step) ? 'active' : ''} ${progress > 20 ? 'completed' : ''}`}>
              <div className="step-dot"></div>
              <span>获取令牌</span>
            </div>
            <div className={`step-item ${['KILL_CURSOR', 'CLEAR_HISTORY', 'RESET_MACHINE_ID'].includes(step) ? 'active' : ''} ${progress > 55 ? 'completed' : ''}`}>
              <div className="step-dot"></div>
              <span>环境准备</span>
            </div>
            <div className={`step-item ${step === 'UPDATE_DB' ? 'active' : ''} ${progress > 70 ? 'completed' : ''}`}>
              <div className="step-dot"></div>
              <span>更新数据</span>
            </div>
            <div className={`step-item ${['RESTART', 'DONE'].includes(step) ? 'active' : ''} ${step === 'DONE' ? 'completed' : ''}`}>
              <div className="step-dot"></div>
              <span>重启应用</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProgressModal


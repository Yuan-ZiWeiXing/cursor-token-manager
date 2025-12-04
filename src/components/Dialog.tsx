import React from 'react'
import '../styles/Dialog.css'

interface DialogProps {
  title?: string
  message: string
  type?: 'info' | 'confirm' | 'warning' | 'error'
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  show: boolean
}

const Dialog: React.FC<DialogProps> = ({
  title,
  message,
  type = 'info',
  onConfirm,
  onCancel,
  confirmText = '确定',
  cancelText = '取消',
  show
}) => {
  if (!show) return null

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (onCancel) {
        onCancel()
      } else if (onConfirm) {
        // 如果没有取消按钮，点击背景也关闭
        onConfirm()
      }
    }
  }


  return (
    <div className="dialog-backdrop" onClick={handleBackdropClick}>
      <div className={`dialog-container dialog-${type}`}>
        <div className="dialog-header">
          {title && <h3 className="dialog-title">{title}</h3>}
        </div>
        <div className="dialog-content">
          <div className="dialog-message">{message}</div>
        </div>
        {(onCancel || onConfirm) && (
          <div className="dialog-actions">
            {onCancel && (
              <button className="dialog-button dialog-button-secondary" onClick={onCancel}>
                {cancelText}
              </button>
            )}
            {onConfirm && (
              <button className="dialog-button dialog-button-primary" onClick={onConfirm}>
                {confirmText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dialog


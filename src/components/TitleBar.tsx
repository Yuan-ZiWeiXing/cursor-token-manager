import React from 'react'
import '../styles/TitleBar.css'

const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow()
    }
  }

  const handleMaximize = () => {
    if (window.electronAPI) {
      window.electronAPI.maximizeWindow()
    }
  }

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow()
    }
  }

  return (
    <div className="title-bar">
      <div className="title-bar-controls">
        <button
          className="title-bar-button close"
          onClick={handleClose}
          aria-label="关闭"
        >
          <span className="title-bar-button-icon">×</span>
        </button>
        <button
          className="title-bar-button minimize"
          onClick={handleMinimize}
          aria-label="最小化"
        >
          <span className="title-bar-button-icon">−</span>
        </button>
        <button
          className="title-bar-button maximize"
          onClick={handleMaximize}
          aria-label="最大化"
        >
          <span className="title-bar-button-icon">+</span>
        </button>
      </div>
      <div className="title-bar-title">Yuan-cursor账号管理器</div>
    </div>
  )
}

export default TitleBar


import '../styles/UpdateModal.css'

interface UpdateModalProps {
  show: boolean
  currentVersion?: string
  latestVersion?: string
  releaseNotes?: string
  releaseUrl?: string
  manualDownload?: boolean
  isDownloading?: boolean
  isDownloaded?: boolean
  downloadProgress?: number
  error?: string
  onClose: () => void
  onDownload: () => void
  onInstall: () => void
  onOpenUrl: () => void
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  show,
  currentVersion,
  latestVersion,
  releaseNotes,
  releaseUrl,
  manualDownload,
  isDownloading,
  isDownloaded,
  downloadProgress = 0,
  error,
  onClose,
  onDownload,
  onInstall,
  onOpenUrl
}) => {
  if (!show) return null

  // 解析 releaseNotes（支持 markdown 格式的简单渲染）
  const renderReleaseNotes = (notes: string) => {
    if (!notes) return <p className="no-notes">暂无更新说明</p>

    // 按行分割
    const lines = notes.split('\n')
    const elements: JSX.Element[] = []
    let listItems: string[] = []

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`}>
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )
        listItems = []
      }
    }

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      
      // 空行
      if (!trimmed) {
        flushList()
        return
      }

      // 标题（## 或 ###）
      if (trimmed.startsWith('### ')) {
        flushList()
        elements.push(<h4 key={index}>{trimmed.slice(4)}</h4>)
        return
      }
      if (trimmed.startsWith('## ')) {
        flushList()
        elements.push(<h3 key={index}>{trimmed.slice(3)}</h3>)
        return
      }
      if (trimmed.startsWith('# ')) {
        flushList()
        elements.push(<h2 key={index}>{trimmed.slice(2)}</h2>)
        return
      }

      // 列表项（- 或 *）
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(trimmed.slice(2))
        return
      }

      // 普通段落
      flushList()
      elements.push(<p key={index}>{trimmed}</p>)
    })

    flushList()
    return elements.length > 0 ? elements : <p className="no-notes">暂无更新说明</p>
  }

  return (
    <div className="update-modal-overlay" onClick={onClose}>
      <div className="update-modal-container" onClick={e => e.stopPropagation()}>
        <div className="update-modal-header">
          <div className="update-modal-title">
            <span className="update-emoji">🎉</span>
            发现新版本
          </div>
          <button className="update-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="update-modal-body">
          <div className="version-info">
            <div className="version-row">
              <span className="version-label">当前版本</span>
              <span className="version-value current">{currentVersion || '未知'}</span>
            </div>
            <div className="version-arrow">→</div>
            <div className="version-row">
              <span className="version-label">最新版本</span>
              <span className="version-value latest">{latestVersion || '未知'}</span>
            </div>
          </div>

          <div className="release-notes-section">
            <div className="release-notes-title">更新内容</div>
            <div className="release-notes-content">
              {renderReleaseNotes(releaseNotes || '')}
            </div>
          </div>
        </div>

        <div className="update-modal-footer">
          {error ? (
            <div className="update-error">
              <span className="error-icon">❌</span>
              <span className="error-text">{error}</span>
            </div>
          ) : isDownloading ? (
            <div className="download-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
              <span className="progress-text">下载中... {downloadProgress.toFixed(0)}%</span>
            </div>
          ) : null}

          <div className="update-actions">
            <button className="btn-secondary" onClick={onClose}>
              稍后再说
            </button>
            
            {releaseUrl && (
              <button className="btn-secondary" onClick={onOpenUrl}>
                查看详情
              </button>
            )}

            {isDownloaded ? (
              <button className="btn-primary install" onClick={onInstall}>
                <span>✅</span> 立即安装
              </button>
            ) : manualDownload ? (
              <button className="btn-primary" onClick={onOpenUrl}>
                <span>🔗</span> 前往下载
              </button>
            ) : (
              <button 
                className="btn-primary" 
                onClick={onDownload}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <span className="btn-spinner" /> 下载中...
                  </>
                ) : (
                  <>
                    <span>⬇️</span> 立即更新
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default UpdateModal




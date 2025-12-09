import '../styles/MacManagePage.css'

const MacManagePage: React.FC = () => {
  return (
    <div className="mac-manage-page">
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon">🍎</span>
          Mac管理
          <span className="wip-badge">待完成</span>
        </h1>
        <p className="page-description">
          此功能正在开发中，敬请期待...
        </p>
      </div>

      <div className="coming-soon-container">
        <div className="coming-soon-icon">🚧</div>
        <h2 className="coming-soon-title">功能开发中</h2>
        <p className="coming-soon-text">
          Mac管理功能正在紧张开发中，即将上线
        </p>
        
        <div className="planned-features">
          <h3 className="features-title">计划功能</h3>
          <ul className="features-list">
            <li>
              <span className="feature-icon">📁</span>
              <span className="feature-text">Mac 环境配置管理</span>
            </li>
            <li>
              <span className="feature-icon">🔄</span>
              <span className="feature-text">Cursor 数据同步</span>
            </li>
            <li>
              <span className="feature-icon">💾</span>
              <span className="feature-text">配置备份与恢复</span>
            </li>
            <li>
              <span className="feature-icon">🛠️</span>
              <span className="feature-text">更多功能...</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default MacManagePage




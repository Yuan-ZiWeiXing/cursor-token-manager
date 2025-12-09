import '../styles/ThanksPage.css'

interface Contributor {
  name: string
  avatar?: string
  role: string
  description: string
  link?: string
}

const ThanksPage: React.FC = () => {
  // 感谢列表数据 - 后续可以从仓库文档读取
  const contributors: Contributor[] = [
    {
      name: 'Denny-Yuan',
      avatar: 'https://github.com/Denny-Yuan.png',
      role: '项目作者',
      description: '项目创建者和主要开发者',
      link: 'https://github.com/Denny-Yuan'
    },
    {
      name: '社区贡献者',
      role: '代码贡献',
      description: '感谢所有为项目提交代码的贡献者们',
    },
    {
      name: '问题反馈者',
      role: '问题反馈',
      description: '感谢所有提交 Issue 和建议的用户',
    },
    {
      name: '使用者',
      role: '支持者',
      description: '感谢所有使用和支持本项目的用户',
    }
  ]

  // 特别感谢列表
  const specialThanks = [
    { name: 'Electron', description: '跨平台桌面应用框架' },
    { name: 'React', description: '用户界面构建库' },
    { name: 'TypeScript', description: '类型安全的 JavaScript' },
    { name: 'Vite', description: '下一代前端构建工具' },
  ]

  return (
    <div className="thanks-page">
      <div className="page-header">
        <h1 className="page-title">
          <span className="title-icon">💝</span>
          感谢列表
        </h1>
        <p className="page-description">
          感谢所有为本项目做出贡献的人
        </p>
      </div>

      <div className="thanks-section">
        <h2 className="section-title">
          <span className="section-icon">👥</span>
          贡献者
        </h2>
        <div className="contributors-grid">
          {contributors.map((contributor, index) => (
            <div 
              key={index} 
              className="contributor-card"
              onClick={() => contributor.link && window.open(contributor.link, '_blank')}
              style={{ cursor: contributor.link ? 'pointer' : 'default' }}
            >
              <div className="contributor-avatar">
                {contributor.avatar ? (
                  <img src={contributor.avatar} alt={contributor.name} />
                ) : (
                  <span className="avatar-placeholder">
                    {contributor.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="contributor-info">
                <h3 className="contributor-name">{contributor.name}</h3>
                <span className="contributor-role">{contributor.role}</span>
                <p className="contributor-desc">{contributor.description}</p>
              </div>
              {contributor.link && (
                <div className="contributor-link">
                  <span>🔗</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="thanks-section">
        <h2 className="section-title">
          <span className="section-icon">🛠️</span>
          技术支持
        </h2>
        <div className="tech-grid">
          {specialThanks.map((tech, index) => (
            <div key={index} className="tech-card">
              <h4 className="tech-name">{tech.name}</h4>
              <p className="tech-desc">{tech.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="thanks-footer">
        <div className="heart-icon">❤️</div>
        <p>感谢每一位支持者，你们的支持是我们前进的动力！</p>
      </div>
    </div>
  )
}

export default ThanksPage




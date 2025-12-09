import { useState, useEffect } from 'react'
import '../styles/DocsPage.css'
import packageJson from '../../package.json'

interface DocItem {
  title: string
  fileName: string
  icon: string
  description: string
}

interface Contributor {
  name: string
  avatar: string
  role: string
  description: string
  link: string
}

interface Technology {
  name: string
  description: string
}

interface FaqItem {
  id: number
  icon: string
  question: string
  answer: string
  type: string
  steps: string[]
  reportedBy: string
  solvedBy: string
}

interface ThanksData {
  contributors: Contributor[]
  technologies: Technology[]
}

interface FaqData {
  faqs: FaqItem[]
  tips: string[]
}

// GitHub 图片基础地址
const GITHUB_IMG_BASE = 'https://raw.githubusercontent.com/Denny-Yuan/cursor-token-manager/master/img/'

// README 内容
const README_CONTENT = `# Yuan-cursor账号管理器

一个美观的Mac风格桌面应用，用于管理Cursor编辑器的Token账号。

## 📥 下载安装

前往 [Releases](https://github.com/Yuan-ZiWeiXing/cursor-token-manager/releases) 页面下载最新版本，根据你的系统选择对应的安装包：

### 📦 安装包对照表

#### Windows 系统

- Windows 64位 (大多数电脑): \`yuan-cursor-manager-setup-x.x.x-x64.exe\`
- Windows 32位 (老电脑): \`yuan-cursor-manager-setup-x.x.x-ia32.exe\`

#### macOS 系统

- 不确定是哪种: \`yuan-cursor-manager-x.x.x-universal.dmg\` ✅ **推荐**
- M1/M2/M3/M4 芯片: \`yuan-cursor-manager-x.x.x-arm64.dmg\`
- Intel 芯片 (2020年前): \`yuan-cursor-manager-x.x.x-x64.dmg\`

#### Linux 系统

- Linux 64位: \`yuan-cursor-manager-x.x.x-x64.AppImage\`

> 💡 **提示**：\`x.x.x\` 代表版本号，请下载最新版本。

---

## 功能预览

### 🏠 主页 (Home)
简洁直观的仪表盘，快速概览系统状态。
![主页](img/zhuye.png)

### 👥 账号管理 (Account Management)
轻松添加、编辑和删除Cursor Token账号，支持一键切换当前使用的账号。
![账号管理](img/zhanghaoguanli.png)

### ⚙️ 系统管理 (System Management)
管理系统配置，监控应用运行状态。
![系统管理](img/xitongguanli.png)

### 🔧 设置 (Settings)
个性化应用设置，调整界面偏好。
![设置](img/shezhi.png)

### ❓ 常见问题 (FAQ)
内置常见问题解答，帮助快速解决使用困惑。
![常见问题](img/changjianwenti.png)

## 许可证

MIT
`

interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
  prerelease: boolean
  draft: boolean
  assets: Array<{
    name: string
    download_count: number
    browser_download_url: string
    size: number
  }>
}

const DocsPage: React.FC = () => {
  const [selectedDoc, setSelectedDoc] = useState<string>('README')
  const [docContent, setDocContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  
  // GitHub Releases 状态
  const [releases, setReleases] = useState<GitHubRelease[]>([])
  const [releasesLoading, setReleasesLoading] = useState(false)
  const [releasesError, setReleasesError] = useState<string>('')
  const [expandedRelease, setExpandedRelease] = useState<number | null>(null)

  // FAQ 状态
  const [faqSearch, setFaqSearch] = useState<string>('')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  // 感谢列表数据
  const [thanksData, setThanksData] = useState<ThanksData>({ contributors: [], technologies: [] })
  const [thanksLoading, setThanksLoading] = useState(false)
  const [thanksError, setThanksError] = useState<string>('')

  // FAQ数据
  const [faqData, setFaqData] = useState<FaqData>({ faqs: [], tips: [] })
  const [faqLoading, setFaqLoading] = useState(false)
  const [faqError, setFaqError] = useState<string>('')

  // 文档列表 - 从仓库读取
  const docList: DocItem[] = [
    { 
      title: '项目说明', 
      fileName: 'README', 
      icon: '📄',
      description: '项目介绍和基本使用说明'
    },
    { 
      title: '更新日志', 
      fileName: 'UPDATE_LOG', 
      icon: '📝',
      description: '从 GitHub 获取版本发布历史'
    },
    { 
      title: '批量验号说明', 
      fileName: '批量验号使用说明', 
      icon: '📋',
      description: '批量验证账号的使用指南'
    },
    { 
      title: '感谢列表', 
      fileName: 'THANKS', 
      icon: '💝',
      description: '感谢所有贡献者和技术支持'
    },
    { 
      title: '常见问题', 
      fileName: 'FAQ', 
      icon: '❓',
      description: 'Cursor 使用问题和解决方案'
    },
  ]

  // 从远程数据获取
  const contributors = thanksData.contributors
  const specialThanks = thanksData.technologies
  const faqs = faqData.faqs
  const tips = faqData.tips

  // 从 GitHub 加载感谢列表数据
  const loadThanksData = async () => {
    setThanksLoading(true)
    setThanksError('')
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/Denny-Yuan/cursor-token-manager/master/src/data/thanks.json')
      
      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }
      
      const data = await response.json()
      setThanksData(data)
    } catch (err) {
      setThanksError(err instanceof Error ? err.message : '加载感谢列表失败')
    } finally {
      setThanksLoading(false)
    }
  }

  // 从 GitHub 加载 FAQ 数据
  const loadFaqData = async () => {
    setFaqLoading(true)
    setFaqError('')
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/Denny-Yuan/cursor-token-manager/master/src/data/faq.json')
      
      if (!response.ok) {
        throw new Error(`加载失败: ${response.status}`)
      }
      
      const data = await response.json()
      setFaqData(data)
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : '加载常见问题失败')
    } finally {
      setFaqLoading(false)
    }
  }

  // 渲染感谢列表
  const renderThanksPage = () => (
    <div className="thanks-container">
      <div className="thanks-section">
        <h2 className="thanks-section-title">
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
        <h2 className="thanks-section-title">
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

  // 模糊搜索过滤 FAQ
  const filteredFaqs = faqs.filter(faq => {
    if (!faqSearch.trim()) return true
    const searchLower = faqSearch.toLowerCase()
    return (
      faq.question.toLowerCase().includes(searchLower) ||
      faq.answer.toLowerCase().includes(searchLower) ||
      (faq.steps && faq.steps.some(step => step.toLowerCase().includes(searchLower)))
    )
  })

  // 渲染常见问题
  const renderFAQPage = () => (
    <div className="faq-container">
      {/* 搜索框 */}
      <div className="faq-search-box">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="faq-search-input"
          placeholder="搜索问题或解决方案..."
          value={faqSearch}
          onChange={(e) => setFaqSearch(e.target.value)}
        />
        {faqSearch && (
          <button 
            className="search-clear-btn"
            onClick={() => setFaqSearch('')}
          >
            ✕
          </button>
        )}
      </div>

      {/* 搜索结果统计 */}
      <div className="faq-stats">
        <span className="stat-icon">📋</span>
        {faqSearch ? (
          <span>找到 {filteredFaqs.length} 个相关问题</span>
        ) : (
          <span>共 {faqs.length} 个常见问题</span>
        )}
      </div>

      {/* FAQ 列表 */}
      <div className="releases-list">
        {filteredFaqs.length === 0 ? (
          <div className="faq-empty">
            <span className="empty-icon">😕</span>
            <p>没有找到匹配的问题</p>
            <button className="clear-search-btn" onClick={() => setFaqSearch('')}>
              清除搜索
            </button>
          </div>
        ) : (
          filteredFaqs.map((faq) => (
            <div key={faq.id} className={`release-card ${expandedFaq === faq.id ? 'expanded' : ''}`}>
              <div 
                className="release-header"
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
              >
                <div className="release-title">
                  <span className="release-version">
                    {faq.question.length > 60 ? faq.question.slice(0, 60) + '...' : faq.question}
                  </span>
                </div>
                <div className="release-meta">
                  <span className="expand-icon">{expandedFaq === faq.id ? '▼' : '▶'}</span>
                </div>
              </div>
              
              {expandedFaq === faq.id && (
                <div className="faq-body">
                  <div className="faq-question-full">
                    <span className="question-label">问题描述：</span>
                    <p>{faq.question}</p>
                  </div>
                  
                  <div className="faq-answer">
                    <span className="answer-label">解决方案：</span>
                    {faq.steps && faq.steps.length > 0 ? (
                      <ol className="answer-steps">
                        {faq.steps.map((step, index) => (
                          <li key={index}>{step}</li>
                        ))}
                      </ol>
                    ) : (
                      <p className="answer-text">{faq.answer}</p>
                    )}
                  </div>

                  {(faq.reportedBy || faq.solvedBy) && (
                    <div className="faq-contributors">
                      {faq.reportedBy && (
                        <span className="faq-contributor">
                          <span className="contributor-icon">👤</span>
                          <span className="contributor-label">问题反馈：</span>
                          {faq.reportedBy}
                        </span>
                      )}
                      {faq.solvedBy && (
                        <span className="faq-contributor">
                          <span className="contributor-icon">💡</span>
                          <span className="contributor-label">解决方案：</span>
                          {faq.solvedBy}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="faq-tips-card">
        <div className="tips-header">
          <span className="tips-icon">💡</span>
          <h3 className="tips-title">温馨提示</h3>
        </div>
        <div className="tips-content">
          {tips.map((tip, index) => (
            <p key={index}>• {tip}</p>
          ))}
        </div>
      </div>
    </div>
  )

  // 从 GitHub 加载 Releases
  const loadGitHubReleases = async () => {
    setReleasesLoading(true)
    setReleasesError('')
    
    try {
      const response = await fetch('https://api.github.com/repos/Denny-Yuan/cursor-token-manager/releases', {
        headers: {
          'Accept': 'application/vnd.github.v3+json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`GitHub API 请求失败: ${response.status}`)
      }
      
      const data: GitHubRelease[] = await response.json()
      setReleases(data)
      
      // 默认不展开任何版本
      setExpandedRelease(null)
    } catch (err: any) {
      console.error('加载 GitHub Releases 失败:', err)
      setReleasesError(err.message || '无法加载版本历史')
    } finally {
      setReleasesLoading(false)
    }
  }

  // 当前版本号
  const currentVersion = `v${packageJson.version}`

  // 加载文档内容
  const loadDocContent = async (fileName: string) => {
    // 如果是更新日志，加载 GitHub Releases
    if (fileName === 'UPDATE_LOG') {
      loadGitHubReleases()
      return
    }
    
    // 如果是感谢列表，从 GitHub 加载
    if (fileName === 'THANKS') {
      loadThanksData()
      return
    }
    
    // 如果是常见问题，从 GitHub 加载
    if (fileName === 'FAQ') {
      loadFaqData()
      return
    }
    
    // 如果是 README，使用内置内容
    if (fileName === 'README') {
      setDocContent(README_CONTENT)
      setLoading(false)
      setError('')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      // 尝试从本地读取文档
      if (window.electronAPI?.readDocFile) {
        const result = await window.electronAPI.readDocFile(fileName)
        if (result.success && result.content) {
          setDocContent(result.content)
        } else {
          setError(result.error || '无法加载文档')
          setDocContent('')
        }
      } else {
        // 如果没有 API，显示占位内容
        setDocContent(`# ${fileName}\n\n文档内容加载中...\n\n请确保文档文件存在于项目根目录。`)
      }
    } catch (err: any) {
      setError(err.message || '加载文档失败')
      setDocContent('')
    } finally {
      setLoading(false)
    }
  }

  // 首次加载默认文档
  useEffect(() => {
    loadDocContent(selectedDoc)
  }, []) // 只在组件挂载时执行一次

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 简单的 Markdown 渲染
  const renderMarkdown = (content: string) => {
    if (!content) return null

    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let listItems: string[] = []
    let codeBlock: string[] = []
    let inCodeBlock = false

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="md-list">
            {listItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )
        listItems = []
      }
    }

    const flushCodeBlock = () => {
      if (codeBlock.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className="md-code-block">
            <code>{codeBlock.join('\n')}</code>
          </pre>
        )
        codeBlock = []
      }
    }

    lines.forEach((line, index) => {
      // 代码块
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          flushCodeBlock()
          inCodeBlock = false
        } else {
          flushList()
          inCodeBlock = true
        }
        return
      }

      if (inCodeBlock) {
        codeBlock.push(line)
        return
      }

      const trimmed = line.trim()

      // 空行
      if (!trimmed) {
        flushList()
        return
      }

      // 标题
      if (trimmed.startsWith('#### ')) {
        flushList()
        elements.push(<h4 key={index} className="md-h4">{trimmed.slice(5)}</h4>)
        return
      }
      if (trimmed.startsWith('### ')) {
        flushList()
        elements.push(<h3 key={index} className="md-h3">{trimmed.slice(4)}</h3>)
        return
      }
      if (trimmed.startsWith('## ')) {
        flushList()
        elements.push(<h2 key={index} className="md-h2">{trimmed.slice(3)}</h2>)
        return
      }
      if (trimmed.startsWith('# ')) {
        flushList()
        elements.push(<h1 key={index} className="md-h1">{trimmed.slice(2)}</h1>)
        return
      }

      // 列表
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        listItems.push(trimmed.slice(2))
        return
      }

      // 图片 ![alt](src)
      const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
      if (imgMatch) {
        flushList()
        const alt = imgMatch[1]
        let src = imgMatch[2]
        // 如果是相对路径，转换为 GitHub raw 地址
        if (src.startsWith('img/')) {
          src = GITHUB_IMG_BASE + src.replace('img/', '')
        }
        elements.push(
          <div key={index} className="md-img-container">
            <img src={src} alt={alt} className="md-img" />
            {alt && <span className="md-img-caption">{alt}</span>}
          </div>
        )
        return
      }

      // 普通段落
      flushList()
      elements.push(<p key={index} className="md-p">{trimmed}</p>)
    })

    flushList()
    flushCodeBlock()

    return elements
  }

  return (
    <div className="docs-page">
      <div className="docs-sidebar">
        <div className="docs-sidebar-header">
          <h2>
            <span>📖</span>
            文档中心
          </h2>
        </div>
        <nav className="docs-nav">
          {docList.map((doc) => (
            <button
              key={doc.fileName}
              className={`docs-nav-item ${selectedDoc === doc.fileName ? 'active' : ''}`}
              onClick={() => {
                setSelectedDoc(doc.fileName)
                // 每次点击都重新加载数据
                loadDocContent(doc.fileName)
              }}
            >
              <span className="doc-icon">{doc.icon}</span>
              <div className="doc-info">
                <span className="doc-title">{doc.title}</span>
                <span className="doc-desc">{doc.description}</span>
              </div>
            </button>
          ))}
        </nav>
      </div>

      <div className="docs-content">
        <div className="docs-content-header">
          <h1>
            {docList.find(d => d.fileName === selectedDoc)?.icon}
            {docList.find(d => d.fileName === selectedDoc)?.title}
          </h1>
          <button 
            className="refresh-btn"
            onClick={() => loadDocContent(selectedDoc)}
            title="刷新文档"
          >
            🔄
          </button>
        </div>

        <div className="docs-content-body">
          {selectedDoc === 'FAQ' ? (
            // 常见问题
            faqLoading ? (
              <div className="docs-loading">
                <div className="loading-spinner"></div>
                <span>正在从 GitHub 获取常见问题...</span>
              </div>
            ) : faqError ? (
              <div className="docs-error">
                <span className="error-icon">⚠️</span>
                <span>{faqError}</span>
                <button className="retry-btn" onClick={loadFaqData}>
                  重试
                </button>
              </div>
            ) : (
              renderFAQPage()
            )
          ) : selectedDoc === 'THANKS' ? (
            // 感谢列表
            thanksLoading ? (
              <div className="docs-loading">
                <div className="loading-spinner"></div>
                <span>正在从 GitHub 获取感谢列表...</span>
              </div>
            ) : thanksError ? (
              <div className="docs-error">
                <span className="error-icon">⚠️</span>
                <span>{thanksError}</span>
                <button className="retry-btn" onClick={loadThanksData}>
                  重试
                </button>
              </div>
            ) : (
              renderThanksPage()
            )
          ) : selectedDoc === 'UPDATE_LOG' ? (
            // 更新日志 - 从 GitHub 获取
            releasesLoading ? (
              <div className="docs-loading">
                <div className="loading-spinner"></div>
                <span>正在从 GitHub 获取版本历史...</span>
              </div>
            ) : releasesError ? (
              <div className="docs-error">
                <span className="error-icon">⚠️</span>
                <span>{releasesError}</span>
                <button className="retry-btn" onClick={loadGitHubReleases}>
                  重试
                </button>
              </div>
            ) : (
              <div className="releases-container">
                <div className="releases-header">
                  <div className="releases-stats">
                    <span className="stat-item">
                      <span className="stat-icon">📦</span>
                      共 {releases.length} 个版本
                    </span>
                  </div>
                </div>
                
                <div className="releases-list">
                  {releases.map((release, index) => (
                    <div 
                      key={release.id} 
                      className={`release-card ${expandedRelease === release.id ? 'expanded' : ''} ${index === 0 ? 'latest' : ''} ${release.tag_name === currentVersion ? 'current' : ''}`}
                    >
                      <div 
                        className="release-header"
                        onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}
                      >
                        <div className="release-title">
                          <span className="release-version">{release.tag_name}</span>
                          {release.tag_name === currentVersion && <span className="current-badge">当前版本</span>}
                          {index === 0 && <span className="latest-badge">最新版本</span>}
                          {release.prerelease && <span className="prerelease-badge">预发布</span>}
                        </div>
                        <div className="release-meta">
                          <span className="release-date">
                            <span>📅</span>
                            {formatDate(release.published_at)}
                          </span>
                          <span className="expand-icon">{expandedRelease === release.id ? '▼' : '▶'}</span>
                        </div>
                      </div>
                      
                      {expandedRelease === release.id && (
                        <div className="release-body">
                          {release.name && release.name !== release.tag_name && (
                            <h3 className="release-name">{release.name}</h3>
                          )}
                          
                          <div className="release-notes">
                            {renderMarkdown(release.body || '暂无更新说明')}
                          </div>
                          
                          <a 
                            href={release.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-on-github"
                          >
                            在 GitHub 上查看 →
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            // 其他文档 - Markdown 渲染
            loading ? (
              <div className="docs-loading">
                <div className="loading-spinner"></div>
                <span>加载中...</span>
              </div>
            ) : error ? (
              <div className="docs-error">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            ) : (
              <div className="markdown-content">
                {renderMarkdown(docContent)}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default DocsPage




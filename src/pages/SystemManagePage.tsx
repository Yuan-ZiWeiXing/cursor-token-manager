import React, { useState, useEffect } from 'react'
import '../styles/SystemManagePage.css'
import packageJson from '../../package.json'

interface SystemManagePageProps {
  updateInfo?: {
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
    releaseNotes?: string
  }
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  html_url: string
}

const SystemManagePage: React.FC<SystemManagePageProps> = ({ updateInfo }) => {
  const [releaseNotes, setReleaseNotes] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)

  const handleDownloadUpdate = () => {
    if (updateInfo?.releaseUrl) {
      window.open(updateInfo.releaseUrl, '_blank')
    }
  }

  // 打开 GitHub 仓库
  const handleOpenGitHub = () => {
    const repoUrl = packageJson.repository?.url || packageJson.homepage
    if (repoUrl) {
      window.open(repoUrl, '_blank')
    }
  }

  const version = `v${packageJson.version}`
  const releaseDate = packageJson.releaseDate ?? ''

  // 从 GitHub API 获取 release notes
  useEffect(() => {
    const fetchReleaseNotes = async () => {
      try {
        setLoading(true)
        const owner = packageJson.publish?.[0]?.owner || 'Denny-Yuan'
        const repo = packageJson.publish?.[0]?.repo || 'cursor-token-manager'
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${version}`
        
        const response = await fetch(apiUrl)
        if (response.ok) {
          const data: GitHubRelease = await response.json()
          setReleaseNotes(data.body || '暂无更新说明')
        } else {
          // 如果获取失败，使用默认更新日志
          setReleaseNotes(getDefaultReleaseNotes())
        }
      } catch (error) {
        console.error('获取 Release Notes 失败:', error)
        setReleaseNotes(getDefaultReleaseNotes())
      } finally {
        setLoading(false)
      }
    }

    fetchReleaseNotes()
  }, [version])

  // 默认更新日志（作为后备）
  const getDefaultReleaseNotes = () => {
    return `## 🎉 首个正式版本发布

### ✨ 核心功能
- 支持添加和管理 Cursor 账号令牌
- 支持同步本地 Cursor 账号
- 实时查看账号用量统计
- 一键切换账号功能
- 批量刷新用量信息
- 清理 Free 账号功能

### 🔧 高级工具
- 重置机器码
- 清理历史会话

### 🎨 界面设计
- 现代化的 macOS 风格界面设计
- 支持长效 Token 和 Cookies 两种格式
- 内置常见问题解答
- 主页数据统计展示`
  }

  // 格式化 markdown 为 React 元素
  const formatReleaseNotes = (markdown: string) => {
    const lines = markdown.split('\n')
    const elements: JSX.Element[] = []
    
    lines.forEach((line, index) => {
      if (line.startsWith('## ')) {
        elements.push(<h3 key={index} className="release-heading-2">{line.replace('## ', '')}</h3>)
      } else if (line.startsWith('### ')) {
        elements.push(<h4 key={index} className="release-heading-3">{line.replace('### ', '')}</h4>)
      } else if (line.startsWith('- ')) {
        elements.push(<li key={index} className="release-list-item">{line.replace('- ', '')}</li>)
      } else if (line.trim()) {
        elements.push(<p key={index} className="release-paragraph">{line}</p>)
      }
    })
    
    return elements
  }

  return (
    <div className="system-manage-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">系统管理</h1>
          <p className="page-subtitle">系统信息与版本更新记录</p>
        </div>
      </div>

      <div className="page-content">
        {/* 感谢卡片 - 最上方 */}
        <div className="thanks-card">
          <p className="thanks-text">
            感谢您使用 Yuan-cursor账号管理器！如觉得好用，请给可怜的作者一个 Star ⭐ 吧~
          </p>
          <div className="thanks-footer">
            <div className="thanks-contact">
              <span>📧 联系方式：Q：1400700713</span>
            </div>
            <div className="github-link-footer" onClick={handleOpenGitHub} title="访问 GitHub 仓库给个 Star">
              <span className="github-icon">⭐</span>
              <span className="github-text">GitHub 仓库</span>
            </div>
          </div>
        </div>

        {/* 更新提示横幅 */}
        {updateInfo?.hasUpdate && (
          <div className="update-banner">
            <div className="update-banner-icon">🎉</div>
            <div className="update-banner-content">
              <div className="update-banner-title">
                发现新版本 {updateInfo.latestVersion}
              </div>
              <div className="update-banner-desc">
                当前版本 {version} · 点击下载最新版本获取更多功能和修复
              </div>
            </div>
            <button className="update-banner-button" onClick={handleDownloadUpdate}>
              立即下载
            </button>
          </div>
        )}

        {/* 更新日志 - 从 GitHub 获取 */}
        <div className="update-logs-section">
          <h3 className="section-title">📝 更新日志</h3>
          
          <div className="update-log-card update-major">
            <div className="log-header">
              <div className="log-version">
                <span className="version-number">{version}</span>
                <span className="version-type type-major">当前版本</span>
              </div>
              <span className="log-date">{releaseDate}</span>
            </div>
            
            <div className="log-content">
              {loading ? (
                <div className="loading-release">
                  <div className="loading-spinner">⏳</div>
                  <p>正在从 GitHub 加载更新日志...</p>
                </div>
              ) : (
                <div className="release-notes">
                  {formatReleaseNotes(releaseNotes)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 系统信息卡片 - 移到更新日志下方 */}
        <div className="system-info-card">
          <div className="info-header">
            <div className="app-logo">
              <div className="logo-circle">C</div>
              <div className="app-name">
                <h2>Yuan-cursor账号管理器</h2>
                <p>Yuan Cursor Account Manager</p>
              </div>
            </div>
            <div className="version-badge">{version}</div>
          </div>
          
          <div className="info-details">
            <div className="info-item">
              <span className="info-icon">📦</span>
              <div className="info-content">
                <span className="info-label">当前版本</span>
                <span className="info-value">{version}</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">📅</span>
              <div className="info-content">
                <span className="info-label">发布日期</span>
                <span className="info-value">{releaseDate}</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">👨‍💻</span>
              <div className="info-content">
                <span className="info-label">开发者</span>
                <span className="info-value">Q：1400700713</span>
              </div>
            </div>
            
            <div className="info-item">
              <span className="info-icon">⚙️</span>
              <div className="info-content">
                <span className="info-label">技术栈</span>
                <span className="info-value">Electron + React + TypeScript</span>
              </div>
            </div>
          </div>
        </div>

        {/* 功能特性 */}
        <div className="features-section">
          <h3 className="section-title">✨ 核心功能</h3>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🎫</div>
              <h4 className="feature-title">账号管理</h4>
              <p className="feature-desc">支持添加、编辑、删除和查看 Cursor 账号信息</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔄</div>
              <h4 className="feature-title">同步功能</h4>
              <p className="feature-desc">一键同步本地 Cursor 账号到管理器</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔀</div>
              <h4 className="feature-title">切换账号</h4>
              <p className="feature-desc">快速切换不同账号，自动配置环境</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h4 className="feature-title">用量统计</h4>
              <p className="feature-desc">实时查看账号使用情况和配额信息</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h4 className="feature-title">批量操作</h4>
              <p className="feature-desc">支持批量刷新用量和清理账号</p>
            </div>
            
            <div className="feature-card">
              <div className="feature-icon">🔧</div>
              <h4 className="feature-title">高级工具</h4>
              <p className="feature-desc">重置机器码、清理历史会话等工具</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemManagePage


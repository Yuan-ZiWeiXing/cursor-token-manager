import React, { useState, useEffect } from 'react'
import { Token } from '../App'
import '../styles/TokenForm.css'

interface TokenFormProps {
  token: Token | null
  onSave: (token: Token) => void
  onCancel: () => void
  onShowDialog: (options: {
    title?: string
    message: string
    type?: 'info' | 'confirm' | 'warning' | 'error'
    onConfirm?: () => void
    onCancel?: () => void
    confirmText?: string
    cancelText?: string
  }) => void
}

interface ParseResult {
  userId: string
  email: string
  tokenType: string
  scope: string
  expiryDate?: string
  expiryDateFormatted?: string
  isExpired: boolean
  isValid: boolean
  subscriptionStatus?: string
  isTrial?: boolean
  daysRemainingOnTrial?: number
  name?: string
  // 新增字段
  importSource?: string
  createTime?: string
  subscriptionUpdatedAt?: string
}

const TokenForm: React.FC<TokenFormProps> = ({ token, onSave, onCancel, onShowDialog }) => {
  const [tokenValue, setTokenValue] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)

  const [mode, setMode] = useState<'cookie' | 'token'>('token') // 默认为长效 Token 模式

  useEffect(() => {
    if (token) {
      setTokenValue(token.token)
      // 判断是 Token 还是 Cookie 模式
      if (token.token.includes('WorkosCursorSessionToken') || (token.token.startsWith('user_') && token.token.includes('%3A%3A'))) {
        setMode('cookie')
      } else {
        setMode('token')
      }
      
      // 编辑模式下，如果已经有账号信息，直接填充到解析结果中显示
      if (token.accountInfo) {
        // 尝试从 token 字符串解析更多信息 (JWT)
        let expiryDateFormatted = '未知'
        let scope = 'openid profile email offline_access'
        let isExpired = false
        
        try {
          const jwtPart = token.accountInfo.longTermToken || (token.token.startsWith('eyJ') ? token.token : (token.token.includes('%3A%3A') ? token.token.split('%3A%3A')[1] : token.token.split('::')[1]))
          if (jwtPart && jwtPart.includes('.')) {
            const base64Url = jwtPart.split('.')[1]
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
            const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            }).join(''))
            const payload = JSON.parse(jsonPayload)
            
            if (payload.exp) {
              const expDate = new Date(payload.exp * 1000)
              expiryDateFormatted = expDate.toLocaleString('zh-CN')
              isExpired = expDate < new Date()
            }
            if (payload.scope) {
              scope = payload.scope
            }
          }
        } catch (e) {
          console.warn('前端解析 JWT 失败', e)
        }

        setParseResult({
          userId: token.accountInfo.id || '未知',
          email: token.accountInfo.email || '未获取',
          tokenType: 'session',
          scope: scope,
          name: token.accountInfo.name,
          isValid: !isExpired,
          isExpired: isExpired,
          subscriptionStatus: token.accountInfo.plan,
          isTrial: token.accountInfo.isTrial,
          daysRemainingOnTrial: token.accountInfo.daysRemainingOnTrial,
          expiryDateFormatted: expiryDateFormatted,
          
          importSource: token.accountInfo.cookieFormat ? 'cookie' : 'jwt_token',
          createTime: token.createTime ? new Date(token.createTime).toLocaleString('zh-CN', { hour12: false }) : '未知',
          subscriptionUpdatedAt: new Date().toLocaleString('zh-CN', { hour12: false }) // 这里没有存储更新时间，暂用当前时间或留空
        })
      } else {
        setParseResult(null)
      }
      
      // 如果是编辑模式，且缺少两种格式，尝试自动生成
      const ensureFormats = async () => {
        // ... (保持原有的 ensureFormats 逻辑)
        if (!token.accountInfo) return
        
        const hasLongToken = !!token.accountInfo.longTermToken
        const hasCookieFormat = !!token.accountInfo.cookieFormat
        
        if (hasLongToken && hasCookieFormat) return
        
        const currentToken = token.token.trim()
        const isCookieFormat = currentToken.includes('%3A%3A') || currentToken.includes('::')
        const isJWT = currentToken.startsWith('eyJ')
        
        if (isCookieFormat && !hasLongToken) {
          let jwtPart = currentToken
          if (currentToken.includes('%3A%3A')) {
            jwtPart = currentToken.split('%3A%3A')[1] || currentToken
          } else if (currentToken.includes('::')) {
            jwtPart = currentToken.split('::')[1] || currentToken
          }
          token.accountInfo.longTermToken = jwtPart
          console.log('✅ 自动提取了 longTermToken')
        }
        
        if (isJWT && !hasCookieFormat && window.electronAPI?.convertTokenToCookie) {
          try {
            const result = await window.electronAPI.convertTokenToCookie(currentToken)
            if (result.success && result.cookieFormat) {
              token.accountInfo.cookieFormat = result.cookieFormat
              if (!token.accountInfo.id && result.workosId) {
                token.accountInfo.id = result.workosId
              }
              console.log('✅ 自动生成了 cookieFormat')
            }
          } catch (error) {
            console.warn('自动生成 cookieFormat 失败:', error)
          }
        }
      }
      
      ensureFormats()
    } else {
      setTokenValue('')
      setMode('token')
      setParseResult(null)
    }
  }, [token])
  
  // 切换显示的 Token 格式（在编辑模式下）
  const handleSwitchFormat = (format: 'long' | 'cookie') => {
    if (!token?.accountInfo) return
    
    if (format === 'long' && token.accountInfo.longTermToken) {
      setTokenValue(token.accountInfo.longTermToken)
      setMode('token')
    } else if (format === 'cookie' && token.accountInfo.cookieFormat) {
      setTokenValue(token.accountInfo.cookieFormat)
      setMode('cookie')
    }
  }

  // 转换长期 Token 为 Cookie 格式
  const handleConvertToCookie = async () => {
    if (!tokenValue.trim()) {
      onShowDialog({
        title: '提示',
        message: '请先输入长效 Token',
        type: 'warning',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
      return
    }

    setIsConverting(true)
    try {
      if (!window.electronAPI || !window.electronAPI.convertTokenToCookie) {
        throw new Error('转换功能不可用，请重启应用')
      }
      
      const result = await window.electronAPI.convertTokenToCookie(tokenValue.trim())
      
      if (result.success && result.cookieFormat) {
        // 转换成功，更新输入框的值
        setTokenValue(result.cookieFormat)
        // 切换到 Cookie 模式
        setMode('cookie')
        
        onShowDialog({
          title: '转换成功',
          message: `已成功转换为 Cookie 格式\n\nWorkosId: ${result.workosId}\n\n现在可以解析或保存该 Token`,
          type: 'info',
          onConfirm: () => {
            onShowDialog({
              show: false,
              message: '',
              type: 'info'
            } as any)
          }
        })
      } else {
        onShowDialog({
          title: '转换失败',
          message: result.error || '无法转换 Token 格式',
          type: 'error',
          onConfirm: () => {
            onShowDialog({
              show: false,
              message: '',
              type: 'info'
            } as any)
          }
        })
      }
    } catch (error: any) {
      console.error('转换失败:', error)
      onShowDialog({
        title: '错误',
        message: '转换过程发生错误: ' + error.message,
        type: 'error',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
    } finally {
      setIsConverting(false)
    }
  }

  const handleParse = async () => {
    if (!tokenValue.trim()) {
      onShowDialog({
        title: '提示',
        message: `请先输入 ${mode === 'token' ? 'Token' : 'Cookie'}`,
        type: 'warning',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
      return
    }

    setIsParsing(true)
    try {
      if (!window.electronAPI || !window.electronAPI.parseToken) {
        throw new Error('parseToken 方法不可用，请重启应用')
      }
      // 无论哪种模式，后端处理逻辑基本一致（会自动识别格式）
      // Cookie 模式本质上也是提取其中的 Token 部分
      const result = await window.electronAPI.parseToken(tokenValue.trim())
      if (result.success && result.parseResult) {
        setParseResult(result.parseResult)
      } else {
        // 解析失败
        if (result.error === 'not_authenticated' || result.errorMessage?.includes('没有这个账号')) {
          onShowDialog({
            title: '解析失败',
            message: result.errorMessage || '没有这个账号，Token 无效或已过期',
            type: 'error',
            onConfirm: () => {
              onShowDialog({
                show: false,
                message: '',
                type: 'info'
              } as any)
            }
          })
        } else {
          onShowDialog({
            title: '解析失败',
            message: result.errorMessage || '无法解析 Token，请检查格式是否正确',
            type: 'error',
            onConfirm: () => {
              onShowDialog({
                show: false,
                message: '',
                type: 'info'
              } as any)
            }
          })
        }
        setParseResult(null)
      }
    } catch (error: any) {
      console.error('解析 Token 失败:', error)
      onShowDialog({
        title: '错误',
        message: `解析 Token 时发生错误: ${error.message || '未知错误'}`,
        type: 'error',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
      setParseResult(null)
    } finally {
      setIsParsing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tokenValue.trim()) {
      onShowDialog({
        title: '提示',
        message: '请填写Token信息',
        type: 'warning',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
      return
    }

    // 如果是添加模式，需要先解析
    if (!token && !parseResult) {
      onShowDialog({
        title: '提示',
        message: '请先点击"解析"按钮验证 Token',
        type: 'warning',
        onConfirm: () => {
          onShowDialog({
            show: false,
            message: '',
            type: 'info'
          } as any)
        }
      })
      return
    }

    setIsLoading(true)

    const tokenData: Token = {
      id: token?.id || Date.now().toString(),
      name: token?.name || '', // 编辑时保留原名称，添加时为空
      token: tokenValue.trim(),
      isActive: token?.isActive || false // 编辑时保留原状态，添加时默认为false
    }

    try {
      await onSave(tokenData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="token-form-container">
      <form className="token-form" onSubmit={handleSubmit}>
        
        {/* 模式切换 Tab */}
        <div className="form-tabs">
          <button
            type="button"
            className={`form-tab ${mode === 'token' ? 'active' : ''}`}
            onClick={() => {
              if (token && token.accountInfo?.longTermToken) {
                handleSwitchFormat('long')
              } else {
                setMode('token')
                setParseResult(null)
              }
            }}
          >
            长效 Token
          </button>
          <button
            type="button"
            className={`form-tab ${mode === 'cookie' ? 'active' : ''}`}
            onClick={() => {
              if (token && token.accountInfo?.cookieFormat) {
                handleSwitchFormat('cookie')
              } else {
                setMode('cookie')
                setParseResult(null)
              }
            }}
          >
            Cookies
          </button>
        </div>

        {/* 如果是编辑模式且有两种格式，显示提示信息 */}
        {token && token.accountInfo && (
          (token.accountInfo.longTermToken || token.accountInfo.cookieFormat) && (
            <div style={{
              marginBottom: '15px',
              padding: '10px 12px',
              backgroundColor: '#e0f2fe',
              border: '1px solid #7dd3fc',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#0c4a6e'
            }}>
              <div style={{ fontWeight: 500, marginBottom: '4px' }}>
                📋 此账号包含{token.accountInfo.longTermToken && token.accountInfo.cookieFormat ? '两种' : '一种'}格式
              </div>
              <div style={{ fontSize: '12px', opacity: 0.9 }}>
                {token.accountInfo.longTermToken && token.accountInfo.cookieFormat ? (
                  '点击上方标签可切换查看 "长效 Token" 或 "Cookies" 格式'
                ) : (
                  '保存后将自动生成另一种格式'
                )}
              </div>
            </div>
          )
        )}

        <div className="form-group">
          <div className="form-label-row">
            <label htmlFor="token-value">
              {mode === 'token' ? 'Cursor Token' : 'Session Token'}
            </label>
            <span className="form-label-hint">
              {mode === 'token' 
                ? '粘贴以 eyJ 开头的长效 Token' 
                : '粘贴以 user_ 开头的 Session Token 或完整 Cookie'}
            </span>
          </div>
          <textarea
            id="token-value"
            className="form-textarea"
            placeholder={mode === 'token' 
              ? "请输入长效 Token (eyJhbG...)" 
              : "请输入 Session Token (user_01K...) 或完整 Cookie"}
            value={tokenValue}
            onChange={(e) => {
              setTokenValue(e.target.value)
              setParseResult(null) // 输入改变时清除解析结果
            }}
            rows={6}
            required
            disabled={isLoading}
            readOnly={!!token}
          />
        </div>

        {/* 解析结果展示区域 */}
        {parseResult && (
          <div className="parse-result">
            <h4 className="parse-result-title">
              {token ? '账号详细信息' : '解析结果'}
            </h4>
            <div className="parse-result-content">
              {/* 第一行：用户ID */}
              <div className="parse-result-item full-width">
                <span className="parse-result-label">用户ID:</span>
                <span className="parse-result-value" style={{ fontSize: '12px', fontFamily: 'monospace', userSelect: 'all' }}>
                  {parseResult.userId}
                </span>
              </div>

              {/* 第二行：邮箱、状态 */}
              <div className="parse-result-row">
                <div className="parse-result-item">
                  <span className="parse-result-label">邮箱:</span>
                  <span className="parse-result-value" style={{ userSelect: 'all' }}>
                    {parseResult.email || parseResult.name || '未命名'}
                  </span>
                </div>
                <div className="parse-result-item">
                  <span className="parse-result-label">状态:</span>
                  <span className="parse-result-value">
                    {token ? (token.isActive ? '✅ 使用中' : '待应用') : '待添加'}
                  </span>
                </div>
              </div>
              
              {/* 第三行：Token类型、订阅状态 */}
              <div className="parse-result-row">
                <div className="parse-result-item">
                  <span className="parse-result-label">Token类型:</span>
                  <span className="parse-result-value">{parseResult.tokenType}</span>
                </div>
                <div className="parse-result-item">
                  <span className="parse-result-label">订阅状态:</span>
                  <span className={`parse-result-value ${parseResult.isTrial ? 'trial-status' : ''}`}>
                    {parseResult.subscriptionStatus || 'free'}
                    {parseResult.isTrial && ' (试用中)'}
                  </span>
                </div>
              </div>

              {/* 第四行：订阅更新时间、Token状态 */}
              <div className="parse-result-row">
                <div className="parse-result-item">
                  <span className="parse-result-label">订阅更新时间:</span>
                  <span className="parse-result-value">
                    {parseResult.subscriptionUpdatedAt || '未知'}
                  </span>
                </div>
                <div className="parse-result-item">
                  <span className="parse-result-label">Token状态:</span>
                  <span className={`parse-result-value ${parseResult.isValid ? 'valid' : 'expired'}`}>
                    {parseResult.isValid ? '✅ 有效' : '❌ 无效/过期'}
                  </span>
                </div>
              </div>

              {/* 第五行：过期时间、Token类型(重复但保留展示位) */}
              <div className="parse-result-row">
                <div className="parse-result-item">
                  <span className="parse-result-label">过期时间:</span>
                  <span className={`parse-result-value ${parseResult.isExpired ? 'expired' : ''}`}>
                    {parseResult.expiryDateFormatted || '未知'}
                    {parseResult.isExpired && ' (已过期)'}
                  </span>
                </div>
                <div className="parse-result-item">
                  <span className="parse-result-label">Token类型:</span>
                  <span className="parse-result-value">{parseResult.tokenType}</span>
                </div>
              </div>

              {/* 第六行：权限范围 (全宽) */}
              <div className="parse-result-item full-width">
                <span className="parse-result-label">权限范围:</span>
                <span className="parse-result-value" style={{ fontSize: '12px', color: '#666' }}>
                  {parseResult.scope}
                </span>
              </div>

              {/* 第七行：导入来源 */}
              <div className="parse-result-item full-width">
                <span className="parse-result-label">导入来源:</span>
                <span className="parse-result-value">{parseResult.importSource || '未知'}</span>
              </div>

              {/* 第八行：创建时间 */}
              <div className="parse-result-item full-width">
                <span className="parse-result-label">创建时间:</span>
                <span className="parse-result-value">
                  {parseResult.createTime || '未知'}
                </span>
              </div>

              {parseResult.isTrial && parseResult.daysRemainingOnTrial !== undefined && (
                <div className="parse-result-item full-width" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #eee' }}>
                  <span className="parse-result-label">试用剩余:</span>
                  <span className="parse-result-value highlight-warning">
                    {parseResult.daysRemainingOnTrial} 天
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {!token && (
          <div className="form-group" style={{ display: 'flex', gap: '10px', marginTop: parseResult ? '10px' : '0' }}>
            {/* 转换按钮 - 仅在长效 Token 模式且输入为纯 JWT 时显示 */}
            {mode === 'token' && tokenValue.trim().startsWith('eyJ') && !tokenValue.includes('%3A%3A') && !tokenValue.includes('::') && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleConvertToCookie}
                disabled={isConverting || isParsing || isLoading || !tokenValue.trim()}
                title="将纯 JWT Token 转换为 Cookie 格式 (workosId%3A%3Atoken)"
              >
                {isConverting ? '转换中...' : '🔄 转换为 Cookie'}
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              onClick={handleParse}
              disabled={isParsing || isLoading || isConverting || !tokenValue.trim()}
            >
              {isParsing ? '解析中...' : '解析'}
            </button>
          </div>
        )}

        {!token && (
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isLoading}>
              取消
            </button>
            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isLoading || !parseResult}
            >
              {isLoading ? '正在获取账号信息...' : '添加'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

export default TokenForm

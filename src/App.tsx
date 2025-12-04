import { useState, useEffect } from 'react'
import TitleBar from './components/TitleBar'
import Sidebar from './components/Sidebar'
import HomePage from './pages/HomePage'
import AccountManagePage from './pages/AccountManagePage'
import SettingsPage from './pages/SettingsPage'
import FAQPage from './pages/FAQPage'
import SystemManagePage from './pages/SystemManagePage'
import TokenFormModal from './components/TokenFormModal'
import Dialog from './components/Dialog'
import ProgressModal from './components/ProgressModal'
import RefreshLogModal from './components/RefreshLogModal'
import './styles/App.css'

export interface Token {
  id: string
  name: string
  token: string
  isActive: boolean
  accountInfo?: {
    email?: string
    name?: string
    username?: string
    id?: string
    plan?: string
    avatar?: string
    longTermToken?: string
    cookieFormat?: string
    [key: string]: any
  }
  usage?: {
    used?: number
    limit?: number | null
    remaining?: number | null
    percentage?: number | null
  }
  lastRefreshError?: string  // 上次刷新失败的错误信息
  createTime?: string
}

export interface DialogOptions {
  title?: string
  message: string
  type?: 'info' | 'confirm' | 'warning' | 'error'
  onConfirm?: () => void
  onCancel?: () => void
  confirmText?: string
  cancelText?: string
  show?: boolean
}

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'accounts' | 'settings' | 'faq' | 'system'>('home')
  const [tokens, setTokens] = useState<Token[]>([])
  const [editingToken, setEditingToken] = useState<Token | null>(null)
  const [showForm, setShowForm] = useState(false)
  
  // 进度弹窗状态
  const [progressModal, setProgressModal] = useState({
    show: false,
    step: '',
    progress: 0,
    message: ''
  })
  
  // 批量刷新日志状态
  const [refreshLogModal, setRefreshLogModal] = useState({
    show: false,
    logs: [] as Array<{
      account: string
      status: 'processing' | 'success' | 'failed'
      message?: string
    }>,
    progress: {
      current: 0,
      total: 0
    }
  })

  const [settings, setSettings] = useState({
    cursorDbPath: '',
    cursorAppPath: '',
    batchRefreshSize: 5,
    switchResetMachineId: true,
    switchClearHistory: false
  })

  // 更新检测状态
  const [updateInfo, setUpdateInfo] = useState<{
    hasUpdate: boolean
    latestVersion?: string
    releaseUrl?: string
    releaseNotes?: string
  }>({
    hasUpdate: false
  })
  
  // 对话框状态
  const [dialog, setDialog] = useState<{
    show: boolean
    title?: string
    message: string
    type?: 'info' | 'confirm' | 'warning' | 'error'
    onConfirm?: () => void
    onCancel?: () => void
    confirmText?: string
    cancelText?: string
  }>({
    show: false,
    message: '',
    type: 'info'
  })

  useEffect(() => {
    // 检查 electronAPI 是否可用
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('electronAPI 已加载')
      
      // 注册进度监听
      const cleanup = window.electronAPI.onSwitchAccountProgress((data) => {
        setProgressModal({
          show: true,
          step: data.step,
          progress: data.progress,
          message: data.message
        })
        
        // 如果完成了，延迟关闭
        if (data.step === 'DONE') {
          setTimeout(() => {
            setProgressModal(prev => ({ ...prev, show: false }))
          }, 1500)
        }
        
        // 如果出错了，关闭进度弹窗
        if (data.step === 'ERROR') {
          setTimeout(() => {
            setProgressModal(prev => ({ ...prev, show: false }))
          }, 500)
        }
      })

      loadTokens().then(() => {
        // 加载完列表后，自动执行一次静默同步
        handleSyncAccount(false)
      })
      loadSettings()
      
      // 检查更新
      checkForUpdates()
      
      return () => {
        cleanup && cleanup()
      }
    } else {
      console.error('electronAPI 未加载！请检查 preload 脚本是否正确加载。')
      console.log('window.electronAPI:', window.electronAPI)
    }
  }, [])

  // 从 Cursor 数据库同步账号
  const handleSyncAccount = async (showToast = true) => {
    try {
      if (!window.electronAPI?.syncCursorAccount) return
      
      // 如果是手动点击（showToast=true），显示加载提示
      if (showToast) {
        showDialog({
          title: '同步中',
          message: '正在从 Cursor 数据库读取当前登录账号...',
          type: 'info',
          show: true
        })
      }
      
      const result = await window.electronAPI.syncCursorAccount()
      
      // 无论成功失败，都先关闭加载提示
      if (showToast) hideDialog()
      
      if (result.success) {
        // 重新加载列表
        await loadTokens()
        
        if (showToast) {
          // 延迟一点显示成功提示，避免闪烁
          setTimeout(() => {
            showDialog({
              title: '同步成功',
              message: result.message || '已成功同步当前 Cursor 账号',
              type: 'info',
              onConfirm: hideDialog
            })
          }, 100)
        }
      } else if (showToast) {
        // 失败提示
        setTimeout(() => {
          showDialog({
            title: '同步提示',
            message: result.error || '未能同步账号，请确认 Cursor 是否已安装并登录',
            type: 'warning',
            onConfirm: hideDialog
          })
        }, 100)
      }
    } catch (error: any) {
      console.error('同步账号失败:', error)
      if (showToast) {
        showDialog({
          title: '错误',
          message: '同步账号时发生错误: ' + error.message,
          type: 'error',
          onConfirm: hideDialog
        })
      }
    }
  }

  // 加载设置
  const loadSettings = async () => {
    try {
      if (window.electronAPI) {
        const data = await window.electronAPI.getSettings()
        // 只提取需要的字段
        setSettings({
          cursorDbPath: data.cursorDbPath || '',
          cursorAppPath: data.cursorAppPath || '',
          batchRefreshSize: data.batchRefreshSize || 5,
          switchResetMachineId: data.switchResetMachineId !== undefined ? data.switchResetMachineId : true,
          switchClearHistory: data.switchClearHistory || false
        })
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    }
  }

  // 检查更新
  const checkForUpdates = async () => {
    try {
      if (window.electronAPI && (window.electronAPI as any).checkForUpdates) {
        const result = await (window.electronAPI as any).checkForUpdates()
        if (result.success && result.hasUpdate) {
          setUpdateInfo({
            hasUpdate: true,
            latestVersion: result.latestVersion,
            releaseUrl: result.releaseUrl,
            releaseNotes: result.releaseNotes
          })
          console.log('🎉 发现新版本:', result.latestVersion)
        }
      }
    } catch (error) {
      console.error('检查更新失败:', error)
    }
  }

  // 批量刷新所有账号用量（支持并发）
  const refreshAllUsage = async (isManual = false) => {
    if (tokens.length === 0) {
      if (isManual) {
        showDialog({
          title: '提示',
          message: '没有账号需要刷新',
          type: 'info',
          onConfirm: hideDialog
        })
      }
      return
    }
    
    const batchSize = settings.batchRefreshSize || 5
    console.log(`开始刷新 ${tokens.length} 个账号的用量，并发数: ${batchSize}...`)
    
    // 初始化日志弹窗
    setRefreshLogModal({
      show: true,
      logs: [],
      progress: {
        current: 0,
        total: tokens.length
      }
    })
    
    let successCount = 0
    let failCount = 0
    
    // 辅助函数：刷新单个账号
    const refreshSingleAccount = async (token: Token, index: number) => {
      const accountName = token.accountInfo?.email || token.name || `账号 ${index + 1}`
      
      // 添加"正在处理"日志
      setRefreshLogModal(prev => ({
        ...prev,
        logs: [...prev.logs, {
          account: accountName,
          status: 'processing',
          message: '正在刷新...'
        }]
      }))
      
      try {
        const result = await window.electronAPI.checkTokenUsage(token.id)
        
        if (result.success && result.usage) {
          // 刷新成功
          setTokens(prevTokens => 
            prevTokens.map(t => {
              if (t.id === token.id) {
                const updatedToken: Token = { 
                  ...t, 
                  usage: result.usage,
                  lastRefreshError: undefined
                }
                if (t.accountInfo) {
                  updatedToken.accountInfo = {
                    ...t.accountInfo,
                    quota: {
                      used: result.usage?.used,
                      limit: result.usage?.limit,
                      remaining: result.usage?.remaining
                    }
                  }
                }
                return updatedToken
              }
              return t
            })
          )
          
          // 更新日志为成功
          setRefreshLogModal(prev => ({
            ...prev,
            logs: prev.logs.map((log) => 
              log.account === accountName && log.status === 'processing'
                ? { ...log, status: 'success', message: `已用: ${result.usage?.used || 0}/${result.usage?.limit || '无限'}` }
                : log
            )
          }))
          
          return { success: true }
        } else {
          // 刷新失败
          const errorMsg = result.error || '未知错误'
          
          // 标记失败的账号
          setTokens(prevTokens => 
            prevTokens.map(t => {
              if (t.id === token.id) {
                return { 
                  ...t, 
                  lastRefreshError: errorMsg
                }
              }
              return t
            })
          )
          
          // 更新日志为失败
          setRefreshLogModal(prev => ({
            ...prev,
            logs: prev.logs.map((log) => 
              log.account === accountName && log.status === 'processing'
                ? { ...log, status: 'failed', message: errorMsg }
                : log
            )
          }))
          
          console.warn(`账号 ${accountName} 刷新失败:`, errorMsg)
          return { success: false }
        }
      } catch (error: any) {
        // 异常错误
        const errorMsg = error.message || '网络请求失败'
        
        // 标记失败的账号
        setTokens(prevTokens => 
          prevTokens.map(t => {
            if (t.id === token.id) {
              return { 
                ...t, 
                lastRefreshError: errorMsg
              }
            }
            return t
          })
        )
        
        // 更新日志为失败
        setRefreshLogModal(prev => ({
          ...prev,
          logs: prev.logs.map((log) => 
            log.account === accountName && log.status === 'processing'
              ? { ...log, status: 'failed', message: errorMsg }
              : log
          )
        }))
        
        console.error(`刷新账号 ${accountName} 用量失败:`, error)
        return { success: false }
      }
    }
    
    // 分批处理
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, Math.min(i + batchSize, tokens.length))
      
      // 并发处理当前批次
      const results = await Promise.all(
        batch.map((token, batchIndex) => refreshSingleAccount(token, i + batchIndex))
      )
      
      // 统计结果
      results.forEach(result => {
        if (result.success) {
          successCount++
        } else {
          failCount++
        }
      })
      
      // 更新进度
      setRefreshLogModal(prev => ({
        ...prev,
        progress: {
          ...prev.progress,
          current: Math.min(i + batchSize, tokens.length)
        }
      }))
      
      // 稍微延迟一下，避免请求过快
      if (i + batchSize < tokens.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log(`刷新完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
    
    // 不自动关闭，让用户查看日志并手动关闭
  }


  const loadTokens = async () => {
    try {
      if (!window.electronAPI) {
        console.error('electronAPI 未加载，请检查 preload 脚本')
        return
      }
      const data = await window.electronAPI.getTokens()
      
      // 将已激活的 token 移动到最前面
      const sortedData = [...data].sort((a, b) => {
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return 0
      })
      
      setTokens(sortedData)
    } catch (error) {
      console.error('加载tokens失败:', error)
    }
  }

  // 提取 token 的实际值（去除 Cookie 前缀）
  const extractTokenValue = (tokenString: string): string => {
    if (tokenString.includes('WorkosCursorSessionToken=')) {
      const match = tokenString.match(/WorkosCursorSessionToken=([^;]+)/)
      return match ? match[1] : tokenString
    }
    return tokenString
  }

  // 检查 token 是否已存在
  const findExistingToken = (tokenValue: string): Token | null => {
    const normalizedValue = extractTokenValue(tokenValue.trim())
    return tokens.find(t => {
      const existingValue = extractTokenValue(t.token)
      return existingValue === normalizedValue
    }) || null
  }

  const showDialog = (options: DialogOptions) => {
    // 如果 show 为 false，则关闭对话框
    if (options.show === false) {
      setDialog(prev => ({ ...prev, show: false }))
      return
    }
    
    // 包装 onConfirm 和 onCancel，确保执行后关闭对话框
    const wrappedOnConfirm = options.onConfirm ? () => {
      options.onConfirm?.()
      setDialog(prev => ({ ...prev, show: false }))
    } : undefined
    
    const wrappedOnCancel = options.onCancel ? () => {
      options.onCancel?.()
      setDialog(prev => ({ ...prev, show: false }))
    } : undefined
    
    setDialog({
      show: true,
      ...options,
      onConfirm: wrappedOnConfirm,
      onCancel: wrappedOnCancel
    })
  }

  const hideDialog = () => {
    setDialog(prev => ({ ...prev, show: false }))
  }

  const handleSaveToken = async (token: Token) => {
    try {
      if (!window.electronAPI) {
        console.error('electronAPI 未加载，请检查 preload 脚本')
        showDialog({
          title: '错误',
          message: '应用未正确初始化，请重启应用',
          type: 'error',
          onConfirm: hideDialog
        })
        return
      }
      
      // 如果是新添加的 token（不是编辑模式），检查是否已存在
      if (!editingToken) {
        const existingToken = findExistingToken(token.token)
        if (existingToken) {
          // Token 已存在，提示用户并更新用量
          const accountName = existingToken.accountInfo?.email || '未命名账号'
          showDialog({
            title: 'Token 已存在',
            message: `该 Token 已存在于列表中（${accountName}）\n\n是否要更新该账号的用量信息？`,
            type: 'confirm',
            confirmText: '更新',
            cancelText: '取消',
            onConfirm: async () => {
              hideDialog()
              // 更新已有 token 的用量信息
              try {
                const usageResult = await window.electronAPI.checkTokenUsage(existingToken.id)
                if (usageResult.success && usageResult.usage) {
                  // 更新 token 的用量信息
                  const updatedTokens = tokens.map(t => {
                    if (t.id === existingToken.id) {
                      const updatedToken: Token = { 
                        ...t, 
                        usage: usageResult.usage 
                      }
                      // 同时更新 accountInfo 中的 quota
                      if (t.accountInfo) {
                        updatedToken.accountInfo = {
                          ...t.accountInfo,
                          quota: {
                            used: usageResult.usage?.used,
                            limit: usageResult.usage?.limit,
                            remaining: usageResult.usage?.remaining
                          }
                        }
                      }
                      return updatedToken
                    }
                    return t
                  })
                  setTokens(updatedTokens)
                  
                  // 保存更新后的 tokens
                  for (const t of updatedTokens) {
                    await window.electronAPI.saveToken(t)
                  }
                  
                  showDialog({
                    title: '成功',
                    message: '已更新该账号的用量信息',
                    type: 'info',
                    onConfirm: hideDialog
                  })
                } else {
                  showDialog({
                    title: '错误',
                    message: usageResult.error || '更新用量信息失败',
                    type: 'error',
                    onConfirm: hideDialog
                  })
                }
              } catch (error) {
                console.error('更新用量信息失败:', error)
                showDialog({
                  title: '错误',
                  message: '更新用量信息失败，请检查网络连接',
                  type: 'error',
                  onConfirm: hideDialog
                })
              }
              
              // 关闭表单弹窗
              setShowForm(false)
              setEditingToken(null)
            },
            onCancel: () => {
              hideDialog()
              // 关闭表单弹窗
              setShowForm(false)
              setEditingToken(null)
            }
          })
          return
        }
      }
      
      // 如果是新添加的 token，尝试获取账号信息
      if (!token.id || !editingToken) {
        try {
          const accountInfo = await window.electronAPI.getAccountInfo(token.token)
          if (accountInfo.success && accountInfo.accountInfo) {
            token.accountInfo = accountInfo.accountInfo
          } else {
            // 获取账号信息失败，检查是否是认证错误
            if (accountInfo.error === 'not_authenticated' || accountInfo.errorMessage?.includes('没有这个账号')) {
              showDialog({
                title: '添加失败',
                message: accountInfo.errorMessage || '没有这个账号，Token 无效或已过期',
                type: 'error',
                onConfirm: hideDialog
              })
              return // 阻止保存
            } else {
              // 其他错误，提示用户但允许保存
              showDialog({
                title: '警告',
                message: accountInfo.errorMessage || '未能获取账号信息，但可以继续保存',
                type: 'warning',
                onConfirm: hideDialog
              })
            }
          }
        } catch (error) {
          console.warn('获取账号信息失败:', error)
          showDialog({
            title: '错误',
            message: '获取账号信息时发生错误，请检查网络连接',
            type: 'error',
            onConfirm: hideDialog
          })
          return // 阻止保存
        }
      }
      
      // 生成两种格式的 Token（longTermToken 和 cookieFormat）
      // 无论是新增还是编辑，都确保生成两种格式
      try {
        if (!token.accountInfo) token.accountInfo = {}
        
        const inputToken = token.token.trim()
        
        // 判断输入的是哪种格式
        const isCookieFormat = inputToken.includes('%3A%3A') || inputToken.includes('::')
        const isJWT = inputToken.startsWith('eyJ')
        
        if (isCookieFormat) {
          // 如果输入的是 Cookie 格式，提取出 JWT 部分作为 longTermToken
          let jwtPart = inputToken
          if (inputToken.includes('%3A%3A')) {
            jwtPart = inputToken.split('%3A%3A')[1] || inputToken
          } else if (inputToken.includes('::')) {
            jwtPart = inputToken.split('::')[1] || inputToken
          }
          
          token.accountInfo.longTermToken = jwtPart
          token.accountInfo.cookieFormat = inputToken
          
          console.log('✅ 识别为 Cookie 格式，已提取 longTermToken')
        } else if (isJWT) {
          // 如果输入的是纯 JWT，需要转换为 Cookie 格式
          const convertResult = await window.electronAPI.convertTokenToCookie(inputToken)
          
          if (convertResult.success && convertResult.cookieFormat) {
            token.accountInfo.longTermToken = inputToken
            token.accountInfo.cookieFormat = convertResult.cookieFormat
            
            // 默认保存 Cookie 格式（更通用）
            token.token = convertResult.cookieFormat
            
            // 如果还没有 workosId，从转换结果中获取
            if (!token.accountInfo.id && convertResult.workosId) {
              token.accountInfo.id = convertResult.workosId
            }
            
            console.log('✅ 已将 JWT 转换为 Cookie 格式')
          } else {
            // 转换失败，只保存 longTermToken
            console.warn('⚠️ Cookie 格式转换失败，仅保存 longTermToken')
            token.accountInfo.longTermToken = inputToken
            token.accountInfo.cookieFormat = inputToken
          }
        } else {
          // 无法识别的格式，原样保存
          console.warn('⚠️ 无法识别 Token 格式，原样保存')
          token.accountInfo.longTermToken = inputToken
          token.accountInfo.cookieFormat = inputToken
        }
      } catch (error) {
        console.error('生成 Token 格式失败:', error)
        // 失败了也继续保存，只是缺少格式转换
        if (!token.accountInfo) token.accountInfo = {}
        token.accountInfo.longTermToken = token.token
        token.accountInfo.cookieFormat = token.token
      }
      
      await window.electronAPI.saveToken(token)
      await loadTokens()
      setShowForm(false)
      setEditingToken(null)
      
      // 显示成功提示
      const accountEmail = token.accountInfo?.email || '未命名账号'
      const isNewToken = !editingToken
      showDialog({
        title: '成功',
        message: isNewToken 
          ? `已成功添加账号 "${accountEmail}"` 
          : `已成功更新账号 "${accountEmail}"`,
        type: 'info',
        onConfirm: hideDialog
      })
    } catch (error) {
      console.error('保存token失败:', error)
      showDialog({
        title: '错误',
        message: '保存token失败，请重试',
        type: 'error',
        onConfirm: hideDialog
      })
    }
  }

  const handleDeleteToken = async (id: string) => {
    try {
      await window.electronAPI.deleteToken(id)
      await loadTokens()
    } catch (error) {
      console.error('删除token失败:', error)
    }
  }

  // 批量清理 Free 账号
  const handleClearFreeAccounts = async () => {
    try {
      // 筛选出所有 free 账号（只统计订阅类型严格等于 free 的账号）
      const freeTokens = tokens.filter(t => {
        const plan = t.accountInfo?.plan?.toLowerCase() || ''
        const subscription = t.accountInfo?.subscriptionStatus?.toLowerCase() || ''
        return plan === 'free' || subscription === 'free'
      })

      if (freeTokens.length === 0) {
        showDialog({
          title: '提示',
          message: '没有 Free 账号需要清理',
          type: 'info',
          onConfirm: hideDialog
        })
        return
      }

      console.log(`开始清理 ${freeTokens.length} 个 Free 账号...`)

      // 批量删除
      let successCount = 0
      let failCount = 0

      for (const token of freeTokens) {
        try {
          await window.electronAPI.deleteToken(token.id)
          successCount++
        } catch (error) {
          console.error(`删除账号 ${token.accountInfo?.email || token.id} 失败:`, error)
          failCount++
        }
      }

      // 重新加载账号列表
      await loadTokens()

      // 显示结果
      showDialog({
        title: '清理完成',
        message: `成功清理 ${successCount} 个 Free 账号${failCount > 0 ? `，失败 ${failCount} 个` : ''}`,
        type: successCount > 0 ? 'info' : 'error',
        onConfirm: hideDialog
      })

      console.log(`清理完成: 成功 ${successCount} 个，失败 ${failCount} 个`)
    } catch (error) {
      console.error('清理 Free 账号失败:', error)
      showDialog({
        title: '错误',
        message: '清理 Free 账号时发生错误',
        type: 'error',
        onConfirm: hideDialog
      })
    }
  }

  const handleSetActive = async (id: string) => {
    try {
      // 先找到要切换的 token，以便显示账号名称
      const targetToken = tokens.find(t => t.id === id)
      const accountName = targetToken?.accountInfo?.email || '未命名账号'
      
      // 重置进度状态并显示
      setProgressModal({
        show: true,
        step: 'INIT',
        progress: 0,
        message: '准备切换账号...'
      })
      
      await window.electronAPI.setActiveToken(id)
      
      // 切换 Cursor 编辑器账号
      // 根据设置决定是否重置机器码和清理历史
      const result = await window.electronAPI.switchCursorAccount(id, {
        resetMachineId: settings.switchResetMachineId,
        clearHistory: settings.switchClearHistory
      })
      
      if (result.success) {
        // 将被切换的账号移动到列表最上面
        setTokens(prevTokens => {
          const tokenIndex = prevTokens.findIndex(t => t.id === id)
          if (tokenIndex === -1) {
            return prevTokens
          }
          
          // 找到要移动的 token
          const activeToken = prevTokens[tokenIndex]
          
          // 创建新数组：将 activeToken 放在最前面，其他保持原顺序
          const newTokens = [
            { ...activeToken, isActive: true },
            ...prevTokens.filter((_, index) => index !== tokenIndex).map(t => ({ ...t, isActive: false }))
          ]
          
          // 保存更新后的 tokens 顺序（异步保存，不阻塞 UI）
          newTokens.forEach(token => {
            window.electronAPI.saveToken(token).catch(err => {
              console.error(`保存 token ${token.id} 失败:`, err)
            })
          })
          
          return newTokens
        })
        
        // 进度条会在收到 DONE 事件后自动关闭
        // 如果没有收到 DONE 事件（极少数情况），这里做个兜底
        setTimeout(() => {
          setProgressModal(prev => {
            if (prev.show) return { ...prev, show: false }
            return prev
          })
          
          // 显示成功提示
          showDialog({
            title: '切换成功',
            message: `已切换到账号: ${accountName}\nCursor 即将自动重启...`,
            type: 'info',
            onConfirm: hideDialog
          })
        }, 1000)
        
      } else {
        // 失败时关闭进度条
        setProgressModal(prev => ({ ...prev, show: false }))
        
        // 如果后端提示需要配置 Cursor 路径，则引导用户打开设置
        if ((result as any).needCursorPath) {
          throw new Error(
            (result as any).error ||
            '未能找到 Cursor 安装/数据路径，请在右上角“设置”中手动配置 Cursor 路径后重试。'
          )
        }
        throw new Error(result.error || '切换账号失败')
      }
    } catch (error: any) {
      console.error('设置激活token失败:', error)
      // 发生错误时确保关闭进度条
      setProgressModal(prev => ({ ...prev, show: false }))
      
      showDialog({
        title: '错误',
        message: error.message || '切换账号失败，请检查 Cursor 编辑器是否已安装，或在“设置”中手动配置 Cursor 路径后重试。',
        type: 'error',
        onConfirm: () => {
          hideDialog()
          // 如果是路径相关错误，自动打开设置，方便用户修改
          if (String(error.message || '').includes('路径')) {
            setCurrentPage('settings')
          }
        }
      })
    }
  }

  const handleCheckUsage = async (id: string) => {
    // 找到对应的 token 以显示账号信息
    const token = tokens.find(t => t.id === id)
    const accountName = token?.accountInfo?.email || '未命名账号'
    
    // 显示加载提示
    showDialog({
      title: '正在更新',
      message: `正在更新 "${accountName}" 的用量信息...`,
      type: 'info',
      onConfirm: undefined,
      onCancel: undefined
    })
    
    try {
      const result = await window.electronAPI.checkTokenUsage(id)
      if (result.success && result.usage) {
        // 更新 token 的用量信息和 accountInfo 中的 quota 信息
        const updatedTokens = tokens.map(t => {
          if (t.id === id) {
            const updatedToken: Token = { 
              ...t, 
              usage: result.usage 
            }
            // 同时更新 accountInfo 中的 quota
            if (t.accountInfo) {
              updatedToken.accountInfo = {
                ...t.accountInfo,
                quota: {
                  used: result.usage?.used,
                  limit: result.usage?.limit,
                  remaining: result.usage?.remaining
                }
              }
            }
            return updatedToken
          }
          return t
        })
        setTokens(updatedTokens)
        
        // 显示成功提示
        hideDialog()
        showDialog({
          title: '更新成功',
          message: `已成功更新 "${accountName}" 的用量信息`,
          type: 'info',
          onConfirm: hideDialog
        })
      } else {
        hideDialog()
        showDialog({
          title: '错误',
          message: result.error || '检查用量失败',
          type: 'error',
          onConfirm: hideDialog
        })
      }
    } catch (error) {
      console.error('检查用量失败:', error)
      hideDialog()
      showDialog({
        title: '错误',
        message: '检查用量失败，请检查网络连接',
        type: 'error',
        onConfirm: hideDialog
      })
    }
  }

  const handleEdit = (token: Token) => {
    setEditingToken(token)
    setShowForm(true)
  }

  const handleAddNew = () => {
    setEditingToken(null)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingToken(null)
  }

  const handleSaveSettings = async (newSettings: { cursorAppPath?: string; batchRefreshSize?: number; switchResetMachineId?: boolean; switchClearHistory?: boolean }) => {
    try {
      const mergedSettings = {
        ...settings,
        cursorAppPath: newSettings.cursorAppPath ?? settings.cursorAppPath,
        batchRefreshSize: newSettings.batchRefreshSize ?? settings.batchRefreshSize,
        switchResetMachineId: newSettings.switchResetMachineId ?? settings.switchResetMachineId,
        switchClearHistory: newSettings.switchClearHistory ?? settings.switchClearHistory
      }
      await window.electronAPI.saveSettings(mergedSettings)
      setSettings(mergedSettings)
      
      showDialog({
        title: '设置已保存',
        message: '设置已成功更新',
        type: 'info',
        onConfirm: hideDialog
      })
    } catch (error) {
      console.error('保存设置失败:', error)
      showDialog({
        title: '错误',
        message: '保存设置失败，请重试',
        type: 'error',
        onConfirm: hideDialog
      })
    }
  }

  const handleCloseRefreshLog = () => {
    // 关闭日志弹窗时，显示刷新结果统计
    const successCount = refreshLogModal.logs.filter(log => log.status === 'success').length
    const failCount = refreshLogModal.logs.filter(log => log.status === 'failed').length
    
    setRefreshLogModal({
      show: false,
      logs: [],
      progress: { current: 0, total: 0 }
    })
    
    // 显示统计结果
    let message = `✅ 成功: ${successCount} 个\n❌ 失败: ${failCount} 个`
    if (failCount > 0) {
      message += '\n\n失败的账号已在列表中标记为红色，点击账号卡片上的刷新按钮可单独重试'
    }
    
    showDialog({
      title: '刷新完成',
      message: message,
      type: failCount > 0 ? 'warning' : 'info',
      onConfirm: hideDialog
    })
  }

  return (
    <div className="app">
      <TitleBar />
      <div className="app-layout">
        <Sidebar 
          currentPage={currentPage} 
          onPageChange={setCurrentPage}
          tokensCount={tokens.length}
          updateInfo={updateInfo}
        />
        
        <div className="app-main">
          {currentPage === 'home' && (
            <HomePage
              tokens={tokens}
              onNavigate={setCurrentPage}
              onAddAccount={handleAddNew}
              onRefreshAll={() => refreshAllUsage(true)}
              onSyncLocal={() => handleSyncAccount(true)}
            />
          )}
          
          {currentPage === 'accounts' && (
            <AccountManagePage
              tokens={tokens}
              onAddAccount={handleAddNew}
              onEditToken={handleEdit}
              onDeleteToken={handleDeleteToken}
              onSetActive={handleSetActive}
              onRefreshUsage={handleCheckUsage}
              onSyncLocal={() => handleSyncAccount(true)}
              onRefreshAll={() => refreshAllUsage(true)}
              onClearFreeAccounts={handleClearFreeAccounts}
              onShowDialog={showDialog}
            />
          )}
          
          {currentPage === 'settings' && (
            <SettingsPage
              settings={settings}
              tokensCount={tokens.length}
              onSave={handleSaveSettings}
            />
          )}
          
          {currentPage === 'faq' && (
            <FAQPage />
          )}
          
          {currentPage === 'system' && (
            <SystemManagePage updateInfo={updateInfo} />
          )}
        </div>
      </div>
      
      <TokenFormModal
        show={showForm}
        token={editingToken}
        onSave={handleSaveToken}
        onCancel={handleCancel}
        onShowDialog={showDialog}
      />
      
      <Dialog
        show={dialog.show}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
      />
      
      <ProgressModal
        show={progressModal.show}
        step={progressModal.step}
        progress={progressModal.progress}
        message={progressModal.message}
      />
      
      <RefreshLogModal
        show={refreshLogModal.show}
        logs={refreshLogModal.logs}
        progress={refreshLogModal.progress}
        onClose={handleCloseRefreshLog}
      />
    </div>
  )
}

export default App


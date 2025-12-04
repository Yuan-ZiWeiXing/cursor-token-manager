import { app, BrowserWindow, ipcMain, session, dialog } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync, readFileSync, writeFileSync, readdirSync, rmSync, rmdirSync } from 'fs'
import { homedir } from 'os'
import Store from 'electron-store'
import Database from 'better-sqlite3'
import crypto from 'crypto'
import { exec } from 'child_process'

// 扫描 Cursor 程序路径的结果类型
interface ScanResult {
  cursorAppPath: string | null
  cursorDbPath: string | null
  scannedPaths: string[]
  foundPaths: string[]
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 确保在开发环境中也能正确解析路径
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// 初始化electron-store用于数据持久化
const store = new Store()

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // 获取 preload 脚本路径
  // 优先使用 .cjs 文件（CommonJS格式，兼容性更好）
  const preloadPathCjs = path.join(__dirname, 'preload.cjs')
  const preloadPathJs = path.join(__dirname, 'preload.js')
  
  // 检查文件是否存在，优先使用 .cjs
  let preloadPath: string
  if (existsSync(preloadPathCjs)) {
    preloadPath = preloadPathCjs
    console.log(`使用 Preload 文件 (CJS): ${preloadPath}`)
  } else if (existsSync(preloadPathJs)) {
    preloadPath = preloadPathJs
    console.log(`使用 Preload 文件 (JS): ${preloadPath}`)
  } else {
    console.error(`Preload 文件不存在: ${preloadPathCjs} 或 ${preloadPathJs}`)
    console.error(`当前 __dirname: ${__dirname}`)
    console.error('请确保已运行: npm run electron:compile')
    // 使用默认路径，即使文件不存在也继续（让 Electron 报错）
    preloadPath = preloadPathJs
  }

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 1500,
    height: 850,
    minWidth: 1500,
    minHeight: 850,
    frame: false, // 无边框窗口，实现Mac风格
    backgroundColor: '#00000000',
    transparent: true,
    roundedCorners: true, // Windows 圆角支持
    icon: path.join(__dirname, isDev ? '../logo.ico' : '../logo.ico'), // 窗口图标
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true
    }
  }

  // Mac特定选项
  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.vibrancy = 'under-window'
    windowOptions.visualEffectState = 'active'
  }

  mainWindow = new BrowserWindow(windowOptions)

  // 开发环境加载本地服务器，生产环境加载打包后的文件
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Token管理相关的IPC处理
ipcMain.handle('get-tokens', () => {
  return store.get('tokens', [])
})

ipcMain.handle('save-token', (_, token: { id: string; name: string; token: string; isActive: boolean }) => {
  const tokens = store.get('tokens', []) as any[]
  const existingIndex = tokens.findIndex(t => t.id === token.id)
  
  if (existingIndex >= 0) {
    tokens[existingIndex] = token
  } else {
    tokens.push(token)
  }
  
  store.set('tokens', tokens)
  return { success: true }
})

ipcMain.handle('delete-token', (_, id: string) => {
  const tokens = store.get('tokens', []) as any[]
  const filtered = tokens.filter(t => t.id !== id)
  store.set('tokens', filtered)
  return { success: true }
})

ipcMain.handle('set-active-token', (_, id: string) => {
  const tokens = store.get('tokens', []) as any[]
  tokens.forEach(token => {
    token.isActive = token.id === id
  })
  store.set('tokens', tokens)
  return { success: true }
})

// 从 token 字符串中提取实际的 token 值
function extractTokenValue(tokenString: string): string {
  let token = tokenString.trim()
  
  // 如果包含 WorkosCursorSessionToken=，提取后面的值
  if (token.includes('WorkosCursorSessionToken=')) {
    const match = token.match(/WorkosCursorSessionToken=([^;]+)/)
    if (match && match[1]) {
      token = decodeURIComponent(match[1])
    }
  }
  
  // 如果包含 %3A%3A 或 ::，提取 JWT 部分（去除 workosId 前缀）
  if (token.includes('%3A%3A')) {
    const parts = token.split('%3A%3A')
    if (parts.length === 2 && parts[1]) {
      return parts[1]  // 返回纯 JWT
    }
  } else if (token.includes('::')) {
    const parts = token.split('::')
    if (parts.length === 2 && parts[1]) {
      return parts[1]  // 返回纯 JWT
    }
  }
  
  // 如果已经是纯 JWT，直接返回
  return token
}

// 生成 PKCE 所需的 code_verifier 和 code_challenge
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // 生成 43-128 字符的随机字符串作为 code_verifier
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  
  // 计算 code_challenge = SHA256(code_verifier) 的 base64url 编码
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')
  
  return { codeVerifier, codeChallenge }
}

// 生成 UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 生成随机 Machine ID (64字符 hex)
function generateMachineId(): string {
  return crypto.randomBytes(32).toString('hex')
}

// 获取 Cursor 安装目录下的 main.js 路径
function getCursorMainJsPath(cursorAppPath?: string): string | null {
  const platform = process.platform
  let basePath = ''

  if (cursorAppPath) {
    // 如果提供了具体的 Cursor 程序路径，尝试从中推断
    // Windows: .../Cursor.exe -> .../resources/app/out/main.js
    // Mac: .../Cursor.app -> .../Contents/Resources/app/out/main.js
    if (platform === 'win32') {
      basePath = path.join(path.dirname(cursorAppPath), 'resources', 'app', 'out', 'main.js')
    } else if (platform === 'darwin') {
      // 如果是 Cursor.app 目录
      if (cursorAppPath.endsWith('.app')) {
        basePath = path.join(cursorAppPath, 'Contents', 'Resources', 'app', 'out', 'main.js')
      } else {
        // 可能是 Cursor.app/Contents/MacOS/Cursor
        basePath = path.join(path.dirname(path.dirname(path.dirname(cursorAppPath))), 'Resources', 'app', 'out', 'main.js')
      }
    } else {
      // Linux: .../cursor -> .../resources/app/out/main.js
      basePath = path.join(path.dirname(cursorAppPath), 'resources', 'app', 'out', 'main.js')
    }
  } else {
    // 尝试默认路径
    if (platform === 'win32') {
      basePath = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor', 'resources', 'app', 'out', 'main.js')
    } else if (platform === 'darwin') {
      basePath = '/Applications/Cursor.app/Contents/Resources/app/out/main.js'
    } else {
      // Linux 默认路径比较多变，暂时略过
    }
  }

  if (basePath && existsSync(basePath)) {
    return basePath
  }
  return null
}

// 重置机器码
async function resetMachineId(dbPath: string): Promise<{ success: boolean; error?: string; newIds?: any }> {
  try {
    console.log('🛡️ 开始重置机器码...')
    
    // 1. 修改 storage.json
    const globalStoragePath = path.dirname(dbPath)
    const storageJsonPath = path.join(globalStoragePath, 'storage.json')
    
    if (!existsSync(storageJsonPath)) {
      return { success: false, error: '找不到 storage.json' }
    }
    
    let storageData: any = {}
    try {
      const content = readFileSync(storageJsonPath, 'utf-8')
      storageData = JSON.parse(content)
    } catch (e) {
      console.warn('读取 storage.json 失败，将创建新对象')
    }
    
    // 生成新 ID
    const newIds = {
      'telemetry.machineId': generateMachineId(),
      'telemetry.macMachineId': generateMachineId(),
      'telemetry.devDeviceId': generateUUID(),
      'telemetry.sqmId': `{${generateUUID().toUpperCase()}}` // 通常是 {UUID} 格式
    }
    
    // 更新 storage.json
    storageData = { ...storageData, ...newIds }
    writeFileSync(storageJsonPath, JSON.stringify(storageData, null, 4), 'utf-8')
    console.log('✅ storage.json 已更新')
    
    // 2. 对 main.js 打补丁 (如果能找到)
    const settings = store.get('settings', {}) as any
    const mainJsPath = getCursorMainJsPath(settings.cursorAppPath)
    
    if (mainJsPath) {
      console.log('🔧 找到 main.js，正在打补丁:', mainJsPath)
      
      try {
        // 备份原始文件（如果还没有备份）
        const backupPath = mainJsPath + '.backup'
        if (!existsSync(backupPath)) {
          const originalContent = readFileSync(mainJsPath, 'utf-8')
          writeFileSync(backupPath, originalContent, 'utf-8')
          console.log('✅ 已创建 main.js 备份:', backupPath)
        }
        
        let mainJsContent = readFileSync(mainJsPath, 'utf-8')
        let modified = false
        let patchedCount = 0
        
        // 策略1: 查找并替换 getMachineId() 函数
        // 常见模式：getMachineId(){...} 或 getMachineId:function(){...} 或 getMachineId(){return ...}
        // 由于代码可能是压缩的，我们匹配到函数体的闭合大括号
        
        // 正则模式1: getMachineId(){...} - 匹配整个函数体（简单版本，只匹配一层大括号）
        const getMachineIdRegex1 = /getMachineId\s*\(\s*\)\s*\{[^}]+\}/g
        const match1 = mainJsContent.match(getMachineIdRegex1)
        if (match1) {
          mainJsContent = mainJsContent.replace(
            getMachineIdRegex1,
            `getMachineId(){return"${newIds['telemetry.machineId']}"}`
          )
          patchedCount++
          console.log('✅ 已替换 getMachineId()')
        }
        
        // 正则模式2: getMacMachineId(){...}
        const getMacMachineIdRegex1 = /getMacMachineId\s*\(\s*\)\s*\{[^}]+\}/g
        const match2 = mainJsContent.match(getMacMachineIdRegex1)
        if (match2) {
          mainJsContent = mainJsContent.replace(
            getMacMachineIdRegex1,
            `getMacMachineId(){return"${newIds['telemetry.macMachineId']}"}`
          )
          patchedCount++
          console.log('✅ 已替换 getMacMachineId()')
        }
        
        // 策略2: 如果上面的正则没有匹配到，尝试更宽松的模式
        // 查找形如 getMachineId:function() 或 getMachineId=function() 的模式
        if (patchedCount === 0) {
          const altRegex1 = /(getMachineId\s*[:=]\s*function\s*\(\s*\)\s*\{)[^}]+(\})/g
          const match3 = mainJsContent.match(altRegex1)
          if (match3) {
            mainJsContent = mainJsContent.replace(
              altRegex1,
              `$1return"${newIds['telemetry.machineId']}"$2`
            )
            patchedCount++
            console.log('✅ 已替换 getMachineId() (function 模式)')
          }
          
          const altRegex2 = /(getMacMachineId\s*[:=]\s*function\s*\(\s*\)\s*\{)[^}]+(\})/g
          const match4 = mainJsContent.match(altRegex2)
          if (match4) {
            mainJsContent = mainJsContent.replace(
              altRegex2,
              `$1return"${newIds['telemetry.macMachineId']}"$2`
            )
            patchedCount++
            console.log('✅ 已替换 getMacMachineId() (function 模式)')
          }
        }
        
        // 策略3: 箭头函数模式 getMachineId=()=>{...}
        if (patchedCount === 0) {
          const arrowRegex1 = /(getMachineId\s*=\s*\(\s*\)\s*=>\s*\{)[^}]+(\})/g
          const match5 = mainJsContent.match(arrowRegex1)
          if (match5) {
            mainJsContent = mainJsContent.replace(
              arrowRegex1,
              `$1return"${newIds['telemetry.machineId']}"$2`
            )
            patchedCount++
            console.log('✅ 已替换 getMachineId() (箭头函数)')
          }
          
          const arrowRegex2 = /(getMacMachineId\s*=\s*\(\s*\)\s*=>\s*\{)[^}]+(\})/g
          const match6 = mainJsContent.match(arrowRegex2)
          if (match6) {
            mainJsContent = mainJsContent.replace(
              arrowRegex2,
              `$1return"${newIds['telemetry.macMachineId']}"$2`
            )
            patchedCount++
            console.log('✅ 已替换 getMacMachineId() (箭头函数)')
          }
        }
        
        modified = patchedCount > 0
        
        if (modified) {
          // 写回修改后的内容
          writeFileSync(mainJsPath, mainJsContent, 'utf-8')
          console.log('✅ main.js 补丁已应用！')
        } else {
          console.warn('⚠️ 未找到 getMachineId/getMacMachineId 函数，可能代码结构已变化')
          console.log('💡 仅 storage.json 已更新，可能需要手动检查 main.js')
        }
      } catch (patchError: any) {
        console.error('❌ main.js 补丁应用失败:', patchError.message)
        console.log('💡 已更新 storage.json，但 main.js 未修改')
      }
    } else {
      console.warn('⚠️ 未找到 main.js，跳过补丁（仅更新了 storage.json）')
    }
    
    return { success: true, newIds }
  } catch (error: any) {
    console.error('重置机器码失败:', error)
    return { success: false, error: error.message }
  }
}

// 清理历史记录
async function clearHistory(dbPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('🧹 开始清理历史记录...')
    
    const globalStoragePath = path.dirname(dbPath) // .../User/globalStorage
    const userPath = path.dirname(globalStoragePath) // .../User
    
    const deletePath = (target: string) => {
      try {
        rmSync(target, { recursive: true, force: true })
      } catch (error) {
        try {
          rmdirSync(target, { recursive: true })
        } catch (fallbackError) {
          console.warn(`⚠️ 无法删除 ${target}:`, fallbackError)
        }
      }
    }

    // 1. 清空 History 目录
    const historyPath = path.join(userPath, 'History')
    if (existsSync(historyPath)) {
      const files = readdirSync(historyPath)
      for (const file of files) {
        const fullPath = path.join(historyPath, file)
        deletePath(fullPath)
      }
      console.log('✅ History 目录已清空')
    }
    
    // 2. 清空 workspaceStorage 目录
    const workspaceStoragePath = path.join(userPath, 'workspaceStorage')
    if (existsSync(workspaceStoragePath)) {
      const files = readdirSync(workspaceStoragePath)
      for (const file of files) {
        const fullPath = path.join(workspaceStoragePath, file)
        deletePath(fullPath)
      }
      console.log('✅ workspaceStorage 目录已清空')
    }
    
    // 3. 删除 state.vscdb (和 backup)
    // 注意：如果数据库正被占用（虽然我们之前应该已经杀进程了），可能会失败
    try {
      if (existsSync(dbPath)) {
        deletePath(dbPath)
        console.log('✅ state.vscdb 已删除')
      }
      const dbBackupPath = dbPath + '.backup'
      if (existsSync(dbBackupPath)) {
        deletePath(dbBackupPath)
        console.log('✅ state.vscdb.backup 已删除')
      }
    } catch (e) {
      console.warn('⚠️ 删除数据库文件失败 (可能被占用):', e)
    }
    
    return { success: true }
  } catch (error: any) {
    console.error('清理历史记录失败:', error)
    return { success: false, error: error.message }
  }
}

// 结束 Cursor 进程
function killCursorIfRunning(): Promise<void> {
  const platform = process.platform
  return new Promise((resolve) => {
    if (platform === 'darwin') {
      exec(`osascript -e 'tell application "Cursor" to quit'`, () => {
        exec(`pkill -f "Cursor.app" || true`, () => setTimeout(resolve, 500))
      })
    } else if (platform === 'win32') {
      exec(`taskkill /IM Cursor.exe /F >NUL 2>&1`, () => setTimeout(resolve, 500))
    } else {
      exec(`pkill -f cursor || true`, () => setTimeout(resolve, 500))
    }
  })
}

// 重启 Cursor 客户端（优先使用设置中的 cursorAppPath）
function restartCursorClient() {
  try {
    const settings = store.get('settings', {}) as any
    const customAppPath = settings.cursorAppPath as string | undefined
    const platform = process.platform

    if (platform === 'darwin') {
      // 杀进程后重新启动
      killCursorIfRunning().then(() => {
        setTimeout(() => {
          if (customAppPath && existsSync(customAppPath)) {
            exec(`open -a "${customAppPath}"`)
          } else {
            exec(`open -a Cursor`)
          }
        }, 300)
      })
    } else if (platform === 'win32') {
      killCursorIfRunning().then(() => {
        setTimeout(() => {
          let appPath = ''
          if (customAppPath && existsSync(customAppPath)) {
            appPath = customAppPath
          } else {
            const localApp = process.env.LOCALAPPDATA || ''
            const defaultPath = path.join(localApp, 'Programs', 'cursor', 'Cursor.exe')
            const altPath = path.join('C:', 'Program Files', 'Cursor', 'Cursor.exe')
            appPath = existsSync(defaultPath) ? defaultPath : altPath
          }
          exec(`start "" "${appPath}"`, { shell: 'cmd.exe' })
        }, 300)
      })
    } else {
      killCursorIfRunning().then(() => {
        setTimeout(() => {
          if (customAppPath && existsSync(customAppPath)) {
            exec(`"${customAppPath}" >/dev/null 2>&1 &`)
          } else {
            exec(`(command -v cursor && cursor) || (command -v AppImageLauncher && AppImageLauncher) >/dev/null 2>&1 &`)
          }
        }, 300)
      })
    }
  } catch (e) {
    console.warn('⚠️ 重启 Cursor 客户端失败（忽略）:', (e as any)?.message)
  }
}

// 获取长效 Token（通过 PKCE 流程）
async function getLongTermToken(sessionToken: string): Promise<{ success: boolean; accessToken?: string; refreshToken?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      // 1. 生成 PKCE 参数
      const { codeVerifier, codeChallenge } = generatePKCE()
      const uuid = generateUUID()
      
      console.log('🔄 开始 PKCE 流程获取长效 Token...')
      console.log('  - UUID:', uuid)
      console.log('  - Code Challenge:', codeChallenge.substring(0, 20) + '...')
      
      // 2. 构建 loginDeepControl URL（根据文档，使用 /cn/loginDeepControl，参数名为 challenge 和 uuid，添加 mode=login）
      const deepLinkUrl = `https://cursor.com/cn/loginDeepControl?challenge=${codeChallenge}&uuid=${uuid}&mode=login`
      console.log('  - Deep Link URL:', deepLinkUrl)
      
      // 3. 提取 session token 值
      let cookieValue = sessionToken
      if (cookieValue.includes('WorkosCursorSessionToken=')) {
        // 提取 token 值部分
        const match = cookieValue.match(/WorkosCursorSessionToken=([^;]+)/)
        if (match) {
          cookieValue = match[1]
        }
      }
      
      // 4. 创建 BrowserWindow 来访问 URL 并注入 Cookie
      // 显示窗口以便用户可以看到授权页面（如果自动点击失败）
      const authWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: false, // 隐藏窗口，在后台运行
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
      
      // 窗口标题（虽然不显示，但设置一下）
      authWindow.setTitle('Cursor 账号授权 - 正在获取长效 Token...')
      
      // 设置 Cookie（根据文档，httpOnly 应该是 true）
      const cookie = {
        url: 'https://cursor.com',
        name: 'WorkosCursorSessionToken',
        value: cookieValue,
        domain: '.cursor.com',
        path: '/',
        secure: true,
        httpOnly: true, // 根据文档要求
        sameSite: 'lax' as const
      }
      
      session.defaultSession.cookies.set(cookie).then(() => {
        console.log('✅ Cookie 已注入')
        
        // 5. 加载 URL
        authWindow.loadURL(deepLinkUrl)
        
        // 监听页面加载完成
        authWindow.webContents.once('did-finish-load', () => {
          console.log('✅ 页面加载完成，等待授权...')
          
          // 6. 尝试自动点击授权按钮
          // 使用多次尝试，因为页面可能需要时间渲染
          let clickAttempts = 0
          const maxClickAttempts = 10
          
          const tryClickButton = () => {
            clickAttempts++
            console.log(`尝试点击授权按钮 (${clickAttempts}/${maxClickAttempts})...`)
            
            authWindow.webContents.executeJavaScript(`
              (function() {
                // 查找所有可能的授权按钮
                const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]'))
                console.log('找到按钮数量:', buttons.length)
                
                // 打印所有按钮的文本，用于调试
                buttons.forEach((btn, idx) => {
                  console.log(\`按钮[\${idx}]: \${btn.textContent || btn.value || '无文本'} - \${btn.tagName} - \${btn.className}\`)
                })
                
                // 尝试匹配多种文本模式（优先匹配 "Yes, Log In"）
                const button = buttons.find(btn => {
                  const text = (btn.textContent || btn.value || '').trim()
                  const textLower = text.toLowerCase()
                  
                  // 优先匹配 "Yes, Log In" 或包含 "Yes" 和 "Log In" 的按钮
                  if (textLower.includes('yes') && textLower.includes('log in')) {
                    return true
                  }
                  if (textLower.includes('yes') && textLower.includes('login')) {
                    return true
                  }
                  if (text === 'Yes, Log In' || text === 'Yes, Login') {
                    return true
                  }
                  
                  // 其他可能的匹配
                  return (
                    textLower.includes('yes') ||
                    textLower.includes('log in') ||
                    textLower.includes('login') ||
                    textLower.includes('授权') ||
                    textLower.includes('确认') ||
                    textLower.includes('allow') ||
                    textLower.includes('approve') ||
                    btn.getAttribute('data-testid')?.includes('confirm') ||
                    btn.getAttribute('data-testid')?.includes('authorize') ||
                    btn.classList.contains('primary') ||
                    btn.classList.contains('confirm')
                  )
                })
                
                if (button) {
                  console.log('找到授权按钮:', button.textContent || button.value)
                  // 尝试多种点击方式
                  try {
                    button.click()
                  } catch (e1) {
                    try {
                      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                    } catch (e2) {
                      try {
                        const clickEvent = new Event('click', { bubbles: true, cancelable: true })
                        button.dispatchEvent(clickEvent)
                      } catch (e3) {
                        console.error('所有点击方式都失败')
                      }
                    }
                  }
                  return '点击成功: ' + (button.textContent || button.value || '')
                }
                
                return '未找到授权按钮'
              })()
            `).then((result) => {
              console.log('自动点击结果:', result)
              if (result && result.includes('成功')) {
                authWindow.setTitle('Cursor 账号授权 - 已点击授权，等待确认...')
                console.log('✅ 授权按钮已点击，开始轮询...')
              } else if (clickAttempts < maxClickAttempts) {
                // 如果没找到，继续尝试
                setTimeout(tryClickButton, 1000)
              } else {
                console.warn('⚠️ 多次尝试后仍未找到授权按钮，请手动点击')
                authWindow.setTitle('Cursor 账号授权 - 请手动点击 "Yes, Log In" 按钮')
              }
            }).catch((err) => {
              console.warn('自动点击失败:', err)
              if (clickAttempts < maxClickAttempts) {
                setTimeout(tryClickButton, 1000)
              } else {
                authWindow.setTitle('Cursor 账号授权 - 请手动点击授权按钮')
              }
            })
          }
          
          // 延迟开始尝试，确保页面完全渲染
          setTimeout(tryClickButton, 2000)
        })
        
          // 7. 后台轮询 API
          let pollAttempts = 0
          const maxAttempts = 10 // 最多轮询 10 次（根据文档建议）
          const pollInterval = 2000 // 每 2 秒轮询一次（根据文档建议）
        
        // 延迟开始轮询，给页面加载和点击留出时间
        setTimeout(() => {
          const pollForToken = setInterval(async () => {
            pollAttempts++
            
            try {
              if (pollAttempts % 10 === 0 || pollAttempts <= 5) {
                console.log(`🔄 轮询尝试 ${pollAttempts}/${maxAttempts}...`)
              }
              
              // 根据文档，参数名应该是 verifier 而不是 code_verifier
              const pollUrl = `https://api2.cursor.sh/auth/poll?uuid=${encodeURIComponent(uuid)}&verifier=${encodeURIComponent(codeVerifier)}`
              console.log('轮询 URL:', pollUrl.replace(codeVerifier, codeVerifier.substring(0, 10) + '...'))
              
              // 生成动态追踪 ID（根据文档要求）
              const traceId = crypto.randomBytes(16).toString('hex')
              const parentId = crypto.randomBytes(8).toString('hex')
              const traceparent = `00-${traceId}-${parentId}-00`
              
              // 根据文档构建完整的请求头
              const response = await fetch(pollUrl, {
                method: 'GET',
                headers: {
                  'Host': 'api2.cursor.sh',
                  'Origin': 'vscode-file://vscode-app',
                  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Cursor/1.2.2 Chrome/132.0.6834.210 Electron/34.5.1 Safari/537.36',
                  'accept': '*/*',
                  'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
                  'sec-ch-ua-mobile': '?0',
                  'sec-ch-ua-platform': '"macOS"',
                  'sec-fetch-site': 'cross-site',
                  'sec-fetch-mode': 'cors',
                  'sec-fetch-dest': 'empty',
                  'accept-language': 'zh-CN',
                  'traceparent': traceparent,
                  'x-ghost-mode': 'true',
                  'x-new-onboarding-completed': 'false'
                }
              })
              
              if (response.ok) {
                const data = await response.json() as any
                console.log('✅ 轮询成功! 响应数据:', Object.keys(data))
                console.log('完整响应:', JSON.stringify(data, null, 2))
                
                // 提取 access_token 和 refresh_token（根据文档，响应字段是 accessToken 和 refreshToken）
                const accessToken = data.accessToken || data.access_token || data.token
                const refreshToken = data.refreshToken || data.refresh_token || data.refresh
                
                // 清理
                clearInterval(pollForToken)
                
                if (accessToken && refreshToken) {
                  console.log('✅ 长效 Token 获取成功!')
                  authWindow.setTitle('Cursor 账号授权 - 授权成功!')
                  // 延迟关闭窗口，让用户看到成功提示
                  setTimeout(() => {
                    authWindow.close()
                  }, 1500)
                  
                  resolve({
                    success: true,
                    accessToken,
                    refreshToken
                  })
                } else {
                  console.error('❌ 响应中缺少 Token:', data)
                  authWindow.close()
                  resolve({
                    success: false,
                    error: '响应中缺少 access_token 或 refresh_token。响应: ' + JSON.stringify(data)
                  })
                }
              } else {
                const errorText = await response.text().catch(() => '无法读取错误信息')
                if (response.status === 404 || response.status === 400) {
                  // 继续轮询（这是正常的，表示还在等待授权）
                  if (pollAttempts % 10 === 0 || pollAttempts <= 5) {
                    console.log(`⏳ 等待授权确认... (${pollAttempts}/${maxAttempts}) - 状态: ${response.status}`)
                  }
                } else {
                  console.warn(`⚠️ 轮询返回状态码: ${response.status}, 错误: ${errorText}`)
                }
              }
            } catch (error: any) {
              console.warn(`⚠️ 轮询请求失败 (${pollAttempts}/${maxAttempts}):`, error.message)
            }
            
            // 如果超过最大尝试次数，停止轮询
            if (pollAttempts >= maxAttempts) {
              clearInterval(pollForToken)
              authWindow.setTitle('Cursor 账号授权 - 超时，请重试')
              setTimeout(() => {
                authWindow.close()
              }, 2000)
              resolve({
                success: false,
                error: '轮询超时，未能获取长效 Token。请确保已点击 "Yes, Log In" 按钮。'
              })
            }
          }, pollInterval)
          
          // 保存 interval ID，以便在窗口关闭时清理
          ;(authWindow as any)._pollInterval = pollForToken
        }, 5000) // 延迟 5 秒开始轮询，给页面加载和点击留出时间
        
        // 监听窗口关闭
        authWindow.on('closed', () => {
          if ((authWindow as any)._pollInterval) {
            clearInterval((authWindow as any)._pollInterval)
          }
        })
        
      }).catch((err) => {
        console.error('❌ 设置 Cookie 失败:', err)
        authWindow.close()
        resolve({
          success: false,
          error: `设置 Cookie 失败: ${err.message}`
        })
      })
      
    } catch (error: any) {
      console.error('❌ PKCE 流程失败:', error)
      resolve({
        success: false,
        error: error.message || 'PKCE 流程失败'
      })
    }
  })
}

// 从 Cursor 数据库同步当前账号到列表
ipcMain.handle('sync-cursor-account', async () => {
  let db: Database.Database | null = null
  try {
    console.log('🔄 开始同步 Cursor 账号...')
    
    // 获取数据库路径
    let dbPath = ''
    const settings = store.get('settings', {}) as any
    
    if (settings.cursorDbPath && existsSync(settings.cursorDbPath)) {
      dbPath = settings.cursorDbPath
    } else {
      const scanResult = scanCursorPaths()
      if (scanResult.cursorDbPath) {
        dbPath = scanResult.cursorDbPath
        // 顺便更新设置
        settings.cursorDbPath = dbPath
        store.set('settings', settings)
      }
    }
    
    if (!dbPath || !existsSync(dbPath)) {
      return { success: false, error: '未找到 Cursor 数据库路径，无法同步' }
    }
    
    console.log('📂 读取数据库:', dbPath)
    
    // 打开数据库 (只读模式，避免锁死)
    db = new Database(dbPath, { readonly: true })
    
    // 查询 Token, 邮箱和 UserID
    const stmt = db.prepare('SELECT key, value FROM ItemTable WHERE key IN (?, ?, ?, ?)')
    const rows = stmt.all(
      'cursorAuth/accessToken', 
      'cursorAuth/cachedEmail',
      'cursorAuth/refreshToken',
      'cursorAuth/userId'
    ) as { key: string; value: string }[]
    
    const accessTokenRow = rows.find(r => r.key === 'cursorAuth/accessToken')
    const emailRow = rows.find(r => r.key === 'cursorAuth/cachedEmail')
    const refreshTokenRow = rows.find(r => r.key === 'cursorAuth/refreshToken')
    const userIdRow = rows.find(r => r.key === 'cursorAuth/userId')
    
    if (!accessTokenRow || !accessTokenRow.value) {
      return { success: false, error: 'Cursor 当前未登录账号' }
    }
    
    const token = accessTokenRow.value
    const email = emailRow?.value || '未命名账号'
    const refreshToken = refreshTokenRow?.value
    
    // 检查 Token 是否有效
    if (token.length < 10) {
      return { success: false, error: '读取到的 Token 无效' }
    }
    
    console.log('👤 读取到当前本地账号详细信息:')
    console.log('  ----------------------------------------')
    console.log('  📧 邮箱 (cachedEmail):', email)
    console.log('  🆔 WorkosId (userId):', userIdRow?.value || '未找到 (可能是旧版本登录)')
    console.log('  🔑 AccessToken:', token.substring(0, 10) + '...' + token.substring(token.length - 5), `(长度: ${token.length})`)
    console.log('  🔄 RefreshToken:', refreshToken ? (refreshToken.substring(0, 10) + '...') : '未找到', refreshToken ? `(长度: ${refreshToken.length})` : '')
    console.log('  ----------------------------------------')
    
    // 获取现有 Token 列表
    const tokens = store.get('tokens', []) as any[]
    
    // 检查是否已存在（通过 Token 值或邮箱匹配）
    // 注意：Token 值可能因为刷新而变化，如果邮箱相同，我们视为同一个账号更新
    let existingIndex = -1
    
    // 1. 优先尝试完全匹配 Token
    existingIndex = tokens.findIndex(t => extractTokenValue(t.token) === extractTokenValue(token))
    
    // 2. 如果没找到，尝试匹配邮箱 (前提是邮箱不为空且不是默认值)
    if (existingIndex === -1 && email && email !== '未命名账号') {
      existingIndex = tokens.findIndex(t => t.accountInfo?.email === email)
    }
    
    let resultMsg = ''
    let syncedTokenId = ''
    let targetToken: any = null
    
    const accountInfo: any = {
      email: email
    }
    // 从数据库读取的 userId 实际上是 workosId（如 "user_01K9FKEM5SYRDNF0B2RJP3G92N"）
    let workosId = userIdRow?.value || ''
    if (workosId) {
      accountInfo.id = workosId
    }
    
    // 如果没有从数据库读取到 workosId，尝试从 token payload 中解析
    if (!workosId) {
      const payload = decodeTokenPayload(token)
      if (payload && payload.sub) {
        workosId = payload.sub.split('|')[1] || payload.sub
        accountInfo.id = workosId
        console.log('✅ 从 Token payload 解析出 workosId:', workosId)
      }
    }
    
    // 生成两种格式的 Token
    const longTermToken = token  // 纯 JWT 格式
    let cookieFormat = ''
    
    if (workosId) {
      // 生成 Cookie 格式: workosId%3A%3Atoken
      cookieFormat = `${workosId}%3A%3A${token}`
      console.log('✅ 生成 Cookie 格式 Token，长度:', cookieFormat.length)
    } else {
      console.warn('⚠️ 未找到 workosId，无法生成 Cookie 格式')
    }
    
    if (existingIndex >= 0) {
      // 更新现有账号
      targetToken = tokens[existingIndex]
      console.log('✅ 更新现有账号:', targetToken.name)
      
      // 默认保存 Cookie 格式（如果有），否则保存长期 Token
      targetToken.token = cookieFormat || longTermToken
      
      // 保存两种格式到 accountInfo
      if (!targetToken.accountInfo) targetToken.accountInfo = {}
      targetToken.accountInfo.id = accountInfo.id
      targetToken.accountInfo.longTermToken = longTermToken
      targetToken.accountInfo.cookieFormat = cookieFormat || longTermToken
      
      syncedTokenId = targetToken.id
      resultMsg = `已同步并激活账号: ${email}`
    } else {
      // 添加新账号
      console.log('➕ 添加新账号:', email)
      
      targetToken = {
        id: generateUUID(),
        name: email,
        token: cookieFormat || longTermToken,  // 默认保存 Cookie 格式
        isActive: true, // 新同步的账号默认为激活
        createTime: new Date().toISOString(),
        accountInfo: {
          ...accountInfo,
          longTermToken: longTermToken,
          cookieFormat: cookieFormat || longTermToken
        }
      }
      
      tokens.push(targetToken)
      syncedTokenId = targetToken.id
      resultMsg = `已添加并激活新账号: ${email}`
      }
      
    // 标记为激活 (统一处理)
    tokens.forEach(t => {
      t.isActive = (t.id === syncedTokenId)
    })
    
    // 尝试获取并更新账号详细信息（订阅、额度等）
    try {
      console.log('🔄 正在同步账号详细信息 (订阅、用量)...')
      const infoResult = await fetchAccountInfo(token)
      if (infoResult.success && infoResult.accountInfo) {
        targetToken.accountInfo = {
          ...targetToken.accountInfo,
          ...infoResult.accountInfo
        }
        
        // 更新 usage 字段，方便前端显示进度条
        if (infoResult.accountInfo.quota) {
          const q = infoResult.accountInfo.quota
          targetToken.usage = {
            used: q.used,
            limit: q.limit,
            remaining: q.remaining,
            percentage: (q.limit && q.limit > 0) ? (q.used / q.limit * 100) : null
          }
        }
        console.log('✅ 账号详细信息同步成功')
      }
    } catch (fetchError) {
      console.warn('⚠️ 同步账号详细信息失败 (不影响主流程):', fetchError)
    }
    
    store.set('tokens', tokens)
    
    return { 
      success: true, 
      message: resultMsg,
      account: { email, id: syncedTokenId }
    }
    
  } catch (error: any) {
    console.error('❌ 同步 Cursor 账号失败:', error)
    return { success: false, error: error.message }
  } finally {
    if (db) {
      try {
        db.close()
      } catch (e) {
        console.error('关闭数据库失败:', e)
      }
    }
  }
})

// 独立重置机器码
ipcMain.handle('reset-machine-id', async () => {
  try {
    // 先获取 DB 路径
    const settings = store.get('settings', {}) as any
    let dbPath = settings.cursorDbPath
    
    if (!dbPath || !existsSync(dbPath)) {
      const scanResult = scanCursorPaths()
      if (scanResult.cursorDbPath) dbPath = scanResult.cursorDbPath
    }
    
    if (!dbPath) return { success: false, error: '未找到 Cursor 路径' }
    
    return await resetMachineId(dbPath)
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 独立清理历史
ipcMain.handle('clear-history', async () => {
  try {
    const settings = store.get('settings', {}) as any
    let dbPath = settings.cursorDbPath
    
    if (!dbPath || !existsSync(dbPath)) {
      const scanResult = scanCursorPaths()
      if (scanResult.cursorDbPath) dbPath = scanResult.cursorDbPath
    }
    
    if (!dbPath) return { success: false, error: '未找到 Cursor 路径' }
    
    // 提示用户这会关闭 Cursor
    await killCursorIfRunning()
    
    return await clearHistory(dbPath)
  } catch (error: any) {
    return { success: false, error: error.message }
  }
})

// 切换 Cursor 编辑器账号（通过修改 state.vscdb 数据库）
ipcMain.handle('switch-cursor-account', async (_, id: string, options?: { resetMachineId?: boolean, clearHistory?: boolean }) => {
  let db: Database.Database | null = null
  try {
    const tokens = store.get('tokens', []) as any[]
    const token = tokens.find(t => t.id === id)
    
    if (!token) {
      return { success: false, error: 'Token 不存在' }
    }
    
    // 进度更新：开始获取长效 Token
    if (mainWindow) {
      mainWindow.webContents.send('switch-account-progress', {
        step: 'GET_TOKEN',
        progress: 10,
        message: '正在获取长效 Token...'
      })
    }
    
    // 先获取长效 Token
    console.log('🔄 开始获取长效 Token...')
    // 优先使用 cookieFormat，因为不管是添加账号还是同步本地都会生成 cookieFormat
    let tokenValue: string
    if (token.accountInfo?.cookieFormat) {
      // 使用 cookieFormat（格式：workosId%3A%3Atoken 或 WorkosCursorSessionToken=...）
      tokenValue = token.accountInfo.cookieFormat
      console.log('使用的 Token 类型: Cookie Format (推荐)')
    } else if (token.accountInfo?.longTermToken) {
      // 备用：使用 longTermToken（纯 JWT）
      tokenValue = token.accountInfo.longTermToken
      console.log('使用的 Token 类型: Long Term Token (备用)')
    } else {
      // 最后备用：从原始 token 字符串提取
      tokenValue = extractTokenValue(token.token)
      console.log('使用的 Token 类型: 从 token 字段提取 (兜底)')
    }
    
    const longTermTokenResult = await getLongTermToken(tokenValue)
    
    if (!longTermTokenResult.success) {
      console.error('❌ 获取长效 Token 失败:', longTermTokenResult.error)
      if (mainWindow) {
        mainWindow.webContents.send('switch-account-progress', {
          step: 'ERROR',
          progress: 0,
          message: '获取 Token 失败'
        })
      }
      return { success: false, error: longTermTokenResult.error || '获取长效 Token 失败' }
    }
    
    console.log('✅ 成功获取长效 Token')

    const accessToken = longTermTokenResult.accessToken || extractTokenValue(token.token)
    const refreshToken = longTermTokenResult.refreshToken || extractTokenValue(token.token)

    // Cursor state.vscdb 数据库路径
    // Windows: %APPDATA%\Cursor\User\globalStorage\state.vscdb
    // macOS: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
    // Linux: ~/.config/Cursor/User/globalStorage/state.vscdb
    
    const platform = process.platform
    let dbPath: string

    // 优先使用设置中的手动路径
    const settings = store.get('settings', {}) as any
    const manualPath = settings.cursorDbPath
    if (manualPath && typeof manualPath === 'string' && manualPath.trim().length > 0 && existsSync(manualPath)) {
      dbPath = manualPath
      console.log('📂 使用手动设置的 Cursor 数据库路径:', dbPath)
    } else {
      if (platform === 'win32') {
        dbPath = path.join(process.env.APPDATA || '', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
      } else if (platform === 'darwin') {
        dbPath = path.join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
      } else {
        dbPath = path.join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
      }
      console.log('📂 使用自动识别的 Cursor 数据库路径:', dbPath)
    }

    // 进度更新：关闭 Cursor 进程
    if (mainWindow) {
      mainWindow.webContents.send('switch-account-progress', {
        step: 'KILL_CURSOR',
        progress: 30,
        message: '正在关闭 Cursor 进程...'
      })
    }
    
    // 为避免数据库被占用，先结束正在运行的 Cursor 进程（需要管理员/提升权限）
    try {
      await killCursorIfRunning()
      console.log('🛑 已结束正在运行的 Cursor 进程')
    } catch (e) {
      console.warn('⚠️ 无法结束 Cursor 进程，可能会导致数据库被占用:', (e as any)?.message)
    }

    // 1. 如果请求了清理历史 (Clear History)
    // 注意：这会删除 state.vscdb，所以必须在打开数据库之前执行
    if (options?.clearHistory) {
      if (mainWindow) {
        mainWindow.webContents.send('switch-account-progress', {
          step: 'CLEAR_HISTORY',
          progress: 40,
          message: '正在清理历史会话...'
        })
      }
      console.log('🧹 执行切换前清理历史...')
      await clearHistory(dbPath)
    }

    // 2. 如果请求了重置机器码 (Reset Machine ID)
    if (options?.resetMachineId) {
      if (mainWindow) {
        mainWindow.webContents.send('switch-account-progress', {
          step: 'RESET_MACHINE_ID',
          progress: 50,
          message: '正在重置机器码...'
        })
      }
      console.log('🛡️ 执行切换前重置机器码...')
      await resetMachineId(dbPath)
    }

    // 检查数据库文件是否存在（如果目录都不存在，认为未安装 Cursor）
    // 如果刚刚执行了清理历史，state.vscdb 可能已被删除，这是正常的，后续 new Database 会创建新的
    const globalStoragePath = path.dirname(dbPath)
    if (!existsSync(globalStoragePath)) {
      console.error(`❌ 未找到 Cursor 数据目录: ${globalStoragePath}`)
      return {
        success: false,
        error: `未找到 Cursor 数据目录，请在“设置”中手动配置 Cursor 路径后重试。\n当前尝试路径: ${dbPath}`,
        needCursorPath: true
      }
    }

    // 打开现有数据库 (如果被删除会自动创建)
    db = new Database(dbPath)

    // 从 token 中提取邮箱信息和 workosId
    const email = token.accountInfo?.email || ''
    let userId = token.accountInfo?.id  // 这应该是 workosId（如 "user_01K9FKEM5SYRDNF0B2RJP3G92N"）
    
    // 如果 Token 中没有 ID，尝试从 Token 字符串解析
    if (!userId) {
      const payload = decodeTokenPayload(accessToken)
      if (payload && payload.sub) {
         // payload.sub 格式为 "auth0|user_01K9FKEM5SYRDNF0B2RJP3G92N"
         // 我们需要提取 workosId 部分（user_01...）
         userId = payload.sub.split('|')[1] || payload.sub
      }
    }
    
    console.log('📝 开始处理数据库操作...')
    console.log('  - Email:', email)
    console.log('  - WorkosId (userId):', userId)
    console.log('  - Access Token 长度:', accessToken.length)
    console.log('  - Database Path:', dbPath)

    // 定义需要清理的旧缓存键（确保一个纯净的会话环境）
    const keysToDelete = [
      // 遥测相关
      'telemetry.currentSessionDate',
      'telemetry.sessionCount',
      'telemetry.lastSessionDate',
      'telemetry.machineId',
      'telemetry.macMachineId',
      'telemetry.devDeviceId',
      'telemetry.sqmId',
      
      // AI 功能相关
      'cursorai/serverConfig',
      'cursorai/cachedServerConfig',
      'cursorai/lastServerConfigUpdate',
      'cursorai/serverConfigVersion',
      
      // 旧的认证信息
      'cursorAuth/oldAccessToken',
      'cursorAuth/oldRefreshToken',
      'cursorAuth/oldEmail',
      
      // 缓存相关
      'cache/completionCache',
      'cache/suggestionCache',
      'cache/diagnosticsCache',
      
      // 会话相关
      'session/lastActiveFile',
      'session/lastOpenedFiles',
      'session/workspaceState',
      
      // 其他可能的旧数据
      'workbench.activity.pinnedViewlets',
      'workbench.panel.markers.hidden',
      'workbench.panel.output.hidden'
    ]

    // 进度更新：修改数据库
    if (mainWindow) {
      mainWindow.webContents.send('switch-account-progress', {
        step: 'UPDATE_DB',
        progress: 60,
        message: '正在更新账号信息...'
      })
    }
    
    // 使用事务处理所有的删除和插入操作
    const deleteStmt = db.prepare('DELETE FROM ItemTable WHERE key = ?')
    const insertStmt = db.prepare('INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)')
    
    const transaction = db.transaction(() => {
      // 第一步：清理旧缓存
      console.log('🧹 清理旧缓存...')
      for (const key of keysToDelete) {
        try {
          deleteStmt.run(key)
        } catch (error) {
          // 忽略删除不存在的键的错误
          console.log(`  ℹ️ 键不存在或已删除: ${key}`)
        }
      }
      console.log(`✅ 已清理 ${keysToDelete.length} 个缓存键`)

      // 第二步：写入新的认证凭证
      console.log('📝 写入新的认证凭证...')
      
      const authUpdates = [
        // 关键：标记账户为已登录状态
        { key: 'cursorAuth/cachedSignUpType', value: 'Auth_0' },
        // 邮箱信息
        { key: 'cursorAuth/cachedEmail', value: email },
        // 长效 Token
        { key: 'cursorAuth/accessToken', value: accessToken },
        { key: 'cursorAuth/refreshToken', value: refreshToken }
      ]
      
      // 如果有 workosId，也写入到 cursorAuth/userId
      if (userId) {
        authUpdates.push({ key: 'cursorAuth/userId', value: userId })
        console.log('  ✓ 将写入 WorkosId:', userId)
      } else {
        console.warn('⚠️ 未找到 WorkosId (userId)，可能导致部分功能异常')
      }

      for (const item of authUpdates) {
        insertStmt.run(item.key, item.value)
        console.log(`  ✅ 已写入: ${item.key}`)
      }

      console.log('✅ 认证凭证写入完成')
    })

    // 执行事务
    transaction()
    
    console.log(`\n🎉 账号切换成功！`)
    console.log(`  - 邮箱: ${email || '(未设置)'}`)
    console.log(`  - 数据库路径: ${dbPath}`)
    console.log(`\n⏳ 正在重启 Cursor 应用以应用更改...`)

    // 关闭数据库连接
    if (db) {
      try {
        db.close()
        console.log('✅ 数据库连接已关闭')
      } catch (closeError) {
        console.error('⚠️ 关闭数据库失败:', closeError)
      }
    }

    // 进度更新：准备重启
    if (mainWindow) {
      mainWindow.webContents.send('switch-account-progress', {
        step: 'RESTART',
        progress: 90,
        message: '准备重启 Cursor...'
      })
    }
    
    // 延迟后重启 Cursor，确保数据库已完全关闭
    setTimeout(() => {
      console.log('🔄 正在重启 Cursor 客户端...')
      restartCursorClient()
      
      // 进度更新：完成
      if (mainWindow) {
        mainWindow.webContents.send('switch-account-progress', {
          step: 'DONE',
          progress: 100,
          message: '切换完成！Cursor 正在重启...'
        })
      }
    }, 800)

    return { 
      success: true, 
      path: dbPath,
      message: '账号切换成功，已触发 Cursor 客户端重启'
    }
  } catch (error: any) {
    console.error('❌ 切换 Cursor 账号失败:', error)
    console.error('错误堆栈:', error.stack)
    
    // 进度更新：错误
    if (mainWindow) {
      mainWindow.webContents.send('switch-account-progress', {
        step: 'ERROR',
        progress: 0,
        message: `切换失败: ${error.message || '未知错误'}`
      })
    }
    
    return { success: false, error: error.message }
  } finally {
    // 关闭数据库连接（如果还未关闭）
    if (db) {
      try {
        db.close()
      } catch (closeError) {
        console.error('关闭数据库失败:', closeError)
      }
    }
  }
})

// 解析 Token（从 JWT 中提取信息）
ipcMain.handle('parse-token', async (_, tokenString: string) => {
  try {
    console.log('开始解析 Token，输入长度:', tokenString.length)
    
    // 提取 token 值（去除 Cookie 前缀）
    let token = tokenString.trim()
    if (token.includes('WorkosCursorSessionToken=')) {
      const match = token.match(/WorkosCursorSessionToken=([^;]+)/)
      if (match) {
        token = match[1]
        console.log('从 Cookie 中提取 token，长度:', token.length)
      }
    }
    
    // 先 URL 解码（处理 %3A%3A 这种情况）
    try {
      token = decodeURIComponent(token)
      console.log('URL 解码后 token 长度:', token.length)
    } catch (error) {
      console.warn('URL 解码失败，使用原始 token:', error)
    }
    
    // Token 格式检查
    let parts: string[] = []
    
    // 1. 尝试作为 Cookie 或 user_id%3A%3AaccessToken 格式解析
    if (token.includes('::')) {
      parts = token.split('::')
    } else if (token.includes('%3A%3A')) {
      parts = token.split('%3A%3A')
    } else {
      // 2. 尝试作为纯 JWT 格式解析 (以 eyJ 开头)
      // 如果是纯 JWT，我们不需要 user_id 前缀也能解析，但为了保持数据结构统一，
      // 我们会尝试从 JWT payload 中提取 user_id
      const jwtStart = token.indexOf('eyJ')
      if (jwtStart >= 0) {
        const possibleJwt = token.substring(jwtStart)
        // 验证是否看起来像 JWT (至少有两个点)
        if ((possibleJwt.match(/\./g) || []).length >= 2) {
          // 这是一个纯 JWT，我们暂时把第一部分设为空，后面从 payload 补全
          parts = ['', possibleJwt]
        }
      }
    }
    
    console.log('Token 分割后部分数:', parts.length)
    
    if (parts.length !== 2 || !parts[1]) {
      console.error('Token 格式无法识别')
      return {
        success: false,
        error: 'format_error',
        errorMessage: 'Token 格式不正确。请粘贴完整 Cookie，或者以 eyJ 开头的长效 Token'
      }
    }
    
    let userId = parts[0]
    const jwtToken = parts[1]
    console.log('初步提取 - 用户ID:', userId)
    console.log('初步提取 - JWT Token 长度:', jwtToken.length)
    
    // 解析 JWT（不验证签名，只提取 payload）
    const jwtParts = jwtToken.split('.')
    console.log('JWT 分割后部分数:', jwtParts.length)
    
    if (jwtParts.length !== 3) {
      console.error('JWT 格式不正确，分割后部分数:', jwtParts.length)
      return {
        success: false,
        error: 'jwt_format_error',
        errorMessage: 'JWT 格式不正确，应为 header.payload.signature 格式'
      }
    }
    
    // 解码 payload（base64url）
    let payload: any = {}
    try {
      const payloadBase64 = jwtParts[1]
      // base64url 转 base64
      const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
      const payloadJson = Buffer.from(padded, 'base64').toString('utf-8')
      payload = JSON.parse(payloadJson)
      console.log('成功解析 JWT payload')
      
      // 如果 userId 为空（纯 JWT 模式），尝试从 payload 提取
      if (!userId && payload.sub) {
        userId = payload.sub.split('|')[1] || payload.sub
        console.log('从 JWT Payload 补全用户ID:', userId)
      }
    } catch (error: any) {
      console.error('解析 JWT payload 失败:', error.message)
      return {
        success: false,
        error: 'jwt_decode_error',
        errorMessage: `无法解析 JWT payload: ${error.message}`
      }
    }
    
    // 提取信息
    const parseResult: any = {
      userId: userId,
      email: payload.email || payload.sub?.split('|')[1] || '',
      tokenType: 'session',
      scope: payload.scope || '',
      exp: payload.exp,
      iat: payload.iat || payload.time,
      iss: payload.iss || '',
      aud: payload.aud || ''
    }
    
    // 计算过期时间
    if (payload.exp) {
      parseResult.expiryDate = new Date(payload.exp * 1000).toISOString()
      parseResult.expiryDateFormatted = new Date(payload.exp * 1000).toLocaleString('zh-CN')
      const now = Date.now()
      const expiry = payload.exp * 1000
      parseResult.isExpired = expiry < now
      parseResult.isValid = expiry > now
    } else {
      parseResult.isValid = false
      parseResult.isExpired = true
    }
    
    // 尝试从 API 获取更多信息
    // 修正：使用 buildCookieValue 确保格式正确 (userId%3A%3AaccessToken)
    const cookieValue = buildCookieValue(tokenString, userId)
    
    const headers = {
      'Cookie': cookieValue,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://cursor.com/'
    }
    
    // 尝试获取账号信息
    let hasEmail = false
    let hasSubscription = false
    
    try {
      const meResponse = await fetch('https://cursor.com/api/auth/me', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })
      
      if (meResponse.ok) {
        const meData = await meResponse.json() as any
        if (meData.email) {
          parseResult.email = meData.email
          parseResult.name = meData.name
          hasEmail = true
        }
      } else if (meResponse.status === 401) {
        console.warn('⚠️ /api/auth/me 返回 401')
        return {
          success: false,
          error: 'not_authenticated',
          errorMessage: '没有这个账号，Token 无效或已过期'
        }
      }
    } catch (error) {
      console.warn('⚠️ 获取账号基本信息失败:', error)
    }
    
    // 尝试获取订阅信息（这是判断 token 是否有效的关键）
    try {
      const stripeResponse = await fetch('https://cursor.com/api/auth/stripe', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })
      
      if (stripeResponse.ok) {
        const stripeData = await stripeResponse.json() as any
        parseResult.subscriptionStatus = stripeData.membershipType || stripeData.individualMembershipType || 'unknown'
        parseResult.isTrial = stripeData.daysRemainingOnTrial > 0
        parseResult.daysRemainingOnTrial = stripeData.daysRemainingOnTrial
        hasSubscription = true
        console.log('✅ 成功获取订阅状态:', parseResult.subscriptionStatus)
      } else if (stripeResponse.status === 401) {
        console.warn('⚠️ /api/auth/stripe 返回 401')
        return {
          success: false,
          error: 'not_authenticated',
          errorMessage: '没有这个账号，Token 无效或已过期'
        }
      } else {
        console.warn('⚠️ /api/auth/stripe 返回状态码:', stripeResponse.status)
      }
    } catch (error) {
      console.warn('⚠️ 获取订阅信息失败:', error)
    }
    
    // 只有能解析出订阅状态的才是正常的 token
    if (!hasSubscription) {
      console.warn('⚠️ 无法获取订阅状态，Token 无效')
      return {
        success: false,
        error: 'not_authenticated',
        errorMessage: '没有这个账号，Token 无效或已过期'
      }
    }
    
    // 如果无法获取邮箱，但能获取订阅状态，至少说明 token 有效
    if (!hasEmail) {
      console.warn('⚠️ 无法获取邮箱信息，但订阅状态有效')
    }
    
    console.log('✅ Token 解析成功')
    return {
      success: true,
      parseResult: parseResult
    }
  } catch (error: any) {
    console.error('❌ 解析 Token 失败:', error)
    console.error('错误堆栈:', error.stack)
    return {
      success: false,
      error: 'parse_error',
      errorMessage: error.message || '解析 Token 失败，请检查 Token 格式'
    }
  }
})

// 将长期 Token (JWT) 转换为 Cookies 格式
ipcMain.handle('convert-token-to-cookie', async (_, tokenString: string) => {
  try {
    console.log('🔄 开始转换 Token 为 Cookie 格式')
    
    let token = tokenString.trim()
    
    // 如果已经是 Cookie 格式，直接返回
    if (token.includes('%3A%3A') || token.includes('::')) {
      console.log('✅ Token 已经是 Cookie 格式')
      // 确保使用 %3A%3A 格式
      const normalized = token.replace('::', '%3A%3A')
      return {
        success: true,
        cookieFormat: normalized,
        message: 'Token 已经是 Cookie 格式'
      }
    }
    
    // 提取纯 JWT（去除可能的前缀）
    const jwtStart = token.indexOf('eyJ')
    if (jwtStart < 0) {
      return {
        success: false,
        error: 'Token 格式无效，无法找到 JWT 部分（应以 eyJ 开头）'
      }
    }
    
    const jwt = token.substring(jwtStart)
    console.log('📋 提取到 JWT，长度:', jwt.length)
    
    // 解析 JWT payload 获取 workosId
    const payload = decodeTokenPayload(jwt)
    if (!payload || !payload.sub) {
      return {
        success: false,
        error: '无法解析 Token payload 或缺少 sub 字段'
      }
    }
    
    // 从 sub 中提取 workosId
    // sub 格式: "auth0|user_01K9EJACWXH9NAT3126WRN63DJ"
    let workosId = payload.sub
    if (workosId.includes('|')) {
      workosId = workosId.split('|')[1]
    }
    
    console.log('✅ 提取到 workosId:', workosId)
    
    // 拼接成 Cookie 格式: workosId%3A%3Atoken
    const cookieFormat = `${workosId}%3A%3A${jwt}`
    
    console.log('✅ 转换成功，Cookie 格式长度:', cookieFormat.length)
    
    return {
      success: true,
      cookieFormat: cookieFormat,
      workosId: workosId,
      message: '转换成功'
    }
  } catch (error: any) {
    console.error('❌ 转换失败:', error)
    return {
      success: false,
      error: error.message || '转换失败'
    }
  }
})

// 辅助函数：从 Token 中提取 JWT Payload
function decodeTokenPayload(tokenString: string): any | null {
  try {
    let token = tokenString.trim()
    if (token.includes('WorkosCursorSessionToken=')) {
      const match = token.match(/WorkosCursorSessionToken=([^;]+)/)
      if (match) token = match[1]
    }
    
    // 先 URL 解码
    try {
      token = decodeURIComponent(token)
    } catch (e) {}
    
    // 提取 JWT 部分
    let jwtToken = token
    if (token.includes('::')) {
      jwtToken = token.split('::')[1]
    } else if (token.includes('%3A%3A')) {
      jwtToken = token.split('%3A%3A')[1]
    } else {
      const jwtStart = token.indexOf('eyJ')
      if (jwtStart > 0) jwtToken = token.substring(jwtStart)
    }
    
    if (!jwtToken || !jwtToken.includes('.')) return null
    
    const jwtParts = jwtToken.split('.')
    if (jwtParts.length < 2) return null
    
    const base64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const payloadJson = Buffer.from(padded, 'base64').toString('utf-8')
    return JSON.parse(payloadJson)
  } catch (e) {
    console.error('Token 解码失败:', e)
    return null
  }
}

// 辅助函数：构建 Cookie 值
function buildCookieValue(token: string, userId?: string): string {
  let tokenValue = token.trim()
  
  // 如果已经包含前缀，先提取出来
  if (tokenValue.includes('WorkosCursorSessionToken=')) {
    const match = tokenValue.match(/WorkosCursorSessionToken=([^;]+)/)
    if (match) tokenValue = match[1]
  }
  
  // 如果没有 userId，尝试从 token 中解析
  if (!userId) {
    const payload = decodeTokenPayload(tokenValue)
    if (payload && payload.sub) {
      userId = payload.sub.split('|')[1] || payload.sub
    }
  }
  
  // 关键逻辑修正：
  // 对于纯 JWT (eyJ...)，必须拼接成 user_id%3A%3Aaccess_token 格式
  // Cursor 后端严格校验 Cookie 格式，缺少前缀会被视为无效
  if (userId && !tokenValue.includes('%3A%3A') && !tokenValue.includes('::')) {
    // 确保 userId 是编码安全的（虽然通常不需要）
    return `WorkosCursorSessionToken=${userId}%3A%3A${tokenValue}`
  }
  
  // 如果已经是完整格式（包含 %3A%3A），直接加上 Cookie 名
  if (!tokenValue.includes('WorkosCursorSessionToken=')) {
    return `WorkosCursorSessionToken=${tokenValue}`
  }
  
  return tokenValue
}

// 提取获取账号信息的公共方法
async function fetchAccountInfo(token: string) {
  try {
    // 构建 Cookie 字符串
    // 使用辅助函数来正确拼接 userId%3A%3AaccessToken
    const cookieValue = buildCookieValue(token)
    
    // 构建请求头
    const headers = {
      'Cookie': cookieValue,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://cursor.com/'
    }
    
    const accountInfo: any = {}
    let hasAnyInfo = false
    
    // 0. 尝试从 Token 本身解析基本信息（作为兜底）
    const payload = decodeTokenPayload(token)
    if (payload) {
      if (payload.email) {
        accountInfo.email = payload.email
        hasAnyInfo = true
      }
      if (payload.sub) {
        // payload.sub 格式: "auth0|user_01K9FKEM5SYRDNF0B2RJP3G92N"
        // 提取 workosId 部分: "user_01K9FKEM5SYRDNF0B2RJP3G92N"
        accountInfo.id = payload.sub.split('|')[1] || payload.sub
        hasAnyInfo = true
      }
      // 从 exp 获取过期时间
      if (payload.exp) {
         // 即使没有联网，也能知道 Token 何时过期
         accountInfo.tokenExpiry = payload.exp
      }
      console.log('✅ 从 Token 解析出基本信息:', accountInfo.email, '| workosId:', accountInfo.id)
    }
    
    // 1. 从 /api/auth/me 获取邮箱
    let isUnauthorized = false
    try {
      const meResponse = await fetch('https://cursor.com/api/auth/me', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })

      if (meResponse.ok) {
        const meData = await meResponse.json() as any
        console.log('✅ 成功获取账号基本信息:', meData)
        
        // 提取邮箱信息
        if (meData.email) {
          accountInfo.email = meData.email
          hasAnyInfo = true
        }
        if (meData.name) {
          accountInfo.name = meData.name
        }
        // 如果有 id 字段，先暂存（稍后通过 get-me 获取准确的 workosId）
        if (meData.id && !accountInfo.id) {
          accountInfo.id = meData.id
        }
        
        accountInfo._rawMe = meData
      } else if (meResponse.status === 401) {
        console.warn('⚠️ /api/auth/me 请求失败: 401 Unauthorized')
        isUnauthorized = true
      } else {
        console.warn('⚠️ /api/auth/me 请求失败:', meResponse.status)
      }
    } catch (meError) {
      console.warn('⚠️ 获取账号基本信息失败:', meError)
    }

    // 1.5 从 /api/dashboard/get-me 获取详细信息（特别是 workosId）
    try {
      const getMeResponse = await fetch('https://cursor.com/api/dashboard/get-me', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })

      if (getMeResponse.ok) {
        const getMeData = await getMeResponse.json() as any
        console.log('✅ 成功获取 dashboard/get-me:', getMeData)
        
        // 提取 workosId（字符串格式，如 "user_01K9FKEM5SYRDNF0B2RJP3G92N"）
        // 这是数据库 cursorAuth/userId 需要的值
        if (getMeData.workosId) {
          accountInfo.id = getMeData.workosId
          console.log('✅ 提取到 workosId:', accountInfo.id)
          hasAnyInfo = true
        } else if (getMeData.userId) {
          // 如果没有 workosId，使用数字 userId 作为后备
          accountInfo.id = String(getMeData.userId)
          console.warn('⚠️ 未找到 workosId，使用 userId:', accountInfo.id)
          hasAnyInfo = true
        }
        
        if (!accountInfo.email && getMeData.email) {
          accountInfo.email = getMeData.email
        }
        
        // 存储完整的 get-me 数据供调试用
        accountInfo._rawGetMe = getMeData
      } else {
        console.warn('⚠️ /api/dashboard/get-me 请求失败:', getMeResponse.status)
      }
    } catch (getMeError) {
      console.warn('⚠️ 获取 dashboard/get-me 失败:', getMeError)
    }
    
    // 2. 从 /api/auth/stripe 获取订阅类型
    try {
      const stripeResponse = await fetch('https://cursor.com/api/auth/stripe', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })

      if (stripeResponse.ok) {
        const stripeData = await stripeResponse.json() as any
        console.log('✅ 成功获取 Stripe 订阅信息:', stripeData)
        
        // 判断订阅类型：如果 daysRemainingOnTrial > 0，则为 Pro Trial
        if (stripeData.daysRemainingOnTrial !== undefined && stripeData.daysRemainingOnTrial > 0) {
          accountInfo.plan = 'Pro Trial'
          accountInfo.isTrial = true
          accountInfo.daysRemainingOnTrial = stripeData.daysRemainingOnTrial
          
          // 计算到期时间（当前时间 + 剩余天数）
          const expiryDate = new Date()
          expiryDate.setDate(expiryDate.getDate() + stripeData.daysRemainingOnTrial)
          accountInfo.trialExpiryDate = expiryDate.toISOString()
          
          hasAnyInfo = true
        } else {
          // 否则使用其他字段
          if (stripeData.plan) {
            accountInfo.plan = stripeData.plan
            hasAnyInfo = true
          }
          if (stripeData.tier) {
            accountInfo.plan = stripeData.tier
            hasAnyInfo = true
          }
          if (stripeData.subscription?.plan) {
            accountInfo.plan = stripeData.subscription.plan
            hasAnyInfo = true
          }
          if (stripeData.subscription?.tier) {
            accountInfo.plan = stripeData.subscription.tier
            hasAnyInfo = true
          }
          if (stripeData.membershipType) {
            accountInfo.plan = stripeData.membershipType
            hasAnyInfo = true
          }
          if (stripeData.individualMembershipType) {
            accountInfo.plan = stripeData.individualMembershipType
            hasAnyInfo = true
          }
        }
        
        // 保存订阅状态和其他信息
        if (stripeData.subscriptionStatus) {
          accountInfo.subscriptionStatus = stripeData.subscriptionStatus
        }
        if (stripeData.trialLengthDays) {
          accountInfo.trialLengthDays = stripeData.trialLengthDays
        }
        
        accountInfo._rawStripe = stripeData
      } else if (stripeResponse.status === 401) {
        console.warn('⚠️ /api/auth/stripe 请求失败: 401 Unauthorized')
        isUnauthorized = true
      } else {
        console.warn('⚠️ /api/auth/stripe 请求失败:', stripeResponse.status)
      }
    } catch (stripeError) {
      console.warn('⚠️ 获取 Stripe 订阅信息失败:', stripeError)
    }
    
    // 3. 从 usage-summary 获取额度信息
    try {
      const usageResponse = await fetch('https://cursor.com/api/usage-summary', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })

      if (usageResponse.ok) {
        const usageData = await usageResponse.json() as any
        console.log('✅ 成功获取 usage-summary:', usageData)
        
        // 提取额度信息（从 individualUsage.plan）
        if (usageData.individualUsage?.plan) {
          const planData = usageData.individualUsage.plan
          if (!accountInfo.quota) accountInfo.quota = {}
          
          if (planData.limit !== undefined) {
            accountInfo.quota.limit = planData.limit
            hasAnyInfo = true
          }
          if (planData.used !== undefined) {
            accountInfo.quota.used = planData.used
            hasAnyInfo = true
          }
          if (planData.remaining !== undefined) {
            accountInfo.quota.remaining = planData.remaining
            hasAnyInfo = true
          }
          if (planData.enabled !== undefined) {
            accountInfo.quota.enabled = planData.enabled
          }
        }
        
        // 保存其他有用信息
        if (usageData.billingCycleStart) {
          accountInfo.billingCycleStart = usageData.billingCycleStart
        }
        if (usageData.billingCycleEnd) {
          accountInfo.billingCycleEnd = usageData.billingCycleEnd
        }
        if (usageData.isUnlimited !== undefined) {
          accountInfo.isUnlimited = usageData.isUnlimited
        }
        
        // 保存原始数据以便调试
        accountInfo._rawUsage = usageData
      } else if (usageResponse.status === 401) {
        const errorText = await usageResponse.text()
        console.error(`❌ usage-summary API 请求失败: 401 Unauthorized`, errorText)
        isUnauthorized = true
      } else {
        const errorText = await usageResponse.text()
        console.error(`❌ usage-summary API 请求失败: ${usageResponse.status} ${usageResponse.statusText}`, errorText)
      }
    } catch (usageError) {
      console.warn('⚠️ 获取 usage-summary 失败:', usageError)
    }
    
    // 返回结果
    // 只要有任何信息（包括从 Token 解析出来的）就算成功
    if (hasAnyInfo) {
      console.log('✅ 成功获取账号信息（合并）')
      return {
        success: true,
        accountInfo: accountInfo
      }
    } else if (isUnauthorized) {
      console.warn('⚠️ Token 认证失败（401 Unauthorized）')
      return {
        success: false,
        error: 'not_authenticated',
        errorMessage: '没有这个账号，Token 无效或已过期',
        accountInfo: null
      }
    } else {
      console.warn('⚠️ 未能获取任何账号信息')
      return {
        success: false,
        error: 'unknown',
        errorMessage: '未能获取账号信息，请检查 Token 是否有效',
        accountInfo: null
      }
    }
  } catch (error: any) {
    console.error('获取账号信息失败:', error)
    return {
      success: false,
      error: error.message,
      accountInfo: null
    }
  }
}

// 根据 Token 获取账号信息
// 邮箱从 /api/auth/me 获取，订阅类型和额度从 usage-summary 获取
ipcMain.handle('get-account-info', async (_, token: string) => {
  return await fetchAccountInfo(token)
})

// 检查 Token 用量（从 usage-summary 接口）
ipcMain.handle('check-token-usage', async (_, id: string) => {
  try {
    const tokens = store.get('tokens', []) as any[]
    const token = tokens.find(t => t.id === id)
    
    if (!token) {
      return { success: false, error: 'Token 不存在' }
    }

    console.log(`🔄 检查账号用量: ${token.accountInfo?.email || token.name || token.id}`)
    
    // 确保有 cookieFormat
    let tokenValue = token.accountInfo?.cookieFormat || token.token
    let needsSave = false
    
    // 如果没有 cookieFormat，尝试生成
    if (!token.accountInfo?.cookieFormat) {
      console.log('   ⚠️ 缺少 cookieFormat，尝试自动生成...')
      
      const rawToken = token.token.trim()
      const isCookieFormat = rawToken.includes('%3A%3A') || rawToken.includes('::')
      const isJWT = rawToken.startsWith('eyJ')
      
      if (isCookieFormat) {
        // 已经是 Cookie 格式，直接使用
        tokenValue = rawToken
        // 提取 JWT 部分作为 longTermToken
        let jwtPart = rawToken
        if (rawToken.includes('%3A%3A')) {
          jwtPart = rawToken.split('%3A%3A')[1] || rawToken
        } else if (rawToken.includes('::')) {
          jwtPart = rawToken.split('::')[1] || rawToken
        }
        
        if (!token.accountInfo) token.accountInfo = {}
        token.accountInfo.cookieFormat = rawToken
        token.accountInfo.longTermToken = jwtPart
        needsSave = true
        console.log('   ✅ 检测到 Cookie 格式，已保存')
      } else if (isJWT) {
        // 纯 JWT，需要转换为 Cookie 格式
        const payload = decodeTokenPayload(rawToken)
        if (payload && payload.sub) {
          let workosId = payload.sub.split('|')[1] || payload.sub
          tokenValue = `${workosId}%3A%3A${rawToken}`
          
          if (!token.accountInfo) token.accountInfo = {}
          token.accountInfo.cookieFormat = tokenValue
          token.accountInfo.longTermToken = rawToken
          token.accountInfo.id = workosId
          needsSave = true
          console.log('   ✅ 已将 JWT 转换为 Cookie 格式')
        } else {
          console.warn('   ❌ 无法从 JWT 中提取 workosId')
          tokenValue = rawToken // 使用原始 token，可能会失败
        }
      }
      
      // 保存更新后的 token
      if (needsSave) {
        const updatedTokens = tokens.map(t => t.id === token.id ? token : t)
        store.set('tokens', updatedTokens)
        console.log('   💾 已保存更新后的 token 格式')
      }
    }
    
    console.log(`   使用格式: ${token.accountInfo?.cookieFormat ? 'cookieFormat' : 'token.token'}`)
    
    // 构建 Cookie 字符串
    let cookieValue = buildCookieValue(tokenValue)
    
    // 构建请求头
    const headers = {
      'Cookie': cookieValue,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
      'Referer': 'https://cursor.com/'
    }

    // 调用 usage-summary 接口获取最新的额度信息
    try {
      const response = await fetch('https://cursor.com/api/usage-summary', {
        method: 'GET',
        headers: headers,
        credentials: 'include'
      })

      if (response.ok) {
        const usageData = await response.json() as any
        console.log('✅ 成功获取 usage-summary（检查用量）:', usageData)
        
        // 从 individualUsage.plan 提取额度信息
        let used = 0
        let limit: number | null = null
        let remaining: number | null = null
        
        if (usageData.individualUsage?.plan) {
          const planData = usageData.individualUsage.plan
          used = planData.used || 0
          limit = planData.limit !== undefined ? planData.limit : null
          remaining = planData.remaining !== undefined ? planData.remaining : null
        }
        
        // 计算百分比
        const percentage = limit !== null && limit > 0 ? (used / limit) * 100 : null
        
        return {
          success: true,
          usage: {
            used: used,
            limit: limit,
            remaining: remaining,
            percentage: percentage
          }
        }
      } else {
        const errorText = await response.text()
        console.error(`❌ usage-summary API 请求失败: ${response.status} ${response.statusText}`, errorText)
        return {
          success: false,
          error: `API 请求失败: ${response.status} ${response.statusText}`
        }
      }
    } catch (apiError: any) {
      console.error('❌ 无法连接到 usage-summary API:', apiError)
      return {
        success: false,
        error: `网络请求失败: ${apiError.message}`
      }
    }
  } catch (error: any) {
    console.error('检查 Token 用量失败:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  }
})

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close()
})

// 全面扫描 Cursor 安装路径的函数
function scanCursorPaths(): ScanResult {
  const platform = process.platform
  const scannedPaths: string[] = []
  const foundPaths: string[] = []
  let cursorAppPath: string | null = null
  let cursorDbPath: string | null = null

  console.log('🔍 开始全面扫描 Cursor 路径...')
  console.log('  - 操作系统:', platform)

  // Windows 平台扫描
  if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || ''
    const appData = process.env.APPDATA || ''
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
    const userProfile = process.env.USERPROFILE || homedir()

    // 常见的 Cursor.exe 安装路径
    const exePaths = [
      // 用户本地安装（最常见）
      path.join(localAppData, 'Programs', 'cursor', 'Cursor.exe'),
      path.join(localAppData, 'Programs', 'Cursor', 'Cursor.exe'),
      path.join(localAppData, 'cursor', 'Cursor.exe'),
      path.join(localAppData, 'Cursor', 'Cursor.exe'),
      // 系统级安装
      path.join(programFiles, 'Cursor', 'Cursor.exe'),
      path.join(programFiles, 'cursor', 'Cursor.exe'),
      path.join(programFilesX86, 'Cursor', 'Cursor.exe'),
      path.join(programFilesX86, 'cursor', 'Cursor.exe'),
      // AppData\Local 下的其他可能位置
      path.join(localAppData, 'cursor-updater', 'Cursor.exe'),
      // 用户桌面（便携版）
      path.join(userProfile, 'Desktop', 'Cursor', 'Cursor.exe'),
      path.join(userProfile, 'Desktop', 'cursor', 'Cursor.exe'),
    ]

    // 尝试扫描 LocalAppData\Programs 下的所有子目录查找 cursor
    try {
      const programsDir = path.join(localAppData, 'Programs')
      if (existsSync(programsDir)) {
        const subDirs = readdirSync(programsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
          .map(dirent => dirent.name)
        
        for (const dir of subDirs) {
          if (dir.toLowerCase().includes('cursor')) {
            const possibleExe = path.join(programsDir, dir, 'Cursor.exe')
            if (!exePaths.includes(possibleExe)) {
              exePaths.push(possibleExe)
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ 扫描 Programs 目录失败:', e)
    }

    // 扫描所有可能路径
    for (const exePath of exePaths) {
      scannedPaths.push(exePath)
      if (existsSync(exePath)) {
        foundPaths.push(exePath)
        if (!cursorAppPath) {
          cursorAppPath = exePath
          console.log('✅ 找到 Cursor 程序:', exePath)
        }
      }
    }

    // 数据库路径
    const dbPaths = [
      path.join(appData, 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      path.join(localAppData, 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
    ]

    for (const dbPath of dbPaths) {
      scannedPaths.push(dbPath)
      if (existsSync(dbPath)) {
        foundPaths.push(dbPath)
        if (!cursorDbPath) {
          cursorDbPath = dbPath
          console.log('✅ 找到 Cursor 数据库:', dbPath)
        }
      }
    }

  } else if (platform === 'darwin') {
    // macOS 平台扫描
    const appPaths = [
      '/Applications/Cursor.app',
      path.join(homedir(), 'Applications', 'Cursor.app'),
      '/Applications/Cursor.app/Contents/MacOS/Cursor',
      path.join(homedir(), 'Applications', 'Cursor.app', 'Contents', 'MacOS', 'Cursor'),
    ]

    for (const appPath of appPaths) {
      scannedPaths.push(appPath)
      if (existsSync(appPath)) {
        foundPaths.push(appPath)
        if (!cursorAppPath) {
          cursorAppPath = appPath
          console.log('✅ 找到 Cursor 程序:', appPath)
        }
      }
    }

    // 数据库路径
    const dbPath = path.join(homedir(), 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'state.vscdb')
    scannedPaths.push(dbPath)
    if (existsSync(dbPath)) {
      foundPaths.push(dbPath)
      cursorDbPath = dbPath
      console.log('✅ 找到 Cursor 数据库:', dbPath)
    }

  } else {
    // Linux 平台扫描
    const exePaths = [
      '/usr/bin/cursor',
      '/usr/local/bin/cursor',
      '/opt/cursor/cursor',
      '/opt/Cursor/cursor',
      path.join(homedir(), '.local', 'bin', 'cursor'),
      path.join(homedir(), 'cursor', 'cursor'),
      // AppImage 常见位置
      path.join(homedir(), 'Applications', 'cursor.AppImage'),
      path.join(homedir(), 'Applications', 'Cursor.AppImage'),
      '/snap/bin/cursor',
      '/var/lib/flatpak/exports/bin/cursor',
    ]

    for (const exePath of exePaths) {
      scannedPaths.push(exePath)
      if (existsSync(exePath)) {
        foundPaths.push(exePath)
        if (!cursorAppPath) {
          cursorAppPath = exePath
          console.log('✅ 找到 Cursor 程序:', exePath)
        }
      }
    }

    // 数据库路径
    const dbPaths = [
      path.join(homedir(), '.config', 'Cursor', 'User', 'globalStorage', 'state.vscdb'),
      path.join(homedir(), '.config', 'cursor', 'User', 'globalStorage', 'state.vscdb'),
    ]

    for (const dbPath of dbPaths) {
      scannedPaths.push(dbPath)
      if (existsSync(dbPath)) {
        foundPaths.push(dbPath)
        if (!cursorDbPath) {
          cursorDbPath = dbPath
          console.log('✅ 找到 Cursor 数据库:', dbPath)
        }
      }
    }
  }

  console.log(`🔍 扫描完成: 共扫描 ${scannedPaths.length} 个路径，找到 ${foundPaths.length} 个有效路径`)

  return {
    cursorAppPath,
    cursorDbPath,
    scannedPaths,
    foundPaths
  }
}

// 扫描 Cursor 路径的 IPC 处理器
ipcMain.handle('scan-cursor-paths', async () => {
  try {
    const result = scanCursorPaths()
    
    // 如果找到路径，自动保存到设置中
    if (result.cursorAppPath || result.cursorDbPath) {
      const prev = (store.get('settings', {}) as any) || {}
      const next = {
        ...prev,
        cursorAppPath: result.cursorAppPath || prev.cursorAppPath || '',
        cursorDbPath: result.cursorDbPath || prev.cursorDbPath || ''
      }
      store.set('settings', next)
      console.log('✅ 已将扫描结果保存到设置')
    }

    return {
      success: true,
      ...result
    }
  } catch (error: any) {
    console.error('❌ 扫描 Cursor 路径失败:', error)
    return {
      success: false,
      error: error.message,
      cursorAppPath: null,
      cursorDbPath: null,
      scannedPaths: [],
      foundPaths: []
    }
  }
})

// 设置相关的IPC处理
ipcMain.handle('get-settings', () => {
  const defaultSettings = {
    cursorDbPath: '', // 可选：手动指定 Cursor state.vscdb 路径
    cursorAppPath: '', // 可选：手动指定 Cursor 应用程序路径
    batchRefreshSize: 5, // 批量刷新并发数，默认 5
    switchResetMachineId: true, // 切换账号时重置机器码，默认开启
    switchClearHistory: false // 切换账号时清理历史，默认关闭
  }

  // 先取已有设置
  const current = (store.get('settings', defaultSettings) as any) || defaultSettings

  let changed = false

  // 自动探测路径（仅在未手动设置时）
  if (!current.cursorDbPath || !current.cursorAppPath) {
    const scanResult = scanCursorPaths()
    
    if (!current.cursorDbPath && scanResult.cursorDbPath) {
      current.cursorDbPath = scanResult.cursorDbPath
      changed = true
      console.log('🔍 自动识别到 Cursor 数据库路径:', scanResult.cursorDbPath)
    }
    
    if (!current.cursorAppPath && scanResult.cursorAppPath) {
      current.cursorAppPath = scanResult.cursorAppPath
      changed = true
      console.log('🔍 自动识别到 Cursor 程序路径:', scanResult.cursorAppPath)
    }
  }

  // 如果有新探测出的路径，持久化
  if (changed) {
    store.set('settings', current)
  }

  return current
})

ipcMain.handle('save-settings', (_, settings: { cursorDbPath?: string; cursorAppPath?: string; batchRefreshSize?: number; switchResetMachineId?: boolean; switchClearHistory?: boolean }) => {
  // 仅合并允许的字段，避免意外覆盖
  const prev = (store.get('settings', {}) as any) || {}
  const next = {
    cursorDbPath: settings.cursorDbPath ?? prev.cursorDbPath ?? '',
    cursorAppPath: settings.cursorAppPath ?? prev.cursorAppPath ?? '',
    batchRefreshSize: settings.batchRefreshSize ?? prev.batchRefreshSize ?? 5,
    switchResetMachineId: settings.switchResetMachineId ?? prev.switchResetMachineId ?? true,
    switchClearHistory: settings.switchClearHistory ?? prev.switchClearHistory ?? false
  }
  store.set('settings', next)
  return { success: true }
})

// 选择 Cursor 程序路径（手动选择）
ipcMain.handle('pick-cursor-app-path', async () => {
  try {
    // 确保主窗口存在
    if (!mainWindow) {
      console.error('主窗口不存在，无法打开文件选择对话框')
      return { success: false, error: '主窗口不存在' }
    }

    const platform = process.platform

    const filters =
      platform === 'win32'
        ? [{ name: '可执行文件', extensions: ['exe'] }]
        : [{ name: '应用程序', extensions: ['app', '*'] }]

    // 使用 mainWindow 作为父窗口，确保对话框正确显示
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Cursor 程序',
      properties: ['openFile'],
      filters,
      // 设置默认路径，方便用户快速找到
      defaultPath: platform === 'win32' 
        ? (process.env.LOCALAPPDATA || 'C:\\') 
        : '/Applications'
    })

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      console.log('用户取消了文件选择')
      return { success: false, canceled: true }
    }

    const selectedPath = result.filePaths[0]
    console.log('📂 用户选择的 Cursor 程序路径:', selectedPath)

    // 顺便写入到 settings 中
    const prev = (store.get('settings', {}) as any) || {}
    const next = {
      ...prev,
      cursorAppPath: selectedPath
    }
    store.set('settings', next)

    return { success: true, path: selectedPath }
  } catch (error: any) {
    console.error('选择 Cursor 程序路径失败:', error)
    return { success: false, error: error.message }
  }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 检查更新
ipcMain.handle('check-for-updates', async () => {
  try {
    console.log('🔍 开始检查更新...')
    const response = await fetch('https://api.github.com/repos/Denny-Yuan/cursor-token-manager/releases/latest')
    
    if (!response.ok) {
      console.warn('⚠️ 获取最新版本失败:', response.status)
      return {
        success: false,
        error: `HTTP ${response.status}`
      }
    }
    
    const data = await response.json() as any
    const latestVersion = data.tag_name || data.name
    const currentVersion = 'v1.0.0'
    
    console.log('📦 当前版本:', currentVersion)
    console.log('📦 最新版本:', latestVersion)
    
    // 比较版本号（简单比较字符串）
    const hasUpdate = latestVersion && latestVersion !== currentVersion
    
    return {
      success: true,
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: data.html_url,
      releaseNotes: data.body,
      publishedAt: data.published_at
    }
  } catch (error: any) {
    console.error('❌ 检查更新失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
})


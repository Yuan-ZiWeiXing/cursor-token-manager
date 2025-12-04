/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getTokens: () => Promise<any[]>
    saveToken: (token: { id: string; name: string; token: string; isActive: boolean }) => Promise<{ success: boolean }>
    deleteToken: (id: string) => Promise<{ success: boolean }>
    setActiveToken: (id: string) => Promise<{ success: boolean }>
    switchCursorAccount: (id: string, options?: { resetMachineId?: boolean, clearHistory?: boolean }) => Promise<{ success: boolean; error?: string; path?: string; needCursorPath?: boolean; message?: string }>
    getAccountInfo: (token: string) => Promise<{ success: boolean; accountInfo?: { email?: string; name?: string; username?: string; id?: string; plan?: string; avatar?: string; [key: string]: any }; error?: string; errorMessage?: string; endpoint?: string }>
    checkTokenUsage: (id: string) => Promise<{ success: boolean; usage?: { used: number; limit: number | null; remaining?: number | null; percentage: number | null }; error?: string }>
    minimizeWindow: () => Promise<void>
    maximizeWindow: () => Promise<void>
    closeWindow: () => Promise<void>
    getSettings: () => Promise<{ cursorDbPath?: string; cursorAppPath?: string; batchRefreshSize?: number; switchResetMachineId?: boolean; switchClearHistory?: boolean; autoRefreshInterval?: number; autoRefreshEnabled?: boolean }>
    saveSettings: (settings: { cursorDbPath?: string; cursorAppPath?: string; batchRefreshSize?: number; switchResetMachineId?: boolean; switchClearHistory?: boolean; autoRefreshInterval?: number; autoRefreshEnabled?: boolean }) => Promise<{ success: boolean }>
    pickCursorAppPath: () => Promise<{ success: boolean; path?: string; error?: string }>
    scanCursorPaths: () => Promise<{ success: boolean; cursorAppPath?: string; cursorDbPath?: string; scannedPaths?: string[]; foundPaths?: string[]; error?: string }>
    syncCursorAccount: () => Promise<{ success: boolean; message?: string; error?: string; account?: { email: string; id: string } }>
    parseToken: (token: string) => Promise<{ success: boolean; parseResult?: any; error?: string; errorMessage?: string }>
    convertTokenToCookie: (token: string) => Promise<{ success: boolean; cookieFormat?: string; workosId?: string; message?: string; error?: string }>
    resetMachineId: () => Promise<{ success: boolean; error?: string; newIds?: any }>
    clearHistory: () => Promise<{ success: boolean; error?: string }>
    onSwitchAccountProgress: (callback: (data: { step: string; progress: number; message: string }) => void) => () => void
  }
}

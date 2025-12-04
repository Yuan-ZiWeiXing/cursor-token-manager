# Yuan-cursor账号管理器

一个美观的Mac风格桌面应用，用于管理Cursor编辑器的Token账号。

## 功能特性

- 🎨 **Mac风格UI** - 仿Mac系统设计，毛玻璃效果，流畅动画
- 🔑 **Token管理** - 添加、编辑、删除多个Token账号
- ⚡ **快速切换** - 一键切换当前使用的Token
- 💾 **数据持久化** - 自动保存所有Token信息
- 🪟 **无边框窗口** - 自定义标题栏，完美Mac体验

## 技术栈

- **Electron** - 桌面应用框架
- **React** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 快速构建工具
- **electron-store** - 数据持久化

## 开发

### 安装依赖

```bash
npm install
```

### 启动开发模式

```bash
npm run electron:dev
```

这将同时启动Vite开发服务器和Electron应用。

### 构建应用

```bash
npm run electron:build
```

构建完成后，可执行文件将在 `release` 目录中。

## 使用说明

1. 启动应用后，点击"添加新Token"按钮
2. 输入账号名称（例如：工作账号、个人账号）
3. 粘贴你的Cursor Token
4. 选择是否设为当前使用的Token
5. 保存后可以在列表中管理所有Token
6. 点击"设为当前"可以快速切换Token

## 项目结构

```
.
├── electron/          # Electron主进程代码
│   ├── main.ts       # 主进程入口
│   └── preload.ts    # 预加载脚本
├── src/              # React应用代码
│   ├── components/   # React组件
│   ├── styles/       # 样式文件
│   └── App.tsx       # 主应用组件
└── package.json      # 项目配置
```

## 许可证

MIT



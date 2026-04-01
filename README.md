# TClaw

OpenClaw 的桌面端控制面板：基于 **Vue 3 + Vite + Electron**，用于管理 Agent、渠道绑定、会话监控与日志查看。

## 环境要求

- [Node.js](https://nodejs.org/) 18+（推荐 LTS）
- [pnpm](https://pnpm.io/)（仓库已声明 `packageManager`，可用 Corepack：`corepack enable`）

## 安装依赖

```bash
pnpm install
```

## 启动开发

推荐使用（由 `vite-plugin-electron` 同时拉起渲染进程与主进程）：

```bash
pnpm dev
```

浏览器可访问 <http://localhost:5173/>；正常情况下会同时弹出 Electron 窗口加载同一开发地址。

> **说明**：若此前用 npm 安装过依赖，再改用 pnpm 时若出现 `electron` 目录占用（`EBUSY`），请先关闭所有 Electron 进程与相关终端后再执行 `pnpm install`。

## 其他脚本

| 命令 | 说明 |
|------|------|
| `pnpm run build` | 类型检查 + Vite 构建 + `electron-builder`（默认打**当前系统**对应产物） |
| `pnpm run build:win` | 同上后仅打 **Windows x64**（NSIS 安装包 + 便携版 `.exe`） |
| `pnpm run build:linux` | 同上后仅打 **Linux x64**（AppImage + `deb`） |
| `pnpm run preview` | 预览构建后的 Web 资源 |
| `pnpm run typecheck` | 仅执行 `vue-tsc` |
| `pnpm run electron:dev` | 使用 `concurrently` 启动 Vite 并等待端口后启动 `electron`（一般与 `pnpm dev` 二选一即可） |
| `pnpm run icons:build` | 由 `build/icon.svg` 生成 `build/icon.png` 与 `build/icon.ico` |

## 使用手册

完整说明见 **`src/content/USER_GUIDE.md`**，应用内侧边栏 **「使用手册」** 会渲染同一份 Markdown（路由 `/docs`）。

## 界面与主题（Tailwind CSS）

- 使用 **[Tailwind CSS v4](https://tailwindcss.com/docs/installation/using-vite)** + 官方 **[Vite 插件 `@tailwindcss/vite`](https://tailwindcss.com/docs/installation/using-vite)**，入口为 **`src/styles/tailwind.css`**（`@import "tailwindcss"`、`@theme` 设计令牌、`@layer` 中的 `.tclaw-page` 等组件类）。
- **[Typography](https://tailwindcss.com/docs/typography-plugin)**（`@tailwindcss/typography`）用于「使用手册」Markdown 排版（`prose` + `prose-invert`）。
- **Element Plus** 仍使用 `dark/css-vars` + 中文 `zh-cn`；与组件深度相关的覆盖放在 **`src/styles/tclaw-element.css`**（避免与 Tailwind 工具类冲突）。
- 配置文件为 **`vite.config.mts`**（ESM，以正确加载仅 ESM 的 Tailwind Vite 插件）。
- 各页使用 **`PageHeader`**（`src/components/PageHeader.vue`），布局优先写 **Tailwind 实用类**。

## 打包（Windows / Linux）

- 产物输出目录：**`release/`**（已在 `.gitignore` 中忽略）。
- **Windows**（`pnpm run build:win`，x64）：
  - **`TClaw-<version>-setup-x64.exe`**：NSIS 安装包（可改安装目录、桌面快捷方式）。
  - **`TClaw-<version>-portable-x64.exe`**：便携版，免安装。
  - 脚本已设置 **`CSC_IDENTITY_AUTO_DISCOVERY=false`** 并关闭可执行文件签名编辑，便于本地打包；正式发布若需签名，请自行配置证书并调整 `package.json` 的 `build.win`。
- **Linux**（`pnpm run build:linux`，x64）：生成 **AppImage** 与 **deb**。
- **应用图标**：仓库已包含 **`build/icon.svg`** 源稿及生成的 **`build/icon.png`**、**`build/icon.ico`**。若你修改了 SVG，请执行 **`pnpm run icons:build`** 重新生成 PNG/ICO（依赖 `sharp` 与 `to-ico`）。

> **跨平台**：在 **Windows** 上执行 `build:win`，在 **Linux**（或 WSL2 / 容器）上执行 `build:linux`。交叉编译请参考 [electron-builder 多平台构建](https://www.electron.build/multi-platform-build)。

### Windows 打包常见问题

- 若出现 **7-Zip 解压符号链接失败**（`Cannot create symbolic link`）：可开启系统 **开发者模式**（设置 → 隐私和安全性 → 开发者选项），或使用 **以管理员身份运行** 终端后再打包。

## 使用说明

1. 在应用内打开 **设置**，配置 **Gateway 地址**（可与 OpenClaw 网关一致）。**支持远程服务器**：填写 `http(s)://主机:端口` 或域名即可（如 `https://your-server:3000`），请求由 Electron 主进程发出，无浏览器 CORS 限制；需保证本机网络可达该地址。
2. 若要在本机编辑 `agents/*.yaml`、**渠道绑定** 等，需配置 **OpenClaw 目录**（包含 `agents/`、`gateway.yaml` 等）。纯远程、仅聊天/会话时可不填目录。
3. 侧边栏 **启动 / 停止 / 重启** 仅用于在本机目录拉起 OpenClaw 子进程；OpenClaw 已在远程运行时一般无需使用。

## 仓库结构（简要）

```
electron/           # 主进程、preload、配置与日志等服务
src/                # 渲染进程：页面、路由、Pinia
```

## 开源协议

若未另行声明，以仓库内 `LICENSE` 为准（若暂无则后续补充）。

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
| `pnpm run build` | 类型检查 + Vite 构建 + `electron-builder` 打包 |
| `pnpm run preview` | 预览构建后的 Web 资源 |
| `pnpm run typecheck` | 仅执行 `vue-tsc` |
| `pnpm run electron:dev` | 使用 `concurrently` 启动 Vite 并等待端口后启动 `electron`（一般与 `pnpm dev` 二选一即可） |

## 使用说明

1. 在应用内打开 **设置**，配置 **OpenClaw 目录**（包含 `agents/`、`gateway.yaml` 等）。
2. 配置 **Gateway 地址**（默认 `http://localhost:3000`），与 OpenClaw 网关一致。
3. 侧边栏可 **启动 / 停止 / 重启** OpenClaw 子进程（需在设置中指定目录，且目标目录下存在可执行的入口，如 `index.js`）。

## 仓库结构（简要）

```
electron/           # 主进程、preload、配置与日志等服务
src/                # 渲染进程：页面、路由、Pinia
```

## 开源协议

若未另行声明，以仓库内 `LICENSE` 为准（若暂无则后续补充）。

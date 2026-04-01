# TClaw 使用手册

**TClaw** 是面向 [OpenClaw](https://github.com/openclaw/openclaw) 生态的桌面控制端（Electron + Vue），用于在本地管理 Agent、渠道绑定、日志，并与 OpenClaw Gateway 进行聊天交互。

---

## 1. 安装与启动

### 环境

- Node.js 18+（推荐 LTS）
- 包管理器：**pnpm**（仓库已声明 `packageManager`）
- OpenClaw 已安装并可通过 `openclaw gateway` 启动

### 安装依赖

```bash
pnpm install
```

若 Electron 二进制异常，可在项目根目录执行：

```bash
node node_modules/electron/install.js
```

### 开发运行

```bash
pnpm dev
```

浏览器可访问 `http://localhost:5173/`，同时会打开 Electron 窗口。

### 打包

- Windows：`pnpm run build:win`（生成安装包与便携版）
- Linux：`pnpm run build:linux`（生成 AppImage 与 deb）

产物在 `release/` 目录。

---

## 2. 界面概览

| 模块 | 说明 |
|------|------|
| **Agent 管理** | 读取 `openclaw.json` 中的 `agents.list[]`（或本地 `agents/*.yaml`），支持新建与编辑 |
| **渠道绑定** | 一键式绑定消息渠道 — 选平台、填凭证、选 Agent，自动写入 `openclaw.json` |
| **Gateway 状态** | 通过 `/v1/models` 等端点轮询 Gateway 服务状态与可用 Agent 列表 |
| **聊天** | 通过 `/v1/chat/completions`（OpenAI 兼容）或 `/v1/responses`（OpenResponses）与 Agent 对话 |
| **日志** | 查看进程日志；可订阅外部日志文件并做关键字过滤与告警高亮 |
| **设置** | OpenClaw 目录、Gateway 地址与 Token、各类 API 路径、自动启动等 |
| **使用手册** | 与本文档同源（`src/content/USER_GUIDE.md`），应用内 Markdown 渲染 |

侧栏底部可 **启动 / 停止 / 重启** OpenClaw Gateway 子进程（执行 `openclaw gateway` 命令，需先在设置中配置目录）。

---

## 3. 首次配置（必读）

1. 打开 **设置**。
2. **OpenClaw 目录**：选择你的 OpenClaw 配置目录（包含 `openclaw.json` 的目录，通常是 `~/.openclaw`）。**若 OpenClaw 只跑在远程服务器**，可留空；此时 Agent 管理/渠道绑定将无法读写本地配置，但**聊天、Gateway 状态**仍可通过下方 Gateway 地址访问远程服务。
3. **Gateway 地址**：OpenClaw Gateway 默认监听端口 **18789**。可以是：
   - 本机：`http://localhost:18789`
   - 局域网：`http://192.168.x.x:18789`
   - 远程：`http://server:18789` 或 `https://openclaw.example.com`
4. **Gateway Token**：对应 OpenClaw 的 `gateway.auth.token`（或环境变量 `OPENCLAW_GATEWAY_TOKEN`）。OpenClaw **默认强制认证**，必须填写此项才能正常访问 API。仅当 Gateway 绑定 loopback 且 `gateway.auth.mode="none"` 时可留空。
5. 点击 **保存**。

---

## 3.1 启用 Gateway HTTP 端点

TClaw 通过 OpenClaw 的 **OpenAI 兼容 HTTP 端点**进行聊天和状态查询。这些端点**默认关闭**，需在 OpenClaw 配置中手动启用：

```json5
// ~/.openclaw/openclaw.json
{
  gateway: {
    http: {
      endpoints: {
        chatCompletions: { enabled: true },
        responses: { enabled: true },  // 可选
      },
    },
  },
}
```

或通过 CLI：

```bash
openclaw config set gateway.http.endpoints.chatCompletions.enabled true
```

---

## 4. 聊天

- **默认路径**：`/v1/chat/completions`（OpenAI Chat Completions 格式）
- **可选路径**：`/v1/responses`（OpenResponses 格式）
- **Agent 目标**：通过 model 字段路由，使用 `openclaw/default`（默认 Agent）或 `openclaw/<agentId>`（指定 Agent）
- 回复按 OpenAI 标准格式 `choices[0].message.content` 解析，同时兼容 OpenResponses 的 `output[].content[].text`

---

## 5. Agent 管理

OpenClaw 的 Agent 定义在 `openclaw.json` 的 `agents` 部分：

```json5
{
  agents: {
    defaults: { workspace: "~/.openclaw/workspace" },
    list: [
      { id: "main", default: true, workspace: "~/.openclaw/workspace-main" },
      { id: "work", workspace: "~/.openclaw/workspace-work" },
    ],
  },
}
```

TClaw 会读取此配置并在 Agent 管理页展示。支持新建和编辑 Agent，修改后自动写回 `openclaw.json`。

---

## 6. 渠道绑定（一键式）

TClaw 提供**一键式渠道绑定**，支持 11 个消息平台：

| 平台 | 凭证需求 | 配对方式 |
|------|----------|---------|
| **Telegram** | Bot Token（@BotFather 获取） | 填 Token 即可 |
| **WhatsApp** | 无 | **页面内扫码配对** |
| **Discord** | Bot Token（Developer Portal） | 填 Token 即可 |
| **Slack** | App Token + Bot Token | 填 Token 即可 |
| **Signal** | Signal 号码 | 填号码即可 |
| **MS Teams** | App ID + Password（Azure） | 填凭证即可 |
| **Google Chat** | — | 直接启用 |
| **Mattermost** | Bot Token + 服务器 URL | 填凭证即可 |
| **飞书** | App ID + App Secret | 填凭证即可 |
| **微信** | AppID + AppSecret + Token | 填凭证即可 |
| **QQ Bot** | AppID + Token + AppSecret | 填凭证即可 |

### 绑定流程

1. 进入 **渠道绑定** 页面
2. 点击要绑定的平台卡片
3. 填写对应平台所需的凭证（如 Bot Token）
4. 选择要绑定到的 Agent（留空则使用默认 Agent）
5. 点击 **「一键绑定」**

TClaw 会自动：
- 将渠道配置写入 `openclaw.json` 的 `channels.*` 部分
- 将 Agent 路由写入 `bindings[]` 部分
- OpenClaw Gateway **自动热重载**配置，无需手动重启

### WhatsApp 扫码配对

WhatsApp 绑定需要额外的 QR 码扫码步骤：

1. 点击 WhatsApp 卡片 → 填写 DM 策略 → 点击「一键绑定」
2. 配置写入成功后，**自动弹出扫码对话框**
3. TClaw 在后台执行 `openclaw channels login --channel whatsapp`
4. QR 码获取方式有两种（自动选择最佳方式）：
   - **高清图片模式**：从 CLI 输出中提取原始 QR 字符串，用 `qrcode` 库渲染为清晰的 QR 图片
   - **终端画模式**：直接展示 CLI 输出的 Unicode 方块字符画（同样可被手机扫描）
5. 用手机 WhatsApp 扫描屏幕上的二维码
6. 配对成功后对话框自动显示成功状态

> **注意**：已绑定的 WhatsApp 渠道卡片会显示「重新配对」按钮，可随时重新扫码（例如连接断开后）。

### 已绑定渠道管理

已启用的渠道会显示在页面顶部，展示 Agent 和 DM 策略信息。可以：
- **重新配对**（WhatsApp 等需要扫码的渠道）
- **解除绑定**（从 `openclaw.json` 中移除该渠道配置）

---

## 7. 日志

- 主进程与 `openclaw gateway` 子进程输出会进入应用内日志流。
- 在设置中填写 **日志文件路径** 后，可在日志页 **订阅文件日志**。
- 支持 **过滤关键字** 与 **告警关键字**（命中行高亮）。

---

## 8. 常见问题

**侧栏显示「未运行」**
确认已在设置中配置 OpenClaw 目录，且系统 PATH 中有 `openclaw` 命令，再点击启动。

**聊天请求返回 401**
请在设置中填写正确的 **Gateway Token**（对应 `gateway.auth.token`）。

**聊天请求返回 404 或 405**
需在 OpenClaw 配置中启用 HTTP 端点（见上方 3.1 节）。

**Gateway 状态查询无数据**
确认 Gateway 已启动（`openclaw gateway status`）、Token 正确、且 `/v1/models` 端点可访问。

**渠道绑定后未生效**
确认 Gateway 正在运行且配置热重载已启用（默认 `hybrid` 模式）。可运行 `openclaw channels status --probe` 检查渠道状态。

**WhatsApp 扫码页面无 QR 显示**
确认系统 PATH 中有 `openclaw` 命令。查看对话框底部的日志输出排查原因。若 QR 只出现在终端方块画模式且不够清晰，可尝试拉大窗口后重新获取。

**WhatsApp 配对后断开连接**
点击已绑定卡片上的「重新配对」按钮重新扫码。也可运行 `openclaw channels login --channel whatsapp` 手动配对。

**飞书/微信/QQ 绑定后如何验证**
TClaw 写入配置后 Gateway 会热重载。确认 Gateway 日志中出现对应渠道的连接信息，或运行 `openclaw channels status` 查看。

**pnpm 安装 Electron 报错 EBUSY**
关闭所有 Electron 窗口与相关终端后重试；必要时重新 `pnpm install`。

---

## 9. 开源与反馈

仓库与版本信息见项目根目录 `README.md`。功能与路由以当前代码为准。

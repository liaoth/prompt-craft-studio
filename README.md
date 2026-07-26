# Prompt Craft Studio

面向个人创作者的本地 Midjourney 双语提示词工作台。Windows 和 Linux 客户端开箱即用：无需登录、Docker、PostgreSQL 或环境变量，数据只保存在本机。

[English](README_EN.md)

## 功能

- 中英文提示词编排、结构化字段、参数与预设。
- 历史记录、收藏及修订、文件夹和个人常用词。
- 可选连接 OpenAI 兼容服务、Ollama、翻译服务和文本推送。
- SQLite 本地持久化，API 凭据通过 AES-256-GCM 加密。
- Electron 桌面客户端，支持 Windows x64 与 Linux x64。

## 安装客户端

从构建产物选择当前系统：

- Windows：安装版 `*.exe` 或便携版 `*.exe`。
- Linux：`*.AppImage` 或 `*.deb`。

首次启动会自动创建数据库、迁移和本地加密密钥，直接进入工作台。Windows 构建目前未签名，系统可能显示 SmartScreen 提示。

详见[快速开始](docs/zh-CN/quick-start.md)和[客户端构建](docs/zh-CN/deployment.md)。

## 从源码运行

要求 Node.js 22.13+：

```bash
npm install
npm run desktop:dev
```

也可仅运行本地网页：

```bash
npm run dev
```

默认地址为 <http://127.0.0.1:3000>。生产网页模式：

```bash
npm run build
npm start
```

所有模式均无必填环境变量。

## 打包

原生依赖必须在目标系统构建：

```bash
# Windows
npm run dist:win

# Linux
npm run dist:linux
```

产物输出到 `release/`。仓库还包含可手动触发的 GitHub Actions 工作流，可在 Windows 和 Linux runner 上分别构建。

## 数据与备份

关闭应用后，同时复制以下两个文件：

- `prompt-craft.db`
- `local.key`

桌面客户端将它们存放在系统应用数据目录下的 `workspace` 子目录；源码运行存放在仓库 `data/`。只备份数据库而丢失密钥会导致已保存的 API 凭据无法解密。

## 安全边界

- 客户端内置服务只监听 `127.0.0.1`。
- 允许访问本机 `localhost`、`127.0.0.1`、`::1` 服务以及公网 HTTPS。
- 阻止局域网私有地址，并拒绝跨站写请求。
- 本项目按个人本机应用设计，不应直接开放到局域网或公网。

更多资料：

- [配置说明](docs/zh-CN/configuration.md)
- [使用指南](docs/zh-CN/user-guide.md)
- [故障排查](docs/zh-CN/troubleshooting.md)
- [安全说明](SECURITY.md)

## 质量命令

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## License

MIT

# 客户端构建与本地部署

## 支持平台

- Windows x64：NSIS 安装版、便携版。
- Linux x64：AppImage、Debian 包。

因为 SQLite/libSQL 包含原生二进制，请在目标操作系统上构建。要求 Node.js 22.13+。

## Windows 构建

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run dist:win
```

## Linux 构建

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run dist:linux
```

产物位于 `release/`。当前 Windows 包未做代码签名；正式分发可在组织发布流程中配置签名证书。

## GitHub Actions

`.github/workflows/desktop-build.yml` 可手动运行，也会在推送 `desktop-v*` 标签时执行。Windows 与 Linux 使用各自原生 runner，产物作为 Actions Artifact 上传。

## 仅本地网页

```bash
npm ci
npm run build
npm start
```

服务固定监听 `127.0.0.1:3000`。这不是服务器部署方案，不要修改为 `0.0.0.0` 后开放网络访问。

## 备份与恢复

1. 完全退出应用。
2. 同时复制 `workspace/prompt-craft.db` 与 `workspace/local.key`。
3. 恢复时在应用关闭状态下成对覆盖。
4. 启动后检查历史、收藏和服务配置。

数据库和密钥版本必须匹配。日志无需备份。

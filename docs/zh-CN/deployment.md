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

客户端使用独立的长期维护分支 `desktop`，默认分支 `main` 无需包含客户端代码。推送指向 `desktop` 提交的 `desktop-v*` 标签后，`.github/workflows/desktop-build.yml` 会：

1. 在 Windows 与 Linux 原生 runner 上分别测试并构建。
2. 上传短期 Actions Artifact，便于排查构建问题。
3. 汇总安装包并生成 `SHA256SUMS.txt`。
4. 创建公开的 [GitHub Release](https://github.com/liaoth/prompt-craft-studio/releases)，供所有用户直接下载。

例如发布 `1.0.0`：

```bash
git switch desktop
git tag -a desktop-v1.0.0 -m "Prompt Craft Studio 1.0.0"
git push origin desktop
git push origin desktop-v1.0.0
```

Release 标签直接指向客户端分支，客户端代码不需要合并到 `main`。

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

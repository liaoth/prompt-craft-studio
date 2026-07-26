# Security

## 中文

Prompt Craft Studio 是单用户本机应用。内置服务只监听 `127.0.0.1`，不提供远程账号、多人隔离或公网部署能力，请勿通过端口映射、反向代理或防火墙放行将它暴露到局域网或公网。

服务配置中的密钥由 `local.key` 使用 AES-256-GCM 加密后写入 SQLite。请将 `prompt-craft.db` 与 `local.key` 一起备份并限制文件访问；不要提交 `data/`、`.env`、构建日志或安装包中的用户数据。丢失密钥后无法恢复已加密凭据。

自定义服务仅允许本机回环 HTTP/HTTPS 或公网 HTTPS。局域网、链路本地和云元数据地址会被拒绝，写接口还会检查浏览器同源信息。桌面窗口启用上下文隔离、沙箱并关闭 Node.js 集成。

发现漏洞时，请通过仓库的私密安全报告渠道提交，不要在公开 Issue 中附带密钥、数据库或完整日志。

## English

Prompt Craft Studio is a single-user local application. Its embedded server binds only to `127.0.0.1`; it does not implement remote accounts, multi-user isolation, or public hosting. Do not expose it to a LAN or the internet through port forwarding, a reverse proxy, or firewall rules.

Service credentials are encrypted with AES-256-GCM using `local.key` before they are stored in SQLite. Back up `prompt-craft.db` and `local.key` together and restrict file access. Never commit `data/`, `.env` files, build logs, or user data in installers. Encrypted credentials cannot be recovered if the key is lost.

Custom services may use loopback HTTP/HTTPS or public HTTPS. Private LAN, link-local, and cloud metadata targets are rejected, and write APIs check browser same-origin metadata. The desktop window uses context isolation and sandboxing with Node.js integration disabled.

Report vulnerabilities through the repository's private security channel. Do not attach credentials, databases, or complete logs to public issues.

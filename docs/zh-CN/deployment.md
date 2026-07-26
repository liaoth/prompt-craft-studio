# 生产部署

[返回首页](../../README.md) · [配置手册](configuration.md) · [故障排查](troubleshooting.md)

推荐结构：

```text
Internet
  -> HTTPS 反向代理（Nginx / Caddy / 云负载均衡器）
  -> 127.0.0.1:3000 Prompt Craft Studio
  -> 私有 Docker 网络中的 PostgreSQL
```

Compose 默认不向公网暴露 PostgreSQL，并把应用和 Mailpit 端口绑定到 `127.0.0.1`。

## 服务器要求

- 64 位 Linux，建议 2 vCPU / 4 GB RAM / 20 GB 可用磁盘起步。
- Docker Engine 和 Compose v2。
- 一个解析到服务器的域名。
- 可用的 SMTP 服务。
- 防火墙只开放 SSH、HTTP 和 HTTPS。

AI、LibreTranslate 和 Ollama 的资源需求不包含在上述基础配置中。

## 首次部署

```bash
git clone https://github.com/liaoth/prompt-craft-studio.git
cd prompt-craft-studio
cp .env.example .env
```

生产 `.env` 至少应设置：

```dotenv
NODE_ENV=production
APP_URL=https://prompt.example.com
BETTER_AUTH_URL=https://prompt.example.com
APP_PORT=3000

BETTER_AUTH_SECRET=独立随机值
APP_ENCRYPTION_KEY=另一个独立随机值

POSTGRES_DB=promptforge
POSTGRES_USER=promptforge
POSTGRES_PASSWORD=强数据库密码
DOCKER_DATABASE_URL=postgresql://promptforge:URL编码后的密码@postgres:5432/promptforge

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=SMTP密码
SMTP_FROM=Prompt Craft <noreply@example.com>
```

启动：

```bash
docker compose up --build -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

确认 `migrate` 成功退出、`postgres` 和 `app` 健康。

## Nginx 示例

```nginx
server {
    listen 80;
    server_name prompt.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name prompt.example.com;

    ssl_certificate     /etc/letsencrypt/live/prompt.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/prompt.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

代理和应用在同一台主机、应用只绑定 loopback 时，通常无需信任来自公网的任意代理头。若使用独立代理节点或负载均衡器，先用安全组限制源站只允许代理访问，再把精确代理 IP/CIDR 放入 `BETTER_AUTH_TRUSTED_PROXIES`。

## Caddy 示例

```caddy
prompt.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Caddy 会自动申请和续期证书。

## 邮件上线检查

Mailpit 不能用于生产。上线前测试：

1. 注册一个真实邮箱。
2. 验证邮件可以收到且链接域名正确。
3. 测试忘记密码。
4. 查看 SMTP 服务中是否有退信。

如需关闭公开注册：

```dotenv
ALLOW_SIGNUP=false
```

先创建需要的账号，再关闭注册。

## 数据备份

更新前创建逻辑备份：

```bash
mkdir -p backups
docker compose exec -T postgres \
  pg_dump -U promptforge -d promptforge -Fc \
  > "backups/promptforge-$(date +%Y%m%d-%H%M%S).dump"
```

备份目录已被 Git 忽略。定期把备份复制到另一台机器或对象存储，并实际验证恢复流程。

## 更新

```bash
git fetch origin
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

`docker compose up` 会先等待 PostgreSQL、运行迁移，再启动新应用。迁移失败时不要强行启动应用；查看：

```bash
docker compose logs migrate
```

## 日志与监控

```bash
docker compose logs -f --tail=200 app
docker compose logs -f --tail=100 postgres
docker compose ps
docker stats
```

建议外部监控每 30–60 秒请求 `/api/health`，并为磁盘空间、PostgreSQL 卷和 SMTP 失败设置告警。

## 安全清单

- `.env` 权限只允许部署用户读取。
- 不把 3000、8025、5432、11434 或 LibreTranslate 端口暴露到公网。
- 只开放 HTTPS；生产 Cookie 依赖 HTTPS。
- 为数据库、认证、加密、SMTP 和外部 API 使用不同密钥。
- `CUSTOM_ENDPOINT_HOST_ALLOWLIST` 只加入确实需要的主机。
- 不信任任意 `X-Forwarded-For`，不把整个私网段标为可信代理。
- 更新镜像和 npm 依赖前查看变更，执行完整测试和备份。
- 账号删除会级联删除业务配置；数据库备份仍按你的备份保留策略处理。

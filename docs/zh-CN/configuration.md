# 配置手册

[返回首页](../../README.md) · [快速开始](quick-start.md) · [部署指南](deployment.md) · [故障排查](troubleshooting.md)

配置分为两层：

- **站点配置**：部署者通过 `.env` 设置，供所有用户作为后备服务。
- **用户配置**：登录后在“服务配置”中保存。当前用户启用的配置优先于站点配置。

用户配置中的 API Key、Token 和私密端点会使用 `APP_ENCRYPTION_KEY` 加密；前端只收到掩码。

## 环境变量总表

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `APP_URL` | 是 | 对外访问的应用根地址，用于页面元数据。生产环境使用 `https://...`。 |
| `APP_PORT` | Docker 可选 | 宿主机监听端口，默认 `3000`，Compose 仅绑定 `127.0.0.1`。 |
| `BETTER_AUTH_URL` | 是 | Better Auth 的公开根地址，通常与 `APP_URL` 一致。 |
| `BETTER_AUTH_SECRET` | 是 | 至少 32 字符的随机认证密钥。 |
| `APP_ENCRYPTION_KEY` | 是 | Base64 编码的 32 字节密钥，或 64 位十六进制密钥。 |
| `ALLOW_SIGNUP` | 可选 | `true` 开放注册，`false` 关闭新注册。 |
| `POSTGRES_*` | Docker 必需 | Compose 创建 PostgreSQL 使用的数据库、用户和密码。 |
| `DOCKER_DATABASE_URL` | Docker 必需 | 容器内数据库连接串，主机名是 `postgres`。 |
| `DATABASE_URL` | 本地开发必需 | 直接运行 npm 命令时使用的 PostgreSQL 连接串。 |
| `DB_POOL_MAX` | 可选 | 每个应用进程的数据库连接池上限，默认由程序决定。 |
| `SMTP_*` | 是 | 邮箱验证、密码重置和账号删除邮件。 |
| `SITE_AI_*` | 可选 | 站点共享 AI。 |
| `SHARED_LIBRETRANSLATE_*` | 可选 | 站点共享 LibreTranslate。 |
| `CUSTOM_ENDPOINT_HOST_ALLOWLIST` | 可选 | 允许用户填写的自定义公网端点域名。 |
| `BETTER_AUTH_TRUSTED_PROXIES` | 生产代理可选 | 精确的可信代理 IP/CIDR，逗号分隔。 |
| `BETTER_AUTH_IP_HEADERS` | 生产代理可选 | 代理提供的客户端 IP 头，默认 `x-forwarded-for`。 |

生成随机密钥：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`BETTER_AUTH_SECRET` 和 `APP_ENCRYPTION_KEY` 必须使用两个不同的结果。不要在系统投入使用后随意更换 `APP_ENCRYPTION_KEY`。

## PostgreSQL

Docker 示例：

```dotenv
POSTGRES_DB=promptforge
POSTGRES_USER=promptforge
POSTGRES_PASSWORD=replace-with-a-strong-password
DOCKER_DATABASE_URL=postgresql://promptforge:replace-with-a-strong-password@postgres:5432/promptforge
```

连接串中的用户名、密码和数据库名必须 URL 编码。数据库迁移由 `migrate` 一次性容器完成。

本地 npm 开发示例：

```dotenv
DATABASE_URL=postgresql://promptforge:password@localhost:5432/promptforge
```

## 邮件与账号

本地 Docker 默认配置：

```dotenv
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=Prompt Craft <noreply@localhost>
```

生产 SMTP 示例：

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASSWORD=your-smtp-password
SMTP_FROM=Prompt Craft <noreply@example.com>
```

- 端口 `465` 通常使用 `SMTP_SECURE=true`。
- 端口 `587` 通常使用 STARTTLS，因此 `SMTP_SECURE=false`。
- `APP_URL` 和 `BETTER_AUTH_URL` 必须是用户能访问的 HTTPS 地址，否则邮件链接会错误。
- `ALLOW_SIGNUP=false` 只关闭新注册，不影响已有账号登录。

## 站点共享 AI

最少需要：

```dotenv
SITE_AI_PROVIDER=openai
SITE_AI_MODEL=gpt-4.1-mini
SITE_AI_API_KEY=your-api-key
SITE_AI_ENDPOINT=
SITE_AI_TIMEOUT_MS=45000
```

支持的 Provider ID：

| Provider ID | 协议 | 接口留空时使用 |
| --- | --- | --- |
| `openai` | OpenAI Chat Completions | OpenAI 默认接口 |
| `anthropic` | Anthropic Messages | Anthropic 默认接口 |
| `gemini` | Gemini generateContent | 按模型名生成接口 |
| `deepseek` | OpenAI 兼容 | DeepSeek 默认接口 |
| `qwen` | OpenAI 兼容 | DashScope 北京区域默认接口 |
| `doubao` | OpenAI 兼容 | 火山方舟北京区域默认接口 |
| `zhipu` | OpenAI 兼容 | 智谱默认接口 |
| `kimi` | OpenAI 兼容 | Moonshot 默认接口 |
| `minimax` | OpenAI 兼容 | MiniMax 默认接口 |
| `custom` | OpenAI 兼容 | 必须填写完整 `/v1/chat/completions` 地址 |

模型名会变化，请以供应商控制台中当前可用的精确模型 ID 为准。`SITE_AI_TIMEOUT_MS` 必须为 `1–120000` 的整数。

### Ollama

先安装 Ollama，并拉取一个资源适合本机的模型：

```bash
ollama pull qwen2.5:3b
ollama list
```

Docker Desktop 连接宿主机 Ollama：

```dotenv
SITE_AI_PROVIDER=custom
SITE_AI_MODEL=qwen2.5:3b
SITE_AI_API_KEY=ollama
SITE_AI_ENDPOINT=http://host.docker.internal:11434/v1/chat/completions
SITE_AI_TIMEOUT_MS=120000
```

Ollama 不校验 Key 时，仍需填写一个非空占位值，因为配置 Schema 要求 API Key 非空。Compose 已为 Linux 添加 `host.docker.internal:host-gateway`。Linux 上还需让 Ollama 监听 Docker 可访问的地址，并使用防火墙限制 11434 端口，不能把未鉴权的 Ollama 暴露到公网。

测试：

```bash
curl http://localhost:11434/api/tags
```

登录应用后，“服务配置”的站点服务区域可测试实际调用。站点配置可以精确使用管理员指定的内网地址；用户自己填写的自定义配置不能绕过私网 SSRF 限制。

## 站点共享 LibreTranslate

使用项目内置服务：

```bash
docker compose -f compose.yaml -f compose.translation.yaml up --build -d
```

叠加文件会为应用设置：

```dotenv
SHARED_LIBRETRANSLATE_URL=http://libretranslate:5000/translate
```

使用已有 LibreTranslate：

```dotenv
SHARED_LIBRETRANSLATE_URL=https://translate.example.com/translate
SHARED_LIBRETRANSLATE_API_KEY=your-api-key
SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE=zh-Hans
```

`SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE` 必须和实例 `/languages` 返回的中文代码一致，常见值是 `zh` 或 `zh-Hans`。没有启用 API Key 时留空 `SHARED_LIBRETRANSLATE_API_KEY`。

直接测试实例：

```bash
curl -X POST https://translate.example.com/translate \
  -H "Content-Type: application/json" \
  -d '{"q":"服务器已经部署完成。","source":"zh-Hans","target":"en","format":"text","api_key":"YOUR_KEY"}'
```

## 用户 AI 配置

登录后打开“服务配置 → AI 模型”：

1. 选择供应商。
2. 填写当前可用的精确模型 ID。
3. 填写 API Key。
4. 官方预设通常将接口留空；自定义 OpenAI 兼容服务必须填完整请求地址。
5. 保存，点击“测试”，然后启用。

同一用户只有一个启用配置。个人配置失败时，生成流程可以使用站点共享 AI；站点也未配置时会返回 `AI_PROVIDER_REQUIRED`。

自定义用户端点必须：

- 使用公网 HTTPS；
- 主机名位于 `CUSTOM_ENDPOINT_HOST_ALLOWLIST`；
- DNS 解析结果不是环回、链路本地或私网地址；
- 路径是服务实际接受的完整请求路径。

## 用户翻译配置

支持 LibreTranslate、DeepL API 和 Google Cloud Translation Basic v2。在“服务配置 → 翻译服务”中按帮助说明创建、测试并启用。

- LibreTranslate：填写完整 `/translate` 地址，Key 可选。
- DeepL Free：默认 `https://api-free.deepl.com/v2/translate`；Pro 使用 `https://api.deepl.com/v2/translate`。
- Google：使用启用了 Cloud Translation API 的 API Key，不是服务账号 JSON。

## 文本推送入口

### Discord Webhook

1. 在有权限的 Discord 服务器进入 **Server Settings → Integrations → Webhooks**。
2. 创建 Webhook、选择频道并复制完整 URL。
3. 在“服务配置 → 文本推送入口”选择 Discord Webhook。
4. URL 填入 Endpoint，API Key 留空，保存并测试。

Webhook 仅发送普通消息文本，**不会执行 `/imagine`，不会触发 Midjourney 出图**。

### 自定义 HTTP

端点收到 JSON `POST`，内容包含 Prompt、快照和参数。配置步骤：

1. 准备公网 HTTPS 接口。
2. 把它的主机名加入 `CUSTOM_ENDPOINT_HOST_ALLOWLIST`。
3. Endpoint 填完整 URL。
4. 如果接收端使用 Bearer Token，把 Token 填入 API Key。
5. 保存并测试。

## 外部端点白名单

```dotenv
CUSTOM_ENDPOINT_HOST_ALLOWLIST=models.example.com,translate.example.com,hooks.example.com
```

只填写主机名，不包含协议、路径或通配符。官方预设供应商和 `discord.com` Webhook 不需要加入。白名单并不会允许私网 IP；私网服务应由部署者配置为站点共享服务。

## 反向代理

只有当应用源站被网络策略限制为“只能由反向代理访问”时，才设置：

```dotenv
BETTER_AUTH_TRUSTED_PROXIES=172.18.0.10/32
BETTER_AUTH_IP_HEADERS=x-forwarded-for
```

不要信任整个私网段，也不要在源站仍可被用户直接访问时信任转发头。完整示例见[部署指南](deployment.md)。

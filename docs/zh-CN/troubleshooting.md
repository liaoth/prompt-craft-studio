# 故障排查

[返回首页](../../README.md) · [配置手册](configuration.md) · [部署指南](deployment.md)

先收集状态：

```bash
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 migrate
curl -i http://localhost:3000/api/health
```

## 应用无法启动

### `BETTER_AUTH_SECRET` 无效

不能使用 `.env.example` 的占位值，长度至少 32 字符：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### `APP_ENCRYPTION_KEY` 无效

必须是 Base64 编码的 32 字节值或 64 位十六进制。不要把普通 32 字符密码当作加密密钥。

### 数据库连接失败

- Docker 中使用 `DOCKER_DATABASE_URL`，主机名必须是 `postgres`。
- `POSTGRES_PASSWORD` 和连接串密码必须相同。
- 特殊字符必须 URL 编码。
- 查看 `docker compose logs postgres`。

## 迁移容器退出

退出码 0 是正常完成。其他情况查看：

```bash
docker compose logs migrate
```

不要删除已有迁移文件或手工修改 Drizzle journal。生产修复前先备份。

## 注册后收不到邮件

- 本地 Docker：打开 <http://localhost:8025>。
- 直接 `npm run dev`：把 `SMTP_HOST` 改为 `localhost`。
- 生产：检查 SMTP 主机、端口、TLS 模式、账号密码和 `SMTP_FROM`。
- 链接域名错误：修正 `APP_URL` 与 `BETTER_AUTH_URL`，重启应用后重新发送邮件。

## 登录后仍要求邮箱验证

使用最新验证邮件；旧 Token 可能已过期。检查系统时间和 `BETTER_AUTH_URL`。验证成功后清除该站点旧 Cookie并重新登录。

## AI 三版本提示未配置

`AI_PROVIDER_REQUIRED` 表示用户没有启用配置，且 `SITE_AI_PROVIDER`、`SITE_AI_MODEL`、`SITE_AI_API_KEY` 没有形成完整站点配置。

结构规则模式仍可使用。配置后在“服务配置”先测试，再启用。

## Ollama 测试失败或超时

1. 宿主机执行 `ollama list`。
2. 测试 `curl http://localhost:11434/api/tags`。
3. Docker 使用完整地址 `http://host.docker.internal:11434/v1/chat/completions`。
4. 模型名必须和 `ollama list` 完全一致。
5. `SITE_AI_API_KEY` 填非空占位值，如 `ollama`。
6. 慢模型可设置 `SITE_AI_TIMEOUT_MS=120000`。
7. 内存不足时换更小模型。

Linux 还需确认 Ollama 监听地址和防火墙允许 Docker 网桥访问。

## LibreTranslate 连接成功但不能中英翻译

- 请求 URL 必须包含 `/translate`。
- 通过实例 `/languages` 确认中文代码。
- 根据实例设置 `SHARED_LIBRETRANSLATE_CHINESE_LANGUAGE_CODE=zh` 或 `zh-Hans`。
- 启用 Key 的实例必须填写 `SHARED_LIBRETRANSLATE_API_KEY`。
- 检查实例是否加载了英语和中文模型。

## 自定义端点提示 `UNSAFE_ENDPOINT`

用户自定义端点必须是加入 `CUSTOM_ENDPOINT_HOST_ALLOWLIST` 的公网 HTTPS 主机，而且不能解析到私网、环回或链路本地地址。

本机/内网 AI 或翻译服务不要作为用户配置填写，应由管理员通过 `SITE_AI_*` 或 `SHARED_LIBRETRANSLATE_*` 设置。

## 参数变灰或不进入 Prompt

这是兼容性保护。检查当前：

- 模型版本；
- Midjourney Web / Discord；
- 图像 / 视频任务；
- 该参数依赖的图片引用；
- 与其他参数的冲突。

不支持的参数会被禁用，并从最终 Prompt 过滤。把鼠标移到帮助按钮可查看当前原因和官方说明。

## Discord 收到文字但没有出图

这是预期行为。Discord Webhook 只能发送普通消息，不能代表用户执行斜杠命令，也不会触发 Midjourney Bot。请复制完整 Prompt，在 Midjourney Web 或 Discord 官方交互中手动使用。

## 修改 `.env` 后没有生效

重新创建应用容器：

```bash
docker compose up -d --force-recreate app
```

如果修改影响镜像构建，再执行：

```bash
docker compose up --build -d
```

## 端口被占用

修改 `.env`：

```dotenv
APP_PORT=3001
```

然后重建应用容器，访问 `http://localhost:3001`。同时更新 `APP_URL` 和 `BETTER_AUTH_URL`。

## 完全重置本地数据

以下操作会永久删除数据库卷，只能用于明确不需要数据的本地环境：

```bash
docker compose down -v
docker compose up --build -d
```

生产环境不要使用。

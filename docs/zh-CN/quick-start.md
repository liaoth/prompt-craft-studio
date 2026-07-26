# 快速开始

[返回首页](../../README.md) · [配置手册](configuration.md) · [使用手册](user-guide.md)

本指南使用 Docker Compose 启动完整开发环境，包括 PostgreSQL、数据库迁移、应用和 Mailpit 邮箱。

## 1. 准备环境

- Windows/macOS：Docker Desktop，启用 Docker Compose v2。
- Linux：Docker Engine + Compose plugin。
- Git。
- 建议至少 4 GB 可用内存；同时运行 Ollama 或 LibreTranslate 时需要更多内存。

确认版本：

```bash
docker --version
docker compose version
git --version
```

## 2. 获取代码

```bash
git clone https://github.com/liaoth/prompt-craft-studio.git
cd prompt-craft-studio
cp .env.example .env
```

PowerShell 可以使用：

```powershell
Copy-Item .env.example .env
```

## 3. 设置必需变量

执行下面的命令两次，得到两个不同的随机值：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

在 `.env` 中填写：

```dotenv
BETTER_AUTH_SECRET=第一个随机值
APP_ENCRYPTION_KEY=第二个随机值
POSTGRES_PASSWORD=一个新的数据库密码
DOCKER_DATABASE_URL=postgresql://promptforge:经过URL编码的密码@postgres:5432/promptforge
```

如果密码包含 `@`、`:`、`/`、`#` 等字符，必须在 `DOCKER_DATABASE_URL` 中 URL 编码。可执行：

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" "你的数据库密码"
```

## 4. 启动

```bash
docker compose up --build -d
docker compose ps
```

`postgres`、`migrate`、`app` 和 `mailpit` 应正常完成或健康。迁移容器执行成功后退出属于正常现象。

查看日志：

```bash
docker compose logs -f app
```

## 5. 注册与验证

1. 打开 <http://localhost:3000>。
2. 注册邮箱账号。
3. 打开 <http://localhost:8025>。
4. 进入最新验证邮件并点击验证链接。
5. 返回应用登录。

Mailpit 只适合本地开发，不会把邮件投递到真实邮箱。

## 6. 完成第一次生成

1. 保持“结构规则”模式。
2. 输入中文创意。
3. 选择模板或把常用词拖到结构化分组。
4. 设置模型、画面比例等参数。
5. 点击“生成 Prompt”。
6. 复制完整 Prompt，或收藏为作品。

结构规则模式不需要 AI Key。要使用 AI 三版本和自动翻译，请继续阅读[配置手册](configuration.md)。

## 7. 停止与更新

停止但保留数据：

```bash
docker compose down
```

更新：

```bash
git pull --ff-only
docker compose up --build -d
```

生产数据库更新前应先备份。不要执行 `docker compose down -v`，除非明确要永久删除 PostgreSQL 数据卷。

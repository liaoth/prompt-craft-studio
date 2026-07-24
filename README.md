# Prompt Craft Studio

面向中文创作者的 Midjourney Prompt 工作台。默认通过双语规则模板生成提示词；用户也可以保存自己的大模型和翻译服务配置，启用 AI 润色、翻译与结构化生成。

## 主要能力

- 主体、场景、构图、镜头、灯光、色彩、材质等结构化编辑
- Midjourney 参数校验与兼容性提示
- 用户常用词库，点击即可插入当前编辑位置
- 自动保留最近 100 条去重历史记录
- 无数量上限的收藏及备注
- OpenAI、Claude、Gemini 与多家国内模型预设
- LibreTranslate、DeepL、Google 翻译适配
- 向 Discord Webhook 或自定义 HTTPS 入口推送 Prompt，并保存独立投递记录
- 邮箱注册、验证与密码找回
- API Key 与私密端点均由服务端加密保存

## 本地开发

1. 复制 `.env.example` 为 `.env`，替换数据库密码、认证密钥和 32 字节加密密钥。Docker 部署还需设置 `DOCKER_DATABASE_URL`，其中的特殊字符必须 URL 编码。
2. 准备 PostgreSQL，设置 `DATABASE_URL`。
3. 安装依赖并执行迁移：

   ```bash
   npm ci
   npm run db:migrate
   npm run dev
   ```

## Docker 部署

```bash
docker compose up --build
```

如需同时运行免费的自托管中英翻译：

```bash
docker compose -f compose.yaml -f compose.translation.yaml up --build
```

应用默认位于 `http://localhost:3000`，开发邮件可在 `http://localhost:8025` 查看。生产环境请改用真实 SMTP，并为 `BETTER_AUTH_SECRET`、`APP_ENCRYPTION_KEY` 和数据库密码设置独立随机值。

“发送到配置入口”只执行 HTTP 文本推送，不会创建、查询或跟踪官方 Midjourney 图片任务。

如需在生产环境允许用户填写自定义 OpenAI 兼容地址或翻译地址，请将域名加入
`CUSTOM_ENDPOINT_HOST_ALLOWLIST`（逗号分隔）。官方预设供应商不需要加入该名单。

## 验证

```bash
npm test
npm run typecheck
npm run lint
npm run db:generate
npm audit --audit-level=high
npm run build
```

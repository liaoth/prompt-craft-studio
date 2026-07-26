# 配置说明

本地版没有必填环境变量，也没有 `.env.example`。所有日常配置均在客户端“服务配置”界面保存。

## 数据位置

桌面端默认位置：

- Windows：`%APPDATA%\prompt-craft-studio\workspace`
- Linux：`~/.config/prompt-craft-studio/workspace`

实际目录以 Electron 的 `userData` 路径为准。源码运行使用仓库 `data/`。

目录包含：

- `prompt-craft.db`：历史、收藏、文件夹、常用词和服务设置。
- `local.key`：加密服务凭据的本地密钥。
- `desktop.log`：桌面启动与本地服务日志。

## AI 服务

支持 OpenAI、DeepSeek、Anthropic、Gemini、Moonshot、OpenRouter、Groq、Ollama 与 OpenAI 兼容接口。填写服务名称、Endpoint、模型和 API Key 后测试连接。

Ollama 示例：

```text
Endpoint: http://127.0.0.1:11434/v1/chat/completions
Model: qwen2.5:7b
API Key: ollama
```

## 翻译服务

支持 DeepL、Google、Microsoft、OpenAI 兼容模型和 LibreTranslate。LibreTranslate 本机示例：

```text
Endpoint: http://127.0.0.1:5000/translate
```

## 文本推送

支持 Discord Webhook 和自定义 HTTP 接口。Discord 只接受官方 Webhook 主机与路径；自定义服务请使用公网 HTTPS 或本机回环地址。

## 网络限制

- `http://localhost:*`、`http://127.0.0.1:*`、`http://[::1]:*` 可用于本机服务。
- 公网服务必须使用 HTTPS。
- `10/8`、`172.16/12`、`192.168/16`、链路本地和云元数据地址会被拒绝。
- 本地客户端不支持局域网共享。

## 内部变量

`PROMPT_CRAFT_DATA_DIR` 和 `PROMPT_CRAFT_MIGRATIONS_DIR` 只供打包运行与自动测试使用，不属于用户配置接口。

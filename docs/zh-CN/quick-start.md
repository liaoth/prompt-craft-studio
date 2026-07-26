# 快速开始

## 安装版

Windows 使用安装版或便携版 `.exe`；Linux 使用 `.AppImage` 或 `.deb`。首次启动无需注册和配置，应用会自动：

1. 在系统应用数据目录创建 `workspace`。
2. 生成 `local.key`。
3. 创建并迁移 `prompt-craft.db`。
4. 在随机端口启动仅绑定 `127.0.0.1` 的本地服务。
5. 打开个人工作区。

Linux AppImage 首次使用：

```bash
chmod +x Prompt-Craft-Studio-*.AppImage
./Prompt-Craft-Studio-*.AppImage
```

Debian/Ubuntu：

```bash
sudo apt install ./Prompt-Craft-Studio-*.deb
```

## 源码开发

安装 Node.js 22.13+ 后：

```bash
npm install
npm run desktop:dev
```

仅启动网页应用：

```bash
npm run dev
```

访问 <http://127.0.0.1:3000>。`predev` 会自动完成数据初始化。

## 第一次使用

结构规则模式无需外部服务即可生成提示词。需要 AI、翻译或推送时，打开“服务配置”，添加服务并先执行连接测试。设置保存在本机数据库，密钥不会回传给任何站点服务。

## 退出与备份

关闭应用后备份系统应用数据目录 `workspace` 中的 `prompt-craft.db` 和 `local.key`。两个文件必须成对保留。

# 故障排查

## 客户端无法启动

查看应用数据目录 `workspace/desktop.log`。确认磁盘可写、杀毒软件未隔离应用，并尝试重启。不要删除 `prompt-craft.db` 或 `local.key`。

## Windows 显示 SmartScreen

当前开发构建未签名。只使用可信仓库或 CI 产生的安装包，核对文件哈希后选择继续运行。公开分发前应配置代码签名。

## Linux AppImage 无法运行

```bash
chmod +x Prompt-Craft-Studio-*.AppImage
./Prompt-Craft-Studio-*.AppImage
```

部分发行版需要安装 FUSE；也可使用 `.deb`。

## 数据库或迁移失败

关闭所有应用实例，备份整个 `workspace`，确认目录可写且磁盘空间充足。不要同时启动两个版本。若从备份恢复，必须同时恢复数据库和密钥。

## 服务连接测试失败

1. 本机服务使用 `127.0.0.1`，不要填写 Docker 或局域网地址。
2. 公网 Endpoint 必须为 HTTPS。
3. 检查模型名、Key、代理和服务额度。
4. Ollama 需先在本机启动并确认模型已拉取。
5. LibreTranslate 默认路径通常为 `/translate`。

## API 凭据无法解密

通常是 `local.key` 与数据库不匹配。恢复与该数据库同时备份的密钥，然后重启；没有匹配密钥时只能删除并重新创建对应服务配置。

## 源码端口被占用

关闭占用 3000 端口的程序，或仅在源码调试时使用 Next.js 的端口参数。桌面安装版会自动选择空闲回环端口。

## 重置本地数据

先备份，然后在应用完全退出后将整个 `workspace` 移到另一个明确命名的目录。再次启动会创建全新数据。确认不再需要旧数据前不要永久删除备份。

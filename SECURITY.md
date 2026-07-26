# Security Policy / 安全策略

## 报告漏洞

请不要在公开 Issue 中提交可利用细节、真实密钥或用户数据。请通过 GitHub 仓库所有者资料中提供的私密联系方式报告，并说明受影响版本、复现条件、影响和建议修复方式。

部署者应始终使用独立随机值配置 `BETTER_AUTH_SECRET`、`APP_ENCRYPTION_KEY`、数据库密码和 SMTP 凭据。不要公开 `.env`，不要把应用源站直接暴露在不受信任网络中。

## Reporting a vulnerability

Do not post exploitable details, real credentials, or user data in a public issue. Contact the repository owner privately using the contact method on their GitHub profile and include the affected version, reproduction conditions, impact, and suggested remediation.

Operators must use independent random values for `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`, the database password, and SMTP credentials. Never publish `.env`, and do not expose the application origin directly to an untrusted network.

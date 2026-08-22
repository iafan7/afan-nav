# LinkNest 部署说明

## 快速部署（推荐：拉取镜像）

镜像由 GitHub Actions 推送到 **GHCR**：`ghcr.io/iafan7/afan-nav:latest`（`main` 分支推送后更新）。

```bash
cd /path/to/afan-nav
git pull origin main
cp .env.example .env   # 公网请改 SESSION_SECRET / COOKIE_SECURE
mkdir -p data && sudo chown -R 1001:1001 data   # 或 chmod 777 data

docker compose pull
docker compose up -d
```

首次若镜像为 **私有包**，需登录 GHCR（Personal Access Token 需 `read:packages`）：

```bash
echo "<GITHUB_PAT>" | docker login ghcr.io -u <GitHub用户名> --password-stdin
docker compose pull && docker compose up -d
```

或在 GitHub → Packages → `afan-nav` → **Package settings → Change visibility → Public**，服务器即可匿名 `pull`。

### 从源码构建（开发 / 无镜像时）

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

- Compose：仓库根目录 `docker-compose.yml`（正式部署配置）
- 环境变量：根目录 `.env`（不入库；由 `.env.example` 复制）。未设置时 Compose 使用内置默认值
- 数据目录：`./data` → 容器 `/data`（SQLite + `uploads/link-icons`）
- 容器名：`linknest`
- 健康检查：`http://127.0.0.1:3000/api/public/site`
- 前台：http://127.0.0.1:3000/
- 登录：http://127.0.0.1:3000/login

反向代理、HTTPS 证书与防火墙由部署者自行配置。

## 默认环境变量

以下默认值**仅用于首次初始化和快速部署**，**不是**安全的生产配置：

| 变量 | 默认值 |
|---|---|
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `123456` |
| `SESSION_SECRET` | `0123456789abcdef0123456789abcdef`（32 字符） |
| `COOKIE_SECURE` | `false` |

请务必注意：

- 默认管理员账号：`admin`；默认管理员密码：`123456`
- 首次登录后应**立即**在后台「站点设置 → 安全设置」修改管理员密码
- 初始化完成后，**数据库管理员凭据为权威来源**；修改环境变量**不会**覆盖已有管理员密码
- 正式公网部署必须替换默认 `SESSION_SECRET`
- HTTPS 环境必须将 `COOKIE_SECURE` 设置为 `true`

## 环境变量

| 变量 | 说明 |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | **仅首次**写入 `admin_credentials`；已有管理员时 env **不得**覆盖；密码 **6～18** 位 |
| `SESSION_SECRET` | ≥32 字符；公网必须替换 Compose / `.env.example` 中的默认值 |
| `COOKIE_SECURE` | HTTPS：`true`；纯 HTTP：`false` |
| `PORT` | 宿主机映射端口，默认 `3000` |
| `DATABASE_PATH` | 容器内默认 `/data/linknest.db` |
| `ENABLE_SERVER_TIMING` | 默认关闭；仅诊断时设 `true` |

后台「站点设置 → 安全设置」改密后**立即生效**，无需重启容器。

## 状态 / 暂停 / 启动

```bash
docker compose ps
curl -sf http://127.0.0.1:3000/api/public/site
docker logs --tail 100 linknest

docker compose stop
docker compose start
```

## 更新版本（保留数据）

**禁止**对有数据环境执行 `docker compose down -v`、`volume prune`、`system prune --volumes`。

```bash
git pull origin main
docker compose pull
docker compose up -d --force-recreate
```

固定版本可在 `.env` 设置，例如 `LINKNEST_IMAGE=ghcr.io/iafan7/afan-nav:v1.0.0`。

## 备份与恢复

见 `ops/BACKUP.md`、`ops/RESTORE.md`：

```bash
ops/scripts/backup.sh
# FORCE_RESTORE=1 ops/scripts/restore.sh backups/<ts> ./data
```

## 日志

```bash
docker logs --tail 200 linknest
```

关注：hydration / 5xx / SQLite locked|readonly|malformed / Session / 上传权限 / 静态资源 404 / 敏感信息。Hitokoto 超时但有缓存或兜底时不算整站失败。

## 测试（开发）

```bash
cd apps/web
pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build

# 隔离改密 E2E（不碰 ./data）
apps/web/e2e-security/run-isolated.sh
```

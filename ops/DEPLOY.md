# LinkNest 部署说明

## 快速部署

```bash
cd /path/to/afan-nav
cp .env.example .env
# 填写 ADMIN_USERNAME、ADMIN_PASSWORD、SESSION_SECRET（≥32）、COOKIE_SECURE
mkdir -p data && chmod 777 data   # 或: sudo chown -R 1001:1001 data

docker compose up -d --build
```

- Compose：仓库根目录 `docker-compose.yml`（唯一正式部署配置）
- 环境变量：根目录 `.env`（不入库；由 `.env.example` 复制）
- 数据目录：`./data` → 容器 `/data`（SQLite + `uploads/link-icons`）
- 容器名：`linknest`
- 健康检查：`http://127.0.0.1:3000/api/public/site`
- 前台：http://127.0.0.1:3000/
- 登录：http://127.0.0.1:3000/login

缺少 `ADMIN_USERNAME` / `ADMIN_PASSWORD` / `SESSION_SECRET` / `COOKIE_SECURE` 时，`docker compose` 会明确失败。

反向代理、HTTPS 证书与防火墙由部署者自行配置。

## 环境变量

| 变量 | 说明 |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | **仅首次**写入 `admin_credentials`；已有管理员时 env **不得**覆盖；密码 **6～18** 位 |
| `SESSION_SECRET` | ≥32 字符；禁止弱默认上线 |
| `COOKIE_SECURE` | HTTPS：`true`；纯 HTTP 实验室：`false` |
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
docker compose --env-file .env start
```

## 重建容器（保留数据）

**禁止**对有数据环境执行 `docker compose down -v`、`volume prune`、`system prune --volumes`。

```bash
docker compose --env-file .env up -d --force-recreate --build
```

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

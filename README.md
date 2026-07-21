# LinkNest（链巢）

自托管**个人书签导航**站（单管理员）。

技术栈：Next.js 15 App Router · TypeScript · pnpm · SQLite + Drizzle · iron-session · Docker Compose。

## 功能概览

**前台**：分类导航、链接卡片、站内筛选、外置搜索引擎、每日一言、浅色/深色主题、响应式布局。

**后台**（`/admin` → `/admin/links`）：

| 菜单 | 路径 |
|------|------|
| 链接管理 | `/admin/links` |
| 分类管理 | `/admin/categories` |
| 搜索引擎 | `/admin/search-engines` |
| 站点设置 | `/admin/settings`（含安全设置改密） |
| 导出备份 | `/admin/export` |

- 管理员：`ADMIN_*` 仅用于**首次初始化**；之后以 SQLite 为准，后台改密立即生效（密码规则 6～18 位）
- 链接图标：`/data/uploads/link-icons`，公开读取 `/api/uploads/link-icons/<file>`
- 不含：多用户、角色权限、忘记密码、访问统计

## 快速启动（本地开发）

```bash
cp .env.example apps/web/.env.local
# 填写 ADMIN_*、SESSION_SECRET（≥32）等
cd apps/web && pnpm install && pnpm dev
```

## Docker 部署

详见 `ops/DEPLOY.md`。仓库根目录仅保留一份正式 Compose：

```bash
cp .env.example .env
# 必填：ADMIN_USERNAME、ADMIN_PASSWORD、SESSION_SECRET、COOKIE_SECURE
mkdir -p data && chmod 777 data
docker compose up -d --build
```

- 前台：http://127.0.0.1:3000/
- 登录：http://127.0.0.1:3000/login
- 数据：`./data`（SQLite + 上传图标）

## 环境变量

见根目录 `.env.example`（复制为 `.env`，勿提交）：

| 变量 | 说明 |
|------|------|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅首次写入管理员；已有记录时 env 不覆盖 |
| `SESSION_SECRET` | ≥32 字符，缺失则 Compose 失败 |
| `COOKIE_SECURE` | HTTPS：`true`；纯 HTTP：`false` |
| `DATABASE_PATH` | 容器内默认 `/data/linknest.db` |

## 备份与恢复

| 文档 | 说明 |
|------|------|
| `ops/DEPLOY.md` | 部署、重建、日志 |
| `ops/BACKUP.md` | 备份范围与脚本 |
| `ops/RESTORE.md` | 恢复步骤 |

```bash
ops/scripts/backup.sh
FORCE_RESTORE=1 ops/scripts/restore.sh backups/<ts> ./data
```

## 测试

```bash
cd apps/web
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build

# 隔离改密 E2E（不碰部署数据目录）
apps/web/e2e-security/run-isolated.sh
```

## 当前版本

发布候选：**v1.0.0-rc.1**（真机与正式 HTTPS 验收待完成后方可正式 `v1.0.0`）。

## 仓库结构

- `apps/web` — 应用源码、migration、测试与静态资源
- `ops/` — 部署/备份/恢复文档与脚本
- `docker-compose.yml` — 唯一正式部署 Compose
- `.env.example` — 环境变量模板

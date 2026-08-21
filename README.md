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
| 导出 / 导入备份 | `/admin/export` |

- 管理员：`ADMIN_*` 仅用于**首次初始化**；之后以 SQLite 为准，后台改密立即生效（密码规则 6～18 位）
- 链接图标：`/data/uploads/link-icons`，公开读取 `/api/uploads/link-icons/<file>`
- 不含：多用户、角色权限、忘记密码、访问统计

## 快速启动（本地开发）

```bash
cp .env.example apps/web/.env.local
cd apps/web && pnpm install && pnpm dev
```

默认示例账号见下方「默认环境变量」。首次登录后请立即在后台「安全设置」修改密码。

## Docker 部署

详见 `ops/DEPLOY.md`。仓库根目录仅保留一份正式 Compose：

```bash
cp .env.example .env   # 可直接使用示例默认值快速启动
mkdir -p data && chmod 777 data
docker compose up -d --build
```

未提供环境变量时，Compose 使用与 `.env.example` 相同的默认值。

- 前台：http://127.0.0.1:3000/
- 登录：http://127.0.0.1:3000/login（默认 `admin` / `123456`）
- 数据：`./data`（SQLite + 上传图标）

## 默认环境变量

以下默认值**仅用于首次初始化和快速部署**，**不是**安全的生产配置：

| 变量 | 默认值 |
|------|--------|
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_PASSWORD` | `123456` |
| `SESSION_SECRET` | `0123456789abcdef0123456789abcdef`（32 字符） |
| `COOKIE_SECURE` | `false` |

请务必注意：

- 首次登录后应**立即**在后台「站点设置 → 安全设置」修改管理员密码
- 初始化完成后，**数据库中的管理员凭据为权威来源**；修改环境变量**不会**覆盖已有管理员密码
- 正式公网部署必须替换默认 `SESSION_SECRET`
- HTTPS 环境必须将 `COOKIE_SECURE` 设为 `true`

见根目录 `.env.example`（复制为 `.env`，勿提交）。

| 变量 | 说明 |
|------|------|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 仅首次写入管理员；已有记录时 env 不覆盖 |
| `SESSION_SECRET` | ≥32 字符；公网必须替换默认值 |
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

**v1.0.0**

## 仓库结构

- `apps/web` — 应用源码、migration、测试与静态资源
- `ops/` — 部署/备份/恢复文档与脚本
- `docker-compose.yml` — 唯一正式部署 Compose
- `.env.example` — 环境变量模板（含快速部署默认示例）

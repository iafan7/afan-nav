# LinkNest Web

Next.js 15 App Router + SQLite (Drizzle) 单体应用。定位：个人导航，单管理员。

## 环境变量

见仓库根目录 `.env.example`。本地复制为 `.env.local`。

常用项：`ADMIN_USERNAME` / `ADMIN_PASSWORD` / `SESSION_SECRET` / `DATABASE_PATH` / `COOKIE_SECURE` / `ENABLE_SERVER_TIMING`。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发服务器 |
| `pnpm build` / `pnpm start` | 生产构建与启动 |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | 类型检查 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm test:e2e` | Playwright（需本机浏览器依赖；生产机推荐 Docker，见根 README） |
| `pnpm db:generate` | Drizzle 生成迁移 |
| `pnpm format` | Prettier |

## Docker

由仓库根目录唯一正式 `docker-compose.yml` 构建本目录 `Dockerfile`。

- 数据卷：`/data`（含 `linknest.db` 与 `uploads/link-icons`）
- `.dockerignore` 排除 `node_modules`、`.next`、`e2e`、测试与报告，缩小 build context
- 镜像内单独安装 `better-sqlite3` 原生模块（standalone 补丁）
- 纯 HTTP：`COOKIE_SECURE=false`

## 测试要点

- 单元：校验器、限流、默认搜索引擎、Hitokoto、上传、响应式 CSS 契约
- E2E：登录、CRUD、导出、移动端无横滚、深浅色、菜单抽屉
- 改密隔离 E2E：`e2e-security/run-isolated.sh`（临时目录，不碰仓库 `./data`）

测试使用独立/临时库；勿指向生产数据库。

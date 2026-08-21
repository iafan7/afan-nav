# LinkNest 备份

## 范围

完整备份必须包含：

1. SQLite 数据库：`linknest.db`（优先在线 `.backup` / better-sqlite3 `backup()`）
2. 上传图标目录：`uploads/link-icons/`

## 命令

```bash
# 默认备份 ./data → backups/<UTC时间戳>/
ops/scripts/backup.sh

# 或指定路径：
ops/scripts/backup.sh /path/to/data /path/to/backups
```

产物：

| 文件 | 说明 |
|---|---|
| `linknest.db` | 数据库快照 |
| `uploads/link-icons/` | 图标文件 |
| `manifest.txt` | 计数、integrity、git commit（**不含**密码或哈希） |
| `SHA256SUMS` | 校验和 |

`backups/` 已在 `.gitignore`，不会进入 Git。

## 注意

- 脚本使用 `set -Eeuo pipefail`
- **不会**删除或覆盖源数据目录
- 不要把真实密码、Session Cookie 或完整 `password_hash` 写入备份文档或报告

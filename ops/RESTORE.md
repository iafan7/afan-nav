# LinkNest 恢复

## 命令

```bash
# 恢复到目标数据目录（默认拒绝覆盖已有 linknest.db）
ops/scripts/restore.sh backups/<timestamp> /path/to/target-data

# 覆盖目标已有库时：
FORCE_RESTORE=1 ops/scripts/restore.sh backups/<timestamp> ./data
```

恢复后自行启动 Compose，并确保数据目录对容器用户（uid 1001）可写：

```bash
chmod 777 data   # 或: sudo chown -R 1001:1001 data
docker compose --env-file .env up -d
curl -sf http://127.0.0.1:3000/api/public/site
```

## 事故恢复示例

1. `docker compose stop`
2. `FORCE_RESTORE=1 ops/scripts/restore.sh backups/<ts> ./data`
3. `chmod 777 data`（或 `chown -R 1001:1001`）
4. `docker compose --env-file .env start`
5. 健康检查：`curl -sf http://127.0.0.1:3000/api/public/site`

## 注意

- 恢复脚本校验 `SHA256SUMS`（若存在）与 `integrity_check`
- 管理员密码以恢复后的 SQLite 为准；`ADMIN_*` 环境变量不会覆盖已有管理员行

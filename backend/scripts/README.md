# Backend Scripts

## migrate_base64_keys_to_fernet.py

### 用途
将 `model_configs` 表中 `api_key` 字段从旧的 base64 编码迁移到 Fernet 加密格式。

### 何时运行
- **仅一次**：在 M2 安全基线部署后、服务正式对外前执行
- 如果表为空或 api_key 全为空，运行也无害

### 用法
```bash
cd backend
python scripts/migrate_base64_keys_to_fernet.py
```

### 选项
- `--dry-run`：预览将要迁移的记录数，不写回数据库
- `--batch-size=N`：每批处理 N 条（默认 100）

### 输出
- 控制台实时进度
- 详细日志：`logs/key_migration_<timestamp>.log`

### 幂等性
脚本会自动跳过以下记录：
- `api_key` 为空
- `api_key` 已经是 Fernet 格式（以 `gAAA` 开头）

因此可以安全地重复执行。

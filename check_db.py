import sqlite3
import os

# 连接到数据库
conn = sqlite3.connect('ainovel.db')
cursor = conn.cursor()

# 检查所有表
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("数据库中的表:")
for table in tables:
    print(f"  - {table[0]}")

# 检查项目表数据
try:
    cursor.execute("SELECT * FROM projects;")
    projects = cursor.fetchall()
    print(f"\n项目表中的数据 ({len(projects)} 条记录):")
    for project in projects:
        print(f"  {project}")
except sqlite3.Error as e:
    print(f"\n查询项目表时出错: {e}")

# 检查用户表数据
try:
    cursor.execute("SELECT * FROM users;")
    users = cursor.fetchall()
    print(f"\n用户表中的数据 ({len(users)} 条记录):")
    for user in users:
        print(f"  {user}")
except sqlite3.Error as e:
    print(f"\n查询用户表时出错: {e}")

conn.close()
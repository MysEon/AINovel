import sqlite3

# 连接到数据库
conn = sqlite3.connect('ainovel.db')
cursor = conn.cursor()

# 插入测试数据
try:
    cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", 
                   ("testuser", "test@example.com", "hashed_password"))
    conn.commit()
    print("数据插入成功")
    
    # 查询插入的数据
    cursor.execute("SELECT * FROM users;")
    users = cursor.fetchall()
    print(f"用户表中的数据 ({len(users)} 条记录):")
    for user in users:
        print(f"  {user}")
        
except sqlite3.Error as e:
    print(f"插入数据时出错: {e}")
finally:
    conn.close()
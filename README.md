# AINovel - 智能小说创作助手

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![React 19](https://img.shields.io/badge/react-19-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/fastapi-0.104+-009688.svg)](https://fastapi.tiangolo.com/)

AINovel 是一个基于 Web 的智能小说创作平台，旨在帮助作者更高效地创作、管理和组织小说内容。

## ✨ 特性

- 📚 **项目管理** - 创建和管理多个小说项目，跟踪字数和章节统计
- 👥 **角色管理** - 详细记录角色信息，包括性格、背景、外貌等
- 🌍 **世界观构建** - 定义世界规则、魔法体系、科技水平和时间线
- 🏛️ **地点与组织** - 构建小说世界的地理环境、文化特色和组织结构
- ✍️ **章节编辑** - 支持章节内容编写、大纲规划和字数统计
- 📝 **草稿管理** - 临时存储创作灵感和片段，支持标签分类
- 🤖 **AI 辅助** - 集成多种 AI 模型，提供智能创作辅助
- 🔐 **用户认证** - JWT 令牌认证机制，保护用户数据

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Python 3.8+
- Docker (可选)

### 本地开发

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/AINovel.git
   cd AINovel
   ```

2. **启动后端**
   ```bash
   cd backend
   pip install -r requirements.txt
   python main.py
   ```

3. **启动前端**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Docker 部署

```bash
docker-compose up --build
```

访问 http://localhost:3000 查看前端，http://localhost:8000 查看后端API。

## 📖 文档

- [API 文档](http://localhost:8000/docs) - FastAPI 自动生成的 API 文档
- [用户指南](docs/user-guide.md) - 详细的使用说明
- [开发指南](docs/development.md) - 开发环境搭建和贡献指南

## 🛠️ 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLite (SQLAlchemy ORM)
- **认证**: JWT (Python-JOSE)
- **密码加密**: bcrypt
- **ASGI 服务器**: Uvicorn

### 前端
- **框架**: React 19
- **构建工具**: Vite
- **语言**: JavaScript
- **图标库**: React Icons

## 📁 项目结构

```
AINovel/
├── backend/                 # 后端代码
│   ├── routers/            # API 路由
│   ├── alembic/            # 数据库迁移
│   ├── main.py             # FastAPI 应用入口
│   ├── models.py           # 数据库模型
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端代码
│   ├── src/
│   │   ├── components/     # React 组件
│   │   ├── services/       # API 服务
│   │   └── App.jsx         # 应用入口
│   └── package.json        # Node.js 依赖
├── docker-compose.yml      # Docker 编排配置
└── README.md              # 项目说明
```

## 🤝 贡献

我们欢迎所有形式的贡献！请查看 [贡献指南](CONTRIBUTING.md) 了解详细信息。

### 开发流程

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和用户。

## 📞 联系我们

- 提交 [Issue](https://github.com/yourusername/AINovel/issues)
- 邮箱: support@ainovel.com
- 官网: www.ainovel.com

---

⭐ 如果这个项目对您有帮助，请考虑给我们一个 Star！
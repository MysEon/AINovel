# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI novel writing platform built with a React frontend and FastAPI backend. The application allows users to create and manage novel projects, write chapters with AI assistance, and track their writing progress.

## Architecture

### Frontend (React)

- Built with React and Vite
- Uses React Hooks for state management
- Component-based architecture with reusable UI components
- Services layer for API communication
- CSS modules for styling with responsive design and dark theme support

### Backend (FastAPI)

- Built with FastAPI for asynchronous API development
- SQLAlchemy ORM with SQLite database
- JWT-based authentication
- Modular router structure for different entity types (projects, chapters, characters, etc.)

### Key Components

- Project management (creation, editing, deletion)
- Chapter writing with AI assistance modes
- Published chapters library
- Character/location/organization/worldview management
- User authentication and session management

## Common Development Commands

### Starting the Development Servers

```bash
# Start backend server
cd backend
python main.py

# Start frontend development server
cd frontend
npm run dev
```

### Building for Production

```bash
# Build frontend
cd frontend
npm run build
```

### Database

- SQLite database file is automatically created at `ainovel.db`
- Database tables are created automatically on application startup

### API Structure

- Base URL: `/api`
- Authentication: JWT tokens stored in localStorage
- Entity endpoints follow RESTful patterns:
  - GET /api/projects/ - List all projects
  - POST /api/projects/ - Create new project
  - GET /api/projects/{project_id}/chapters - List chapters in project
  - PUT /api/chapters/{chapter_id} - Update chapter
  - DELETE /api/chapters/{chapter_id} - Delete chapter

### Key Service Files

- `frontend/src/services/chapterService.js` - Chapter-related API calls
- `frontend/src/services/projectService.js` - Project-related API calls

### Key Component Files

- `frontend/src/components/ProjectEditor.jsx` - Main project editing interface
- `frontend/src/components/writing/WritingEditor.jsx` - Chapter writing interface with AI assistance
- `frontend/src/components/writing/PublishedChapters.jsx` - Published chapters library
- `frontend/src/components/ProjectOverview.jsx` - Project dashboard with statistics

### Routing

- Frontend routing is handled within ProjectEditor.jsx
- Backend routing is modular with separate routers for each entity type

### Authentication

- JWT tokens are stored in localStorage under 'ainovel_token'
- Protected routes require valid authentication headers
- Session management handled through auth router

### Styling

- CSS files accompany most component files
- Dark theme support with .dark-theme class
- Responsive design with media queries for mobile devices

## Development Practices

### Incremental Implementation

- Implement features in small steps
- Get user verification after each feature implementation
- Do not implement many features at once before verification
- Code writing must follow design patterns, such as the Adapter pattern, to ensure code is easy to read and modify.

### Git Commit Practices

- Commit frequently with detailed commit messages without any ads about yourself
- Commit messages should contain only project details that AI can reference as project context
- Use descriptive commit messages that explain the "why" rather than just the "what"

### Task Management

- Read or update TODO.md before and after each operation
- Keep task list synchronized with actual progress
- Use TODO.md as the single source of truth for task tracking

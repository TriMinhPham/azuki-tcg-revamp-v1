# Azuki TCG Revamp - Developer Guidelines

## Build Commands
- `npm run dev` - Start development server (front-end only)
- `npm run server` - Start Express backend server
- `npm run start` - Start full-stack development (backend + frontend concurrently)
- `npm run build` - Build production-ready frontend
- `npm run prod` - Build frontend and start production server

## Code Style
- **TypeScript**: Use strict typing with interfaces in `src/types/`
- **Imports**: Use absolute imports with `@/` prefix (e.g., `import { Component } from '@/components'`)
- **Components**: Functional components with React hooks; export named components
- **State Management**: React hooks for local state; avoid global state when possible
- **Error Handling**: Use try/catch blocks with specific error messages in server routes
- **Naming**: PascalCase for components, camelCase for variables/functions, UPPER_SNAKE for constants
- **File Structure**: Group by feature (components, pages, utils), then by component
- **React Three Fiber**: For 3D rendering; avoid direct Three.js manipulation
- **Comments**: Document complex logic and component props
- **API Responses**: Always include `success` boolean in responses

## Project Structure
- `/src` - Frontend React/TypeScript code
- `/server.js` - Express backend server
- `/cache` - Local cache storage for API results
- `/public` - Static assets
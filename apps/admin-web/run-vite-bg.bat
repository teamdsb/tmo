@echo off
set VITE_ADMIN_WEB_MODE=mock
corepack pnpm exec vite --host 0.0.0.0 --port 5174 >> vite-dev.log 2>&1

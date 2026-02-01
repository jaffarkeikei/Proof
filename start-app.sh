#!/bin/bash

echo "🚀 Starting Proof - Complete Application"
echo ""

# Kill any existing processes
echo "Stopping any existing processes..."
pkill -f "node server-full.js" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# Start backend server
echo "Starting backend server on port 3000..."
node server-full.js > logs/backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

# Wait for backend to start
sleep 3

# Start frontend
echo "Starting frontend on port 3001..."
cd app && npx next dev -p 3001 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

sleep 3

echo ""
echo "✅ Application started!"
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║  🎬 Proof - Complete Application Running                  ║"
echo "║                                                            ║"
echo "║  Backend API: http://localhost:3000                        ║"
echo "║  Frontend:    http://localhost:3001                        ║"
echo "║                                                            ║"
echo "║  Open http://localhost:3001 in your browser               ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for user interrupt
trap "echo 'Stopping services...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Keep script running
wait

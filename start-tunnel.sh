#!/bin/bash
# Persistent localtunnel script - automatically restarts on failure

while true; do
  echo "$(date): Starting localtunnel on port 3000..."
  lt --port 3000
  echo "$(date): Tunnel died, restarting in 5 seconds..."
  sleep 5
done
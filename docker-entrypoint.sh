#!/bin/bash
# Use Railway's PORT env variable (default to 8080 if not set)
PORT="${PORT:-8080}"

# Update Apache to listen on the correct port at runtime
sed -i "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/:80/:${PORT}/" /etc/apache2/sites-available/000-default.conf
echo "ServerName localhost:${PORT}" >> /etc/apache2/apache2.conf

echo "Starting Apache on port ${PORT}..."
exec apache2-foreground

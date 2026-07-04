FROM php:8.2-apache

# Install MongoDB PHP extension
RUN pecl install mongodb && docker-php-ext-enable mongodb

# Disable mpm_event and enable mpm_prefork (required for mod_php)
RUN a2dismod mpm_event && a2enmod mpm_prefork

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set the document root
ENV APACHE_DOCUMENT_ROOT /var/www/html

# Set default port (Railway provides PORT env variable at runtime)
ENV PORT 8080

# Copy project files to container
COPY . /var/www/html/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html

# Expose the port expected by Railway (container will listen on ${PORT})
EXPOSE 8080

# Add entrypoint script and fix Windows CRLF line endings
COPY docker-entrypoint.sh /usr/local/bin/
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

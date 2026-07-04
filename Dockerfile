FROM php:8.2-apache

# Install MongoDB PHP extension
RUN pecl install mongodb && docker-php-ext-enable mongodb

# Disable mpm_event and enable mpm_prefork (required for mod_php)
RUN a2dismod mpm_event && a2enmod mpm_prefork

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Copy project files to container
COPY . /var/www/html/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html

# Set default port (Railway provides PORT env variable at runtime)
ENV PORT 8080

# Expose port for Railway
EXPOSE 8080

# At runtime: configure Apache to listen on $PORT (Railway sets this), then start
CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen $PORT/g\" /etc/apache2/ports.conf && sed -i \"s/:80/:$PORT/g\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]

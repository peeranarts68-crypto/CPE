FROM php:8.2-apache

# Install MongoDB PHP extension
RUN pecl install mongodb && docker-php-ext-enable mongodb

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set the document root
ENV APACHE_DOCUMENT_ROOT /var/www/html

# Copy project files to container
COPY . /var/www/html/

# Set proper permissions
RUN chown -R www-data:www-data /var/www/html

# Expose port (Railway uses PORT env variable)
EXPOSE 80

# Start Apache
CMD ["apache2-foreground"]

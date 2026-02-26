# Usamos Nginx versión Alpine (menos de 50MB)
FROM nginx:alpine

# Copiamos el contenido de tu proyecto al directorio público de Nginx
COPY . /usr/share/nginx/html

# Exponemos el puerto 80 del contenedor
EXPOSE 80

# Nginx se inicia automáticamente, no necesitamos CMD
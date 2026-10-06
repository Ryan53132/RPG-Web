# --- build do Vite ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- nginx: serve o front e repassa socket/uploads para a API ---
FROM nginx:1.27-alpine

# Instala o pacote gettext para ter acesso ao comando envsubst
RUN apk add --no-cache gettext

# Copia o arquivo de configuração renomeado como template para a pasta de templates do Nginx
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copia os arquivos gerados no build do Vite para a pasta pública do Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Cria e copia um script de inicialização para injetar a variável de ambiente no Nginx
COPY <<-'EOF' /docker-entrypoint.sh
#!/bin/sh
# Substitui a variável ${BACKEND_URL} no template e gera o arquivo de configuração final do Nginx
envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
# Inicia o Nginx em primeiro plano
exec nginx -g 'daemon off;'
EOF

RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

# Define o script de entrada para rodar antes de subir o Nginx
ENTRYPOINT ["/docker-entrypoint.sh"]
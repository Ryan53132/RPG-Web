#!/bin/sh

# Substitui a variável ${BACKEND_URL} no arquivo de configuração do nginx pelo valor da env var da Render
envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# Inicia o Nginx em primeiro plano
exec nginx -g 'daemon off;'
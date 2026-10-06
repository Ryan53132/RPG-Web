FROM node:20-alpine
ENV NODE_ENV=production DATA_DIR=/data
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY index.js ./
COPY src ./src
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 3001
VOLUME /data
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "index.js"]

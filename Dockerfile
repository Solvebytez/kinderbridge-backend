FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY ./ ./
EXPOSE 5001
ENV NODE_ENV=production
ENV PORT=5001
CMD ["node","src/server.js"]
FROM node:20-slim

# Install building dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Pre-create internal data folder layout
RUN mkdir -p /usr/src/app/db_storage && chmod 777 /usr/src/app/db_storage

COPY package*.json ./

# Force compilation directly inside this exact container's OS layer
RUN npm install --build-from-source=sqlite3

COPY . .

EXPOSE 8080

CMD ["node", "broker.js"]
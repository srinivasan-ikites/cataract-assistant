FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY cataract-ui/package*.json ./
RUN npm ci

# Copy source
COPY cataract-ui/ .

# Build-time API URL for Vite (override with build-arg)
ARG VITE_API_URL=http://backend:8000
ENV VITE_API_URL=${VITE_API_URL}

# Build static assets
RUN npm run build

# Runtime image
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY cataract-ui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


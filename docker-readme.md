# Docker Setup for Learnwith Backend Auth

This document explains how to run the Learnwith Backend Auth application using Docker.

## Prerequisites

- Docker
- Docker Compose

## Getting Started

1. Clone the repository and navigate to the project root:

```bash
git clone <repository-url>
cd <repository-directory>
```

2. Create an environment file from the example (if needed):

```bash
cp .env.example .env
```

3. Edit the `.env` file with your actual configuration:
   - The default `DATABASE_URL` in the docker-compose.yml is already set up correctly for Docker
   - Set a secure `JWT_SECRET` (at least 32 characters)
   - Configure Google OAuth credentials
   - Default ports: API runs on 4000, PostgreSQL on 5433

## Running with Docker Compose

1. Start all services:

```bash
docker compose up -d
```

2. Check logs (optional):

```bash
docker compose logs -f api
```

3. Stop all services:

```bash
docker compose down
```

4. Other useful Docker Compose commands:

```bash
# Rebuild containers after making changes to Dockerfile
docker compose build

# View running containers
docker compose ps

# Execute command inside a container
docker compose exec api sh

# View resource usage of containers
docker compose top

# Stop and remove containers, networks, and volumes
docker compose down -v

# Start specific service
docker compose up -d api
```

## Configuration

The Docker Compose setup includes:

1. **API Service**: 
   - Fastify application running on port 4000 (mapped to host port 4000)
   - Uses a multi-stage Docker build for optimized production container
   - Automatically runs Prisma migrations on startup
   - Restart policy: unless-stopped

2. **Database**: 
   - PostgreSQL 16 (Alpine variant) running on port 5432 (mapped to host port 5433)
   - Default credentials: postgres/postgres
   - Database name: learnwith
   - Restart policy: unless-stopped

## Networks

- `learnwith-network`: Bridge network that connects all services

## Volumes

- `postgres_data`: Persistent volume for PostgreSQL data
- `logs`: Volume for application logs (mounted from local ./logs directory)

## Development and Building

To rebuild the Docker image after making changes:

```bash
docker compose build api
```

For local development with hot-reload, uncomment these lines in docker-compose.yml:

```yaml
volumes:
  # Mount for persistent logs if needed
  - ./logs:/usr/src/app/logs
  # Optional: Mount for development (uncomment in development)
  - .:/usr/src/app
  - /usr/src/app/node_modules
```

## Troubleshooting

1. To check container status:
   ```bash
   docker compose ps
   ```

2. To view detailed logs:
   ```bash
   docker compose logs -f
   ```

3. To connect to the database directly:
   ```bash
   docker compose exec db psql -U postgres -d learnwith
   ```

4. To run Prisma commands directly:
   ```bash
   docker compose exec api npx prisma studio
   docker compose exec api npx prisma migrate deploy
   ``` 

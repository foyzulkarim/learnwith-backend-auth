# learnwith-backend

## Database Setup

This project uses Prisma with PostgreSQL for both development and production environments.

### Prerequisites

- PostgreSQL server (local or containerized)
- Node.js and npm

### Local Development Setup

1. Start the PostgreSQL database container:

   ```bash
   docker compose up -d db
   ```

2. Make sure your `.env` file contains the correct database URL:

   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5433/learnwith?schema=public"
   ```

3. Run the database migrations:

   ```bash
   npm run prisma:migrate
   ```

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Test your database connection:

   ```bash
   npm run db:test
   ```

### Useful Database Commands

- Open Prisma Studio to browse/edit data: `npm run prisma:studio`
- Reset the database: `npm run prisma:reset`
- Push schema changes without migrations: `npm run prisma:push`

## Docker Setup

The project includes Docker configuration for running both the API and PostgreSQL database in containers. To start the entire stack:

```bash
docker compose up -d
```

This will start both the API server and the PostgreSQL database.

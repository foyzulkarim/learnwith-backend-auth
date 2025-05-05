# learnwith-backend

## Database Setup

This project uses Prisma with SQLite for local development. To set up your local database:

1. Make sure your `.env` file contains the correct database URL:
   ```
   DATABASE_URL="file:./dev.db"
   ```

2. Initialize your database with the Prisma schema:
   ```bash
   npx prisma db push
   ```

This will create the necessary tables in your SQLite database file. Note that the database file (`dev.db`) is not included in source control and needs to be generated locally.

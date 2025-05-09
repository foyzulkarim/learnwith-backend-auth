# Migration from PostgreSQL/Prisma to MongoDB/Mongoose

This document outlines the changes made to convert the authentication system from PostgreSQL/Prisma to MongoDB/Mongoose.

## Major Changes

1. **Database Technology**
   - Replaced PostgreSQL with MongoDB
   - Replaced Prisma ORM with Mongoose ODM

2. **Authentication System**
   - Maintained Fastify's built-in OAuth2 for social authentication
   - Continued using JWT tokens for authenticated sessions

3. **File Structure Changes**
   - Removed Prisma schema and migrations
   - Added Mongoose models and connection logic

## Modified Files

### Configuration Files
- `src/config/schema.ts`: Updated for MongoDB connection
- `package.json`: Updated dependencies and scripts
- `docker-compose.yml`: Replaced PostgreSQL with MongoDB
- `Dockerfile`: Removed Prisma-specific commands

### Plugin System
- Created `src/plugins/mongoose.ts`: MongoDB connection plugin
- Modified `src/app.ts`: Updated to use mongoose plugin

### User Module
- `src/modules/user/user.model.ts`: Created Mongoose model for User
- `src/modules/user/user.service.ts`: Updated to use Mongoose instead of Prisma

### Authentication Module
- `src/modules/auth/auth.service.ts`: Modified to work with Mongoose
- `src/modules/auth/auth.controller.ts`: Streamlined implementation

## Environment Variables

The `.env` file structure has been updated:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=mongodb://localhost:27017/learnwith
JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3030

# Google OAuth Credentials
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

## Testing

To test the MongoDB connection:
```bash
npm run db:test
```

To start the application in development mode:
```bash
npm run dev
```

## Authentication Flow

1. User initiates a Google login from the frontend
2. User is redirected to Google for authentication
3. After successful authentication, Google redirects back to our callback URL
4. Fastify OAuth2 plugin processes the authentication response
5. The application fetches the user profile from Google, creates/finds the user in MongoDB
6. The application generates JWT tokens and sets them in HTTP-only cookies
7. The user is redirected to the frontend application
8. Protected routes verify authentication using the JWT tokens

## Additional Notes

- The transition maintains the same API endpoints and authentication flow
- All social login functionality continues to work with a cleaner implementation
- The MongoDB connection is easier to configure and does not require migrations
- By leveraging Fastify's built-in OAuth2 support, we've kept the codebase simpler and more maintainable 

# LearnWith Authentication Backend

This is the authentication service for the LearnWith platform, handling user authentication through Google OAuth 2.0.

## Technology Stack

- **Node.js**: Runtime environment
- **TypeScript**: Programming language
- **Fastify**: Web framework
- **MongoDB**: Database
- **Mongoose**: MongoDB ODM
- **@fastify/oauth2**: OAuth authentication
- **JWT**: JSON Web Tokens for authentication

## Getting Started

### Prerequisites

- Node.js 24.x
- npm 11.x
- MongoDB 6.x+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/learnwith-backend-auth.git
   cd learnwith-backend-auth
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```bash
   cp .env.example .env
   ```

4. Fill in the environment variables in `.env`:
   ```
   NODE_ENV=development
   PORT=3000
   DATABASE_URL=mongodb://localhost:27017/learnwith
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_chars_long
   FRONTEND_URL=http://localhost:5173
   ALLOWED_ORIGINS=http://localhost:5173

   # Google OAuth Credentials (Get these from Google Cloud Console)
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
   ```

5. Test the database connection:
   ```bash
   npm run db:test
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

## Authentication Flow

1. User initiates a Google login from the frontend
2. User is redirected to Google for authentication
3. After successful authentication, Google redirects back to our callback URL
4. Server receives user info from Google, creates/finds user account in MongoDB
5. Server generates JWT tokens and sends them to the client via HTTP-only cookies
6. Client can access protected routes using the JWT token

## API Endpoints

### Authentication

- `GET /api/auth/google`: Initiates Google OAuth login
- `GET /api/auth/google/callback`: Callback URL for Google OAuth
- `POST /api/auth/refresh`: Refreshes access token using refresh token
- `POST /api/auth/logout`: Logout user (clears auth cookies)

### Protected Routes

- `GET /api/auth/me`: Get current authenticated user profile
- `GET /api/auth/protected`: Test route for authenticated users

## Running in Production

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Docker Support

You can also run the application using Docker:

```bash
docker-compose up -d
```

This will start both the application and a MongoDB instance.

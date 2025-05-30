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

   # API Base URL for video streaming
   API_BASE_URL=http://localhost:4000

   # Google OAuth Credentials (Get these from Google Cloud Console)
   GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

   # Cloudflare R2 Storage for video streaming
   CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
   R2_ACCESS_KEY_ID=your-r2-access-key-id
   R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
   R2_BUCKET_NAME=your-r2-bucket-name
   SIGNED_URL_EXPIRATION=3600
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

## Deployment

### Digital Ocean App Platform

#### Prerequisites

1. **MongoDB Database**: Set up MongoDB Atlas or a managed MongoDB instance
2. **Google OAuth**: Configure OAuth application in Google Cloud Console
3. **Cloudflare R2**: Set up R2 bucket for video storage
4. **Domain**: Your Digital Ocean app domain for OAuth callback

#### Environment Variables

Set the following environment variables in Digital Ocean App Platform:

```bash
# Core Application
NODE_ENV=production
PORT=8080

# Database (MongoDB Atlas recommended)
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/your-database-name

# Authentication & Security
JWT_SECRET=your_super_secure_jwt_secret_at_least_32_characters_long_random_string
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_REFRESH_TOKEN_EXPIRY=7d

# CORS & Frontend Integration
FRONTEND_URL=https://your-cloudflare-frontend-url.com
ALLOWED_ORIGINS=https://your-cloudflare-frontend-url.com
COOKIE_SAME_SITE=none

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://your-digital-ocean-app-url.com/api/auth/google/callback

# Cloudflare R2 Storage
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-r2-bucket-name
SIGNED_URL_EXPIRATION=3600

# Video Streaming API Configuration
API_BASE_URL=https://your-digital-ocean-app-url.com
```

#### GitHub CI/CD Deployment

This project is configured to automatically deploy to Digital Ocean App Platform using GitHub CI/CD integration. The deployment configuration is defined in the `.do/app.yaml` file.

**Steps to Set Up CI/CD Deployment:**

- **Initial Setup**:
  - Log in to your Digital Ocean account
  - Navigate to the App Platform section
  - Click "Create App" or "Launch App" button
  - Select "GitHub" as your source
  - Connect your GitHub account if you haven't already
  - Select the repository containing this backend code
  - Select the branch you want to deploy (usually `main`)

- **App Configuration**:
  - Digital Ocean will detect the `.do/app.yaml` file in your repository
  - Review the auto-detected settings
  - Ensure the app.yaml file has the correct GitHub repository reference:

```yaml
github:
  repo: your-username/your-repo-name
  branch: main
```

- **Configure Environment Variables**:
  - In Digital Ocean App Platform, navigate to the "Environment Variables" section
  - Set up all required environment variables listed in the app.yaml file
  - Make sure to mark sensitive information as "Secret" type

- **Update Google OAuth Settings**:
  - Go to Google Cloud Console
  - Navigate to your OAuth 2.0 Client ID
  - Update OAuth redirect URI to: `https://your-app-url.com/api/auth/google/callback`
  - Save changes

- **Continuous Deployment**:
  - After initial setup, any push to the main branch will trigger automatic deployment
  - Digital Ocean App Platform will build and deploy your application according to the app.yaml configuration
  - No manual commands are needed after the initial setup

- **Monitor Deployments**:
  - Track deployment status in the Digital Ocean App Platform dashboard
  - Review build logs if any issues occur during deployment

#### Production Considerations

- **Database**: Use MongoDB Atlas for managed database service
- **Monitoring**: Enable Digital Ocean monitoring and alerts
- **Logging**: Configure structured logging for production
- **Security**: Enable HTTPS and configure proper CORS settings
- **Backup**: Set up automated database backups
- **Rate Limiting**: The app includes built-in rate limiting middleware
- **Error Handling**: Global error handling is configured

#### Health Check

The app exposes a health check endpoint at `/` for Digital Ocean monitoring.

#### Scaling

Digital Ocean App Platform supports automatic scaling based on:

- CPU usage
- Memory usage
- Request volume

Configure scaling settings in the app specification or dashboard.

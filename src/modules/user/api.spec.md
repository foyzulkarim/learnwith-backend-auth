# User API Specification

This document outlines the User API endpoints for the LearnWith platform.

## Endpoints

### 1. Update User Profile

Updates profile information for the currently logged-in user.

**Endpoint:** `PUT /api/user/profile`

**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "bio": "Software engineer with 5 years of experience in web development.",
  "emailPreferences": {
    "marketing": true,
    "coursesUpdates": true,
    "accountNotifications": false
  }
}
```

All fields are optional. Only the fields provided will be updated.

**Response:**
```json
{
  "id": "60a2c4e8f52d8b1c9e123456",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "bio": "Software engineer with 5 years of experience in web development.",
  "emailPreferences": {
    "marketing": true,
    "coursesUpdates": true,
    "accountNotifications": false
  },
  "role": "student",
  "updatedAt": "2025-06-09T15:30:45.123Z",
  "createdAt": "2025-01-15T10:20:30.456Z"
}
```

**Error Responses:**

- **401 Unauthorized** - If the user is not authenticated
  ```json
  {
    "error": "Unauthorized"
  }
  ```

- **400 Bad Request** - If provided data is invalid
  ```json
  {
    "error": "Email is already in use",
    "code": "EMAIL_ALREADY_IN_USE"
  }
  ```

- **404 Not Found** - If user is not found
  ```json
  {
    "error": "User not found"
  }
  ```

- **500 Internal Server Error** - If server encounters an error
  ```json
  {
    "error": "Internal Server Error"
  }
  ```

### 2. Get User Profile

Retrieves profile information for the currently logged-in user.

**Endpoint:** `GET /api/user/profile`

**Authentication:** Required

**Response:**
```json
{
  "id": "60a2c4e8f52d8b1c9e123456",
  "email": "john.doe@example.com",
  "name": "John Doe",
  "bio": "Software engineer with 5 years of experience in web development.",
  "emailPreferences": {
    "marketing": true,
    "coursesUpdates": true,
    "accountNotifications": false
  },
  "role": "student",
  "updatedAt": "2025-06-09T15:30:45.123Z",
  "createdAt": "2025-01-15T10:20:30.456Z"
}
```

**Error Responses:**

- **401 Unauthorized** - If the user is not authenticated
  ```json
  {
    "error": "Unauthorized"
  }
  ```

- **404 Not Found** - If user is not found
  ```json
  {
    "error": "User not found"
  }
  ```

- **500 Internal Server Error** - If server encounters an error
  ```json
  {
    "error": "Internal Server Error"
  }
  ```

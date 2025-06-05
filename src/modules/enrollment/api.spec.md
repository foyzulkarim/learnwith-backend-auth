# Enrollment API Specification

This document outlines the API endpoints for the enrollment module, which handles course enrollments, progress tracking, and related features.

## Base URL

All endpoints are prefixed with `/api/enrollments`.

## Authentication

All endpoints require authentication. Include a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <your_jwt_token>
```

## Error Responses

All endpoints may return the following error responses:

- `401 Unauthorized`: User is not authenticated
- `403 Forbidden`: User does not have permission to access the resource
- `404 Not Found`: The requested resource was not found
- `500 Internal Server Error`: An unexpected error occurred

## Endpoints

### 1. Get All User Enrollments

Retrieves all courses a user is enrolled in.

**Endpoint:** `GET /api/enrollments`

**Response:**
```json
[
  {
    "_id": "61b3d5f7e89a2c3d4f567890",
    "title": "Introduction to React",
    "thumbnailUrl": "https://example.com/thumbnails/react.jpg",
    "instructor": "John Doe",
    "totalLessons": 24,
    "enrolledAt": "2025-05-15T14:30:22.123Z",
    "lastAccessedAt": "2025-06-04T09:45:18.456Z",
    "lastWatchedLessonId": "61b3d5f7e89a2c3d4f567895",
    "completedLessons": 3,
    "progress": 42.5
  },
  {
    "_id": "61b3d5f7e89a2c3d4f567891",
    "title": "Advanced JavaScript",
    "thumbnailUrl": "https://example.com/thumbnails/javascript.jpg",
    "instructor": "Jane Smith",
    "totalLessons": 18,
    "enrolledAt": "2025-04-10T11:20:15.789Z",
    "lastAccessedAt": "2025-06-01T16:30:45.123Z",
    "lastWatchedLessonId": "61b3d5f7e89a2c3d4f567896",
    "completedLessons": 12,
    "progress": 66.7
  }
]
```

### 2. Enroll in a Course

Enrolls the current user in a specific course.

**Endpoint:** `POST /api/enrollments/courses/:courseId`

**URL Parameters:**
- `courseId`: ID of the course to enroll in

**Response:**
```json
{
  "enrolled": true,
  "enrolledAt": "2025-06-05T10:15:30.123Z",
  "lastAccessedAt": "2025-06-05T10:15:30.123Z",
  "lastWatchedLessonId": null,
  "completedLessons": 0,
  "progress": 0,
  "course": {
    "_id": "61b3d5f7e89a2c3d4f567890",
    "title": "Introduction to React",
    "thumbnailUrl": "https://example.com/thumbnails/react.jpg",
    "totalLessons": 24
  }
}
```

### 3. Get Enrollment Details

Retrieves detailed enrollment information for a specific course.

**Endpoint:** `GET /api/enrollments/courses/:courseId`

**URL Parameters:**
- `courseId`: ID of the course

**Response (if enrolled):**
```json
{
  "enrolled": true,
  "enrolledAt": "2025-05-15T14:30:22.123Z",
  "lastAccessedAt": "2025-06-04T09:45:18.456Z",
  "lastWatchedLessonId": "61b3d5f7e89a2c3d4f567895",
  "lessons": {
    "61b3d5f7e89a2c3d4f567891": {
      "lessonId": "61b3d5f7e89a2c3d4f567891",
      "startedAt": "2025-05-15T15:10:22.123Z",
      "completedAt": "2025-05-15T15:45:18.456Z",
      "lastAccessedAt": "2025-05-20T10:15:30.789Z",
      "watchDuration": 2100,
      "notes": "Great introduction to the course concepts",
      "status": "completed",
      "bookmarked": true
    },
    "61b3d5f7e89a2c3d4f567892": {
      "lessonId": "61b3d5f7e89a2c3d4f567892",
      "startedAt": "2025-05-16T09:20:15.123Z",
      "completedAt": "2025-05-16T10:05:45.456Z",
      "lastAccessedAt": "2025-05-25T14:30:22.789Z",
      "watchDuration": 2730,
      "notes": "Need to review the section on React hooks",
      "status": "completed"
    }
  },
  "completedLessons": 2,
  "progress": 42.5,
  "notes": "This course has great content on React hooks.",
  "rating": 4,
  "feedback": "Excellent course, but would like more practical examples.",
  "course": {
    "_id": "61b3d5f7e89a2c3d4f567890",
    "title": "Introduction to React",
    "thumbnailUrl": "https://example.com/thumbnails/react.jpg",
    "totalLessons": 24
  }
}
```

**Response (if not enrolled):**
```json
{
  "enrolled": false,
  "course": {
    "_id": "61b3d5f7e89a2c3d4f567890",
    "title": "Introduction to React",
    "thumbnailUrl": "https://example.com/thumbnails/react.jpg",
    "totalLessons": 24
  }
}
```

### 4. Get Resume Lesson

Retrieves the lesson that the user should resume from (either the last watched lesson or the first lesson if never watched).

**Endpoint:** `GET /api/enrollments/courses/:courseId/resume`

**URL Parameters:**
- `courseId`: ID of the course

**Response:**
```json
{
  "courseId": "61b3d5f7e89a2c3d4f567890",
  "moduleId": "61b3d5f7e89a2c3d4f567880",
  "lessonId": "61b3d5f7e89a2c3d4f567895",
  "title": "Understanding React Hooks"
}
```

### 5. Get All Lesson Progress

Retrieves progress information for all lessons in a course.

**Endpoint:** `GET /api/enrollments/courses/:courseId/progress`

**URL Parameters:**
- `courseId`: ID of the course

**Response:**
```json
[
  {
    "lessonId": "61b3d5f7e89a2c3d4f567891",
    "startedAt": "2025-05-15T15:10:22.123Z",
    "completedAt": "2025-05-15T15:45:18.456Z",
    "lastAccessedAt": "2025-05-20T10:15:30.789Z",
    "watchDuration": 2100,
    "notes": "Great introduction to the course concepts",
    "status": "completed",
    "bookmarked": true
  },
  {
    "lessonId": "61b3d5f7e89a2c3d4f567892",
    "startedAt": "2025-05-16T09:20:15.123Z",
    "completedAt": "2025-05-16T10:05:45.456Z",
    "lastAccessedAt": "2025-05-25T14:30:22.789Z",
    "watchDuration": 2730,
    "notes": "Need to review the section on React hooks",
    "status": "completed"
  },
  {
    "lessonId": "61b3d5f7e89a2c3d4f567895",
    "startedAt": "2025-06-04T09:15:22.123Z",
    "lastAccessedAt": "2025-06-04T09:45:18.456Z",
    "watchDuration": 1800,
    "status": "in_progress"
  }
]
```

### 6. Update Last Watched Lesson

Updates the last watched lesson and tracks watch duration.

**Endpoint:** `PUT /api/enrollments/courses/:courseId/lessons/:lessonId/watch`

**URL Parameters:**
- `courseId`: ID of the course
- `lessonId`: ID of the lesson

**Request Body:**
```json
{
  "duration": 300
}
```

**Response:**
```json
{
  "lastWatchedLessonId": "61b3d5f7e89a2c3d4f567895",
  "lastAccessedAt": "2025-06-05T10:30:45.123Z",
  "lessonProgress": {
    "lessonId": "61b3d5f7e89a2c3d4f567895",
    "startedAt": "2025-06-04T09:15:22.123Z",
    "lastAccessedAt": "2025-06-05T10:30:45.123Z",
    "watchDuration": 2100,
    "status": "in_progress"
  }
}
```

### 7. Mark Lesson as Completed

Marks a lesson as completed and updates course progress.

**Endpoint:** `PUT /api/enrollments/courses/:courseId/lessons/:lessonId/complete`

**URL Parameters:**
- `courseId`: ID of the course
- `lessonId`: ID of the lesson

**Response:**
```json
{
  "progress": 45.8,
  "lastAccessedAt": "2025-06-05T10:35:22.456Z",
  "completedLessons": 11,
  "lessonProgress": {
    "lessonId": "61b3d5f7e89a2c3d4f567895",
    "startedAt": "2025-06-04T09:15:22.123Z",
    "completedAt": "2025-06-05T10:35:22.456Z",
    "lastAccessedAt": "2025-06-05T10:35:22.456Z",
    "watchDuration": 2100,
    "status": "completed"
  }
}
```

### 8. Update Lesson Notes

Adds or updates notes for a specific lesson.

**Endpoint:** `PUT /api/enrollments/courses/:courseId/lessons/:lessonId/notes`

**URL Parameters:**
- `courseId`: ID of the course
- `lessonId`: ID of the lesson

**Request Body:**
```json
{
  "notes": "This lesson covers important concepts about React hooks that I need to remember."
}
```

**Response:**
```json
{
  "lastAccessedAt": "2025-06-05T10:40:15.789Z",
  "lessonProgress": {
    "lessonId": "61b3d5f7e89a2c3d4f567895",
    "startedAt": "2025-06-04T09:15:22.123Z",
    "completedAt": "2025-06-05T10:35:22.456Z",
    "lastAccessedAt": "2025-06-05T10:40:15.789Z",
    "watchDuration": 2100,
    "notes": "This lesson covers important concepts about React hooks that I need to remember.",
    "status": "completed"
  }
}
```

### 9. Toggle Lesson Bookmark

Toggles the bookmark status for a lesson.

**Endpoint:** `PUT /api/enrollments/courses/:courseId/lessons/:lessonId/bookmark`

**URL Parameters:**
- `courseId`: ID of the course
- `lessonId`: ID of the lesson

**Response:**
```json
{
  "lastAccessedAt": "2025-06-05T10:45:30.123Z",
  "lessonProgress": {
    "lessonId": "61b3d5f7e89a2c3d4f567895",
    "startedAt": "2025-06-04T09:15:22.123Z",
    "completedAt": "2025-06-05T10:35:22.456Z",
    "lastAccessedAt": "2025-06-05T10:45:30.123Z",
    "watchDuration": 2100,
    "notes": "This lesson covers important concepts about React hooks that I need to remember.",
    "status": "completed",
    "bookmarked": true
  }
}
```

### 10. Add Course Notes

Adds or updates notes for the entire course.

**Endpoint:** `POST /api/enrollments/courses/:courseId/notes`

**URL Parameters:**
- `courseId`: ID of the course

**Request Body:**
```json
{
  "notes": "This course is excellent for learning React fundamentals. I should review the hooks section again."
}
```

**Response:**
```json
{
  "notes": "This course is excellent for learning React fundamentals. I should review the hooks section again.",
  "lastAccessedAt": "2025-06-05T10:50:45.456Z"
}
```

### 11. Add Course Rating

Adds or updates a rating and optional feedback for a course.

**Endpoint:** `POST /api/enrollments/courses/:courseId/rating`

**URL Parameters:**
- `courseId`: ID of the course

**Request Body:**
```json
{
  "rating": 4,
  "feedback": "Great course with clear explanations. Would like more advanced examples."
}
```

**Response:**
```json
{
  "rating": 4,
  "feedback": "Great course with clear explanations. Would like more advanced examples.",
  "lastAccessedAt": "2025-06-05T10:55:15.789Z"
}
```

### 12. Get Course Students (Admin/Instructor Only)

Retrieves all students enrolled in a course.

**Endpoint:** `GET /api/enrollments/courses/:courseId/students`

**URL Parameters:**
- `courseId`: ID of the course

**Response:**
```json
[
  {
    "_id": "65c7a8d9f2b3e45d6a789012",
    "userId": "60a2c4e8f52d8b1c9e123456",
    "enrolledAt": "2025-05-15T14:30:22.123Z",
    "lastAccessedAt": "2025-06-04T09:45:18.456Z",
    "progress": 42.5,
    "completedLessons": 10
  },
  {
    "_id": "65c7a8d9f2b3e45d6a789013",
    "userId": "60a2c4e8f52d8b1c9e123457",
    "enrolledAt": "2025-05-20T09:15:30.456Z",
    "lastAccessedAt": "2025-06-03T16:20:45.789Z",
    "progress": 75.0,
    "completedLessons": 18
  }
]
```

### 13. Get Course Completion Stats (Admin/Instructor Only)

Retrieves completion statistics for a course.

**Endpoint:** `GET /api/enrollments/courses/:courseId/stats`

**URL Parameters:**
- `courseId`: ID of the course

**Response:**
```json
{
  "totalEnrollments": 45,
  "completedEnrollments": 12,
  "inProgressEnrollments": 28,
  "notStartedEnrollments": 5,
  "completionRate": 26.7,
  "averageProgress": 58.4
}
```

## Frontend Integration Guide

### React Hooks for Enrollment

Here are some example React hooks you can create to interact with the enrollment API:

#### 1. useEnrollments Hook

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useEnrollments() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnrollments = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/enrollments');
        setEnrollments(response.data);
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch enrollments');
      } finally {
        setLoading(false);
      }
    };

    fetchEnrollments();
  }, []);

  const enrollInCourse = async (courseId) => {
    try {
      const response = await axios.post(`/api/enrollments/courses/${courseId}`);
      setEnrollments(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to enroll in course');
    }
  };

  return { enrollments, loading, error, enrollInCourse };
}
```

#### 2. useCourseProgress Hook

```jsx
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useCourseProgress(courseId) {
  const [enrollment, setEnrollment] = useState(null);
  const [lessonProgress, setLessonProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEnrollment = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/enrollments/courses/${courseId}`);
        setEnrollment(response.data);
        
        if (response.data.enrolled) {
          const progressResponse = await axios.get(`/api/enrollments/courses/${courseId}/progress`);
          setLessonProgress(progressResponse.data);
        }
        
        setError(null);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to fetch enrollment details');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      fetchEnrollment();
    }
  }, [courseId]);

  const updateLastWatched = async (lessonId, duration) => {
    try {
      const response = await axios.put(
        `/api/enrollments/courses/${courseId}/lessons/${lessonId}/watch`,
        { duration }
      );
      
      // Update the local state with the new lesson progress
      const updatedLesson = response.data.lessonProgress;
      setLessonProgress(prev => {
        const existing = prev.find(p => p.lessonId === lessonId);
        if (existing) {
          return prev.map(p => p.lessonId === lessonId ? updatedLesson : p);
        } else {
          return [...prev, updatedLesson];
        }
      });
      
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to update watch progress');
    }
  };

  const markLessonComplete = async (lessonId) => {
    try {
      const response = await axios.put(
        `/api/enrollments/courses/${courseId}/lessons/${lessonId}/complete`
      );
      
      // Update the enrollment progress
      setEnrollment(prev => ({
        ...prev,
        progress: response.data.progress,
        completedLessons: response.data.completedLessons
      }));
      
      // Update the lesson progress
      const updatedLesson = response.data.lessonProgress;
      setLessonProgress(prev => {
        const existing = prev.find(p => p.lessonId === lessonId);
        if (existing) {
          return prev.map(p => p.lessonId === lessonId ? updatedLesson : p);
        } else {
          return [...prev, updatedLesson];
        }
      });
      
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to mark lesson as complete');
    }
  };

  const updateLessonNotes = async (lessonId, notes) => {
    try {
      const response = await axios.put(
        `/api/enrollments/courses/${courseId}/lessons/${lessonId}/notes`,
        { notes }
      );
      
      // Update the lesson progress
      const updatedLesson = response.data.lessonProgress;
      setLessonProgress(prev => {
        const existing = prev.find(p => p.lessonId === lessonId);
        if (existing) {
          return prev.map(p => p.lessonId === lessonId ? updatedLesson : p);
        } else {
          return [...prev, updatedLesson];
        }
      });
      
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to update lesson notes');
    }
  };

  const toggleBookmark = async (lessonId) => {
    try {
      const response = await axios.put(
        `/api/enrollments/courses/${courseId}/lessons/${lessonId}/bookmark`
      );
      
      // Update the lesson progress
      const updatedLesson = response.data.lessonProgress;
      setLessonProgress(prev => {
        const existing = prev.find(p => p.lessonId === lessonId);
        if (existing) {
          return prev.map(p => p.lessonId === lessonId ? updatedLesson : p);
        } else {
          return [...prev, updatedLesson];
        }
      });
      
      return response.data;
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to toggle bookmark');
    }
  };

  return {
    enrollment,
    lessonProgress,
    loading,
    error,
    updateLastWatched,
    markLessonComplete,
    updateLessonNotes,
    toggleBookmark
  };
}
```

### Example Usage in Components

#### Course Card Component

```jsx
import React from 'react';
import { useEnrollments } from '../hooks/useEnrollments';

function CourseCard({ course }) {
  const { enrollments, enrollInCourse, loading } = useEnrollments();
  
  // Check if user is already enrolled
  const isEnrolled = enrollments.some(e => e._id === course._id);
  
  const handleEnroll = async () => {
    try {
      await enrollInCourse(course._id);
      // Show success message or redirect to course
    } catch (error) {
      console.error('Failed to enroll:', error);
      // Show error message
    }
  };
  
  return (
    <div className="course-card">
      <img src={course.thumbnailUrl} alt={course.title} />
      <h3>{course.title}</h3>
      <p>Instructor: {course.instructor}</p>
      <p>{course.totalLessons} lessons</p>
      
      {isEnrolled ? (
        <button className="btn-continue">Continue Learning</button>
      ) : (
        <button 
          className="btn-enroll" 
          onClick={handleEnroll}
          disabled={loading}
        >
          {loading ? 'Processing...' : 'Enroll Now'}
        </button>
      )}
    </div>
  );
}
```

#### Course Player Component

```jsx
import React, { useState, useEffect, useRef } from 'react';
import { useCourseProgress } from '../hooks/useCourseProgress';

function CoursePlayer({ courseId, lessonId }) {
  const videoRef = useRef(null);
  const [watchTime, setWatchTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState('');
  
  const {
    enrollment,
    lessonProgress,
    loading,
    updateLastWatched,
    markLessonComplete,
    updateLessonNotes,
    toggleBookmark
  } = useCourseProgress(courseId);
  
  // Find current lesson progress
  const currentLessonProgress = lessonProgress.find(p => p.lessonId === lessonId);
  
  // Initialize notes from lesson progress
  useEffect(() => {
    if (currentLessonProgress?.notes) {
      setNotes(currentLessonProgress.notes);
    }
  }, [currentLessonProgress]);
  
  // Track video play/pause
  useEffect(() => {
    let interval;
    
    if (isPlaying) {
      interval = setInterval(() => {
        setWatchTime(prev => prev + 1);
      }, 1000);
    } else if (watchTime > 0) {
      // When paused, update the watch time
      updateLastWatched(lessonId, watchTime);
      setWatchTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, watchTime, lessonId, updateLastWatched]);
  
  // Handle video events
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);
  const handleEnded = async () => {
    setIsPlaying(false);
    await markLessonComplete(lessonId);
  };
  
  // Handle notes update
  const handleSaveNotes = async () => {
    await updateLessonNotes(lessonId, notes);
  };
  
  // Handle bookmark toggle
  const handleToggleBookmark = async () => {
    await toggleBookmark(lessonId);
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div className="course-player">
      <video
        ref={videoRef}
        src={`/api/hls/${courseId}/${lessonId}/index.m3u8`}
        controls
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      />
      
      <div className="lesson-controls">
        <button 
          className={`bookmark-btn ${currentLessonProgress?.bookmarked ? 'active' : ''}`}
          onClick={handleToggleBookmark}
        >
          {currentLessonProgress?.bookmarked ? 'Bookmarked' : 'Bookmark'}
        </button>
        
        <button 
          className="complete-btn"
          onClick={() => markLessonComplete(lessonId)}
          disabled={currentLessonProgress?.status === 'completed'}
        >
          Mark as Complete
        </button>
      </div>
      
      <div className="lesson-notes">
        <h4>Lesson Notes</h4>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add your notes for this lesson..."
        />
        <button onClick={handleSaveNotes}>Save Notes</button>
      </div>
    </div>
  );
}
```

This documentation and example code should provide a solid foundation for integrating the enrollment API with your React frontend application.

# Face Authentication System - Implementation Guide

## Overview
Server-side face authentication system for attendance marking. Students enroll their face during signup and verify it during class attendance.

## Database Schema

### `face_profiles`
Stores student face images and embeddings
```sql
- id (UUID)
- student_id (UUID) - FK to auth.users
- face_image (BYTEA) - Raw JPEG image data
- face_embedding (VECTOR(128)) - 128-dimensional face encoding
- captured_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### `face_attendance`
Records attendance check-ins with match details
```sql
- id (UUID)
- student_id (UUID) - FK to auth.users
- calendar_request_id (UUID) - FK to calendar_requests (class/event)
- classroom_id (UUID) - FK to classrooms
- check_in_image (BYTEA) - Image captured during check-in
- check_in_embedding (VECTOR(128)) - Check-in face encoding
- match_confidence (FLOAT) - Similarity score (0-1)
- matched (BOOLEAN) - Whether it passed the threshold
- matched_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

## API Endpoints

### 1. Enroll Face
**POST** `/api/face/enroll`

Enrolls or updates a student's face during signup.

**Request:**
```
Content-Type: multipart/form-data

image: File (JPEG image captured via webcam)
studentId: string (UUID)
```

**Response:**
```json
{
  "success": true,
  "message": "Face enrolled successfully"
}
```

### 2. Verify Attendance
**POST** `/api/face/verify`

Verifies student identity and marks attendance.

**Request:**
```
Content-Type: multipart/form-data

image: File (JPEG captured during class)
studentId: string (UUID)
calendarRequestId: string (UUID of class/event)
classroomId: string (UUID)
```

**Response:**
```json
{
  "success": true,
  "matched": true,
  "confidence": 87,
  "threshold": 75,
  "message": "✓ Face matched! Attendance marked."
}
```

## Frontend Components

### `FaceCapture`
Base component for capturing photos from webcam.

```tsx
import { FaceCapture } from "@/components/face-auth";

<FaceCapture 
  onCapture={(blob) => setImage(blob)}
  title="Capture Your Face"
  description="Ensure good lighting..."
/>
```

### `FaceEnrollment`
Component for signup flow - enrolls student's face.

```tsx
import { FaceEnrollment } from "@/components/face-auth";

<FaceEnrollment 
  studentId={userId}
  onSuccess={() => router.push("/dashboard")}
/>
```

### `FaceVerify`
Component for attendance verification at class time.

```tsx
import { FaceVerify } from "@/components/face-auth";

<FaceVerify
  studentId={userId}
  calendarRequestId={classId}
  classroomId={roomId}
  onSuccess={(data) => markAttendance(data)}
/>
```

## Configuration

### Adjust Match Threshold

**File:** `/src/app/api/face/verify/route.ts`

```typescript
// Change this value (0-1)
// 0.75 = 75% confidence required
// 0.80 = 80% confidence required (stricter)
// 0.70 = 70% confidence required (more lenient)
export const FACE_MATCH_THRESHOLD = 0.75;
```

The threshold determines how strict the face matching is. You can play around with it based on your needs.

## Installation & Setup

### 1. Install Dependencies
```bash
npm install @vladmandic/face-api canvas
npm install react-webcam  # Optional, for better webcam handling
```

### 2. Add Face-API Models
Download models from: https://github.com/vladmandic/face-api/tree/master/model

Place in `/public/models/`

### 3. Run Database Migration
```bash
# In Supabase SQL editor, run:
# From: supabase/add-face-auth.sql
```

### 4. Enable pgvector Extension (if using Postgres)
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## How It Works

### Enrollment Flow
1. Student captures photo during signup
2. Backend extracts 128-dimensional face embedding using face-api
3. Image + embedding stored in `face_profiles` table
4. Student can retake/update anytime

### Verification Flow
1. Student captures photo during class check-in
2. Backend extracts embedding from check-in image
3. Calculates cosine similarity with stored embedding
4. Compares against threshold (default 0.75)
5. If match: Attendance marked, record stored in `face_attendance`
6. If no match: Request rejected with confidence score

## Threshold Tuning Guide

| Threshold | Behavior | Use Case |
|-----------|----------|----------|
| 0.60-0.65 | Very lenient | Testing, many false positives |
| 0.70-0.75 | Balanced | Default, good accuracy |
| 0.80-0.85 | Strict | High security needed, may reject valid matches |
| 0.90+ | Very strict | Highest security, may reject valid matches |

## Security Notes

- Embeddings are vectors, not face images - enables privacy
- Store both images and embeddings for audit trails (can delete images later)
- Attendance records are immutable - good for audits
- RLS policies ensure students only see their own data
- All API calls should be authenticated in production

## Future Enhancements

1. **Client-side preprocessing**: Crop face before sending to reduce bandwidth
2. **Liveness detection**: Prevent spoofing with photo/video
3. **Multi-face support**: Link multiple face profiles to same student
4. **Real-time dashboard**: Show attendance stats with confidence scores
5. **Export reports**: Generate attendance reports from face_attendance table
6. **Webhook notifications**: Alert on failed verification attempts

# Face Authentication Testing Guide

## Quick Testing Steps

### 1. Test Face Embedding Extraction (Optional)
This verifies face-api is working before enrolling:

1. Go to `http://localhost:3000/face-embedding-test`
2. Click "Start Camera"
3. Position your face clearly in the frame
4. Click "Test Embedding"
5. You should see:
   - "Success" with a 128-dimensional embedding
   - First 5 values displayed
   - ✓ confirmation that face detection is working

### 2. Test Face Enrollment
This is the real flow during signup:

1. Go to `http://localhost:3000/signup`
2. Fill in:
   - Full Name: Any name
   - Email: test-student-1@university.edu
   - Password: password123
   - Role: **Student** (important!)
3. Click "Sign Up"
4. You'll see "Set up Face Authentication"
5. Click "Start Camera"
6. Wait for video to load (up to 10 seconds)
7. Position face clearly
8. Click "Capture Photo"
9. Click "Enroll Face"
10. You should see "Face profile updated successfully" or "Face enrolled successfully"
11. Then see "Check your email" screen

### 3. Test Face Verification (Attendance Check-in)
This tests the actual attendance marking:

1. After enrollment, verify your email (check inbox for confirmation link)
2. Sign in with the email and password you used
3. Go to the **Student Dashboard**
4. Under "Your upcoming classes", you should see your classes
5. Click "Check In with Face" on any class
6. Position your face in the frame again
7. Click "Capture Photo"
8. Click "Verify Attendance"
9. You should see:
   - ✓ Green success message if face matches (confidence >= 75%)
   - Confidence percentage displayed (should be 80%+)
   - "Attendance marked" confirmation

## Expected Results

### First Enrollment
```
✓ Enrollment successful
✓ Face profile updated successfully
✓ Shows email verification screen
```

### Class Check-in (Same Day)
```
✓ Attendance verified
✓ Confidence: 85-95%
✓ Face matched! Attendance marked.
```

### Class Check-in (Different Day)
```
✓ Attendance verified
✓ Confidence: 75-90% (might vary due to lighting/angle)
✓ Face matched! Attendance marked.
```

## Troubleshooting

### Problem: "No face detected in image"
**Solution:**
- Ensure face is clearly visible (at least 60% of frame)
- Good lighting (avoid backlighting)
- Look directly at camera
- Try again with better position

### Problem: Confidence score is 0%
**Solution:**
- This means enrollment was done but re-enroll the student:
  - Go to Supabase → SQL Editor
  - Run: `DELETE FROM face_profiles WHERE student_id = 'USER_ID';`
  - Have student re-enroll from signup page

### Problem: Confidence score is 30-50%
**Solution:**
- This is likely a lighting or angle mismatch
- Try in similar lighting conditions to enrollment
- If still low, consider re-enrolling with better quality photo

### Problem: Camera won't start
**Solution:**
- Clear browser cache
- Check browser permissions (Settings → Privacy → Camera)
- Ensure no other app is using the camera
- Try a different browser
- Check browser console (F12) for error messages

## Confidence Score Interpretation

| Score | Meaning | Action |
|-------|---------|--------|
| 0-40% | No match | Fail, user must retry |
| 41-74% | Partial match | Fail, user can retry |
| 75-99% | Good match ✓ | Success, attendance marked |
| 100% | Perfect match | Success (rare) |

## Adjusting Sensitivity

If you want stricter or more lenient matching:

**File:** `src/app/api/face/verify/route.ts`

```typescript
export const FACE_MATCH_THRESHOLD = 0.75; // Change this
```

Examples:
- `0.60` = Very lenient (might accept wrong faces)
- `0.75` = Default balanced (recommended)
- `0.85` = Strict (rejects similar faces)
- `0.95` = Very strict (only exact matches)

## Debugging Commands

### Check server logs
Look at your terminal running `npm run dev` for detailed API logs:
```
1. Requesting camera access...
2. Camera stream obtained: ...
3. Setting stream to video element...
4. Video metadata loaded
5. Calling play()...
6. Video playing successfully
7. Extracting check-in face embedding...
8. Check-in embedding extracted successfully
Match result: { confidence: 0.87, matched: true, threshold: 0.75 }
```

### Clear student's face profile (in Supabase)
```sql
-- Find student ID first
SELECT id, email FROM auth.users WHERE email = 'student@university.edu';

-- Then delete their face profile
DELETE FROM face_profiles WHERE student_id = 'PASTE_ID_HERE';

-- Optional: Clear attendance records too
DELETE FROM face_attendance WHERE student_id = 'PASTE_ID_HERE';
```

### View attendance records (in Supabase)
```sql
SELECT 
  fa.student_id,
  u.email,
  fa.matched,
  fa.match_confidence,
  fa.matched_at
FROM face_attendance fa
JOIN auth.users u ON fa.student_id = u.id
ORDER BY fa.matched_at DESC
LIMIT 20;
```

## Test Scenarios

### Scenario 1: Perfect Enrollment & Verification
1. Enroll in good lighting
2. Check-in in same location immediately
3. Expected: 90%+ confidence, ✓ success

### Scenario 2: Different Lighting Conditions
1. Enroll in bright daylight
2. Check-in under office lights
3. Expected: 75-85% confidence, ✓ success (if >= 75%)

### Scenario 3: Glasses/Accessories
1. Enroll with glasses
2. Check-in without glasses
3. Expected: 60-75% confidence, might ✗ fail

### Scenario 4: Poor Image Quality
1. Enroll in blurry/dark image
2. Check-in with clear image
3. Expected: Low confidence, likely ✗ fail
4. Solution: Re-enroll with better quality

## After Testing

When face auth is working well:
1. ✅ Run `npm run build` to check for build errors
2. ✅ Commit changes: `git add -A && git commit -m "feat: implement face authentication"`
3. ✅ Push to GitHub: `git push origin main`
4. ✅ Deploy to production

---

**Last Updated:** March 17, 2026
**Status:** Ready for testing ✓

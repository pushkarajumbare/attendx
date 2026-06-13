# AttendX — Smart Classroom Attendance System

Face recognition + GPS verified attendance for schools and colleges.

## Features

- **Teacher & Student roles** with Firebase Authentication
- **Face registration & verification** via Expo Camera
- **GPS geo-fencing** (default 50m radius) with mock-location detection
- **Teacher-controlled attendance windows** (start/end time)
- **Classroom code system** for student enrollment
- **Real-time Firestore sync**
- **Notes, Assignments, Question Bank, Announcements**
- **Push notifications** (FCM via Expo Notifications)
- **Dark mode** support

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React Native Expo (JavaScript) |
| Backend | Firebase |
| Database | Cloud Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| Face | Expo Camera + feature matching (upgrade to ML Kit/TFLite for production) |
| Location | Expo Location |
| Navigation | Expo Router (React Navigation) |
| State | React Context API |
| UI | React Native Paper |

## Project Structure

```
attendx/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Login, Signup, Forgot Password
│   ├── (student)/          # Student tabs & flows
│   └── (teacher)/          # Teacher tabs & flows
├── src/
│   ├── components/         # Reusable UI
│   ├── config/             # Firebase, theme
│   ├── constants/          # App constants
│   ├── context/            # Auth & Theme providers
│   ├── services/           # Business logic
│   └── utils/              # Helpers
├── firestore.rules
├── storage.rules
└── eas.json
```

## Setup

### 1. Install dependencies

```bash
cd Projects/attendx
npm install
```

### 2. Firebase project

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password)
3. Create **Firestore Database**
4. Enable **Storage**
5. Copy web app config to `.env`:

```bash
cp .env.example .env
```

6. Deploy security rules:

```bash
firebase deploy --only firestore:rules,storage
```

### 3. Add app assets

Place these files in `assets/` (or run `npx create-expo-app@latest temp --template blank` and copy its assets):

- `icon.png` (1024×1024)
- `splash-icon.png`
- `adaptive-icon.png`
- `notification-icon.png`

### 4. Run the app

```bash
npx expo start
```

Press `a` for Android emulator or scan QR with Expo Go.

### 5. Build APK

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

## Attendance Flow

1. **Teacher** creates classroom → shares code
2. **Student** joins with code → registers face (multi-angle)
3. **Teacher** starts attendance session (sets time window + radius; GPS saved)
4. **Student** opens attendance → face scan → GPS check → time check
5. Attendance marked only if all validations pass

## Production Upgrades

For a startup-grade product, replace the placeholder face matcher in `src/services/faceService.js` with:

- **TensorFlow Lite** face embedding model
- **Google ML Kit Face Detection**
- On-device liveness detection (blink/pose challenge)

## Firestore Collections

- `users`, `teachers`, `students`
- `classrooms`, `attendanceSessions`, `attendance`
- `faceData`, `notes`, `assignments`, `submissions`
- `questionBank`, `announcements`, `devices`

## License

MIT

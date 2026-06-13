export const COLORS = {
primary: '#4F46E5',
primaryDark: '#4338CA',
secondary: '#06B6D4',
secondaryDark: '#0891B2',
success: '#10B981',
danger: '#EF4444',
warning: '#F59E0B',
background: '#F8FAFC',
surface: '#FFFFFF',
text: '#0F172A',
textSecondary: '#64748B',
border: '#E2E8F0',
loading: '#4F46E5',
error: '#EF4444',
};

export const ATTENDANCE = {
DEFAULT_RADIUS_METERS: 50,

// Face registration
MIN_FACE_SAMPLES: 3,
MAX_FACE_SAMPLES: 5,

/*

* Balanced thresholds for Expo Go
* Better real-person detection
* Lower false rejections
* Still blocks static/fake images
  */

// correct person match
FACE_MATCH_THRESHOLD: 0.65,

// small movement/blink enough
LIVENESS_THRESHOLD: 0.05,
};

export const ROLES = {
TEACHER: 'teacher',
STUDENT: 'student',
};

export const ATTENDANCE_STATUS = {
PRESENT: 'present',
ABSENT: 'absent',
REJECTED: 'rejected',
};

export const SESSION_STATUS = {
ACTIVE: 'active',
PAUSED: 'paused',
ENDED: 'ended',
REOPENED: 'reopened',
};

export const REJECTION_REASONS = {
FACE_MISMATCH: 'Face verification failed',
OUT_OF_RANGE: 'Outside allowed classroom radius',
TIME_EXPIRED: 'Attendance window has ended',
TIME_NOT_STARTED: 'Attendance has not started yet',
FAKE_GPS: 'Suspicious location detected',
ALREADY_MARKED:
'Attendance already marked for this session',
NO_ACTIVE_SESSION:
'No active attendance session',
SESSION_INACTIVE:
'Attendance session is not active',

// face + liveness
LIVENESS_FAILED:
'Liveness check failed - please show real face',

STATIC_IMAGE:
'Static image detected - slightly move your face',

NO_MOTION:
'No motion detected - blink or slightly move head',
};

export const COLLECTIONS = {
USERS: 'users',
TEACHERS: 'teachers',
STUDENTS: 'students',
CLASSROOMS: 'classrooms',
ATTENDANCE: 'attendance',
ATTENDANCE_SESSIONS:
'attendanceSessions',
ASSIGNMENTS: 'assignments',
NOTES: 'notes',
QUESTION_BANK: 'questionBank',
ANNOUNCEMENTS: 'announcements',
FACE_DATA: 'faceData',
DEVICES: 'devices',
};

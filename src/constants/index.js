/**
 * AttendX - Central Design System & Constants
 * Light Orange / Warm Orange Theme with Full Light & Dark Mode
 */

export const THEME_COLORS = {
  // Brand / Warm Orange Palette
  primary: '#F97316',        // Warm Orange (Primary Accent)
  primaryDark: '#EA580C',    // Deep Orange
  primaryLight: '#FFEDD5',   // Soft Peach Tint (Light Mode chips/accents)
  primaryMuted: 'rgba(249, 115, 22, 0.15)',

  // Secondary Accents
  secondary: '#FB923C',      // Bright Orange
  secondaryDark: '#C2410C',  // Rust
  accent: '#D97706',         // Amber Accent

  // Functional Colors
  success: '#10B981',        // Emerald Green
  successLight: 'rgba(16, 185, 129, 0.15)',
  danger: '#EF4444',         // Crimson Red
  dangerLight: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',        // Golden Amber
  warningLight: 'rgba(245, 158, 11, 0.15)',
  info: '#06B6D4',           // Cyan Info
  infoLight: 'rgba(6, 182, 212, 0.15)',

  // Light Mode Tokens
  light: {
    background: '#FAF8F5',   // Warm Cream
    surface: '#FFFFFF',      // Pure White Card
    surfaceElevated: '#FFFFFF',
    surfaceVariant: '#F5F2EB', // Soft Warm Gray
    surfaceAccent: '#FFF7ED', // Light Peach Accent Box
    text: '#1C1917',         // Deep Stone (High Contrast)
    textSecondary: '#78716C',// Muted Stone Gray
    textTertiary: '#A8A29E', // Subtle Gray
    border: '#E7E5E4',       // Soft Stone Border
    borderStrong: '#D6D3D1',
    inputBackground: '#F5F5F4',
    cardShadow: 'rgba(28, 25, 23, 0.06)',
    modalOverlay: 'rgba(0, 0, 0, 0.5)',
  },

  // Dark Mode Tokens
  dark: {
    background: '#0C0A09',   // Deep Warm Obsidian
    surface: '#1C1917',      // Warm Dark Stone Card
    surfaceElevated: '#292524',
    surfaceVariant: '#292524', // Elevated Dark Stone
    surfaceAccent: '#2A1F18', // Warm Dark Orange Accent Box
    text: '#FAFAF9',         // Crisp White
    textSecondary: '#A8A29E',// Warm Stone Gray
    textTertiary: '#78716C', // Subtle Slate
    border: '#44403C',       // Dark Stone Border
    borderStrong: '#57534E',
    inputBackground: '#292524',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
    modalOverlay: 'rgba(0, 0, 0, 0.75)',
  },
};

// Backward-compatible default COLORS export (dynamically adaptive where possible)
export const COLORS = {
  primary: THEME_COLORS.primary,
  primaryDark: THEME_COLORS.primaryDark,
  primaryLight: THEME_COLORS.primaryLight,
  secondary: THEME_COLORS.secondary,
  secondaryDark: THEME_COLORS.secondaryDark,
  success: THEME_COLORS.success,
  danger: THEME_COLORS.danger,
  warning: THEME_COLORS.warning,
  info: THEME_COLORS.info,
  background: THEME_COLORS.light.background,
  surface: THEME_COLORS.light.surface,
  surfaceAccent: THEME_COLORS.light.surfaceAccent,
  text: THEME_COLORS.light.text,
  textSecondary: THEME_COLORS.light.textSecondary,
  border: THEME_COLORS.light.border,
  loading: THEME_COLORS.primary,
  error: THEME_COLORS.danger,
};

export const ATTENDANCE = {
  DEFAULT_RADIUS_METERS: 50,
  MIN_FACE_SAMPLES: 3,
  MAX_FACE_SAMPLES: 3,
  FACE_MATCH_THRESHOLD: Number(process.env.EXPO_PUBLIC_FACE_MATCH_THRESHOLD || 86),
  LIVENESS_THRESHOLD: 0.15,
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
  FACE_MISMATCH: 'Biometric verification failed (Face mismatch)',
  OUT_OF_RANGE: 'Outside allowed classroom radius',
  TIME_EXPIRED: 'Attendance window has ended',
  TIME_NOT_STARTED: 'Attendance has not started yet',
  FAKE_GPS: 'Suspicious GPS location detected',
  ALREADY_MARKED: 'Attendance already marked for this session',
  NO_ACTIVE_SESSION: 'No active attendance session found',
  SESSION_INACTIVE: 'Attendance session is currently closed',
  LIVENESS_FAILED: 'Liveness test failed (Please blink or move head naturally)',
  STATIC_IMAGE: 'Static 2D image/photo detected',
  NO_MOTION: 'No natural facial movement detected',
  MULTIPLE_FACES: 'Multiple faces detected in frame',
  POOR_LIGHTING: 'Poor lighting conditions',
  BLURRED_IMAGE: 'Image blurred - hold device steady',
};

export const COLLECTIONS = {
  USERS: 'users',
  TEACHERS: 'teachers',
  STUDENTS: 'students',
  CLASSROOMS: 'classrooms',
  ATTENDANCE: 'attendance',
  ATTENDANCE_SESSIONS: 'attendanceSessions',
  ASSIGNMENTS: 'assignments',
  NOTES: 'notes',
  QUESTION_BANK: 'questionBank',
  ANNOUNCEMENTS: 'announcements',
  FACE_DATA: 'faceData',
  DEVICES: 'devices',
};

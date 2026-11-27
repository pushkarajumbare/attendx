/**
 * AttendX - Central Design System & Constants
 * Graceful Professional Palette: Royal Blue Primary + Vibrant Orange & Emerald Green Accents
 * Full Light & Dark Mode
 */

export const THEME_COLORS = {
  // Brand / Royal Blue Palette
  primary: '#2563EB',        // Vibrant Royal Tech Blue
  primaryDark: '#1D4ED8',    // Deep Cobalt Blue
  primaryLight: '#EFF6FF',   // Clean Ice Blue Tint (Light Mode pills/accents)
  primaryMuted: 'rgba(37, 99, 235, 0.14)',

  // Secondary Warm Orange Accents
  secondary: '#F97316',      // Bright Warm Orange
  secondaryDark: '#EA580C',  // Deep Burnt Orange
  secondaryLight: '#FFF7ED', // Soft Peach Tint
  secondaryMuted: 'rgba(249, 115, 22, 0.14)',
  accent: '#8B5CF6',         // Royal Purple / Violet

  // Functional Colors
  success: '#10B981',        // Vivid Emerald Green
  successLight: 'rgba(16, 185, 129, 0.14)',
  danger: '#EF4444',         // Crimson Red
  dangerLight: 'rgba(239, 68, 68, 0.14)',
  warning: '#F59E0B',        // Golden Amber
  warningLight: 'rgba(245, 158, 11, 0.15)',
  info: '#0284C7',           // Vibrant Sky Blue
  infoLight: 'rgba(2, 132, 199, 0.14)',

  // Light Mode Tokens (Graceful Slate White + Crisp White Cards)
  light: {
    background: '#F8FAFC',   // Clean Slate White
    surface: '#FFFFFF',      // Crisp Pure White Card
    surfaceElevated: '#FFFFFF',
    surfaceVariant: '#F1F5F9', // Cool Slate Pill/Chip Bg
    surfaceAccent: '#EFF6FF', // Soft Royal Ice Blue Accent Box
    text: '#0F172A',         // Deep Slate Stone (Maximum Readability)
    textSecondary: '#475569',// Crisp Slate Gray
    textTertiary: '#94A3B8', // Subtle Muted Slate
    border: '#E2E8F0',       // Soft Elegant Slate Border
    borderStrong: '#CBD5E1',
    inputBackground: '#FFFFFF',
    cardShadow: 'rgba(37, 99, 235, 0.06)',
    modalOverlay: 'rgba(15, 23, 42, 0.55)',
  },

  // Dark Mode Tokens (Deep Midnight Navy Obsidian + Distinct Sapphire Cards)
  dark: {
    background: '#0A0F1D',   // Deepest Midnight Obsidian
    surface: '#111827',      // Midnight Slate Card
    surfaceElevated: '#1E293B',
    surfaceVariant: '#1E293B', // Elevated Slate
    surfaceAccent: '#172554', // Deep Royal Navy Glow Box
    text: '#F8FAFC',         // Crisp Snow White
    textSecondary: '#94A3B8',// High-Contrast Slate Gray
    textTertiary: '#64748B', // Muted Cool Slate
    border: '#1E293B',       // Clean Midnight Slate Border
    borderStrong: '#334155',
    inputBackground: '#131D31',
    cardShadow: 'rgba(0, 0, 0, 0.65)',
    modalOverlay: 'rgba(0, 0, 0, 0.82)',
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

const parsedMatchThreshold = Number(process.env.EXPO_PUBLIC_FACE_MATCH_THRESHOLD || 45);
// Guard against stale legacy landmark-era threshold env values (>= 80)
const CALIBRATED_MATCH_THRESHOLD =
  Number.isFinite(parsedMatchThreshold) && parsedMatchThreshold >= 35 && parsedMatchThreshold <= 75
    ? parsedMatchThreshold
    : 45;

export const ATTENDANCE = {
  DEFAULT_RADIUS_METERS: 50,
  MIN_FACE_SAMPLES: 3,
  MAX_FACE_SAMPLES: 3,
  FACE_MODEL_VERSION: 'insightface-mobilenet-emore-v1',
  FACE_MATCH_THRESHOLD: CALIBRATED_MATCH_THRESHOLD,
  FACE_COSINE_THRESHOLD: CALIBRATED_MATCH_THRESHOLD / 100,
  FACE_AMBIGUOUS_FLOOR: 0.36,
  FACE_MIN_SAMPLE_CONSISTENCY: 0.36,
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
  NOTIFICATIONS: 'notifications',
  FACE_DATA: 'faceData',
  DEVICES: 'devices',
};

export function generateClassroomCode(subject = 'CLS') {
  const prefix = subject.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase() || 'CLS';
  const year = new Date().getFullYear().toString().slice(-2);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${year}${suffix}`;
}

export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

export function toValidDate(value) {
  if (value == null || value === '') return null;

  let date;
  try {
    if (value instanceof Date) {
      date = value;
    } else if (typeof value?.toDate === 'function') {
      date = value.toDate();
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d{10}$/.test(trimmed)) date = new Date(Number(trimmed) * 1000);
      else if (/^\d{11,13}$/.test(trimmed)) date = new Date(Number(trimmed));
      else date = new Date(trimmed);
    } else if (typeof value === 'object' && Number.isFinite(value.seconds ?? value._seconds)) {
      date = new Date((value.seconds ?? value._seconds) * 1000);
    }
  } catch (_) {
    return null;
  }

  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
}

export function withTimeout(promise, timeoutMs = 15000, message = 'Request timed out. Please try again.') {
  let timeoutId;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeoutId));
}

export function formatDate(value) {
  const date = toValidDate(value);
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(value) {
  const date = toValidDate(value);
  if (!date) return 'N/A';
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(value) {
  const date = toValidDate(value);
  return date ? `${formatDate(date)} ${formatTime(date)}` : 'N/A';
}

export function isWithinTimeWindow(startTime, endTime, now = new Date()) {
  const start = toValidDate(startTime);
  const end = toValidDate(endTime);
  const current = toValidDate(now);
  return Boolean(start && end && current && current >= start && current <= end);
}

export function isCompletedSession(session, now = Date.now()) {
  const start = toValidDate(session?.startTime);
  const end = toValidDate(session?.endTime);
  const current = toValidDate(now);
  return Boolean(start && end && current && start <= current && (session?.status === 'ended' || end <= current));
}

export function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

export function detectFakeGps(location) {
  if (!location) return true;
  const { mocked, accuracy, coords } = location;
  if (mocked === true) return true;
  if (accuracy != null && accuracy <= 0) return true;
  if (coords && (coords.latitude === 0 && coords.longitude === 0)) return true;
  return false;
}

export function calculateAttendancePercentage(present, total) {
  if (!total) return 0;
  return Math.round((present / total) * 100);
}

// Get status label and color for sessions
export function getSessionStatusLabel(status) {
  const labels = {
    active: 'Active',
    paused: 'Paused',
    ended: 'Ended',
    reopened: 'Reopened',
  };
  return labels[status] || status;
}

// Format session duration
export function formatSessionDuration(startTime, endTime) {
  const start = toValidDate(startTime);
  const end = toValidDate(endTime);
  if (!start || !end || end < start) return 'N/A';
  const minutes = Math.round((end - start) / (1000 * 60));
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

// Truncate string with ellipsis
export function truncate(str, length = 20) {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

// CSV Export Utility for Attendance Reports
export function exportAttendanceToCSV({ classroom = {}, students = [], sessions = [], records = [] } = {}) {
  const headers = [
    'Classroom ID', 'Classroom Name', 'Subject', 'Student ID', 'Student Name', 'Roll Number',
    'Session ID', 'Lecture Date', 'Start Time', 'End Time', 'Attendance Status', 'Marked Time',
    'Face Verified', 'Face Confidence', 'GPS Verified', 'Distance Meters',
  ];
  const recordByPair = new Map(records.map((record) => [`${record.sessionId}|${record.studentId}`, record]));
  const rows = [];

  for (const session of sessions) {
    const start = toValidDate(session.startTime);
    const end = toValidDate(session.endTime);
    if (!start || !end || start.getTime() > Date.now()) continue;
    if (session.status !== 'ended' && end.getTime() > Date.now()) continue;

    for (const student of students) {
      const record = recordByPair.get(`${session.sessionId}|${student.studentId}`);
      const isPresent = record?.status === 'present';
      const radius = Number(session.radiusMeters) || 50;
      const gpsVerified = Boolean(record && Number.isFinite(Number(record.distanceMeters)) && Number(record.distanceMeters) <= radius);
      rows.push([
        classroom.classroomId || '',
        classroom.className || '',
        session.subject || classroom.subject || '',
        student.studentId || '',
        student.name || student.displayName || '',
        student.rollNumber || '',
        session.sessionId || '',
        formatDate(start),
        formatTime(start),
        formatTime(end),
        isPresent ? 'Present' : 'Absent',
        isPresent ? formatDateTime(record.time) : '',
        isPresent && record.faceVerified ? 'Yes' : 'No',
        isPresent ? record.faceConfidence ?? '' : '',
        isPresent && gpsVerified ? 'Yes' : 'No',
        isPresent ? record.distanceMeters ?? '' : '',
      ]);
    }
  }

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}


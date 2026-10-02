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

export function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateTime(date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function isWithinTimeWindow(startTime, endTime, now = new Date()) {
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
  return now >= start && now <= end;
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
  const start = startTime instanceof Date ? startTime : new Date(startTime);
  const end = endTime instanceof Date ? endTime : new Date(endTime);
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
export function exportAttendanceToCSV(records = [], classroomName = 'Classroom') {
  const headers = ['Attendance ID', 'Student ID', 'Status', 'Date', 'Distance (m)', 'Face Confidence (%)'];
  const rows = records.map((r) => [
    `"${r.attendanceId || ''}"`,
    `"${r.studentId || ''}"`,
    `"${r.status || 'present'}"`,
    `"${r.date || ''}"`,
    r.distanceMeters ?? 0,
    r.faceConfidence ?? 0,
  ]);
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
}


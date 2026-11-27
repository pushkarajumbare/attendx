/**
 * AttendX Classroom Management Service
 * 
 * Handles classroom creation, code generation, joining, member management,
 * and permanent classroom membership sync.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';
import { generateClassroomCode, withTimeout } from '../utils/helpers';

function readDoc(reference) {
  return withTimeout(getDoc(reference), 15000, 'Classroom request timed out. Please retry.');
}

function readDocs(queryReference) {
  return withTimeout(getDocs(queryReference), 15000, 'Classroom request timed out. Please retry.');
}

/**
 * Teacher creates a new classroom with an auto-generated unique code.
 */
export async function createClassroom(teacherId, { className, subject }) {
  if (!teacherId) throw new Error('Teacher ID required to create classroom');
  if (!className?.trim()) throw new Error('Classroom name is required');

  const classroomCode = generateClassroomCode(subject || className);
  const classroomRef = doc(collection(db, COLLECTIONS.CLASSROOMS));

  const classroom = {
    classroomId: classroomRef.id,
    teacherId,
    className: className.trim(),
    subject: subject?.trim() || 'General',
    classroomCode: classroomCode.toUpperCase(),
    studentIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(classroomRef, classroom);

  try {
    const teacherDocRef = doc(db, COLLECTIONS.TEACHERS, teacherId);
    await updateDoc(teacherDocRef, {
      classrooms: arrayUnion(classroomRef.id),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.log('[ClassroomService] Teacher arrayUnion notice:', err?.message);
  }

  return classroom;
}

/**
 * Fetch all classrooms owned by a teacher.
 */
export async function getTeacherClassrooms(teacherId) {
  if (!teacherId) return [];
  const q = query(
    collection(db, COLLECTIONS.CLASSROOMS),
    where('teacherId', '==', teacherId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await readDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), classroomId: d.data().classroomId || d.id }));
}

/**
 * Fetch a classroom by its 6-character code.
 */
export async function getClassroomByCode(classroomCode) {
  if (!classroomCode?.trim()) return null;
  const cleanCode = classroomCode.trim().toUpperCase();

  const q = query(
    collection(db, COLLECTIONS.CLASSROOMS),
    where('classroomCode', '==', cleanCode)
  );
  const snapshot = await readDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

/**
 * Student joins a classroom by entering the code.
 * Adds studentId to classroom.studentIds and enrolledClasses on student document.
 */
export async function joinClassroom(studentId, classroomCode) {
  if (!studentId) throw new Error('Student ID context missing');
  if (!classroomCode?.trim()) throw new Error('Please enter a classroom code');

  const classroom = await getClassroomByCode(classroomCode);
  if (!classroom) {
    throw new Error('Classroom not found. Please check the code and try again.');
  }

  // Check if already joined
  if (classroom.studentIds && Array.isArray(classroom.studentIds) && classroom.studentIds.includes(studentId)) {
    throw new Error(`You are already enrolled in ${classroom.className}`);
  }

  // 1. Add student to classroom document
  await updateDoc(doc(db, COLLECTIONS.CLASSROOMS, classroom.classroomId), {
    studentIds: arrayUnion(studentId),
    updatedAt: serverTimestamp(),
  });

  // 2. Add classroom to student document for double-link persistence
  try {
    const studentRef = doc(db, COLLECTIONS.STUDENTS, studentId);
    await updateDoc(studentRef, {
      enrolledClasses: arrayUnion(classroom.classroomId),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.log('[ClassroomService] Student enrolledClasses notice:', err?.message);
  }

  return classroom;
}

/**
 * Fetch all classrooms a student is permanently enrolled in.
 */
export async function getStudentClassrooms(studentId) {
  if (!studentId) return [];

  try {
    // Primary query: Find all classrooms where studentIds array contains studentId
    const q = query(
      collection(db, COLLECTIONS.CLASSROOMS),
      where('studentIds', 'array-contains', studentId)
    );
    const snapshot = await readDocs(q);
    const list = snapshot.docs.map((d) => ({ ...d.data(), classroomId: d.data().classroomId || d.id }));

    if (list.length > 0) {
      return list;
    }

    // Fallback: Check student document enrolledClasses
    const studentDoc = await readDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
    const enrolledIds = studentDoc.data()?.enrolledClasses || [];

    if (enrolledIds.length > 0) {
      const fetched = await Promise.all(
        enrolledIds.map(async (id) => {
          const docSnap = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, id));
          return docSnap.exists()
            ? { ...docSnap.data(), classroomId: docSnap.data().classroomId || docSnap.id }
            : null;
        })
      );
      return fetched.filter(Boolean);
    }

    return [];
  } catch (error) {
    console.error('[ClassroomService] getStudentClassrooms error:', error);
    throw error;
  }
}

export function sortStudentsByRollAndName(students = []) {
  return [...students].sort((a, b) => {
    const rA = String(a?.rollNumber ?? '').trim();
    const rB = String(b?.rollNumber ?? '').trim();
    if (rA && rB) {
      const cmp = rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    } else if (rA && !rB) {
      return -1;
    } else if (!rA && rB) {
      return 1;
    }
    return String(a?.name || a?.displayName || '').localeCompare(
      String(b?.name || b?.displayName || ''),
      undefined,
      { sensitivity: 'base' }
    );
  });
}

/**
 * Get all students enrolled in a classroom with their user profiles and classroom roll numbers.
 */
export async function getClassroomStudents(classroomId) {
  if (!classroomId) return [];
  const classroomDoc = await readDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) return [];

  const classroomData = classroomDoc.data() || {};
  const studentIds = [...new Set(classroomData.studentIds || [])];
  if (studentIds.length === 0) return [];
  const rollMap = classroomData.studentRollNumbers || {};

  const students = await Promise.all(
    studentIds.map(async (sid) => {
      try {
        const uDoc = await readDoc(doc(db, COLLECTIONS.USERS, sid));
        const userData = uDoc.exists() ? uDoc.data() : {};
        const hasClassroomRoll = Object.prototype.hasOwnProperty.call(rollMap, sid);
        const resolvedRoll = hasClassroomRoll
          ? String(rollMap[sid] ?? '').trim()
          : String(userData.rollNumber ?? '').trim();
        return {
          studentId: sid,
          name: userData.name || userData.displayName || 'Student',
          email: userData.email || '',
          faceRegistered: Boolean(userData.faceRegistered),
          rollNumber: resolvedRoll,
        };
      } catch {
        const hasClassroomRoll = Object.prototype.hasOwnProperty.call(rollMap, sid);
        return {
          studentId: sid,
          name: 'Student',
          email: '',
          faceRegistered: false,
          rollNumber: hasClassroomRoll ? String(rollMap[sid] ?? '').trim() : '',
        };
      }
    })
  );

  return sortStudentsByRollAndName(students);
}

/**
 * Teacher sets, updates, or clears (blank) a student's roll number for a classroom.
 * When empty/blank is saved, it remains blank cleanly.
 */
export async function updateStudentRollNumber(classroomId, teacherId, studentId, rollNumber) {
  if (!classroomId || !teacherId || !studentId) {
    throw new Error('Classroom, teacher, and student identity are required.');
  }

  const classRef = doc(db, COLLECTIONS.CLASSROOMS, classroomId);
  const classDoc = await readDoc(classRef);
  if (!classDoc.exists()) {
    throw new Error('Classroom not found.');
  }
  const classData = classDoc.data();
  if (classData.teacherId !== teacherId) {
    throw new Error('Unauthorized: only the classroom teacher can update roll numbers.');
  }
  if (!Array.isArray(classData.studentIds) || !classData.studentIds.includes(studentId)) {
    throw new Error('Student is not enrolled in this classroom.');
  }

  const normalizedRoll = String(rollNumber ?? '').trim();
  const nextMap = { ...(classData.studentRollNumbers || {}) };
  nextMap[studentId] = normalizedRoll;

  await updateDoc(classRef, {
    studentRollNumbers: nextMap,
    updatedAt: serverTimestamp(),
  });

  return normalizedRoll;
}

export async function deleteClassroom(classroomId, teacherId) {
  const classroomDoc = await getDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) throw new Error('Classroom not found');
  if (classroomDoc.data().teacherId !== teacherId) throw new Error('Unauthorized');

  await deleteDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));

  try {
    await updateDoc(doc(db, COLLECTIONS.TEACHERS, teacherId), {
      classrooms: arrayRemove(classroomId),
      updatedAt: serverTimestamp(),
    });
  } catch (_) {}
}

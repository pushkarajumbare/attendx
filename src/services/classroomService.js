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
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';
import { generateClassroomCode } from '../utils/helpers';

export async function createClassroom(teacherId, { className, subject }) {
  const classroomCode = generateClassroomCode(subject);
  const classroomRef = doc(collection(db, COLLECTIONS.CLASSROOMS));

  const classroom = {
    classroomId: classroomRef.id,
    teacherId,
    className,
    subject,
    classroomCode,
    studentIds: [],
    createdAt: serverTimestamp(),
  };

  await setDoc(classroomRef, classroom);
  await updateDoc(doc(db, COLLECTIONS.TEACHERS, teacherId), {
    classrooms: arrayUnion(classroomRef.id),
  });

  return classroom;
}

export async function getTeacherClassrooms(teacherId) {
  const q = query(collection(db, COLLECTIONS.CLASSROOMS), where('teacherId', '==', teacherId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function getClassroomByCode(classroomCode) {
  const q = query(
    collection(db, COLLECTIONS.CLASSROOMS),
    where('classroomCode', '==', classroomCode.toUpperCase())
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

export async function joinClassroom(studentId, classroomCode) {
  const classroom = await getClassroomByCode(classroomCode);
  if (!classroom) throw new Error('Invalid classroom code');

  if (classroom.studentIds?.includes(studentId)) {
    throw new Error('Already enrolled in this classroom');
  }

  await updateDoc(doc(db, COLLECTIONS.CLASSROOMS, classroom.classroomId), {
    studentIds: arrayUnion(studentId),
  });

  await updateDoc(doc(db, COLLECTIONS.STUDENTS, studentId), {
    enrolledClasses: arrayUnion(classroom.classroomId),
  });

  return classroom;
}

export async function updateClassroom(classroomId, updates) {
  await updateDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId), updates);
}

export async function deleteClassroom(classroomId, teacherId) {
  const classroomDoc = await getDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  if (!classroomDoc.exists()) throw new Error('Classroom not found');
  if (classroomDoc.data().teacherId !== teacherId) throw new Error('Unauthorized');

  await deleteDoc(doc(db, COLLECTIONS.CLASSROOMS, classroomId));
  await updateDoc(doc(db, COLLECTIONS.TEACHERS, teacherId), {
    classrooms: arrayRemove(classroomId),
  });
}

export async function getStudentClassrooms(studentId) {
  const studentDoc = await getDoc(doc(db, COLLECTIONS.STUDENTS, studentId));
  const enrolled = studentDoc.data()?.enrolledClasses || [];

  const classrooms = await Promise.all(
    enrolled.map(async (id) => {
      const docSnap = await getDoc(doc(db, COLLECTIONS.CLASSROOMS, id));
      return docSnap.exists() ? docSnap.data() : null;
    })
  );

  return classrooms.filter(Boolean);
}

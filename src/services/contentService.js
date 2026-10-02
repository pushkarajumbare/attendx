/**
 * AttendX Content & File Management Service
 * 
 * Manages:
 * - Native Document Picker file attachments (PDF, DOCX, PPT, Images, etc.)
 * - Firebase Storage upload with live progress tracking
 * - Firestore resource metadata persistence (Notes, Assignments, Question Bank, Announcements)
 * - Safe file downloading, sharing, and viewing for students and teachers
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Linking, Alert } from 'react-native';

import { db, storage } from '../config/firebase';
import { COLLECTIONS } from '../constants';
import { getClassroomStudents } from './classroomService';

// ===============================================
// DOCUMENT PICKER HELPER
// ===============================================
/**
 * Open native system document picker to select any file.
 * Returns { uri, name, size, mimeType } or null if cancelled.
 */
export async function pickDocument() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const file = result.assets[0];
    return {
      uri: file.uri,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType || 'application/octet-stream',
    };
  } catch (error) {
    console.error('[ContentService] pickDocument error:', error);
    Alert.alert('File Picker Error', 'Could not access device files.');
    return null;
  }
}

// ===============================================
// FIREBASE STORAGE UPLOADER
// ===============================================
/**
 * Upload a local file URI directly to Firebase Storage with progress tracking.
 * 
 * @param {string} localUri - File URI from document picker
 * @param {string} storagePath - e.g. "notes/classroomId/timestamp_filename"
 * @param {function} [onProgress] - Optional callback(percent)
 * @returns {Promise<string>} Public download URL
 */
export async function uploadFileToStorage(localUri, storagePath, onProgress) {
  try {
    // 1. Fetch file as blob in React Native
    const response = await fetch(localUri);
    const blob = await response.blob();

    // 2. Create Storage reference
    const storageRef = ref(storage, storagePath);

    // 3. Resumable upload task with progress callbacks
    const uploadTask = uploadBytesResumable(storageRef, blob);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          if (onProgress) {
            onProgress(Math.round(progress));
          }
        },
        (error) => {
          console.error('[ContentService] Storage upload error:', error);
          reject(new Error(`File upload failed: ${error.message}`));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadUrl);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  } catch (error) {
    console.error('[ContentService] uploadFileToStorage error:', error);
    throw error;
  }
}

// ===============================================
// OPEN / DOWNLOAD / SHARE FILE
// ===============================================
/**
 * Open or share a file on device natively.
 */
export async function openOrDownloadFile(fileUrl, fileName = 'download') {
  if (!fileUrl) {
    Alert.alert('Error', 'Invalid or missing file URL.');
    return;
  }

  try {
    // If it's a web/external link or standard URL, attempt system browser/viewer first
    const supported = await Linking.canOpenURL(fileUrl);
    if (supported) {
      await Linking.openURL(fileUrl);
      return;
    }

    // Fallback: Download file to cache and open via native share dialog
    const localTarget = `${FileSystem.cacheDirectory}${Date.now()}_${fileName}`;
    const downloadRes = await FileSystem.downloadAsync(fileUrl, localTarget);

    if (downloadRes.status === 200) {
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(downloadRes.uri);
      } else {
        Alert.alert('Downloaded', `File saved to ${downloadRes.uri}`);
      }
    } else {
      throw new Error('Download failed');
    }
  } catch (error) {
    console.error('[ContentService] openOrDownloadFile error:', error);
    // Final fallback to Linking
    try {
      await Linking.openURL(fileUrl);
    } catch (_) {
      Alert.alert('Cannot Open File', 'Please ensure you have a compatible app installed.');
    }
  }
}

// ===============================================
// NOTES
// ===============================================
export async function uploadNote(classroomId, teacherId, { title, description, linkUrl, fileAsset }, onProgress) {
  if (!classroomId || !teacherId) throw new Error('Classroom and Teacher ID required');
  if (!title?.trim()) throw new Error('Note title is required');

  let finalFileUrl = linkUrl?.trim() || '';
  let finalFileName = fileAsset?.name || '';
  let finalFileSize = fileAsset?.size || 0;

  // If a local file was attached, upload it to Firebase Storage
  if (fileAsset?.uri) {
    const cleanFileName = (fileAsset.name || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `notes/${classroomId}/${Date.now()}_${cleanFileName}`;
    finalFileUrl = await uploadFileToStorage(fileAsset.uri, storagePath, onProgress);
    finalFileName = fileAsset.name;
  }

  if (!finalFileUrl) {
    throw new Error('Please attach a file or provide a link URL');
  }

  const noteRef = doc(collection(db, COLLECTIONS.NOTES));
  const note = {
    noteId: noteRef.id,
    classroomId,
    teacherId,
    title: title.trim(),
    description: description?.trim() || '',
    fileUrl: finalFileUrl,
    fileName: finalFileName,
    fileSize: finalFileSize,
    createdAt: serverTimestamp(),
  };

  await setDoc(noteRef, note);
  return note;
}

export async function getNotes(classroomId) {
  if (!classroomId) return [];
  const q = query(
    collection(db, COLLECTIONS.NOTES),
    where('classroomId', '==', classroomId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

// ===============================================
// ASSIGNMENTS
// ===============================================
export async function uploadAssignment(classroomId, teacherId, data, onProgress) {
  if (!classroomId || !teacherId) throw new Error('Classroom context missing');
  if (!data.title?.trim()) throw new Error('Assignment title is required');

  let finalFileUrl = data.linkUrl?.trim() || '';
  let finalFileName = data.fileAsset?.name || '';
  let finalFileSize = data.fileAsset?.size || 0;

  if (data.fileAsset?.uri) {
    const cleanFileName = (data.fileAsset.name || 'assignment.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `assignments/${classroomId}/${Date.now()}_${cleanFileName}`;
    finalFileUrl = await uploadFileToStorage(data.fileAsset.uri, storagePath, onProgress);
    finalFileName = data.fileAsset.name;
  }

  // finalFileUrl may be empty — assignments without attached files are valid (title+description only)

  const assignmentRef = doc(collection(db, COLLECTIONS.ASSIGNMENTS));
  const assignment = {
    assignmentId: assignmentRef.id,
    classroomId,
    teacherId,
    title: data.title.trim(),
    description: data.description?.trim() || '',
    deadline: data.deadline || null,
    maxMarks: Number(data.maxMarks) || 100,
    fileUrl: finalFileUrl,
    fileName: finalFileName,
    fileSize: finalFileSize,
    createdAt: serverTimestamp(),
  };

  await setDoc(assignmentRef, assignment);
  return assignment;
}

export async function getAssignments(classroomId) {
  if (!classroomId) return [];
  const q = query(
    collection(db, COLLECTIONS.ASSIGNMENTS),
    where('classroomId', '==', classroomId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

export async function submitAssignment(assignmentId, studentId, submissionInput, onProgress) {
  if (!assignmentId || !studentId) throw new Error('Assignment ID and Student ID are required');

  // 1. Evaluate deadline server/timestamp logic
  const assignmentRef = doc(db, COLLECTIONS.ASSIGNMENTS, assignmentId);
  const assignmentSnap = await getDoc(assignmentRef);
  if (assignmentSnap.exists()) {
    const assignment = assignmentSnap.data();
    if (assignment?.deadline) {
      const deadlineMs = assignment.deadline.toDate ? assignment.deadline.toDate().getTime() : new Date(assignment.deadline).getTime();
      if (!Number.isNaN(deadlineMs) && Date.now() > deadlineMs) {
        throw new Error(`Submissions for this assignment closed on ${new Date(deadlineMs).toLocaleString()}`);
      }
    }
  }

  let submissionUrl = null;
  let fileUrl = null;
  let fileName = 'submission';
  let fileSize = 0;

  if (typeof submissionInput === 'string') {
    submissionUrl = submissionInput.trim();
  } else if (submissionInput?.submissionUrl) {
    submissionUrl = submissionInput.submissionUrl.trim();
  }

  const fileToUpload = submissionInput?.fileAsset || (submissionInput?.uri ? submissionInput : null);
  if (fileToUpload?.uri) {
    const cleanFileName = (fileToUpload.name || 'submission.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `submissions/${assignmentId}/${studentId}_${Date.now()}_${cleanFileName}`;
    fileUrl = await uploadFileToStorage(fileToUpload.uri, storagePath, onProgress);
    fileName = fileToUpload.name || 'submission';
    fileSize = fileToUpload.size || 0;
    if (!submissionUrl) submissionUrl = fileUrl;
  }

  if (!submissionUrl && !fileUrl) {
    throw new Error('Please enter a submission URL or select a file to submit');
  }

  const existingSub = await getStudentSubmission(assignmentId, studentId);
  const subRef = existingSub?.submissionId
    ? doc(db, 'submissions', existingSub.submissionId)
    : doc(collection(db, 'submissions'));

  const submission = {
    submissionId: subRef.id,
    assignmentId,
    studentId,
    fileUrl: fileUrl || existingSub?.fileUrl || null,
    submissionUrl: submissionUrl || fileUrl || existingSub?.submissionUrl,
    fileName: fileName || existingSub?.fileName || 'submission',
    fileSize: fileSize || existingSub?.fileSize || 0,
    submittedAt: existingSub?.submittedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(subRef, submission, { merge: true });
  return submission;
}

export async function getStudentSubmission(assignmentId, studentId) {
  if (!assignmentId || !studentId) return null;
  const q = query(
    collection(db, 'submissions'),
    where('assignmentId', '==', assignmentId),
    where('studentId', '==', studentId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

export async function getAssignmentSubmissionsForTeacher(assignmentId, classroomId) {
  if (!assignmentId || !classroomId) return [];
  const students = await getClassroomStudents(classroomId);

  const q = query(
    collection(db, 'submissions'),
    where('assignmentId', '==', assignmentId)
  );
  const snapshot = await getDocs(q);
  const submissionsMap = {};
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    submissionsMap[data.studentId] = data;
  });

  return students.map((std) => {
    const sub = submissionsMap[std.studentId];
    return {
      studentId: std.studentId,
      name: std.name || std.displayName || 'Student',
      rollNumber: std.rollNumber || '',
      email: std.email || '',
      status: sub ? 'Submitted' : 'Not Submitted',
      submissionUrl: sub?.submissionUrl || sub?.fileUrl || null,
      fileName: sub?.fileName || null,
      submittedAt: sub?.submittedAt || null,
    };
  });
}

// ===============================================
// QUESTION BANK
// ===============================================
export async function uploadQuestionBank(classroomId, teacherId, { title, description, linkUrl, fileAsset }, onProgress) {
  if (!classroomId || !teacherId) throw new Error('Classroom context missing');
  if (!title?.trim()) throw new Error('Question bank title is required');

  let finalFileUrl = linkUrl?.trim() || '';
  let finalFileName = fileAsset?.name || '';

  if (fileAsset?.uri) {
    const cleanFileName = (fileAsset.name || 'questions.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `questionBank/${classroomId}/${Date.now()}_${cleanFileName}`;
    finalFileUrl = await uploadFileToStorage(fileAsset.uri, storagePath, onProgress);
    finalFileName = fileAsset.name;
  }

  const qbRef = doc(collection(db, COLLECTIONS.QUESTION_BANK));
  const item = {
    qbId: qbRef.id,
    classroomId,
    teacherId,
    title: title.trim(),
    description: description?.trim() || '',
    fileUrl: finalFileUrl,
    fileName: finalFileName,
    createdAt: serverTimestamp(),
  };

  await setDoc(qbRef, item);
  return item;
}

export async function getQuestionBank(classroomId) {
  if (!classroomId) return [];
  const q = query(
    collection(db, COLLECTIONS.QUESTION_BANK),
    where('classroomId', '==', classroomId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

// ===============================================
// ANNOUNCEMENTS
// ===============================================
export async function createAnnouncement(classroomId, teacherId, { title, message }) {
  if (!classroomId || !teacherId) throw new Error('Classroom context missing');
  if (!title?.trim()) throw new Error('Announcement title is required');

  const announcementRef = doc(collection(db, COLLECTIONS.ANNOUNCEMENTS));
  const announcement = {
    announcementId: announcementRef.id,
    classroomId,
    teacherId,
    title: title.trim(),
    message: message?.trim() || '',
    createdAt: serverTimestamp(),
  };

  await setDoc(announcementRef, announcement);
  return announcement;
}

export async function getAnnouncements(classroomId) {
  if (!classroomId) return [];
  const q = query(
    collection(db, COLLECTIONS.ANNOUNCEMENTS),
    where('classroomId', '==', classroomId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => d.data());
}

// ===============================================
// DELETE RESOURCE
// ===============================================
export async function deleteResource(collectionName, docId) {
  await deleteDoc(doc(db, collectionName, docId));
}

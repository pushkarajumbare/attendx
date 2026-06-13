import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import * as Device from 'expo-device';
import { auth, db } from '../config/firebase';
import { COLLECTIONS, ROLES } from '../constants';

async function getDeviceId() {
  return Device.osInternalBuildId || Device.modelId || 'unknown-device';
}

export async function signUp({ email, password, name, role }) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;

  await updateProfile(user, { displayName: name });

  const userData = {
    uid: user.uid,
    name,
    email,
    role,
    profileImage: null,
    faceRegistered: role === ROLES.STUDENT ? false : true,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData);

  if (role === ROLES.TEACHER) {
    await setDoc(doc(db, COLLECTIONS.TEACHERS, user.uid), {
      teacherId: user.uid,
      name,
      email,
      classrooms: [],
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(doc(db, COLLECTIONS.STUDENTS, user.uid), {
      studentId: user.uid,
      name,
      email,
      enrolledClasses: [],
      faceRegistered: false,
      createdAt: serverTimestamp(),
    });
  }

  const deviceId = await getDeviceId();
  await setDoc(doc(db, COLLECTIONS.DEVICES, user.uid), {
    userId: user.uid,
    deviceId,
    lastLogin: serverTimestamp(),
  });

  return userData;
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, credential.user.uid));

  if (!userDoc.exists()) {
    throw new Error('User profile not found');
  }

  const deviceId = await getDeviceId();
  const deviceDoc = await getDoc(doc(db, COLLECTIONS.DEVICES, credential.user.uid));
  const storedDeviceId = deviceDoc.data()?.deviceId;

  if (storedDeviceId && storedDeviceId !== deviceId) {
    await setDoc(doc(db, COLLECTIONS.DEVICES, credential.user.uid), {
      userId: credential.user.uid,
      deviceId,
      lastLogin: serverTimestamp(),
      previousDevice: storedDeviceId,
    });
  } else {
    await setDoc(doc(db, COLLECTIONS.DEVICES, credential.user.uid), {
      userId: credential.user.uid,
      deviceId,
      lastLogin: serverTimestamp(),
    });
  }

  return userDoc.data();
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  await signOut(auth);
}

export async function fetchUserProfile(uid) {
  const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
  return userDoc.exists() ? userDoc.data() : null;
}

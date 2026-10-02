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

  // 1. Update Auth Profile Display Name
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

  // 2. ALWAYS create /users/{uid} FIRST with the correct role
  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userData, { merge: true });

  // 3. THEN create role-specific collection document (/teachers/{uid} or /students/{uid})
  if (role === ROLES.TEACHER) {
    await setDoc(
      doc(db, COLLECTIONS.TEACHERS, user.uid),
      {
        teacherId: user.uid,
        name,
        email,
        classrooms: [],
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    await setDoc(
      doc(db, COLLECTIONS.STUDENTS, user.uid),
      {
        studentId: user.uid,
        name,
        email,
        enrolledClasses: [],
        faceRegistered: false,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  // 4. Register Device tracking document
  const deviceId = await getDeviceId();
  await setDoc(
    doc(db, COLLECTIONS.DEVICES, user.uid),
    {
      userId: user.uid,
      deviceId,
      lastLogin: serverTimestamp(),
    },
    { merge: true }
  );

  return userData;
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const deviceId = await getDeviceId();

  try {
    await setDoc(
      doc(db, COLLECTIONS.DEVICES, credential.user.uid),
      {
        userId: credential.user.uid,
        deviceId,
        lastLogin: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.log("Device registration error:", error);
  }

  const profile = await fetchUserProfile(credential.user.uid);
  if (!profile) {
    throw new Error('User profile not found in database');
  }

  return profile;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logOut() {
  await signOut(auth);
}

export async function fetchUserProfile(
  uid,
  retries = 5,
  delay = 500
) {
  if (!uid) return null;

  for (let i = 0; i < retries; i++) {
    try {
      const userRef = doc(db, COLLECTIONS.USERS, uid);
      const snap = await getDoc(userRef);

      if (snap.exists()) {
        return {
          uid,
          ...snap.data(),
        };
      }

      console.log(
        `Profile not found (attempt ${i + 1})`
      );
    } catch (error) {
      console.log(
        `Fetch profile attempt ${i + 1} failed`,
        error
      );

      if (i === retries - 1) {
        throw error;
      }
    }

    await new Promise((resolve) =>
      setTimeout(resolve, delay)
    );
  }

  return null;
}
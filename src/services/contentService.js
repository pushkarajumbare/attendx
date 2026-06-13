import {
collection,
doc,
setDoc,
getDocs,
query,
where,
serverTimestamp,
deleteDoc,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { COLLECTIONS } from '../constants';

// ==========================
// NOTES
// ==========================

export async function uploadNote(
classroomId,
teacherId,
linkUrl,
title,
description = ''
) {
const noteRef = doc(
collection(db, COLLECTIONS.NOTES)
);

const note = {
noteId: noteRef.id,
classroomId,
teacherId,

title:
  title?.trim() ||
  'Untitled Note',

description:
  description?.trim() || '',

// IMPORTANT
linkUrl:
  linkUrl?.trim() || '',

fileUrl:
  linkUrl?.trim() || '',

createdAt:
  serverTimestamp(),


};

await setDoc(noteRef, note);

return note;
}

export async function getNotes(
classroomId
) {
const q = query(
collection(db, COLLECTIONS.NOTES),
where(
'classroomId',
'==',
classroomId
)
);

const snapshot =
await getDocs(q);

return snapshot.docs.map(
(doc) => ({
id: doc.id,
...doc.data(),
})
);
}

// ==========================
// ASSIGNMENTS
// ==========================

export async function uploadAssignment(
classroomId,
teacherId,
data
) {
const assignmentRef = doc(
collection(
db,
COLLECTIONS.ASSIGNMENTS
)
);

const assignment = {
assignmentId:
assignmentRef.id,


classroomId,
teacherId,

title:
  data.title?.trim() || '',

description:
  data.description?.trim() || '',

deadline:
  data.deadline || null,

maxMarks:
  Number(data.maxMarks) ||
  100,

// IMPORTANT
linkUrl:
  data.linkUrl?.trim() || '',

fileUrl:
  data.linkUrl?.trim() || '',

createdAt:
  serverTimestamp(),


};

await setDoc(
assignmentRef,
assignment
);

return assignment;
}

export async function getAssignments(
classroomId
) {
const q = query(
collection(
db,
COLLECTIONS.ASSIGNMENTS
),
where(
'classroomId',
'==',
classroomId
)
);

const snapshot =
await getDocs(q);

return snapshot.docs.map(
(doc) => ({
id: doc.id,
...doc.data(),
})
);
}

// Upload removed
export async function submitAssignment() {
throw new Error(
'File upload removed. Only links supported.'
);
}

// ==========================
// QUESTION BANK
// ==========================

export async function uploadQuestionBank(
classroomId,
teacherId,
linkUrl,
title,
description = ''
) {
const qbRef = doc(
collection(
db,
COLLECTIONS.QUESTION_BANK
)
);

const item = {
qbId: qbRef.id,


classroomId,
teacherId,

title:
  title?.trim() ||
  'Question Bank',

description:
  description?.trim() || '',

// IMPORTANT
linkUrl:
  linkUrl?.trim() || '',

fileUrl:
  linkUrl?.trim() || '',

createdAt:
  serverTimestamp(),


};

await setDoc(qbRef, item);

return item;
}

export async function getQuestionBank(
classroomId
) {
const q = query(
collection(
db,
COLLECTIONS.QUESTION_BANK
),
where(
'classroomId',
'==',
classroomId
)
);

const snapshot =
await getDocs(q);

return snapshot.docs.map(
(doc) => ({
id: doc.id,
...doc.data(),
})
);
}

// ==========================
// ANNOUNCEMENTS
// ==========================

export async function createAnnouncement(
classroomId,
teacherId,
{
title,
message,
}
) {
const announcementRef =
doc(
collection(
db,
COLLECTIONS.ANNOUNCEMENTS
)
);

const announcement = {
announcementId:
announcementRef.id,

classroomId,
teacherId,

title:
  title?.trim() || '',

message:
  message?.trim() || '',

createdAt:
  serverTimestamp(),


};

await setDoc(
announcementRef,
announcement
);

return announcement;
}

export async function getAnnouncements(
classroomId
) {
const q = query(
collection(
db,
COLLECTIONS.ANNOUNCEMENTS
),
where(
'classroomId',
'==',
classroomId
)
);

const snapshot =
await getDocs(q);

return snapshot.docs.map(
(doc) => ({
id: doc.id,
...doc.data(),
})
);
}

// ==========================
// DELETE
// ==========================

export async function deleteResource(
collectionName,
docId
) {
await deleteDoc(
doc(
db,
collectionName,
docId
)
);
}

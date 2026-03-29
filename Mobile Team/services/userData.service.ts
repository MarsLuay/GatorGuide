/**
 * Delete all data for a user from Firestore (and optionally Storage).
 * Used when the user deletes their account.
 */

import {
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { getStorage, ref, listAll, deleteObject } from "firebase/storage";
import {
  FIRESTORE_COLLECTIONS,
  FIRESTORE_CHAT_HISTORY_SUBCOLLECTIONS,
  FIRESTORE_USER_SUBCOLLECTIONS,
  buildFirebaseUserStoragePath,
} from "@/constants/schema";
import { db, firebaseApp } from "./firebase";
import { isStubMode } from "./config";

async function commitDeleteBatchInChunks(dbInstance: NonNullable<typeof db>, refs: { ref: Parameters<ReturnType<typeof writeBatch>["delete"]>[0] }[]) {
  const CHUNK_SIZE = 400;

  for (let index = 0; index < refs.length; index += CHUNK_SIZE) {
    const batch = writeBatch(dbInstance);
    refs.slice(index, index + CHUNK_SIZE).forEach(({ ref }) => batch.delete(ref));
    await batch.commit().catch(() => {});
  }
}

export async function deleteAllUserDataFromFirestore(uid: string): Promise<void> {
  if (isStubMode() || !db) return;

  // 1. Delete users/{uid}/savedColleges/*
  const savedCollegesRef = collection(
    db,
    FIRESTORE_COLLECTIONS.users,
    uid,
    FIRESTORE_USER_SUBCOLLECTIONS.savedColleges
  );
  const savedCollegesSnapshot = await getDocs(savedCollegesRef).catch(() => null);
  if (savedCollegesSnapshot?.size) {
    await commitDeleteBatchInChunks(db, savedCollegesSnapshot.docs);
  }

  // 2. Delete users/{uid}/opportunityStatuses/*
  const opportunityStatusesRef = collection(
    db,
    FIRESTORE_COLLECTIONS.users,
    uid,
    FIRESTORE_USER_SUBCOLLECTIONS.opportunityStatuses
  );
  const opportunityStatusesSnapshot = await getDocs(opportunityStatusesRef).catch(() => null);
  if (opportunityStatusesSnapshot?.size) {
    await commitDeleteBatchInChunks(db, opportunityStatusesSnapshot.docs);
  }

  // 3. Delete chatHistory/{sessionId} and chatHistory/{sessionId}/messages/*
  const chatHistoryRef = collection(db, FIRESTORE_COLLECTIONS.chatHistory);
  const chatHistoryQuery = query(chatHistoryRef, where("userId", "==", uid));
  const chatHistorySnapshot = await getDocs(chatHistoryQuery).catch(() => null);
  if (chatHistorySnapshot?.size) {
    for (const chatDoc of chatHistorySnapshot.docs) {
      const messagesRef = collection(
        db,
        FIRESTORE_COLLECTIONS.chatHistory,
        chatDoc.id,
        FIRESTORE_CHAT_HISTORY_SUBCOLLECTIONS.messages
      );
      const messagesSnapshot = await getDocs(messagesRef).catch(() => null);
      if (messagesSnapshot?.size) {
        await commitDeleteBatchInChunks(db, messagesSnapshot.docs);
      }
      await deleteDoc(chatDoc.ref).catch(() => {});
    }
  }

  // 4. Delete users/{uid}
  const userRef = doc(db, FIRESTORE_COLLECTIONS.users, uid);
  await deleteDoc(userRef).catch(() => {});

  // 5. Delete roadmaps/{uid}
  const roadmapRef = doc(db, FIRESTORE_COLLECTIONS.roadmaps, uid);
  await deleteDoc(roadmapRef).catch(() => {});

  // 6. Delete questionnaires/{uid} (new format)
  const questionnaireRef = doc(db, FIRESTORE_COLLECTIONS.questionnaires, uid);
  await deleteDoc(questionnaireRef).catch(() => {});

  // 7. Back-compat: delete any legacy questionnaires where userId === uid (random doc ids)
  const questionnairesRef = collection(db, FIRESTORE_COLLECTIONS.questionnaires);
  const q = query(questionnairesRef, where("userId", "==", uid));
  const snapshot = await getDocs(q);
  if (snapshot.size > 0) {
    await commitDeleteBatchInChunks(db, snapshot.docs);
  }
}

/**
 * Delete user's files in Firebase Storage under users/{uid}/
 */
export async function deleteAllUserStorageFiles(uid: string): Promise<void> {
  if (isStubMode() || !firebaseApp) return;
  try {
    const storage = getStorage(firebaseApp);
    const userFolderRef = ref(storage, buildFirebaseUserStoragePath(uid));
    const listResult = await listAll(userFolderRef);
    await Promise.all(
      listResult.items.map((itemRef) => deleteObject(itemRef).catch(() => {}))
    );
    for (const prefixRef of listResult.prefixes) {
      const sub = await listAll(prefixRef);
      await Promise.all(
        sub.items.map((itemRef) => deleteObject(itemRef).catch(() => {}))
      );
    }
  } catch {
    // Storage not configured or folder doesn't exist
  }
}

export async function deleteAllUserData(uid: string): Promise<void> {
  await deleteAllUserDataFromFirestore(uid);
  await deleteAllUserStorageFiles(uid);
}

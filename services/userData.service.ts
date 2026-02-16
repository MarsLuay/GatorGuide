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
import { db, firebaseApp } from "./firebase";
import { isStubMode } from "./config";

export async function deleteAllUserDataFromFirestore(uid: string): Promise<void> {
  if (isStubMode() || !db) return;

  // 1. Delete users/{uid}
  const userRef = doc(db, "users", uid);
  await deleteDoc(userRef).catch(() => {});

  // 2. Delete roadmaps/{uid}
  const roadmapRef = doc(db, "roadmaps", uid);
  await deleteDoc(roadmapRef).catch(() => {});

  // 3. Delete all questionnaires where userId === uid (batch)
  const questionnairesRef = collection(db, "questionnaires");
  const q = query(questionnairesRef, where("userId", "==", uid));
  const snapshot = await getDocs(q);
  if (snapshot.size > 0) {
    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Delete user's files in Firebase Storage under users/{uid}/
 */
export async function deleteAllUserStorageFiles(uid: string): Promise<void> {
  if (isStubMode() || !firebaseApp) return;
  try {
    const storage = getStorage(firebaseApp);
    const userFolderRef = ref(storage, `users/${uid}`);
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

// services/storage.service.ts
// File storage service for resumes and transcripts
// Uses Firebase Storage buckets (resume, transcript) when available; falls back to local

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export type UploadedFile = {
  name: string;
  url: string;
  uploadedAt: Date;
};

const DOCS_DIR = 'gatorguide_docs';

async function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new TypeError('Failed to read file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

async function copyToLocalStorage(sourceUri: string, fileName: string, subDir: string): Promise<string> {
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const dir = `${FileSystem.documentDirectory}${DOCS_DIR}/${subDir}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const destUri = `${dir}${Date.now()}_${fileName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

async function uploadToFirebaseBucket(
  userId: string,
  bucket: 'resume' | 'transcript',
  fileUri: string,
  fileName: string
): Promise<string | null> {
  if (!storage) return null;
  try {
    const blob = await uriToBlob(fileUri);
    const ext = fileName.split('.').pop() || 'pdf';
    const safeName = `${bucket}_${Date.now()}.${ext}`;
    const path = `users/${userId}/${bucket}/${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytesResumable(storageRef, blob, {
      contentType: ext === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch {
    return null;
  }
}

class StorageService {

  async uploadResume(userId: string, fileUri: string): Promise<UploadedFile> {
    const fileName = fileUri.split('/').pop() || `resume_${Date.now()}.pdf`;
    const firebaseUrl = await uploadToFirebaseBucket(userId, 'resume', fileUri, fileName);
    const url = firebaseUrl ?? await copyToLocalStorage(fileUri, fileName, `resume_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`resume:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadTranscript(userId: string, fileUri: string): Promise<UploadedFile> {
    const fileName = fileUri.split('/').pop() || `transcript_${Date.now()}.pdf`;
    const firebaseUrl = await uploadToFirebaseBucket(userId, 'transcript', fileUri, fileName);
    const url = firebaseUrl ?? await copyToLocalStorage(fileUri, fileName, `transcript_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`transcript:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadAvatar(userId: string, imageUri: string): Promise<UploadedFile> {
    const ext = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `avatar_${Date.now()}.${ext}`;
    const persistentUri = await copyToLocalStorage(imageUri, fileName, `avatar_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`avatar:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadDocument(userId: string, docType: string, fileUri: string, originalFileName?: string): Promise<UploadedFile> {
    const fileName = originalFileName || fileUri.split('/').pop() || `${docType}_${Date.now()}.pdf`;
    const persistentUri = await copyToLocalStorage(fileUri, fileName, `roadmap_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`roadmap:${userId}:${docType}`, JSON.stringify(localData));
    return localData;
  }

  async getDocument(userId: string, docType: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`roadmap:${userId}:${docType}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's uploaded resume (from AsyncStorage; URL may be Firebase or local)
   */
  async getResume(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`resume:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's uploaded transcript (from AsyncStorage; URL may be Firebase or local)
   */
  async getTranscript(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`transcript:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  async getAvatar(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`avatar:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete uploaded file metadata from AsyncStorage.
   * Firebase Storage files under users/{uid}/ are cleaned by deleteAllUserStorageFiles.
   */
  async deleteFile(userId: string, fileType: 'resume' | 'transcript'): Promise<void> {
    await AsyncStorage.removeItem(`${fileType}:${userId}`);
  }


}

export const storageService = new StorageService();
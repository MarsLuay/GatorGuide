// services/storage.service.ts
// File storage service for resumes and transcripts
// Local-only storage - files copied to document directory for persistence

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type UploadedFile = {
  name: string;
  url: string;
  uploadedAt: Date;
};

const DOCS_DIR = 'gatorguide_docs';

async function copyToLocalStorage(sourceUri: string, fileName: string, subDir: string): Promise<string> {
  // Web already uses browser-managed file URLs; no filesystem copy needed.
  if (Platform.OS === 'web') {
    return sourceUri;
  }
  const dir = `${FileSystem.documentDirectory}${DOCS_DIR}/${subDir}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const destUri = `${dir}${Date.now()}_${fileName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

class StorageService {

  async uploadResume(userId: string, fileUri: string): Promise<UploadedFile> {
    const fileName = fileUri.split('/').pop() || `resume_${Date.now()}.pdf`;
    const persistentUri = await copyToLocalStorage(fileUri, fileName, `resume_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`resume:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadTranscript(userId: string, fileUri: string): Promise<UploadedFile> {
    const fileName = fileUri.split('/').pop() || `transcript_${Date.now()}.pdf`;
    const persistentUri = await copyToLocalStorage(fileUri, fileName, `transcript_${userId}`);
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date(),
    };
    await AsyncStorage.setItem(`transcript:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadDocument(userId: string, docType: string, fileUri: string): Promise<UploadedFile> {
    // Roadmap document uploads share one namespace keyed by document type.
    const fileName = fileUri.split('/').pop() || `${docType}_${Date.now()}.pdf`;
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
    // Returns metadata for previously uploaded roadmap documents.
    const data = await AsyncStorage.getItem(`roadmap:${userId}:${docType}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's uploaded resume
   * STUB: Retrieves from AsyncStorage
   * TODO: Replace with Firebase Storage download URL
   */
  async getResume(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`resume:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Get user's uploaded transcript
   * STUB: Retrieves from AsyncStorage
   * TODO: Replace with Firebase Storage download URL
   */
  async getTranscript(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(`transcript:${userId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Delete uploaded file
   * STUB: Removes from AsyncStorage
   * TODO: Replace with Firebase Storage delete
   */
  async deleteFile(userId: string, fileType: 'resume' | 'transcript'): Promise<void> {
    await AsyncStorage.removeItem(`${fileType}:${userId}`);
  }


}

export const storageService = new StorageService();

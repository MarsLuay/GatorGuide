// services/storage.service.ts
// File storage service for resumes and transcripts
// Local-only storage to avoid paid cloud storage

import AsyncStorage from '@react-native-async-storage/async-storage';

export type UploadedFile = {
  name: string;
  url: string;
  uploadedAt: Date;
};

class StorageService {

  async uploadResume(userId: string, fileUri: string): Promise<UploadedFile> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const fileName = fileUri.split('/').pop() || `resume_${Date.now()}.pdf`;
    const localData = {
      name: fileName,
      url: fileUri,
      uploadedAt: new Date(),
    };

    await AsyncStorage.setItem(`resume:${userId}`, JSON.stringify(localData));
    return localData;
  }

  async uploadTranscript(userId: string, fileUri: string): Promise<UploadedFile> {
    await new Promise((resolve) => setTimeout(resolve, 200));

    const fileName = fileUri.split('/').pop() || `transcript_${Date.now()}.pdf`;
    const localData = {
      name: fileName,
      url: fileUri,
      uploadedAt: new Date(),
    };

    await AsyncStorage.setItem(`transcript:${userId}`, JSON.stringify(localData));
    return localData;
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
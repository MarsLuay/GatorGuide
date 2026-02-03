import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { storage } from './firebase'; 
import { isStubMode } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UploadedFile = {
  name: string;
  url: string;
  uploadedAt: Date;
};

class StorageService {

  private async uploadToFirebase(userId: string, fileUri: string, folder: 'resumes' | 'transcripts'): Promise<UploadedFile> {

    const fileName = `${folder}_${Date.now()}.pdf`;
    
    const response = await fetch(fileUri);
    const blob = await response.blob();


    const storageRef = ref(storage, `${folder}/${userId}/${fileName}`);


    const snapshot = await uploadBytes(storageRef, blob);


    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      name: fileName,
      url: downloadURL,
      uploadedAt: new Date(),
    };
  }

  async uploadResume(userId: string, fileUri: string): Promise<UploadedFile> {
    if (isStubMode()) {

      const fileName = `resume_${Date.now()}.pdf`;
      const stubData = { name: fileName, url: `stub://resumes/${userId}/${fileName}`, uploadedAt: new Date() };
      await AsyncStorage.setItem(`resume:${userId}`, JSON.stringify(stubData));
      return stubData;
    }

    return await this.uploadToFirebase(userId, fileUri, 'resumes');
  }

  async uploadTranscript(userId: string, fileUri: string): Promise<UploadedFile> {
    if (isStubMode()) {
      const fileName = `transcript_${Date.now()}.pdf`;
      const stubData = { name: fileName, url: `stub://transcripts/${userId}/${fileName}`, uploadedAt: new Date() };
      await AsyncStorage.setItem(`transcript:${userId}`, JSON.stringify(stubData));
      return stubData;
    }

    return await this.uploadToFirebase(userId, fileUri, 'transcripts');
  }


  async deleteFile(userId: string, fileType: 'resume' | 'transcript', fileName: string): Promise<void> {
    if (isStubMode()) {
      await AsyncStorage.removeItem(`${fileType}:${userId}`);
      return;
    }

    const fileRef = ref(storage, `${fileType}s/${userId}/${fileName}`);
    await deleteObject(fileRef);
  }


}

export const storageService = new StorageService();
// services/storage.service.ts
// File storage service for resumes and transcripts
// Uses Firebase Storage buckets (resume, transcript) when available; falls back to local

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  LOCAL_DOCUMENTS_DIR_NAME,
  buildFirebaseUserStoragePath,
  buildLocalDocumentSubdirectory,
  getAvatarStorageKey,
  getResumeStorageKey,
  getRoadmapDocumentStorageKey,
  getTranscriptStorageKey,
} from '@/constants/schema';
import { errorLoggingService } from './error-logging.service';
import { storage } from './firebase';

type UploadFileMetadata = {
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type UploadedFile = {
  name: string;
  url: string;
  uploadedAt: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

function normalizeUploadedAt(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeMimeType(value: unknown) {
  const raw = String(value ?? "").trim();
  return raw || null;
}

function normalizeSizeBytes(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function looksLikeEncodedFileName(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return true;
  if (raw.includes("base64,")) return true;
  return /^[A-Za-z0-9+/=]{120,}$/.test(raw.replace(/\s+/g, ""));
}

function extractFileNameFromUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return null;

  const withoutQuery = raw.split(/[?#]/)[0] ?? "";
  const lastSegment = withoutQuery.split("/").pop() ?? "";

  try {
    const decoded = decodeURIComponent(lastSegment).trim();
    return decoded && decoded.length <= 180 ? decoded : null;
  } catch {
    const trimmed = lastSegment.trim();
    return trimmed && trimmed.length <= 180 ? trimmed : null;
  }
}

function buildFallbackFileName(url: unknown, mimeType: unknown) {
  const inferredFromUrl = extractFileNameFromUrl(url);
  if (inferredFromUrl && !looksLikeEncodedFileName(inferredFromUrl)) {
    return inferredFromUrl;
  }

  const normalizedMimeType = String(mimeType ?? "").trim().toLowerCase();
  if (normalizedMimeType.includes("pdf")) {
    return "uploaded-document.pdf";
  }

  return "uploaded-file";
}

function normalizeUploadedFileName(name: unknown, url: unknown, mimeType: unknown) {
  const raw = String(name ?? "").trim();
  if (raw && raw.length <= 180 && !looksLikeEncodedFileName(raw)) {
    return raw;
  }

  return buildFallbackFileName(url, mimeType);
}

function normalizeUploadedFile(raw: unknown): UploadedFile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const url = String(record.url ?? "").trim();
  if (!url) return null;
  const mimeType = normalizeMimeType(record.mimeType);
  const name = normalizeUploadedFileName(record.name, url, mimeType);

  return {
    name,
    url,
    uploadedAt: normalizeUploadedAt(record.uploadedAt),
    mimeType,
    sizeBytes: normalizeSizeBytes(record.sizeBytes ?? record.size),
  };
}

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

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new TypeError('Failed to encode file'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new TypeError('Failed to encode file'));
    reader.readAsDataURL(blob);
  });
}

async function persistWebFileUrl(sourceUri: string): Promise<string> {
  const normalizedUri = String(sourceUri ?? '').trim();
  if (!normalizedUri) {
    throw new TypeError('Missing file URL');
  }

  if (
    normalizedUri.startsWith('data:') ||
    normalizedUri.startsWith('http://') ||
    normalizedUri.startsWith('https://')
  ) {
    return normalizedUri;
  }

  const blob = await uriToBlob(normalizedUri);
  return blobToDataUrl(blob);
}

async function copyToLocalStorage(sourceUri: string, fileName: string, subDir: string): Promise<string> {
  if (Platform.OS === 'web') {
    return persistWebFileUrl(sourceUri);
  }
  const baseDir = (FileSystem as any).documentDirectory ?? (FileSystem as any).cacheDirectory ?? "";
  const dir = `${baseDir}${LOCAL_DOCUMENTS_DIR_NAME}/${subDir}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch((error) => {
    void errorLoggingService.captureException(error, {
      category: 'storage',
      operation: 'create-local-document-directory',
      severity: 'warn',
      handled: true,
      source: 'storage.service',
      metadata: {
        subDir,
      },
    });
  });
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
    const path = buildFirebaseUserStoragePath(userId, bucket, safeName);
    const storageRef = ref(storage, path);
    await uploadBytesResumable(storageRef, blob, {
      contentType: ext === 'pdf' ? 'application/pdf' : 'application/octet-stream',
    });
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (error) {
    void errorLoggingService.captureException(error, {
      category: 'upload',
      operation: 'upload-to-firebase-storage',
      severity: 'warn',
      handled: true,
      source: 'storage.service',
      metadata: {
        bucket,
        userId,
        fileName,
        firebaseStorageConfigured: !!storage,
      },
    });
    return null;
  }
}

class StorageService {

  async uploadResume(userId: string, fileUri: string, metadata?: UploadFileMetadata): Promise<UploadedFile> {
    const fileName = metadata?.fileName?.trim() || fileUri.split('/').pop() || `resume_${Date.now()}.pdf`;
    const firebaseUrl = await uploadToFirebaseBucket(userId, 'resume', fileUri, fileName);
    const url =
      firebaseUrl ??
      await copyToLocalStorage(
        fileUri,
        fileName,
        buildLocalDocumentSubdirectory('resume', userId)
      );
    const localData: UploadedFile = {
      name: fileName,
      url,
      uploadedAt: new Date().toISOString(),
      mimeType: normalizeMimeType(metadata?.mimeType),
      sizeBytes: normalizeSizeBytes(metadata?.sizeBytes),
    };
    await AsyncStorage.setItem(getResumeStorageKey(userId), JSON.stringify(localData));
    return localData;
  }

  async uploadTranscript(userId: string, fileUri: string, metadata?: UploadFileMetadata): Promise<UploadedFile> {
    const fileName = metadata?.fileName?.trim() || fileUri.split('/').pop() || `transcript_${Date.now()}.pdf`;
    const firebaseUrl = await uploadToFirebaseBucket(userId, 'transcript', fileUri, fileName);
    const url =
      firebaseUrl ??
      await copyToLocalStorage(
        fileUri,
        fileName,
        buildLocalDocumentSubdirectory('transcript', userId)
      );
    const localData: UploadedFile = {
      name: fileName,
      url,
      uploadedAt: new Date().toISOString(),
      mimeType: normalizeMimeType(metadata?.mimeType),
      sizeBytes: normalizeSizeBytes(metadata?.sizeBytes),
    };
    await AsyncStorage.setItem(getTranscriptStorageKey(userId), JSON.stringify(localData));
    return localData;
  }

  async uploadAvatar(userId: string, imageUri: string): Promise<UploadedFile> {
    const ext = imageUri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `avatar_${Date.now()}.${ext}`;
    const persistentUri = await copyToLocalStorage(
      imageUri,
      fileName,
      buildLocalDocumentSubdirectory('avatar', userId)
    );
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date().toISOString(),
      mimeType: null,
      sizeBytes: null,
    };
    await AsyncStorage.setItem(getAvatarStorageKey(userId), JSON.stringify(localData));
    return localData;
  }

  async uploadDocument(userId: string, docType: string, fileUri: string, metadata?: UploadFileMetadata): Promise<UploadedFile> {
    const fileName = metadata?.fileName?.trim() || fileUri.split('/').pop() || `${docType}_${Date.now()}.pdf`;
    const persistentUri = await copyToLocalStorage(
      fileUri,
      fileName,
      buildLocalDocumentSubdirectory('roadmap', userId)
    );
    const localData: UploadedFile = {
      name: fileName,
      url: persistentUri,
      uploadedAt: new Date().toISOString(),
      mimeType: normalizeMimeType(metadata?.mimeType),
      sizeBytes: normalizeSizeBytes(metadata?.sizeBytes),
    };
    await AsyncStorage.setItem(
      getRoadmapDocumentStorageKey(userId, docType),
      JSON.stringify(localData)
    );
    return localData;
  }

  async getDocument(userId: string, docType: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(getRoadmapDocumentStorageKey(userId, docType));
    return data ? normalizeUploadedFile(JSON.parse(data)) : null;
  }

  /**
   * Get user's uploaded resume (from AsyncStorage; URL may be Firebase or local)
   */
  async getResume(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(getResumeStorageKey(userId));
    return data ? normalizeUploadedFile(JSON.parse(data)) : null;
  }

  /**
   * Get user's uploaded transcript (from AsyncStorage; URL may be Firebase or local)
   */
  async getTranscript(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(getTranscriptStorageKey(userId));
    return data ? normalizeUploadedFile(JSON.parse(data)) : null;
  }

  async getAvatar(userId: string): Promise<UploadedFile | null> {
    const data = await AsyncStorage.getItem(getAvatarStorageKey(userId));
    return data ? normalizeUploadedFile(JSON.parse(data)) : null;
  }

  /**
   * Delete uploaded file metadata from AsyncStorage.
   * Firebase Storage files under users/{uid}/ are cleaned by deleteAllUserStorageFiles.
   */
  async deleteFile(userId: string, fileType: 'resume' | 'transcript'): Promise<void> {
    await AsyncStorage.removeItem(
      fileType === 'resume'
        ? getResumeStorageKey(userId)
        : getTranscriptStorageKey(userId)
    );
  }


}

export const storageService = new StorageService();

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Folder, UploadedFile, PlaybackSettings } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial connection test as required by Firebase integration guidelines
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

// Authentication Helpers
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// Firestore Database Sync Operations

export async function saveFolderToFirestore(folder: Folder, userId: string): Promise<void> {
  const path = `folders/${folder.id}`;
  try {
    const payload = {
      id: folder.id,
      ownerId: userId,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      description: folder.description || '',
      createdAt: new Date(folder.createdAt || Date.now()).toISOString(),
    };
    await setDoc(doc(db, 'folders', folder.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFolderFromFirestore(folderId: string): Promise<void> {
  const path = `folders/${folderId}`;
  try {
    await deleteDoc(doc(db, 'folders', folderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveFileToFirestore(file: UploadedFile, userId: string): Promise<void> {
  const path = `files/${file.id}`;
  try {
    const payload: Record<string, any> = {
      id: file.id,
      ownerId: userId,
      name: file.name,
      type: file.type || 'text',
      size: typeof file.size === 'number' ? file.size : 0,
      content: file.content || '',
      createdAt: new Date(file.createdAt || Date.now()).toISOString(),
    };
    if (file.folderId) {
      payload.folderId = file.folderId;
    }
    if (Array.isArray(file.tags)) {
      payload.tags = file.tags;
    }
    if (typeof file.estimatedDuration === 'number') {
      payload.estimatedDuration = file.estimatedDuration;
    }
    await setDoc(doc(db, 'files', file.id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateFileFolderInFirestore(fileId: string, folderId: string | undefined): Promise<void> {
  const path = `files/${fileId}`;
  try {
    const ref = doc(db, 'files', fileId);
    if (folderId) {
      await updateDoc(ref, { folderId });
    } else {
      await updateDoc(ref, { folderId: '' });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFileFromFirestore(fileId: string): Promise<void> {
  const path = `files/${fileId}`;
  try {
    await deleteDoc(doc(db, 'files', fileId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function savePlaybackSettingsToFirestore(
  settings: PlaybackSettings,
  userId: string
): Promise<void> {
  const path = `settings/${userId}`;
  try {
    const payload = {
      id: userId,
      ownerId: userId,
      speed: Number(settings.speed) || 1.0,
      voiceId: settings.voiceId || 'gemini-Kore',
      voiceEngine: settings.voiceEngine || 'gemini',
      voiceName: settings.voiceName || 'Kore (Studio Neural)',
      loopMode: settings.loopMode || 'off',
      autoPlayNext: Boolean(settings.autoPlayNext),
      volume: typeof settings.volume === 'number' ? settings.volume : 1.0,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'settings', userId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

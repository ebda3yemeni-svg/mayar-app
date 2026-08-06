import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export interface UploadTaskResult {
  downloadUrl: string;
  fileName: string;
  fileSize: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export async function compressImage(file: File, maxDimension = 1200, quality = 0.8): Promise<Blob> {
  return new Promise((resolve) => {
    // If file is not image or small enough (< 300KB), don't compress
    if (!file.type.startsWith('image/') || file.size < 300 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export async function uploadMediaFile({
  file,
  folderPath,
  fileName,
  onProgress,
}: {
  file: File | Blob;
  folderPath: string; // e.g. "chat-media/chat123/images" or "users/uid/profile"
  fileName: string;
  onProgress?: (progress: number) => void;
}): Promise<UploadTaskResult> {
  const cleanFileName = `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const fullPath = `${folderPath}/${cleanFileName}`;
  const storageRef = ref(storage, fullPath);

  const rawSize = file.size;
  const fileSizeStr = formatFileSize(rawSize);

  try {
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress?.(progress);
          }
        },
        async (error) => {
          console.warn('Firebase Storage upload warning:', error);
          // Fallback to data URL if Firebase Storage fails
          try {
            const dataUrl = await new Promise<string>((res, rej) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.onerror = rej;
              reader.readAsDataURL(file);
            });
            resolve({
              downloadUrl: dataUrl,
              fileName,
              fileSize: fileSizeStr,
            });
          } catch {
            reject(new Error('تعذر رفع الملف، يُرجى إعادة المحاولة.'));
          }
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            resolve({
              downloadUrl,
              fileName,
              fileSize: fileSizeStr,
            });
          } catch (err) {
            console.warn('Error getting download URL:', err);
            const dataUrl = await new Promise<string>((res) => {
              const reader = new FileReader();
              reader.onload = () => res(reader.result as string);
              reader.readAsDataURL(file);
            });
            resolve({
              downloadUrl: dataUrl,
              fileName,
              fileSize: fileSizeStr,
            });
          }
        }
      );
    });
  } catch (err) {
    console.warn('Upload initialization error, fallback to data URL:', err);
    const dataUrl = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(file);
    });
    return {
      downloadUrl: dataUrl,
      fileName,
      fileSize: fileSizeStr,
    };
  }
}

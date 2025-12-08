declare module 'browser-image-compression' {
  interface Options {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    maxIteration?: number;
    exifOrientation?: number;
    fileType?: string;
    initialQuality?: number;
    alwaysKeepResolution?: boolean;
    onProgress?: (progress: number) => void;
    signal?: AbortSignal;
  }

  export default function imageCompression(
    file: File,
    options?: Options
  ): Promise<File>;
} 
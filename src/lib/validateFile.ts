// Comprehensive file validation utilities
// Provides security checks for file uploads including type, size, and content validation

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  metadata?: {
    mimeType: string;
    size: number;
    extension: string;
  };
}

export interface FileValidationConfig {
  // Maximum file size in bytes (default: 10MB)
  maxSize?: number;
  // Allowed MIME types (if empty, uses allowedExtensions)
  allowedMimeTypes?: string[];
  // Allowed file extensions (e.g., ['.pdf', '.doc', '.docx'])
  allowedExtensions?: string[];
  // Whether to validate file content (default: true)
  validateContent?: boolean;
}

// Common file type configurations
export const fileConfig = {
  // Documents
  documents: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
    ],
    validateContent: true,
  },
  // Images
  images: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ],
    validateContent: true,
  },
  // Audio files
  audio: {
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp4',
    ],
    validateContent: true,
  },
  // General uploads
  general: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif'],
    validateContent: true,
  },
};

// Magic numbers for common file types
const magicNumbers: Record<string, string> = {
  'application/pdf': '25504446',
  'image/jpeg': 'ffd8ffe0',
  'image/png': '89504e47',
  'image/gif': '47494638',
  'application/zip': '504b0304',
  'application/x-zip-compressed': '504b0304',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '504b0304',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '504b0304',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '504b0304',
};

/**
 * Validate a file based on configuration
 */
export async function validateFile(
  file: File,
  config: FileValidationConfig
): Promise<FileValidationResult> {
  const {
    maxSize = fileConfig.documents.maxSize,
    allowedMimeTypes = [],
    allowedExtensions = [],
    validateContent = true,
  } = config;

  // Check file size
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${formatBytes(maxSize)}`,
    };
  }

  // Get file extension
  const extension = getFileExtension(file.name);
  const mimeType = file.type.toLowerCase();

  // Validate MIME type if specified
  if (allowedMimeTypes.length > 0) {
    if (!allowedMimeTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `File type ${mimeType} is not allowed`,
      };
    }
  }

  // Validate extension if MIME types not specified
  if (allowedMimeTypes.length === 0 && allowedExtensions.length > 0) {
    if (!allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension ${extension} is not allowed`,
      };
    }
  }

  // Validate file content (magic numbers) for security
  if (validateContent) {
    const contentValidation = await validateFileContent(file, mimeType);
    if (!contentValidation.valid) {
      return contentValidation;
    }
  }

  // Sanitize filename
  const sanitizedFilename = sanitizeFilename(file.name);

  return {
    valid: true,
    metadata: {
      mimeType,
      size: file.size,
      extension,
    },
  };
}

/**
 * Validate file content using magic numbers
 */
async function validateFileContent(
  file: File,
  expectedMimeType: string
): Promise<FileValidationResult> {
  try {
    const arrayBuffer = await file.slice(0, 8).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const hexSignature = Array.from(uint8Array)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Check if the magic number matches the expected type
    const expectedMagicNumber = magicNumbers[expectedMimeType];
    if (expectedMagicNumber && !hexSignature.startsWith(expectedMagicNumber)) {
      return {
        valid: false,
        error: `File content does not match its declared type (${expectedMimeType})`,
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Failed to validate file content',
    };
  }
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? `.${parts.pop()}` : '';
}

/**
 * Sanitize filename to prevent directory traversal and other attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove any path components
  const sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove null bytes and control characters
  const cleanName = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Remove any characters that are problematic in filenames
  const safeName = cleanName.replace(/[<>:"|?*\x00-\x1f]/g, '_');
  
  // Limit filename length
  const maxLength = 255;
  if (safeName.length > maxLength) {
    const ext = getFileExtension(safeName);
    const baseName = safeName.slice(0, maxLength - ext.length);
    return baseName + ext;
  }
  
  return safeName;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate image dimensions (optional)
 */
export async function validateImageDimensions(
  file: File,
  maxWidth?: number,
  maxHeight?: number
): Promise<FileValidationResult> {
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: 'File is not an image',
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      if (maxWidth && img.width > maxWidth) {
        resolve({
          valid: false,
          error: `Image width ${img.width}px exceeds maximum ${maxWidth}px`,
        });
        return;
      }

      if (maxHeight && img.height > maxHeight) {
        resolve({
          valid: false,
          error: `Image height ${img.height}px exceeds maximum ${maxHeight}px`,
        });
        return;
      }

      resolve({ valid: true });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({
        valid: false,
        error: 'Failed to load image for dimension validation',
      });
    };

    img.src = url;
  });
}

/**
 * Check if file is potentially dangerous (executable, script, etc.)
 */
export function isDangerousFile(filename: string): boolean {
  const dangerousExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.com',
    '.scr',
    '.pif',
    '.vbs',
    '.js',
    '.jar',
    '.app',
    '.deb',
    '.rpm',
    '.dmg',
    '.pkg',
    '.sh',
    '.php',
    '.asp',
    '.aspx',
    '.jsp',
    '.py',
    '.rb',
    '.pl',
    '.cgi',
  ];

  const extension = getFileExtension(filename);
  return dangerousExtensions.includes(extension);
}

/**
 * Create a safe filename with UUID prefix
 */
export function createSafeFilename(originalFilename: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  const extension = getFileExtension(sanitized);
  const baseName = sanitized.replace(extension, '');
  const uuid = crypto.randomUUID().slice(0, 8);
  return `${baseName}-${uuid}${extension}`;
}

/**
 * Generate a unique storage path for files
 */
export function generateStoragePath(
  churchId: string,
  fileType: string,
  filename: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const safeFilename = createSafeFilename(filename);
  
  return `${churchId}/${fileType}/${year}/${month}/${safeFilename}`;
}
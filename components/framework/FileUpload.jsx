'use client';

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Upload, X, File, Image, Video, FileText, Music, Download, Eye, Trash2, Camera, ImagePlus } from 'lucide-react';
import { useMobile } from '../../core/services/mobile';

/**
 * FileUpload Component - Modern file upload with best UX practices
 *
 * Features:
 * - Drag & drop with visual feedback
 * - File type validation and preview
 * - Progress tracking with real-time updates
 * - Batch upload support
 * - Accessibility compliant
 * - Integration with JasonJS app object
 * - Automatic S3 upload via pre-signed URLs
 *
 * Props:
 * @param {Array|Object} value - Current file URLs/objects (array for multiple, single object for single)
 * @param {Function} onChange - Callback for value changes (returns array if multiple=true, single object if multiple=false)
 * @param {boolean} multiple - Allow multiple files (controls return format)
 * @param {Array} accept - Allowed file types (MIME types)
 * @param {number} maxSize - Max file size in bytes
 * @param {number} maxFiles - Max number of files
 * @param {boolean} disabled - Disable upload
 * @param {Object} jcontext - JasonJS context with app object
 */
export default function FileUpload({
  value = [],
  onChange,
  multiple = true,
  accept = ['image/*', 'video/*', 'audio/*', 'application/pdf'],
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 10,
  disabled = false,
  placeholder = "Drag files here or click to select",
  showPreviews = true,
  className = '',
  jcontext = {},
  variant = 'default', // 'default' | 'avatar' | 'square' - picker style
  size = 'lg' // 'sm' | 'md' | 'lg' | 'xl' - size for avatar/square variants
}) {
  // Normalize accept to always be an array (memoized to prevent re-renders)
  const normalizedAccept = useMemo(() => 
    Array.isArray(accept) ? accept : (accept ? [accept] : ['image/*', 'video/*', 'audio/*', 'application/pdf']),
    [accept]
  );
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(new Map());
  const [errors, setErrors] = useState([]);
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  // Helper to normalize a single malformed file object
  const normalizeSingleFile = (val) => {
    if (!val || typeof val !== 'object') return val;
    // If it's a valid file object, return as-is
    if (val.url) return val;
    return null;
  };

  // Helper to extract all files from a malformed structure like {"0": {...}, "1": {...}, id: null}
  // This handles the case where an array was spread into an object
  const extractFilesFromMalformed = (val) => {
    if (!val || typeof val !== 'object' || Array.isArray(val)) return null;

    // Check if this looks like a spread array (has numeric keys starting from "0")
    if (!('0' in val) || typeof val['0'] !== 'object') return null;

    const files = [];
    let i = 0;
    while (val[String(i)] !== undefined) {
      const file = val[String(i)];
      if (file && typeof file === 'object' && file.url) {
        files.push(file);
      }
      i++;
    }
    return files.length > 0 ? files : null;
  };

  // Ensure value is always an array (memoized to prevent re-renders)
  const files = useMemo(() => {
    if (!value) return [];

    // If it's already an array, normalize each item
    if (Array.isArray(value)) {
      return value.map(item => normalizeSingleFile(item)).filter(Boolean);
    }

    // Check if it's a malformed spread array like {"0": {...}, "1": {...}}
    const extractedFiles = extractFilesFromMalformed(value);
    if (extractedFiles) {
      return extractedFiles;
    }

    // Single file object with url
    if (typeof value === 'object' && value.url) {
      return [value];
    }

    // String URL
    if (typeof value === 'string') {
      return [{ url: value, name: 'File', type: 'unknown' }];
    }

    return [];
  }, [value]);

  // Get app object from jcontext
  const app = jcontext?.app;

  // Native mobile bridge
  const { isNative: isNativeMobile, camera: nativeCamera } = useMobile();
  const [showNativePicker, setShowNativePicker] = useState(false);

  // Convert base64 string to File object
  const base64ToFile = (base64, fileName, mimeType) => {
    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], fileName, { type: mimeType });
  };

  // Handle native camera capture
  const handleNativeCamera = async () => {
    setShowNativePicker(false);
    try {
      const permission = await nativeCamera.requestPermission();
      if (!permission.camera) {
        setErrors(['Camera permission denied. Please allow camera access in your device settings.']);
        return;
      }
      const result = await nativeCamera.takePhoto({ quality: 0.8, base64: true, allowsEditing: true });
      if (result.canceled) return;
      const fileName = result.fileName || `photo_${Date.now()}.jpg`;
      const mimeType = result.type || 'image/jpeg';
      const file = base64ToFile(result.base64, fileName, mimeType);
      handleFiles([file]);
    } catch (error) {
      setErrors([error.message || 'Failed to take photo']);
    }
  };

  // Handle native gallery pick
  const handleNativeGallery = async () => {
    setShowNativePicker(false);
    try {
      const permission = await nativeCamera.requestPermission();
      if (!permission.mediaLibrary) {
        setErrors(['Gallery permission denied. Please allow photo library access in your device settings.']);
        return;
      }

      const acceptsVideo = normalizedAccept.some(t => t.startsWith('video/'));
      const acceptsImage = normalizedAccept.some(t => t.startsWith('image/'));

      // Video-only accept types
      if (acceptsVideo && !acceptsImage) {
        const result = await nativeCamera.pickVideo();
        if (result.canceled) return;
        const response = await fetch(result.uri);
        const blob = await response.blob();
        const fileName = result.fileName || `video_${Date.now()}.mp4`;
        const file = new File([blob], fileName, { type: result.type || 'video/mp4' });
        handleFiles([file]);
        return;
      }

      // Image (or image+video) — use pickImage
      const limit = multiple ? maxFiles - files.length : 1;
      const result = await nativeCamera.pickImage({
        quality: 0.8,
        base64: true,
        multiple: multiple && limit > 1,
        limit
      });
      if (result.canceled) return;

      const assets = Array.isArray(result.assets) ? result.assets : [result.assets];
      const fileObjects = assets.filter(Boolean).map((asset) => {
        const fileName = asset.fileName || `image_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
        const mimeType = asset.type || 'image/jpeg';
        return base64ToFile(asset.base64, fileName, mimeType);
      });

      if (fileObjects.length > 0) {
        handleFiles(fileObjects);
      }
    } catch (error) {
      setErrors([error.message || 'Failed to pick from gallery']);
    }
  };

  // Prevent browser from opening files when dropped outside dropzone
  useEffect(() => {
    const preventDragOver = (e) => {
      e.preventDefault();
    };
    const preventDrop = (e) => {
      // Only prevent default if drop is outside our dropzone
      if (!dropRef.current?.contains(e.target)) {
        e.preventDefault();
      }
    };

    window.addEventListener('dragover', preventDragOver);
    window.addEventListener('drop', preventDrop);

    return () => {
      window.removeEventListener('dragover', preventDragOver);
      window.removeEventListener('drop', preventDrop);
    };
  }, []);

  // Size configurations for avatar/square variants
  const sizeConfig = {
    sm: { container: 'w-16 h-16', icon: 'w-6 h-6', text: 'text-xs' },
    md: { container: 'w-24 h-24', icon: 'w-8 h-8', text: 'text-sm' },
    lg: { container: 'w-32 h-32', icon: 'w-10 h-10', text: 'text-sm' },
    xl: { container: 'w-40 h-40', icon: 'w-12 h-12', text: 'text-base' }
  };
  const currentSize = sizeConfig[size] || sizeConfig.lg;

  // Check if we're using a compact variant (avatar or square)
  const isCompactVariant = variant === 'avatar' || variant === 'square';

  // File type icons mapping
  const getFileIcon = (mimeType) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType === 'application/pdf') return FileText;
    return File;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    // Handle undefined, null, or invalid values
    if (bytes === undefined || bytes === null || isNaN(bytes)) {
      return '10 MB'; // Default fallback
    }
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validate file
  const validateFile = (file) => {
    const errors = [];

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}`);
    }

    // Check file type
    const isValidType = normalizedAccept.some(type => {
      if (type.endsWith('/*')) {
        return file.type.startsWith(type.slice(0, -1));
      }
      return file.type === type;
    });

    if (!isValidType) {
      errors.push(`File "${file.name}" has an unsupported format. Allowed: ${normalizedAccept.join(', ')}`);
    }

    // Check total file count
    if (!multiple && files.length >= 1) {
      errors.push('Only one file is allowed');
    } else if (multiple && files.length >= maxFiles) {
      errors.push(`Maximum ${maxFiles} files allowed`);
    }

    return errors;
  };

  // Upload single file through server
  const uploadToS3 = async (file) => {
    try {
      // Create FormData to send file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      formData.append('fileType', file.type);
      formData.append('path', 'uploads');

      // Upload file through our server API
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData, // Send FormData with file
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error('[FileUpload] Upload failed with error:', error);
        throw new Error(error.error || `Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Validate response structure
      if (!result.data || !result.data.publicUrl) {
        throw new Error('Invalid upload response: missing publicUrl');
      }

      // Return file metadata
      const fileMetadata = {
        id: result.data.key,
        name: file.name,
        size: file.size,
        type: file.type,
        url: result.data.publicUrl,
        key: result.data.key,
        uploadedAt: new Date().toISOString()
      };

      return fileMetadata;

    } catch (error) {
      throw error;
    }
  };

  // Handle file upload with progress tracking
  const handleFiles = useCallback(async (selectedFiles) => {
    if (disabled) return;

    const fileList = Array.from(selectedFiles);
    const validFiles = [];
    const newErrors = [];

    // Validate each file
    fileList.forEach(file => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        newErrors.push(...fileErrors);
      } else {
        validFiles.push(file);
      }
    });

    // Update errors
    setErrors(newErrors);

    if (validFiles.length === 0) return;

    // Create upload tracking with unique keys to avoid conflicts
    const uploadMap = new Map();
    validFiles.forEach(file => {
      const uniqueKey = `${file.name}-${Date.now()}-${Math.random()}`;
      uploadMap.set(uniqueKey, {
        progress: 0,
        status: 'uploading',
        fileName: file.name,
        file
      });
    });
    setUploadingFiles(prev => new Map([...prev, ...uploadMap]));

    try {
      // Upload files with progress tracking
      const uploadKeys = Array.from(uploadMap.keys());
      const uploadResults = await Promise.allSettled(
        uploadKeys.map(async (uniqueKey) => {
          const uploadData = uploadMap.get(uniqueKey);
          const file = uploadData.file;

          try {
            // Simulate progress updates
            const progressInterval = setInterval(() => {
              setUploadingFiles(prev => {
                const updated = new Map(prev);
                const current = updated.get(uniqueKey);
                if (current && current.progress < 90) {
                  updated.set(uniqueKey, {
                    ...current,
                    progress: current.progress + Math.random() * 30
                  });
                }
                return updated;
              });
            }, 200);

            const result = await uploadToS3(file);

            clearInterval(progressInterval);

            // Set completion
            setUploadingFiles(prev => {
              const updated = new Map(prev);
              updated.set(uniqueKey, {
                ...updated.get(uniqueKey),
                progress: 100,
                status: 'completed'
              });
              return updated;
            });

            return result;
          } catch (error) {
            setUploadingFiles(prev => {
              const updated = new Map(prev);
              updated.set(uniqueKey, {
                ...updated.get(uniqueKey),
                progress: 0,
                status: 'error',
                error: error.message
              });
              return updated;
            });
            throw error;
          }
        })
      );

      // Process successful uploads
      const successfulUploads = uploadResults
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

      if (successfulUploads.length > 0) {
        let newFiles;

        console.log('[FileUpload] Upload complete:', {
          multiple,
          existingFiles: files,
          successfulUploads,
        });

        if (multiple) {
          // Multiple files: always return array
          newFiles = [...files, ...successfulUploads];
        } else {
          // Single file: return just the file object (not array)
          newFiles = successfulUploads[0];
        }

        console.log('[FileUpload] Calling onChange with:', newFiles);
        onChange?.(newFiles);
      }

      // Handle errors
      const failedUploads = uploadResults
        .filter(result => result.status === 'rejected')
        .map(result => result.reason.message);

      if (failedUploads.length > 0) {
        setErrors(prev => [...prev, ...failedUploads]);
      }

    } catch (error) {
      setErrors(prev => [...prev, 'Upload failed. Please try again.']);
    }

    // Clear only completed uploads after delay
    setTimeout(() => {
      setUploadingFiles(prev => {
        const updated = new Map(prev);
        Array.from(updated.entries()).forEach(([key, value]) => {
          if (value.status === 'completed') {
            updated.delete(key);
          }
        });
        return updated;
      });
    }, 3000);

  }, [files, onChange, multiple, disabled, maxSize, maxFiles, normalizedAccept]);

  // Check if any uploads are in progress
  const hasActiveUploads = Array.from(uploadingFiles.values()).some(
    upload => upload.status === 'uploading'
  );

  // Drag and drop handlers with better event handling
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || hasActiveUploads) return;
    setIsDragActive(true);
  }, [disabled, hasActiveUploads]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    // Only set inactive if leaving the drop zone entirely
    if (!dropRef.current?.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  }, [disabled]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Set dataTransfer.dropEffect to indicate we'll accept the drop
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || hasActiveUploads) return;

    setIsDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles, disabled, hasActiveUploads]);

  // File input handler
  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  // Remove file
  const removeFile = (fileToRemove) => {
    const newFiles = files.filter(file =>
      file.id !== fileToRemove.id && file.url !== fileToRemove.url
    );

    if (multiple) {
      // Multiple files: return array
      onChange?.(newFiles);
    } else {
      // Single file: return null if no files, or the single file object
      onChange?.(newFiles.length > 0 ? newFiles[0] : null);
    }
  };

  // Open file selector
  const openFileSelector = () => {
    if (!disabled) {
      if (isNativeMobile) {
        setShowNativePicker(true);
      } else {
        fileInputRef.current?.click();
      }
    }
  };

  // Preview component for files
  const FilePreview = ({ file }) => {
    const IconComponent = getFileIcon(file.type);
    const isImage = file.type?.startsWith('image/');
    const isVideo = file.type?.startsWith('video/');

    return (
      <div className="relative group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
        {/* Preview area */}
        <div className="flex items-center space-x-3">
          {/* File icon or media preview */}
          <div className="flex-shrink-0">
            {isImage ? (
              <img
                src={file.url}
                alt={file.name}
                className="w-12 h-12 object-cover rounded-md"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : isVideo ? (
              <div className="w-12 h-12 bg-black rounded-md overflow-hidden relative">
                <video
                  src={file.url}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                  <Video className="w-5 h-5 text-white" />
                </div>
              </div>
            ) : null}
            <div className={`w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center ${isImage || isVideo ? 'hidden' : ''}`}>
              <IconComponent className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </div>
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={file.name}>
              {file.name}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatFileSize(file.size)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-1">
            {file.url && (
              <button
                type="button"
                onClick={() => window.open(file.url, '_blank')}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title={isVideo ? "Play video" : "Preview file"}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => removeFile(file)}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Upload progress component
  const UploadProgress = ({ fileName, progress, status, error }) => (
    <div className="bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-lg p-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate min-w-0">{fileName}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
          {status === 'error' ? 'Failed' : `${Math.round(progress)}%`}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${
            status === 'error' ? 'bg-red-500' : 'bg-current opacity-60'
          }`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
      )}
    </div>
  );

  // Get the first file for compact variants (avatar/square show single image)
  const currentFile = files.length > 0 ? files[0] : null;
  const hasImage = currentFile && currentFile.type?.startsWith('image/');

  return (
    <div className={`file-upload ${className}`}>
      {/* Hidden file input - always rendered */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={normalizedAccept.join(',')}
        onChange={handleFileInput}
        disabled={disabled}
        className="hidden"
        aria-hidden="true"
      />

      {/* Compact variant: Avatar (rounded) or Square */}
      {isCompactVariant ? (
        <div className="flex flex-col items-center gap-3">
          <div
            ref={dropRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={openFileSelector}
            className={`
              relative ${currentSize.container} cursor-pointer
              transition-all duration-200 ease-in-out overflow-hidden
              ${variant === 'avatar' ? 'rounded-full' : 'rounded-xl'}
              ${isDragActive
                ? 'ring-4 ring-blue-400 ring-offset-2 dark:ring-offset-gray-900'
                : disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:ring-4 hover:ring-gray-300 dark:hover:ring-gray-600 hover:ring-offset-2 dark:hover:ring-offset-gray-900'
              }
              ${hasImage ? '' : 'border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800'}
            `}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label="Upload image"
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
                e.preventDefault();
                openFileSelector();
              }
            }}
          >
            {/* Show uploaded image or placeholder */}
            {hasImage ? (
              <>
                <img
                  src={currentFile.url}
                  alt={currentFile.name || 'Uploaded image'}
                  className="w-full h-full object-cover"
                />
                {/* Overlay on hover */}
                <div className={`
                  absolute inset-0 bg-black/50 opacity-0 hover:opacity-100
                  transition-opacity duration-200 flex items-center justify-center
                  ${variant === 'avatar' ? 'rounded-full' : 'rounded-xl'}
                `}>
                  <Upload className={`${currentSize.icon} text-white`} />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                <Upload className={currentSize.icon} />
                {size !== 'sm' && (
                  <span className={`${currentSize.text} mt-1`}>Upload</span>
                )}
              </div>
            )}

            {/* Drag overlay */}
            {isDragActive && (
              <div className={`
                absolute inset-0 bg-blue-500/70 flex items-center justify-center
                ${variant === 'avatar' ? 'rounded-full' : 'rounded-xl'}
              `}>
                <Upload className={`${currentSize.icon} text-white`} />
              </div>
            )}
          </div>

          {/* Remove button for compact variants */}
          {hasImage && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeFile(currentFile);
              }}
              className="text-sm text-red-500 hover:text-red-700 transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Remove
            </button>
          )}
        </div>
      ) : !multiple && files.length > 0 ? (
        /* Single file mode: inline preview replaces dropzone */
        (() => {
          const singleFile = files[0];
          const isImg = singleFile.type?.startsWith('image/');
          const isVid = singleFile.type?.startsWith('video/');
          const IconComponent = getFileIcon(singleFile.type || 'unknown');

          return (
            <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Preview area */}
              {isImg ? (
                <div
                  ref={dropRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={openFileSelector}
                  className="relative cursor-pointer group"
                >
                  <img
                    src={singleFile.url}
                    alt={singleFile.name || 'Uploaded file'}
                    className="w-full max-h-64 object-cover"
                  />
                  {/* Hover overlay to replace */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="text-white text-sm font-medium flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Replace
                    </div>
                  </div>
                  {/* Drag overlay */}
                  {isDragActive && (
                    <div className="absolute inset-0 bg-blue-500/60 flex items-center justify-center">
                      <div className="text-white font-medium">Drop to replace</div>
                    </div>
                  )}
                </div>
              ) : isVid ? (
                <div
                  ref={dropRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={openFileSelector}
                  className="relative cursor-pointer group"
                >
                  <video
                    src={singleFile.url}
                    className="w-full max-h-64 object-cover bg-black"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video className="w-10 h-10 text-white/80" />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="text-white text-sm font-medium flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Replace
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  ref={dropRef}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={openFileSelector}
                  className="relative cursor-pointer group flex items-center gap-3 p-4"
                >
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center flex-shrink-0">
                    <IconComponent className="w-6 h-6 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{singleFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(singleFile.size)}</p>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 transition-colors">
                    <Upload className="w-4 h-4" />
                  </div>
                </div>
              )}

              {/* Remove button */}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(singleFile);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })()
      ) : (
        /* Default variant: Full dropzone */
        <div
          ref={dropRef}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={openFileSelector}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
            transition-all duration-200 ease-in-out
            ${isDragActive
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
              : disabled || hasActiveUploads
              ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed opacity-60'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
            }
          `}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label="File upload area"
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              openFileSelector();
            }
          }}
        >
          {/* Upload icon and text */}
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 flex items-center justify-center">
              <Upload
                className={`w-8 h-8 ${
                  isDragActive ? 'text-blue-600 dark:text-blue-400' : disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-500 dark:text-gray-400'
                }`}
              />
            </div>

            <div>
              <p className={`text-lg font-medium ${
                disabled ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-200'
              }`}>
                {isDragActive ? 'Drop files here' : placeholder}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {multiple ? `Up to ${maxFiles} files` : 'Single file'} • Max {formatFileSize(maxSize)} each
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Supported: {normalizedAccept.join(', ')}
              </p>
            </div>
          </div>

          {/* Drag overlay */}
          {isDragActive && (
            <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/50 bg-opacity-50 rounded-lg flex items-center justify-center">
              <div className="text-blue-600 dark:text-blue-300 font-medium">Drop files to upload</div>
            </div>
          )}
        </div>
      )}

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="mt-4 space-y-2">
          {errors.map((error, index) => (
            <div key={index} className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploadingFiles.size > 0 && (
        <div className="mt-4 space-y-2">
          {Array.from(uploadingFiles.entries()).map(([uniqueKey, upload]) => (
            <UploadProgress
              key={uniqueKey}
              fileName={upload.fileName}
              progress={upload.progress}
              status={upload.status}
              error={upload.error}
            />
          ))}
        </div>
      )}

      {/* File previews - only show for default variant with multiple files (single file shows inline preview) */}
      {showPreviews && files.length > 0 && !isCompactVariant && multiple && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Uploaded files ({files.length})
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {files.map((file, index) => (
              <FilePreview key={file.id || file.url || index} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Native mobile picker action sheet */}
      {showNativePicker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setShowNativePicker(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Sheet */}
          <div
            className="relative w-full max-w-md mx-4 mb-4 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleNativeCamera}
              className="w-full flex items-center gap-3 px-6 py-4 text-left text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <Camera className="w-5 h-5 text-blue-500" />
              <span className="text-base font-medium">Take Photo</span>
            </button>
            <button
              type="button"
              onClick={handleNativeGallery}
              className="w-full flex items-center gap-3 px-6 py-4 text-left text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <ImagePlus className="w-5 h-5 text-green-500" />
              <span className="text-base font-medium">Choose from Gallery</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNativePicker(false)}
              className="w-full px-6 py-4 text-center text-red-500 dark:text-red-400 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

FileUpload.displayName = 'FileUpload';
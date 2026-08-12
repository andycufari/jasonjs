"use client";

import React, { useState, useEffect, useRef } from 'react';

/**
 * QRScanner Component
 *
 * A reusable QR code scanner component that uses the Barcode Detection API
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Controls modal visibility
 * @param {Function} props.onClose - Called when modal is closed
 * @param {Function} props.onScan - Called with scanned value (string)
 * @param {string} props.title - Modal title (default: "Escanear Código QR")
 * @param {string} props.successMessage - Success message template (default: "¡Código QR detectado!")
 * @param {number} props.autoCloseDelay - Delay before auto-closing on success in ms (default: 1500)
 */
export default function QRScanner({
  isOpen = false,
  onClose,
  onScan,
  title = "Escanear Código QR",
  successMessage = "¡Código QR detectado!",
  autoCloseDelay = 1500
}) {
  const [scannerError, setScannerError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [lastDetectedValue, setLastDetectedValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectionLoopRef = useRef(null);

  // Cleanup stream on unmount or when modal closes
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  // Start/stop scanning based on isOpen
  useEffect(() => {
    if (isOpen) {
      setIsScanning(true);
      startScanning();
    } else {
      stopScanning();
      setIsScanning(false);
      setScannerError(null);
      setLastDetectedValue('');
    }
  }, [isOpen]);

  const getCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);

      // Default to back camera on mobile/tablets
      const backCamera = videoDevices.find(device =>
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('trasera') ||
        device.label.toLowerCase().includes('environment')
      );
      setSelectedCamera(backCamera || videoDevices[0]);
    } catch (error) {
      console.error('Error getting cameras:', error);
      setScannerError({
        type: 'error',
        message: 'No se pudo acceder a las cámaras del dispositivo'
      });
    }
  };

  const startScanning = async () => {
    try {
      setScannerError(null);

      // Check if mediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara. Por favor usa Chrome, Edge o Safari.');
      }

      if (cameras.length === 0) {
        await getCameras();
      }

      let stream = null;
      let lastError = null;

      // Try multiple constraint levels, from most to least specific
      const constraintLevels = [
        // Level 1: Ideal constraints with specific camera
        selectedCamera?.deviceId ? {
          video: {
            deviceId: { exact: selectedCamera.deviceId },
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            aspectRatio: { ideal: 1.777777778 },
            focusMode: { ideal: 'continuous' },
            frameRate: { ideal: 30 }
          }
        } : null,
        // Level 2: Try environment facing camera
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Level 3: Basic constraints with any camera
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        // Level 4: Absolute fallback - just video
        {
          video: true
        }
      ].filter(Boolean);

      // Try each constraint level until one works
      for (const constraints of constraintLevels) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('Camera started with constraints:', constraints);
          break;
        } catch (error) {
          console.warn('Failed with constraints:', constraints, error);
          lastError = error;
          continue;
        }
      }

      if (!stream) {
        // Provide specific error messages based on the error type
        if (lastError) {
          if (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError') {
            throw new Error('Permiso de cámara denegado. Por favor permite el acceso a la cámara en la configuración de tu navegador.');
          } else if (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError') {
            throw new Error('No se encontró ninguna cámara en tu dispositivo.');
          } else if (lastError.name === 'NotReadableError' || lastError.name === 'TrackStartError') {
            throw new Error('La cámara está siendo usada por otra aplicación. Por favor cierra otras apps que usen la cámara.');
          } else if (lastError.name === 'OverconstrainedError' || lastError.name === 'ConstraintNotSatisfiedError') {
            throw new Error('Las especificaciones de la cámara no pudieron ser satisfechas. Intenta con otra cámara.');
          } else {
            throw new Error(`Error al acceder a la cámara: ${lastError.message || 'Desconocido'}`);
          }
        }
        throw new Error('No se pudo acceder a ninguna cámara');
      }

      streamRef.current = stream;

      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play();

        // Set video element size based on stream track settings
        const track = streamRef.current.getVideoTracks()[0];
        const settings = track.getSettings();
        console.log('Camera settings:', settings);

        // Adjust video element sizing if needed
        if (settings.width && settings.height) {
          videoRef.current.style.width = '100%';
          videoRef.current.style.height = '100%';
        }
      }

      // Try native Barcode Detection API first, fallback to jsQR
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new window.BarcodeDetector({
          formats: ['qr_code'] // Only QR codes
        });

        const detectCodes = async () => {
          if (!isScanning || !videoRef.current) {
            return;
          }

          try {
            const codes = await barcodeDetector.detect(videoRef.current);
            if (codes.length > 0) {
              console.log('QR detected:', codes[0]);
              const detectedValue = codes[0].rawValue.trim();

              setLastDetectedValue(detectedValue);
              setScannerError({ type: 'success', message: successMessage });

              if (onScan) {
                onScan(detectedValue);
              }

              if (autoCloseDelay > 0) {
                setTimeout(() => handleClose(), autoCloseDelay);
              }

              return;
            }
          } catch (error) {
            console.error('Detection error:', error);
          }

          detectionLoopRef.current = requestAnimationFrame(detectCodes);
        };

        detectCodes();
      } else {
        // Fallback: Use jsQR library
        console.log('BarcodeDetector not available, using jsQR fallback');

        const loadJsQR = () => {
          return new Promise((resolve, reject) => {
            if (window.jsQR) {
              resolve();
              return;
            }

            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };

        loadJsQR()
          .then(() => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const detectCodesJsQR = () => {
              if (!isScanning || !videoRef.current) {
                return;
              }

              if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;

                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
                  inversionAttempts: 'dontInvert',
                });

                if (code) {
                  console.log('QR detected with jsQR:', code);
                  const detectedValue = code.data.trim();

                  setLastDetectedValue(detectedValue);
                  setScannerError({ type: 'success', message: successMessage });

                  if (onScan) {
                    onScan(detectedValue);
                  }

                  if (autoCloseDelay > 0) {
                    setTimeout(() => handleClose(), autoCloseDelay);
                  }

                  return;
                }
              }

              detectionLoopRef.current = requestAnimationFrame(detectCodesJsQR);
            };

            detectCodesJsQR();
          })
          .catch(() => {
            setScannerError({
              type: 'error',
              message: 'No se pudo cargar el escáner QR. Verifica tu conexión a internet.'
            });
          });
      }

    } catch (error) {
      console.error('Error starting scanner:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      setScannerError({
        type: 'error',
        message: error.message || 'No se pudo iniciar la cámara'
      });
    }
  };

  const stopScanning = () => {
    // Cancel detection loop
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current);
      detectionLoopRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;

    const currentIndex = cameras.findIndex(cam => cam.deviceId === selectedCamera?.deviceId);
    const nextCamera = cameras[(currentIndex + 1) % cameras.length];
    setSelectedCamera(nextCamera);

    if (isScanning) {
      stopScanning();
      setTimeout(() => startScanning(), 100); // Restart scanner with new camera
    }
  };

  const handleClose = () => {
    stopScanning();
    setScannerError(null);
    setLastDetectedValue('');
    if (onClose) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl m-4 max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h3 className="text-xl font-semibold text-foreground">
            {title}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto">
          <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover bg-black rounded-lg"
            />
            <div className="absolute inset-0">
              <div className="absolute inset-[15%] border-2 border-white/50 rounded-lg">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-sm bg-black/50 px-3 py-1.5 rounded-full whitespace-nowrap">
                    Centre el código QR aquí
                  </span>
                </div>
                {/* Frame corners */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary"></div>
              </div>
            </div>
          </div>

          {scannerError && (
            <div className={`mt-4 p-4 rounded-lg border-l-4 ${
              scannerError.type === 'success'
                ? 'bg-success/10 border-success text-success'
                : 'bg-destructive/10 border-destructive text-destructive'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {scannerError.type === 'success' ? '✅' : '⚠️'}
                </span>
                <div className="flex-1">
                  <p className="text-lg font-medium">
                    {scannerError.type === 'success' && lastDetectedValue
                      ? `${scannerError.message}: ${lastDetectedValue}`
                      : scannerError.message
                    }
                  </p>
                  {scannerError.type === 'error' && scannerError.message.includes('Permiso de cámara denegado') && (
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="font-semibold">Para activar la cámara:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Haz clic en el icono 🔒 junto a la URL</li>
                        <li>Selecciona "Cámara"</li>
                        <li>Cambia a "Permitir"</li>
                        <li>Haz clic en "Reintentar" abajo</li>
                      </ol>
                      <button
                        onClick={() => {
                          setScannerError(null);
                          startScanning();
                        }}
                        className="mt-3 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
                        type="button"
                      >
                        🔄 Reintentar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-between">
            {cameras.length > 1 && (
              <button
                onClick={switchCamera}
                className="px-4 py-2 text-lg font-medium rounded-lg bg-secondary text-white hover:bg-secondary/90 transition-colors"
                type="button"
              >
                Cambiar cámara 🔄
              </button>
            )}
            <button
              onClick={handleClose}
              className="px-4 py-2 text-lg font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 ml-auto transition-colors"
              type="button"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

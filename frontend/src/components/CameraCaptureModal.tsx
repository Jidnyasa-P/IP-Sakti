import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle, Upload, FlipHorizontal } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (photoDataUrl: string) => void;
  onFallbackUpload?: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onFallbackUpload
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Start the camera stream
  const startCamera = async (mode: 'user' | 'environment') => {
    setIsLoading(true);
    setErrorMessage(null);
    setCapturedImage(null);

    // Stop any existing stream before starting a new one
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Camera access is not supported by your browser in this environment.');
      setIsLoading(false);
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      console.error('Camera access error:', err);
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission was denied. Please allow camera permissions in your browser settings to take a photo.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setErrorMessage('No camera device was detected on your system.');
      } else {
        setErrorMessage('Unable to access the camera: ' + (error.message || 'Unknown error.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Start camera when modal opens, stop when it closes
  useEffect(() => {
    if (isOpen) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Flip camera between front (user) and rear (environment)
  const handleToggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture frame from video to canvas
  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    // Crop to square avatar aspect ratio
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    canvas.width = 400;
    canvas.height = 400;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If front camera, mirror horizontally for natural selfie orientation
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, startX, startY, size, size, 0, 0, 400, 400);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Confirm photo
  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setErrorMessage(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {capturedImage ? 'Review Captured Photo' : 'Take Profile Photo'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {capturedImage ? 'Confirm or retake your new avatar' : 'Position your face within the frame'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Close camera"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Camera View / Captured Preview */}
        <div className="p-5 flex flex-col items-center">
          {errorMessage ? (
            <div className="w-full py-8 px-4 rounded-xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-900">Camera Unavailable</p>
                <p className="text-xs text-rose-700 max-w-xs mx-auto leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => startCamera(facingMode)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                {onFallbackUpload && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onFallbackUpload();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>Upload from Device</span>
                  </button>
                )}
              </div>
            </div>
          ) : capturedImage ? (
            /* Review Captured Photo */
            <div className="space-y-4 flex flex-col items-center">
              <div className="w-56 h-56 rounded-full overflow-hidden border-4 border-emerald-500 shadow-md bg-slate-900">
                <img
                  src={capturedImage}
                  alt="Captured Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Photo ready to apply
              </span>
            </div>
          ) : (
            /* Active Camera Viewfinder */
            <div className="space-y-3 flex flex-col items-center w-full">
              <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-slate-900 shadow-md bg-slate-900 flex items-center justify-center">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-white gap-2 z-10">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span className="text-xs text-slate-300">Starting camera...</span>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? 'scale-x-[-1]' : ''
                  }`}
                />
                {/* Circular Framing Overlay Guideline */}
                <div className="absolute inset-0 rounded-full border-2 border-white/40 pointer-events-none" />
              </div>

              {/* Camera Switch Control */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleCamera}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Flip camera direction"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  <span>Flip Camera</span>
                </button>
              </div>
            </div>
          )}

          {/* Hidden Canvas for Frame Processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {!errorMessage && (
            <div>
              {capturedImage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRetake}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Use This Photo</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  id="snap-photo-btn"
                  onClick={handleSnapPhoto}
                  disabled={isLoading || !!errorMessage}
                  className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl shadow-xs inline-flex items-center gap-2 transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-amber-300" />
                  <span>Capture Photo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

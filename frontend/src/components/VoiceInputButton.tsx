import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, AlertCircle, Loader2, ExternalLink, Volume2, Square } from 'lucide-react';
import { Language } from '../types';
import { apiUrl } from './auth/authStorage';

interface VoiceInputButtonProps {
  onTranscript: (text: string, isFinal?: boolean) => void;
  language: Language;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
  onTranscript,
  language,
  disabled = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [isRecordingMedia, setIsRecordingMedia] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showNewTabTip, setShowNewTabTip] = useState(false);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.abort();
        }
      } catch (e) {}
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {}
    };
  }, []);

  // Stop Web Speech
  const stopWebSpeech = useCallback(() => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    } catch (e) {}
    setIsListening(false);
  }, []);

  // Start MediaRecorder + Gemini Transcribe fallback
  const startMediaRecorderFallback = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Select supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecordingMedia(false);
        if (recordTimerRef.current) {
          clearInterval(recordTimerRef.current);
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        if (audioBlob.size < 1000) {
          setErrorMessage('No audio captured. Please speak closer to the microphone.');
          setTimeout(() => setErrorMessage(null), 4000);
          return;
        }

        // Send to /api/transcribe
        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            const res = await fetch(apiUrl('/api/transcribe'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioData: base64Audio,
                mimeType: audioBlob.type,
                language,
              }),
            });

            if (res.ok) {
              const data = await res.json();
              if (data.transcript && data.transcript.trim()) {
                onTranscriptRef.current(data.transcript.trim(), true);
                setErrorMessage(null);
              } else {
                setErrorMessage('No speech detected in audio. Please try again.');
                setTimeout(() => setErrorMessage(null), 4000);
              }
            } else {
              throw new Error('Transcription service responded with error');
            }
            setIsTranscribing(false);
          };
        } catch (transErr) {
          console.error('Transcription error:', transErr);
          setErrorMessage('Transcription error. Please type your query.');
          setIsTranscribing(false);
          setTimeout(() => setErrorMessage(null), 5000);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecordingMedia(true);
      setRecordSeconds(0);
      setErrorMessage(null);

      // Start timer
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 15) {
            // Auto stop after 15 seconds
            try {
              recorder.stop();
            } catch (e) {}
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn('MediaRecorder error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setShowNewTabTip(true);
        setErrorMessage('Microphone blocked by browser or iframe permission.');
      } else {
        setErrorMessage('Unable to access audio device. Please check settings.');
      }
      setTimeout(() => setErrorMessage(null), 7000);
    }
  };

  // Stop MediaRecorder
  const stopMediaRecorder = () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch (e) {}
  };

  // Start Web Speech API with fallback
  const startWebSpeech = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback to MediaRecorder + AI Transcribe directly
      startMediaRecorderFallback();
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      if (language === 'hi') {
        recognition.lang = 'hi-IN';
      } else if (language === 'mr') {
        recognition.lang = 'mr-IN';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsListening(true);
        setErrorMessage(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            finalTranscript += res[0].transcript + ' ';
          } else {
            interimTranscript += res[0].transcript;
          }
        }

        const combined = (finalTranscript + interimTranscript).trim();
        if (combined) {
          onTranscriptRef.current(combined, Boolean(finalTranscript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Web Speech API error:', event.error);
        setIsListening(false);

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          // If in an iframe, try the MediaRecorder fallback
          console.info('Switching to MediaRecorder audio transcription fallback...');
          startMediaRecorderFallback();
        } else if (event.error === 'no-speech') {
          setErrorMessage('No speech detected. Please speak into the mic.');
          setTimeout(() => setErrorMessage(null), 3000);
        } else if (event.error !== 'aborted') {
          // Try fallback
          startMediaRecorderFallback();
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn('Web Speech start failed, attempting MediaRecorder:', err);
      startMediaRecorderFallback();
    }
  };

  const handleToggle = () => {
    if (disabled || isTranscribing) return;

    if (isListening) {
      stopWebSpeech();
    } else if (isRecordingMedia) {
      stopMediaRecorder();
    } else {
      setErrorMessage(null);
      startWebSpeech();
    }
  };

  const active = isListening || isRecordingMedia;

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        id="voice-input-toggle-btn"
        onClick={handleToggle}
        disabled={disabled || isTranscribing}
        title={
          isTranscribing
            ? 'Transcribing your speech with AI...'
            : isRecordingMedia
            ? `Recording (${recordSeconds}s) - Click to stop and transcribe`
            : isListening
            ? 'Listening... Click to stop'
            : `Voice Input (${language.toUpperCase()})`
        }
        className={`p-2 rounded-lg transition-all flex items-center justify-center relative ${
          isTranscribing
            ? 'bg-amber-100 text-amber-700'
            : active
            ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400 animate-pulse'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isTranscribing ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
        ) : isRecordingMedia ? (
          <Square className="w-4 h-4 text-white fill-white" />
        ) : isListening ? (
          <MicOff className="w-4 h-4 text-white" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>

      {/* Recording State Pill */}
      {isRecordingMedia && (
        <div className="absolute bottom-full mb-2 left-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap px-2.5 py-1 bg-rose-600 text-white text-[11px] font-medium rounded-full shadow-lg flex items-center gap-1.5 z-40 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
          <span>Recording ({recordSeconds}s) • Click to Send</span>
        </div>
      )}

      {/* Transcribing State Pill */}
      {isTranscribing && (
        <div className="absolute bottom-full mb-2 left-0 sm:left-1/2 sm:-translate-x-1/2 whitespace-nowrap px-2.5 py-1 bg-slate-900 text-white text-[11px] font-medium rounded-full shadow-lg flex items-center gap-1.5 z-40 border border-slate-700">
          <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
          <span>Transcribing voice query...</span>
        </div>
      )}

      {/* Error & New Tab Guidance */}
      {errorMessage && !active && !isTranscribing && (
        <div className="absolute bottom-full mb-2 left-0 sm:left-1/2 sm:-translate-x-1/2 w-72 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl flex flex-col gap-1.5 z-50 border border-slate-700">
          <div className="flex items-start gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span className="leading-tight text-slate-200">{errorMessage}</span>
          </div>
          {showNewTabTip && (
            <button
              type="button"
              onClick={() => {
                window.open(window.location.href, '_blank');
                setShowNewTabTip(false);
                setErrorMessage(null);
              }}
              className="mt-1 flex items-center justify-center gap-1 w-full py-1 px-2 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-medium rounded-md transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open in New Tab (Direct Mic Access)</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

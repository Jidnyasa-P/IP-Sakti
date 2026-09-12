import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, AlertCircle } from 'lucide-react';
import { Language } from '../types';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  language: Language;
  disabled?: boolean;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onTranscript, language, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [hasSupport, setHasSupport] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setHasSupport(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      // Language code mapping
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
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access denied. Please allow microphone permission.');
        } else {
          setErrorMessage('Speech recognition unavailable. Please type your query.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } catch (err) {
      console.warn('Could not initialize speech recognition:', err);
      setHasSupport(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, onTranscript]);

  const toggleListening = () => {
    if (disabled) return;
    if (!hasSupport) {
      setErrorMessage('Speech recognition is not supported in this browser. Please type.');
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        id="voice-input-toggle-btn"
        onClick={toggleListening}
        disabled={disabled}
        title={isListening ? 'Stop listening' : `Voice input (${language.toUpperCase()})`}
        className={`p-2.5 rounded-lg transition-all flex items-center justify-center ${
          isListening
            ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {errorMessage && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-2 bg-slate-900 text-white text-xs rounded-md shadow-xl flex items-center gap-1.5 z-30">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};

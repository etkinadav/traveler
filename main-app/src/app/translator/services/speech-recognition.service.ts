import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

@Injectable({
  providedIn: 'root'
})
export class SpeechRecognitionService {
  private recognition: any;
  private isListening = false;
  private currentLanguage = 'he-IL';
  
  private transcriptSubject = new Subject<SpeechRecognitionResult>();
  public transcript$: Observable<SpeechRecognitionResult> = this.transcriptSubject.asObservable();
  
  private statusSubject = new Subject<string>();
  public status$: Observable<string> = this.statusSubject.asObservable();
  
  private errorSubject = new Subject<string>();
  public error$: Observable<string> = this.errorSubject.asObservable();

  constructor() {
    this.initializeRecognition();
  }

  private initializeRecognition(): void {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.errorSubject.next('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLanguage;

    // Event handlers
    this.recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        this.transcriptSubject.next({
          transcript: finalTranscript.trim(),
          isFinal: true
        });
      } else if (interimTranscript) {
        this.transcriptSubject.next({
          transcript: interimTranscript,
          isFinal: false
        });
      }
    };

    this.recognition.onerror = (event: any) => {
      let errorMessage = 'An error occurred with speech recognition.';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Please check your microphone.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone permission denied. Please allow microphone access.';
          break;
        case 'network':
          errorMessage = 'Network error. Please check your internet connection.';
          break;
        case 'aborted':
          // User stopped, not really an error
          return;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      this.errorSubject.next(errorMessage);
      this.isListening = false;
      this.statusSubject.next('error');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.statusSubject.next('stopped');
    };

    this.recognition.onstart = () => {
      this.isListening = true;
      this.statusSubject.next('listening');
    };
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.errorSubject.next('Microphone permission denied. Please allow microphone access in your browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        this.errorSubject.next('No microphone found. Please connect a microphone and try again.');
      } else {
        this.errorSubject.next('Error accessing microphone: ' + error.message);
      }
      return false;
    }
  }

  startListening(language?: string): void {
    if (!this.recognition) {
      this.errorSubject.next('Speech recognition is not available in this browser.');
      return;
    }

    if (this.isListening) {
      return;
    }

    if (language) {
      this.currentLanguage = language;
      this.recognition.lang = language;
    }

    try {
      this.recognition.start();
    } catch (error: any) {
      // If already started, ignore the error
      if (error.message && !error.message.includes('already started')) {
        this.errorSubject.next('Failed to start speech recognition: ' + error.message);
      }
    }
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  setLanguage(language: string): void {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  isSupported(): boolean {
    return !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition;
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return [
      { code: 'he-IL', name: 'Hebrew', nativeName: 'עברית' },
      { code: 'en-US', name: 'English (US)', nativeName: 'English (US)' },
      { code: 'en-GB', name: 'English (UK)', nativeName: 'English (UK)' },
      { code: 'ar-SA', name: 'Arabic (Saudi)', nativeName: 'العربية (السعودية)' },
      { code: 'ar-EG', name: 'Arabic (Egypt)', nativeName: 'العربية (مصر)' },
      { code: 'ar-IL', name: 'Arabic (Israel)', nativeName: 'العربية (إسرائيل)' },
      { code: 'fr-FR', name: 'French', nativeName: 'Français' },
      { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español (España)' },
      { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)' },
      { code: 'de-DE', name: 'German', nativeName: 'Deutsch' },
      { code: 'it-IT', name: 'Italian', nativeName: 'Italiano' },
      { code: 'ru-RU', name: 'Russian', nativeName: 'Русский' },
      { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)' },
      { code: 'ja-JP', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko-KR', name: 'Korean', nativeName: '한국어' },
      { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)' },
      { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'pl-PL', name: 'Polish', nativeName: 'Polski' },
      { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska' },
      { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk' },
      { code: 'da-DK', name: 'Danish', nativeName: 'Dansk' },
      { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi' },
      { code: 'cs-CZ', name: 'Czech', nativeName: 'Čeština' },
      { code: 'hu-HU', name: 'Hungarian', nativeName: 'Magyar' },
      { code: 'ro-RO', name: 'Romanian', nativeName: 'Română' },
      { code: 'bg-BG', name: 'Bulgarian', nativeName: 'Български' },
      { code: 'hr-HR', name: 'Croatian', nativeName: 'Hrvatski' },
      { code: 'sk-SK', name: 'Slovak', nativeName: 'Slovenčina' },
      { code: 'sl-SI', name: 'Slovenian', nativeName: 'Slovenščina' },
      { code: 'el-GR', name: 'Greek', nativeName: 'Ελληνικά' },
      { code: 'th-TH', name: 'Thai', nativeName: 'ไทย' },
      { code: 'vi-VN', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
      { code: 'id-ID', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
      { code: 'ms-MY', name: 'Malay', nativeName: 'Bahasa Melayu' },
      { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'ta-IN', name: 'Tamil', nativeName: 'தமிழ்' },
      { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు' },
      { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
      { code: 'ml-IN', name: 'Malayalam', nativeName: 'മലയാളം' },
      { code: 'uk-UA', name: 'Ukrainian', nativeName: 'Українська' },
      { code: 'ca-ES', name: 'Catalan', nativeName: 'Català' },
      { code: 'eu-ES', name: 'Basque', nativeName: 'Euskara' },
      { code: 'gl-ES', name: 'Galician', nativeName: 'Galego' },
    ];
  }
}


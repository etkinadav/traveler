import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
  speaker?: 'A' | 'B'; // דובר א' או ב'
  language?: string; // השפה שזוהתה
  confidence?: number; // רמת ביטחון
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
  private recognitionA: any; // דובר א'
  private recognitionB: any; // דובר ב'
  private isListening = false;
  private languageA = 'he-IL';
  private languageB = 'en-US';
  
  private transcriptSubject = new Subject<SpeechRecognitionResult>();
  public transcript$: Observable<SpeechRecognitionResult> = this.transcriptSubject.asObservable();
  
  private statusSubject = new Subject<string>();
  public status$: Observable<string> = this.statusSubject.asObservable();
  
  private errorSubject = new Subject<string>();
  public error$: Observable<string> = this.errorSubject.asObservable();

  private lastResultTime: { [key: string]: number } = {};
  private resultQueue: SpeechRecognitionResult[] = [];
  private processingQueue = false;

  constructor() {
    // לא נאתחל כאן - נאתחל רק כשמתחילים להאזין
  }

  private initializeRecognition(languageA: string, languageB: string): void {
    // Check browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.errorSubject.next('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    // Initialize recognition for speaker A
    this.recognitionA = new SpeechRecognition();
    this.recognitionA.continuous = true;
    this.recognitionA.interimResults = true;
    this.recognitionA.lang = languageA;
    this.recognitionA.maxAlternatives = 1;

    // Initialize recognition for speaker B
    this.recognitionB = new SpeechRecognition();
    this.recognitionB.continuous = true;
    this.recognitionB.interimResults = true;
    this.recognitionB.lang = languageB;
    this.recognitionB.maxAlternatives = 1;

    // Event handlers for speaker A
    this.recognitionA.onresult = (event: any) => {
      console.log('Recognition A result:', event);
      this.handleRecognitionResult(event, 'A', languageA);
    };

    this.recognitionA.onerror = (event: any) => {
      console.log('Recognition A error:', event);
      this.handleRecognitionError(event, 'A');
    };

    this.recognitionA.onstart = () => {
      console.log('Recognition A started');
    };

    this.recognitionA.onend = () => {
      console.log('Recognition A ended, isListening:', this.isListening);
      // Auto-restart if still listening (for continuous listening)
      if (this.isListening) {
        setTimeout(() => {
          try {
            if (this.isListening && this.recognitionA) {
              this.recognitionA.start();
              console.log('✓ Auto-restarted recognition after end');
            }
          } catch (e) {
            // Ignore restart errors (might already be starting)
            console.log('Recognition already starting or error:', e);
          }
        }, 100);
      }
    };

    // Event handlers for speaker B
    this.recognitionB.onresult = (event: any) => {
      console.log('Recognition B result:', event);
      this.handleRecognitionResult(event, 'B', languageB);
    };

    this.recognitionB.onerror = (event: any) => {
      console.log('Recognition B error:', event);
      this.handleRecognitionError(event, 'B');
    };

    this.recognitionB.onstart = () => {
      console.log('Recognition B started');
    };

    this.recognitionB.onend = () => {
      console.log('Recognition B ended, isListening:', this.isListening);
      // Don't auto-restart - we'll handle it manually to avoid conflicts
    };
  }

  private handleRecognitionResult(event: any, speaker: 'A' | 'B', language: string): void {
    let interimTranscript = '';
    let finalTranscript = '';
    let maxConfidence = 0;

    console.log(`[${speaker}] Processing result for language ${language}:`, event);

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i][0];
      const transcript = result.transcript;
      const confidence = result.confidence || 0;
      
      console.log(`[${speaker}] Result ${i}: "${transcript}" (confidence: ${confidence}, final: ${event.results[i].isFinal})`);
      
      if (confidence > maxConfidence) {
        maxConfidence = confidence;
      }

      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    // Only process if we have actual text
    if (!finalTranscript && !interimTranscript) {
      console.log(`[${speaker}] No text found, skipping`);
      return;
    }

    // Try to detect which language is actually being spoken
    // This is a simple heuristic - we'll identify speaker based on the configured language
    // In a real implementation, you might want to use language detection APIs
    const detectedSpeaker = this.detectSpeaker(language, finalTranscript || interimTranscript, maxConfidence);

    const result: SpeechRecognitionResult = {
      transcript: finalTranscript.trim() || interimTranscript,
      isFinal: !!finalTranscript,
      speaker: detectedSpeaker,
      language: language,
      confidence: maxConfidence
    };

    console.log(`[${speaker}] Sending result with detected speaker ${detectedSpeaker}:`, result);

    const now = Date.now();
    this.lastResultTime[detectedSpeaker] = now;

    // Send ALL results immediately (both interim and final) for LIVE display
    console.log(`[${detectedSpeaker}] Sending result LIVE (isFinal: ${result.isFinal}):`, result);
    this.transcriptSubject.next(result);
    
    // For final results, restart recognition to continue listening
    if (result.isFinal && this.isListening) {
      setTimeout(() => {
        try {
          if (this.isListening && this.recognitionA) {
            this.recognitionA.start();
            console.log('✓ Restarted recognition to continue listening');
          }
        } catch (e) {
          console.warn('Failed to restart recognition:', e);
          // Try again after a longer delay
          setTimeout(() => {
            if (this.isListening && this.recognitionA) {
              try {
                this.recognitionA.start();
              } catch (e2) {
                console.error('Failed to restart recognition again:', e2);
              }
            }
          }, 500);
        }
      }, 50);
    }
  }

  private currentDetectedSpeaker: 'A' | 'B' | null = null;
  private lastLanguageDetection: string = '';

  private detectSpeaker(configuredLanguage: string, transcript: string, confidence: number): 'A' | 'B' {
    // Detect the actual language being spoken based on the transcript
    const detectedLanguage = this.detectLanguageFromText(transcript);
    
    console.log(`Language detection: transcript="${transcript}", detected=${detectedLanguage}, configured=${configuredLanguage}`);
    
    // Determine speaker based on detected language
    let speaker: 'A' | 'B';
    
    if (detectedLanguage === this.languageA || detectedLanguage.startsWith('he-') && this.languageA.startsWith('he-')) {
      speaker = 'A';
    } else if (detectedLanguage === this.languageB || detectedLanguage.startsWith('en-') && this.languageB.startsWith('en-')) {
      speaker = 'B';
    } else {
      // If we can't detect clearly, use configured language as fallback
      speaker = configuredLanguage === this.languageA ? 'A' : 'B';
    }
    
    // If we detected a language change, update the current speaker and switch recognition language
    if (detectedLanguage && detectedLanguage !== this.lastLanguageDetection && this.lastLanguageDetection !== '') {
      console.log(`Language changed from ${this.lastLanguageDetection} to ${detectedLanguage}, switching speaker to ${speaker}`);
      this.lastLanguageDetection = detectedLanguage;
      this.currentDetectedSpeaker = speaker;
      
      // Switch recognition language if needed
      this.switchRecognitionLanguage(detectedLanguage);
    } else if (!this.currentDetectedSpeaker || this.lastLanguageDetection === '') {
      // First detection or no previous detection
      this.currentDetectedSpeaker = speaker;
      this.lastLanguageDetection = detectedLanguage || configuredLanguage;
      
      // Set initial recognition language
      if (detectedLanguage) {
        this.switchRecognitionLanguage(detectedLanguage);
      }
    } else {
      // Same language, keep current speaker
      speaker = this.currentDetectedSpeaker;
    }
    
    return speaker;
  }

  private switchRecognitionLanguage(targetLanguage: string): void {
    if (!this.isListening || !this.recognitionA) {
      return;
    }

    // Determine which language to use
    const shouldUseLanguageA = targetLanguage === this.languageA || 
                               (targetLanguage.startsWith('he-') && this.languageA.startsWith('he-')) ||
                               (targetLanguage.startsWith('ar-') && this.languageA.startsWith('ar-'));
    
    const shouldUseLanguageB = targetLanguage === this.languageB || 
                               (targetLanguage.startsWith('en-') && this.languageB.startsWith('en-'));
    
    const newLanguage = shouldUseLanguageA ? this.languageA : (shouldUseLanguageB ? this.languageB : null);
    
    if (newLanguage && this.recognitionA.lang !== newLanguage) {
      console.log(`Switching recognition language from ${this.recognitionA.lang} to ${newLanguage}`);
      
      // Stop current recognition
      try {
        this.recognitionA.stop();
      } catch (e) {
        // Ignore stop errors
      }
      
      // Change language and restart
      setTimeout(() => {
        if (this.isListening && this.recognitionA) {
          this.recognitionA.lang = newLanguage;
          try {
            this.recognitionA.start();
            console.log(`✓ Restarted recognition with language: ${newLanguage}`);
          } catch (e) {
            console.warn('Failed to restart recognition with new language:', e);
          }
        }
      }, 200);
    }
  }

  private detectLanguageFromText(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    // Simple heuristic-based language detection
    // Check for Hebrew characters (Unicode range: \u0590-\u05FF)
    const hebrewPattern = /[\u0590-\u05FF]/;
    const hasHebrew = hebrewPattern.test(text);

    // Check for Arabic characters (Unicode range: \u0600-\u06FF)
    const arabicPattern = /[\u0600-\u06FF]/;
    const hasArabic = arabicPattern.test(text);

    // Check for English/Latin characters
    const englishPattern = /^[a-zA-Z0-9\s.,!?'"-]+$/;
    const isEnglish = englishPattern.test(text) && !hasHebrew && !hasArabic;

    // Determine language based on patterns
    if (hasHebrew) {
      // Check if it matches language A or B
      if (this.languageA.startsWith('he-') || this.languageA.startsWith('iw-')) {
        return this.languageA;
      } else if (this.languageB.startsWith('he-') || this.languageB.startsWith('iw-')) {
        return this.languageB;
      }
      return 'he-IL'; // Default Hebrew
    } else if (hasArabic) {
      // Check if it matches language A or B
      if (this.languageA.startsWith('ar-')) {
        return this.languageA;
      } else if (this.languageB.startsWith('ar-')) {
        return this.languageB;
      }
      return 'ar-SA'; // Default Arabic
    } else if (isEnglish) {
      // Check if it matches language A or B
      if (this.languageA.startsWith('en-')) {
        return this.languageA;
      } else if (this.languageB.startsWith('en-')) {
        return this.languageB;
      }
      return 'en-US'; // Default English
    }

    // If we can't detect, return empty string
    return '';
  }

  private processQueue(): void {
    if (this.resultQueue.length === 0) {
      this.processingQueue = false;
      return;
    }

    if (this.processingQueue) {
      return; // Already processing
    }

    this.processingQueue = true;

    // Use setTimeout to debounce and process the most recent result
    setTimeout(() => {
      if (this.resultQueue.length === 0) {
        this.processingQueue = false;
        return;
      }

      console.log('Processing queue, items:', this.resultQueue.length);

      // Find the most recent result (by time) or most confident
      const mostRecent = this.resultQueue.reduce((latest, current) => {
        const currentTime = this.lastResultTime[current.speaker!] || 0;
        const latestTime = this.lastResultTime[latest.speaker!] || 0;
        
        // Prefer more recent
        if (currentTime > latestTime) {
          return current;
        } else if (currentTime === latestTime) {
          // If same time, prefer higher confidence
          if ((current.confidence || 0) > (latest.confidence || 0)) {
            return current;
          }
        }
        return latest;
      });

      console.log('Sending most recent interim result:', mostRecent);
      // Send the most recent interim result
      this.transcriptSubject.next(mostRecent);
      
      this.processingQueue = false;
    }, 50);
  }

  private handleRecognitionError(event: any, speaker: 'A' | 'B'): void {
    // Only show error if it's not a "no-speech" error (which is common)
    if (event.error === 'no-speech' || event.error === 'aborted') {
      return;
    }

    let errorMessage = `Error with ${speaker === 'A' ? 'Speaker A' : 'Speaker B'} recognition: `;
    
    switch (event.error) {
      case 'audio-capture':
        errorMessage = 'No microphone found. Please check your microphone.';
        break;
      case 'not-allowed':
        errorMessage = 'Microphone permission denied. Please allow microphone access.';
        break;
      case 'network':
        errorMessage = 'Network error. Please check your internet connection.';
        break;
      default:
        errorMessage = `Speech recognition error: ${event.error}`;
    }
    
    this.errorSubject.next(errorMessage);
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

  startListening(languageA?: string, languageB?: string): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.errorSubject.next('Speech recognition is not available in this browser.');
      return;
    }

    if (this.isListening) {
      return;
    }

    // Update languages if provided
    if (languageA) {
      this.languageA = languageA;
    }
    if (languageB) {
      this.languageB = languageB;
    }

    // Initialize recognitions with current languages
    this.initializeRecognition(this.languageA, this.languageB);

    // Clear previous state
    this.resultQueue = [];
    this.lastResultTime = {};
    this.currentDetectedSpeaker = null;
    this.lastLanguageDetection = '';

    try {
      // Web Speech API limitation: Cannot run 2 instances simultaneously
      // Strategy: Use a single instance and switch languages dynamically based on detection
      // We'll start with language A, and switch to B if we detect B is being spoken
      
      try {
        // Start with recognition A
        // We'll dynamically switch languages based on what we detect
        this.recognitionA.start();
        console.log('✓ Started recognition A for language:', this.languageA);
        console.log('ℹ Note: Using single recognition instance with dynamic language switching.');
        
        this.isListening = true;
        this.statusSubject.next('listening');
        console.log('✓ Speech recognition is now listening');
      } catch (e: any) {
        console.error('✗ Failed to start recognition:', e);
        this.errorSubject.next('Failed to start speech recognition: ' + (e.message || e));
      }
    } catch (error: any) {
      console.error('✗ Error starting recognition:', error);
      this.errorSubject.next('Failed to start speech recognition: ' + (error.message || error));
    }
  }

  stopListening(): void {
    if (this.isListening) {
      try {
        if (this.recognitionA) {
          this.recognitionA.stop();
        }
        if (this.recognitionB) {
          this.recognitionB.stop();
        }
      } catch (e) {
        // Ignore stop errors
      }
      this.isListening = false;
      this.statusSubject.next('stopped');
      this.resultQueue = [];
    }
  }

  setLanguageA(language: string): void {
    this.languageA = language;
    if (this.recognitionA) {
      this.recognitionA.lang = language;
    }
  }

  setLanguageB(language: string): void {
    this.languageB = language;
    if (this.recognitionB) {
      this.recognitionB.lang = language;
    }
  }

  setLanguages(languageA: string, languageB: string): void {
    this.languageA = languageA;
    this.languageB = languageB;
    
    if (this.recognitionA) {
      this.recognitionA.lang = languageA;
    }
    if (this.recognitionB) {
      this.recognitionB.lang = languageB;
    }

    // If currently listening, restart with new languages
    if (this.isListening) {
      this.stopListening();
      setTimeout(() => {
        this.startListening(languageA, languageB);
      }, 200);
    }
  }

  getLanguageA(): string {
    return this.languageA;
  }

  getLanguageB(): string {
    return this.languageB;
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



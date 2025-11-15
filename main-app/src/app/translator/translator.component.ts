import { Component, OnInit, OnDestroy } from "@angular/core";
import { Subscription } from 'rxjs';
import { DirectionService } from '../direction.service';
import { Router } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
import { SpeechRecognitionService, SupportedLanguage } from './services/speech-recognition.service';

@Component({
  selector: "app-translator",
  templateUrl: "./translator.component.html",
  styleUrls: ["./translator.component.css"],
  host: {
    class: 'fill-screen'
  }
})

export class TranslatorComponent implements OnInit, OnDestroy {
  isRTL: boolean = true;
  private directionSubscription: Subscription;
  isDarkMode: boolean = false;

  // Speech Recognition
  isListening = false;
  transcript = '';
  currentSpeaker: 'A' | 'B' | null = null;
  status = 'idle'; // idle, listening, stopped, error
  errorMessage = '';
  selectedLanguageA = 'he-IL';
  selectedLanguageB = 'en-US';
  supportedLanguages: SupportedLanguage[] = [];
  filteredLanguagesA: SupportedLanguage[] = [];
  filteredLanguagesB: SupportedLanguage[] = [];
  languageSearchTermA = '';
  languageSearchTermB = '';
  showLanguageSelectorA = false;
  showLanguageSelectorB = false;
  transcriptHistory: Array<{ speaker: 'A' | 'B', text: string, language: string }> = [];

  private transcriptSubscription?: Subscription;
  private statusSubscription?: Subscription;
  private errorSubscription?: Subscription;

  constructor(
    private directionService: DirectionService,
    private router: Router,
    private translateService: TranslateService,
    private speechRecognitionService: SpeechRecognitionService,
  ) { }

  ngOnInit() {
    this.directionSubscription = this.directionService.direction$.subscribe(direction => {
      this.isRTL = direction === 'rtl';
    });

    this.directionService.isDarkMode$.subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });

    // Check if speech recognition is supported
    if (!this.speechRecognitionService.isSupported()) {
      this.status = 'error';
      this.errorMessage = 'Speech recognition is not supported in this browser. Please use Chrome or Edge.';
    }

    // Load supported languages
    this.supportedLanguages = this.speechRecognitionService.getSupportedLanguages();
    this.filteredLanguagesA = this.supportedLanguages;
    this.filteredLanguagesB = this.supportedLanguages;

    // Load saved language preferences
    const savedLanguageA = localStorage.getItem('translator-language-a');
    const savedLanguageB = localStorage.getItem('translator-language-b');
    if (savedLanguageA) {
      this.selectedLanguageA = savedLanguageA;
    }
    if (savedLanguageB) {
      this.selectedLanguageB = savedLanguageB;
    }

    // Subscribe to transcript updates
    this.transcriptSubscription = this.speechRecognitionService.transcript$.subscribe(result => {
      console.log('Transcript result received:', result);
      
      if (result.isFinal && result.speaker && result.transcript.trim()) {
        // Final result - add to history
        this.transcript = '';
        this.currentSpeaker = null;
        this.transcriptHistory.push({
          speaker: result.speaker,
          text: result.transcript.trim(),
          language: result.language || ''
        });
        console.log('Added to history:', result);
      } else if (result.speaker && result.transcript) {
        // Interim result - show current speaker and text
        this.currentSpeaker = result.speaker;
        this.transcript = result.transcript;
        console.log('Interim result:', result);
      }
    });

    // Subscribe to status updates
    this.statusSubscription = this.speechRecognitionService.status$.subscribe(status => {
      this.status = status;
      this.isListening = status === 'listening';
    });

    // Subscribe to errors
    this.errorSubscription = this.speechRecognitionService.error$.subscribe(error => {
      this.errorMessage = error;
      this.status = 'error';
      this.isListening = false;
    });
  }

  ngOnDestroy() {
    if (this.directionSubscription) {
      this.directionSubscription.unsubscribe();
    }
    if (this.transcriptSubscription) {
      this.transcriptSubscription.unsubscribe();
    }
    if (this.statusSubscription) {
      this.statusSubscription.unsubscribe();
    }
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
    // Stop listening if still active
    if (this.isListening) {
      this.speechRecognitionService.stopListening();
    }
  }

  async toggleListening(): Promise<void> {
    if (this.isListening) {
      this.stopListening();
    } else {
      await this.startListening();
    }
  }

  async startListening(): Promise<void> {
    // Request microphone permission first
    const hasPermission = await this.speechRecognitionService.requestMicrophonePermission();
    if (!hasPermission) {
      return;
    }

    // Clear previous error
    this.errorMessage = '';
    this.status = 'idle';

    // Start listening with both languages
    this.speechRecognitionService.startListening(this.selectedLanguageA, this.selectedLanguageB);
  }

  stopListening(): void {
    this.speechRecognitionService.stopListening();
  }

  onLanguageChangeA(languageCode: string): void {
    this.selectedLanguageA = languageCode;
    this.speechRecognitionService.setLanguageA(languageCode);
    localStorage.setItem('translator-language-a', languageCode);
    this.showLanguageSelectorA = false;

    // If currently listening, restart with new languages
    if (this.isListening) {
      this.speechRecognitionService.setLanguages(this.selectedLanguageA, this.selectedLanguageB);
    }
  }

  onLanguageChangeB(languageCode: string): void {
    this.selectedLanguageB = languageCode;
    this.speechRecognitionService.setLanguageB(languageCode);
    localStorage.setItem('translator-language-b', languageCode);
    this.showLanguageSelectorB = false;

    // If currently listening, restart with new languages
    if (this.isListening) {
      this.speechRecognitionService.setLanguages(this.selectedLanguageA, this.selectedLanguageB);
    }
  }

  filterLanguagesA(): void {
    if (!this.languageSearchTermA) {
      this.filteredLanguagesA = this.supportedLanguages;
      return;
    }

    const searchTerm = this.languageSearchTermA.toLowerCase();
    this.filteredLanguagesA = this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.nativeName.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }

  filterLanguagesB(): void {
    if (!this.languageSearchTermB) {
      this.filteredLanguagesB = this.supportedLanguages;
      return;
    }

    const searchTerm = this.languageSearchTermB.toLowerCase();
    this.filteredLanguagesB = this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.nativeName.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }

  clearTranscript(): void {
    this.transcript = '';
    this.transcriptHistory = [];
  }

  copyToClipboard(): void {
    // Copy all history in play format
    if (this.transcriptHistory.length > 0) {
      const playText = this.transcriptHistory.map(item => {
        return `${this.getSpeakerName(item.speaker)}: ${item.text}`;
      }).join('\n\n');
      
      navigator.clipboard.writeText(playText).then(() => {
        console.log('History copied to clipboard');
      });
    } else if (this.transcript) {
      // If no history, copy current transcript
      navigator.clipboard.writeText(this.transcript).then(() => {
        console.log('Text copied to clipboard');
      });
    }
  }

  getSelectedLanguageNameA(): string {
    const lang = this.supportedLanguages.find(l => l.code === this.selectedLanguageA);
    return lang ? lang.nativeName : this.selectedLanguageA;
  }

  getSelectedLanguageNameB(): string {
    const lang = this.supportedLanguages.find(l => l.code === this.selectedLanguageB);
    return lang ? lang.nativeName : this.selectedLanguageB;
  }

  getSpeakerName(speaker: 'A' | 'B'): string {
    return speaker === 'A' ? 'דובר א\'' : 'דובר ב\'';
  }

  getStatusIcon(): string {
    switch (this.status) {
      case 'listening':
        return 'mic';
      case 'stopped':
        return 'mic_off';
      case 'error':
        return 'error';
      default:
        return 'mic_none';
    }
  }

  getStatusColor(): string {
    switch (this.status) {
      case 'listening':
        return 'warn';
      case 'error':
        return 'warn';
      default:
        return 'primary';
    }
  }
}



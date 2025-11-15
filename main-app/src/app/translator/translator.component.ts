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
  status = 'idle'; // idle, listening, stopped, error
  errorMessage = '';
  selectedLanguage = 'he-IL';
  supportedLanguages: SupportedLanguage[] = [];
  filteredLanguages: SupportedLanguage[] = [];
  languageSearchTerm = '';
  showLanguageSelector = false;
  transcriptHistory: string[] = [];

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
    this.filteredLanguages = this.supportedLanguages;

    // Load saved language preference
    const savedLanguage = localStorage.getItem('translator-language');
    if (savedLanguage) {
      this.selectedLanguage = savedLanguage;
      this.speechRecognitionService.setLanguage(savedLanguage);
    }

    // Subscribe to transcript updates
    this.transcriptSubscription = this.speechRecognitionService.transcript$.subscribe(result => {
      if (result.isFinal) {
        this.transcript = result.transcript;
        if (result.transcript.trim()) {
          this.transcriptHistory.push(result.transcript);
        }
      } else {
        // Show interim results
        this.transcript = result.transcript;
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

    // Start listening
    this.speechRecognitionService.startListening(this.selectedLanguage);
  }

  stopListening(): void {
    this.speechRecognitionService.stopListening();
  }

  onLanguageChange(languageCode: string): void {
    this.selectedLanguage = languageCode;
    this.speechRecognitionService.setLanguage(languageCode);
    localStorage.setItem('translator-language', languageCode);
    this.showLanguageSelector = false;

    // If currently listening, restart with new language
    if (this.isListening) {
      this.stopListening();
      setTimeout(() => {
        this.startListening();
      }, 100);
    }
  }

  filterLanguages(): void {
    if (!this.languageSearchTerm) {
      this.filteredLanguages = this.supportedLanguages;
      return;
    }

    const searchTerm = this.languageSearchTerm.toLowerCase();
    this.filteredLanguages = this.supportedLanguages.filter(lang =>
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
    if (this.transcript) {
      navigator.clipboard.writeText(this.transcript).then(() => {
        // Could show a toast notification here
        console.log('Text copied to clipboard');
      });
    }
  }

  getSelectedLanguageName(): string {
    const lang = this.supportedLanguages.find(l => l.code === this.selectedLanguage);
    return lang ? lang.nativeName : this.selectedLanguage;
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


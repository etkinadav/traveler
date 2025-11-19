import { Component, OnInit, OnDestroy, ChangeDetectorRef } from "@angular/core";
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
  isPaused = false; // Pause state - when true, listening is paused but UI stays the same
  hasStartedListening = false; // Track if listening has started at least once - keeps mic in center
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
  
  // Translation languages (currently not functional)
  selectedTranslationLanguageA = 'en-US';
  selectedTranslationLanguageB = 'he-IL';
  filteredTranslationLanguagesA: SupportedLanguage[] = [];
  filteredTranslationLanguagesB: SupportedLanguage[] = [];
  translationLanguageSearchTermA = '';
  translationLanguageSearchTermB = '';
  showTranslationLanguageSelectorA = false;
  showTranslationLanguageSelectorB = false;
  transcriptHistory: Array<{ speaker: 'A' | 'B', text: string, language: string, id: number, isWaiting?: boolean }> = [];
  private historyIdCounter = 0;
  
  // Full transcript text - accumulates all text without duplicates
  private fullTranscriptText: string = '';
  
  // Track last added words to detect repetitions
  private lastAddedWords: string[] = [];
  private readonly MAX_TRACKED_WORDS = 10; // Track last 10 words
  
  // Track last result time to detect speech gaps
  private lastResultTime: number = 0;
  private readonly SPEECH_GAP_THRESHOLD = 700; // 0.7 seconds in milliseconds - creates empty line with spinner if current line has content
  private lastSavedText: string = ''; // Track the last saved text to prevent duplicates after gap
  private lastEmptyLineId: number | null = null; // Track the ID of the last empty line created after gap
  
  // Loading spinner and language probability
  isAnalyzing: boolean = false;
  languageProbabilityA: number = 0; // Probability for language A (percentage)
  languageProbabilityB: number = 0; // Probability for language B (percentage)
  private analysisTimeout?: any;
  private readonly ANALYSIS_DELAY = 500; // Wait 500ms after last result before analyzing

  // Per-utterance buffering to avoid early misclassification
  private bufferingActive: boolean = false;
  private utteranceStartTime: number = 0;
  private readonly MIN_BUFFER_WORDS = 2; // Wait for at least 2 words before displaying
  private readonly MIN_BUFFER_MS = 2000; // 2 seconds

  // Manual speaker selection (toggle)
  currentSpeaker: 'A' | 'B' = 'A';
  private manualSpeakerMode: boolean = true;

  // UI: Compact history visibility
  showCompactHistory: boolean = false;

  toggleCompactHistory(): void {
    this.showCompactHistory = !this.showCompactHistory;
  }
  
  // Fast-probe for startup language switching
  private consecutiveVeryLowCount: number = 0;
  private resultsSinceStart: number = 0;
  private readonly STARTUP_PROBE_WINDOW = 8; // first ~8 results
  private readonly VERY_LOW_CONF_THRESHOLD = 0.05;
  
  private transcriptSubscription?: Subscription;
  private statusSubscription?: Subscription;
  private errorSubscription?: Subscription;

  constructor(
    private directionService: DirectionService,
    private router: Router,
    private translateService: TranslateService,
    private speechRecognitionService: SpeechRecognitionService,
    private cdr: ChangeDetectorRef
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
    this.filteredTranslationLanguagesA = this.supportedLanguages;
    this.filteredTranslationLanguagesB = this.supportedLanguages;

    // Load saved language preferences
    const savedLanguageA = localStorage.getItem('translator-language-a');
    const savedLanguageB = localStorage.getItem('translator-language-b');
    console.log('✓ Loaded from localStorage - savedLanguageA:', savedLanguageA, 'savedLanguageB:', savedLanguageB);
    if (savedLanguageA) {
      this.selectedLanguageA = savedLanguageA;
      console.log('✓ Set selectedLanguageA to:', this.selectedLanguageA);
    }
    if (savedLanguageB) {
      this.selectedLanguageB = savedLanguageB;
      console.log('✓ Set selectedLanguageB to:', this.selectedLanguageB);
    }
    
    // Load saved translation language preferences
    const savedTranslationLanguageA = localStorage.getItem('translator-translation-language-a');
    const savedTranslationLanguageB = localStorage.getItem('translator-translation-language-b');
    if (savedTranslationLanguageA) {
      this.selectedTranslationLanguageA = savedTranslationLanguageA;
    }
    if (savedTranslationLanguageB) {
      this.selectedTranslationLanguageB = savedTranslationLanguageB;
    }

    // Subscribe to transcript updates - LIVE transcription to history
    this.transcriptSubscription = this.speechRecognitionService.transcript$.subscribe(result => {
      if (result.speaker && result.transcript && result.transcript.trim()) {
        const trimmedText = result.transcript.trim();
        const currentTime = Date.now();

        // Debug: log latest snippet probabilities for A/B
        this.logNewVoiceData(trimmedText);
        
        // SIMPLIFIED: Don't save text after speech gaps - only save when pausing or switching speakers
        // Just update the last result time to track when we last received text
        this.lastResultTime = currentTime;
        
        // Startup probe counters
        this.resultsSinceStart++;
        if (result.confidence !== undefined && result.confidence <= this.VERY_LOW_CONF_THRESHOLD) {
          this.consecutiveVeryLowCount++;
        } else {
          this.consecutiveVeryLowCount = 0;
        }
        
        // If at start we get several very-low-confidence English-like snippets, force a quick try to the other language
        // BUT: Skip this in manual speaker mode - user has explicitly chosen the language
        if (this.manualSpeakerMode) {
          // In manual mode, don't do startup probe - trust the user's selection
        } else if (this.resultsSinceStart <= this.STARTUP_PROBE_WINDOW && this.consecutiveVeryLowCount >= 3) {
          const otherLanguage = this.speechRecognitionService.getLanguageA() === this.selectedLanguageA ? this.selectedLanguageB : this.selectedLanguageA;
          console.log(`STARTUP_PROBE: ${this.consecutiveVeryLowCount} very-low-confidence results at start -> probing switch to ${otherLanguage}`);
          this.checkAndSwitchLanguage(otherLanguage);
          this.consecutiveVeryLowCount = 0;
        }
        
        // Check confidence score - if it's low, the current language might be wrong
        if (result.confidence !== undefined) {
          this.checkLanguageByConfidence(result.confidence, trimmedText, result.language);
          
          // If confidence is very low and text looks like English but we're expecting Hebrew,
          // it might be a misrecognition - skip it to avoid adding wrong text
          // Check for both extremely low confidence (0.015) and moderately low confidence (0.6) for single words
          if (result.language && result.language.startsWith('en-')) {
            // Check if the other language is Hebrew
            if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
              // Check if text looks like English (only Latin characters, no Hebrew)
              const hasOnlyLatin = /^[a-zA-Z\s]+$/.test(trimmedText);
              const hasHebrew = /[\u0590-\u05FF]/.test(trimmedText);
              
              if (hasOnlyLatin && !hasHebrew) {
                const words = trimmedText.split(/\s+/).filter(w => w.length > 0);
                const isVeryShort = words.length <= 3;
                const isSingleWord = words.length === 1;
                
                // Check confidence levels
                const isExtremelyLowConfidence = result.confidence <= 0.015;
                const isModeratelyLowConfidence = result.confidence <= 0.6;
                
                // Check if words extend each other (like "EXT extre extreme")
                let hasExtendingWords = false;
                if (words.length >= 2) {
                  for (let i = 0; i < words.length - 1; i++) {
                    const current = words[i].toLowerCase();
                    const next = words[i + 1].toLowerCase();
                    if (next.startsWith(current) && next.length > current.length) {
                      hasExtendingWords = true;
                      break;
                    }
                  }
                }
                
                // Check if words are very short (likely gibberish)
                const hasVeryShortWords = words.some(w => w.length <= 2);
                
                // Check if text contains Hebrew words transcribed as English (like "shalom", "shut it on" for "שלום מדבר נדב")
                const hebrewWordsInEnglish: { [key: string]: string } = {
                  'shalom': 'שלום',
                  'shut': 'שלום',
                  'it': 'מדבר',
                  'on': 'נדב'
                };
                
                let containsHebrewWords = false;
                for (const word of words) {
                  const cleanWord = word.replace(/[.,!?'"-]/g, '').toLowerCase();
                  if (hebrewWordsInEnglish[cleanWord]) {
                    containsHebrewWords = true;
                    break;
                  }
                }
                
                // Only skip if it's clearly gibberish or misrecognition
                // Don't skip if it looks like real English words, even with low confidence
                const isLikelyGibberish = hasExtendingWords || (hasVeryShortWords && isVeryShort) || containsHebrewWords;
                const isSingleWordGibberish = isSingleWord && isExtremelyLowConfidence && hasVeryShortWords;
                
                // Only skip if we have no text yet AND it's clearly gibberish
                // This prevents skipping legitimate English text that just has low confidence
                if (!this.fullTranscriptText && (isLikelyGibberish || isSingleWordGibberish)) {
                  console.log(`SKIP_LOW_CONFIDENCE: Skipping very low confidence English text "${trimmedText}" (confidence: ${result.confidence}) - likely gibberish (extending: ${hasExtendingWords}, veryShortWords: ${hasVeryShortWords}, hebrewWords: ${containsHebrewWords}, singleWordGibberish: ${isSingleWordGibberish})`);
                  return; // Skip this result
                }
              }
            }
          }
        }
        
        // Update full transcript text - add only new parts without duplicates
        this.updateFullTranscript(trimmedText, result.confidence);
        
        // Start/restart analysis timer - wait for message to complete before analyzing
        this.scheduleLanguageAnalysis();
      }
    });

    // Subscribe to status updates
    this.statusSubscription = this.speechRecognitionService.status$.subscribe(status => {
      this.status = status;
      // Only update isListening if not paused - when paused, keep isListening as true
      if (!this.isPaused) {
        this.isListening = status === 'listening';
      }
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
      // If listening and not paused, pause it
      if (!this.isPaused) {
        this.pauseListening();
      } else {
        // If paused, resume it
        this.resumeListening();
      }
    } else {
      // If not listening, start listening
      await this.startListening();
    }
  }

  pauseListening(): void {
    if (this.isListening && !this.isPaused) {
      this.isPaused = true;
      // Keep isListening as true even when paused, so UI doesn't change
      // Stop the recognition but don't let status subscription change isListening
      this.speechRecognitionService.stopListening();
      // Manually keep isListening as true
      this.isListening = true;
      
      // Save current text before pausing (if there's any)
      if (this.fullTranscriptText && this.fullTranscriptText.trim().length > 0) {
        this.addCurrentTextToHistoryAsNewLine();
        // Reset the text for next time
        this.fullTranscriptText = '';
        this.lastAddedWords = [];
        this.lastFullTextLength = 0;
      }
      
      // Clear analysis state
      if (this.analysisTimeout) {
        clearTimeout(this.analysisTimeout);
        this.analysisTimeout = undefined;
      }
      this.isAnalyzing = false;
      this.languageProbabilityA = 0;
      this.languageProbabilityB = 0;
      
      // Remove spinner (waiting lines) and live segments when pausing
      if (this.transcriptHistory.length > 0) {
        const hadWaitingLine = this.transcriptHistory.some(item => item.isWaiting);
        // Remove waiting lines and live segments (keep only saved history)
        this.transcriptHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
        // Update saved history count
        this.savedHistoryCount = this.transcriptHistory.length;
        // Clear lastEmptyLineId
        this.lastEmptyLineId = null;
        if (hadWaitingLine || this.transcriptHistory.length < this.savedHistoryCount) {
          this.cdr.detectChanges();
        }
      }
      
      console.log('✓ Paused listening');
    }
  }

  async resumeListening(): Promise<void> {
    if (this.isListening && this.isPaused) {
      this.isPaused = false;
      // Resume listening with the current speaker's language
      const currentLanguage = this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
      this.speechRecognitionService.startListening(this.selectedLanguageA, this.selectedLanguageB);
      
      // In manual mode, immediately switch to the current speaker's language
      if (this.manualSpeakerMode) {
        setTimeout(() => {
          this.speechRecognitionService.switchRecognitionLanguage(currentLanguage);
        }, 100);
      }
      
      // Create a spinner for the new session as a LIVE segment (not saved)
      const savedHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
      const language = this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
      // Check if there's already a waiting line in live segments
      const liveSegments = this.transcriptHistory.slice(this.savedHistoryCount);
      const existingWaiting = liveSegments.find(item => item.isWaiting);
      if (!existingWaiting) {
        this.historyIdCounter++;
        this.lastEmptyLineId = this.historyIdCounter;
        // IMPORTANT: This is a LIVE segment (id > savedHistoryCount), it will NOT be saved
        this.transcriptHistory = [...savedHistory, {
          speaker: this.currentSpeaker,
          text: '',
          language: language,
          id: this.lastEmptyLineId,
          isWaiting: true
        }];
        // DO NOT update savedHistoryCount - this is a live segment
      } else {
        this.lastEmptyLineId = existingWaiting.id;
      }
      
      // Reset buffering
      this.bufferingActive = true;
      this.utteranceStartTime = Date.now();
      
      console.log('✓ Resumed listening');
    }
  }

  async startListening(): Promise<void> {
    // Request microphone permission first
    const hasPermission = await this.speechRecognitionService.requestMicrophonePermission();
    if (!hasPermission) {
      return;
    }

    // Mark that listening has started - mic will stay in center from now on
    this.hasStartedListening = true;

    // Clear previous error
    this.errorMessage = '';
    this.status = 'idle';
    this.isPaused = false; // Reset pause state when starting
    
    // Reset counters and state
    this.fullTranscriptText = '';
    this.lastFullTextLength = 0;
    this.transcriptHistory = [];
    this.historyIdCounter = 0;
    this.savedHistoryCount = 0; // Reset saved history count
    this.lowConfidenceCount = 0;
    this.languageMismatchCount = 0;
    this.lastLanguageCheck = '';
    this.lastLanguageCheckTime = 0;
    this.lastAddedWords = []; // Reset tracked words
    this.lastResultTime = 0; // Reset last result time
    this.lastSavedText = ''; // Reset saved text tracking
    this.lastEmptyLineId = null; // Reset empty line tracking
    // Initialize buffering for the first utterance
    this.bufferingActive = true;
    this.utteranceStartTime = Date.now();
    // Default speaker at start can remain previous or reset to A
    // this.currentSpeaker = 'A';

    // Create an empty line with spinner immediately when starting to listen as a LIVE segment (not saved)
    const language = this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
    this.historyIdCounter++;
    this.lastEmptyLineId = this.historyIdCounter;
    // IMPORTANT: This is a LIVE segment (id > savedHistoryCount), it will NOT be saved
    this.transcriptHistory.push({
      speaker: this.currentSpeaker,
      text: '',
      language: language,
      id: this.lastEmptyLineId,
      isWaiting: true
    });
    // DO NOT update savedHistoryCount - this is a live segment

    // Start listening with both languages
    // In manual mode, start with the current speaker's language
    const initialLanguage = this.manualSpeakerMode 
      ? (this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB)
      : this.selectedLanguageA;
    console.log('✓ Starting listening with selectedLanguageA:', this.selectedLanguageA, 'selectedLanguageB:', this.selectedLanguageB, 'initialLanguage:', initialLanguage);
    this.speechRecognitionService.startListening(this.selectedLanguageA, this.selectedLanguageB);
    
    // In manual mode, immediately switch to the current speaker's language
    if (this.manualSpeakerMode) {
      setTimeout(() => {
        this.speechRecognitionService.switchRecognitionLanguage(initialLanguage);
      }, 100);
    }
  }

  stopListening(): void {
    this.isPaused = false; // Reset pause state when stopping
    this.hasStartedListening = false; // Reset - mic will go back down
    this.speechRecognitionService.stopListening();
    // Clear analysis state
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = undefined;
    }
    this.isAnalyzing = false;
    this.languageProbabilityA = 0;
    this.languageProbabilityB = 0;
  }

  resetToInitialState(): void {
    // Full reset - stop listening, reset everything, show language inputs, move mic down
    this.isPaused = false;
    this.hasStartedListening = false;
    this.isListening = false;
    this.speechRecognitionService.stopListening();
    // Clear analysis state
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = undefined;
    }
    this.isAnalyzing = false;
    this.languageProbabilityA = 0;
    this.languageProbabilityB = 0;
    this.status = 'idle';
    this.errorMessage = '';
    console.log('✓ Reset to initial state');
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

  // Translation language functions (currently not functional)
  onTranslationLanguageChangeA(languageCode: string): void {
    this.selectedTranslationLanguageA = languageCode;
    localStorage.setItem('translator-translation-language-a', languageCode);
    this.showTranslationLanguageSelectorA = false;
    // TODO: Implement translation functionality
  }

  onTranslationLanguageChangeB(languageCode: string): void {
    this.selectedTranslationLanguageB = languageCode;
    localStorage.setItem('translator-translation-language-b', languageCode);
    this.showTranslationLanguageSelectorB = false;
    // TODO: Implement translation functionality
  }

  filterTranslationLanguagesA(): void {
    if (!this.translationLanguageSearchTermA) {
      this.filteredTranslationLanguagesA = this.supportedLanguages;
      return;
    }

    const searchTerm = this.translationLanguageSearchTermA.toLowerCase();
    this.filteredTranslationLanguagesA = this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.nativeName.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }

  filterTranslationLanguagesB(): void {
    if (!this.translationLanguageSearchTermB) {
      this.filteredTranslationLanguagesB = this.supportedLanguages;
      return;
    }

    const searchTerm = this.translationLanguageSearchTermB.toLowerCase();
    this.filteredTranslationLanguagesB = this.supportedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchTerm) ||
      lang.nativeName.toLowerCase().includes(searchTerm) ||
      lang.code.toLowerCase().includes(searchTerm)
    );
  }

  getSelectedTranslationLanguageNameA(): string {
    const lang = this.supportedLanguages.find(l => l.code === this.selectedTranslationLanguageA);
    return lang ? lang.nativeName : this.selectedTranslationLanguageA;
  }

  getSelectedTranslationLanguageNameB(): string {
    const lang = this.supportedLanguages.find(l => l.code === this.selectedTranslationLanguageB);
    return lang ? lang.nativeName : this.selectedTranslationLanguageB;
  }

  /**
   * Updates the full transcript text with new recognition results
   * Simple logic: always update to the new text if it's different and longer or extends the current text
   */
  private updateFullTranscript(newText: string, confidence?: number): void {
    // Don't update transcript when paused
    if (this.isPaused) {
      return;
    }
    
    // Remove RTL marks and normalize
    const cleanNewText = newText.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    const cleanFullText = this.fullTranscriptText.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    
    if (!cleanNewText) {
      return;
    }
    
    // Skip if new text is identical to current text
    if (cleanNewText === cleanFullText) {
      return;
    }
    
    // Skip if new text is already fully contained in current text (it's an older result)
    if (cleanFullText && cleanFullText.includes(cleanNewText) && cleanFullText.length >= cleanNewText.length) {
      return;
    }
    
    // Always update if:
    // 1. Current text is empty, OR
    // 2. New text starts with current text (extension), OR
    // 3. New text is longer than current text
    if (!cleanFullText || cleanNewText.startsWith(cleanFullText) || cleanNewText.length > cleanFullText.length) {
      // Extract the new part if it's an extension
      let addedPart = cleanNewText;
      if (cleanFullText && cleanNewText.startsWith(cleanFullText)) {
        addedPart = cleanNewText.slice(cleanFullText.length).trim();
        if (!addedPart || addedPart.length === 0) {
          return; // No new content
        }
      }
      
      // Update to the new text
      this.fullTranscriptText = cleanNewText;
      this.updateTrackedWords(addedPart);
      console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
      
      // Check and switch language based on the full text (only in auto mode)
      if (!this.manualSpeakerMode) {
        this.checkFullTextLanguage();
      }
      
      // Update the history display
      this.updateHistoryFromFullText();
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToTop(), 100);
    }
  }
  
  /**
   * Updates the tracked words array with newly added words
   */
  private updateTrackedWords(addedText: string): void {
    if (!addedText || addedText.trim().length === 0) {
      return;
    }
    
    const words = addedText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    
    // Add new words to the tracked array
    this.lastAddedWords.push(...words);
    
    // Keep only the last MAX_TRACKED_WORDS words
    if (this.lastAddedWords.length > this.MAX_TRACKED_WORDS) {
      this.lastAddedWords = this.lastAddedWords.slice(-this.MAX_TRACKED_WORDS);
    }
    
    console.log(`TRACKED_WORDS: Updated to [${this.lastAddedWords.join(', ')}]`);
  }
  
  /**
   * Checks if the text contains repetitions of the last tracked words
   */
  private containsLastTrackedWords(text: string): boolean {
    if (this.lastAddedWords.length === 0 || !text || text.trim().length === 0) {
      return false;
    }
    
    const textLower = text.toLowerCase();
    const textWords = textLower.split(/\s+/).filter(w => w.length > 0);
    
    if (textWords.length === 0) {
      return false;
    }
    
    // Check if the text starts with tracked words (repetition pattern)
    // Check for 3+ consecutive tracked words at the start
    let matchedCount = 0;
    for (let i = 0; i < Math.min(this.lastAddedWords.length, textWords.length); i++) {
      if (textWords[i] === this.lastAddedWords[this.lastAddedWords.length - 1 - i]) {
        matchedCount++;
      } else {
        break;
      }
    }
    
    if (matchedCount >= 3) {
      console.log(`REPETITION_TRACKED: Found ${matchedCount} consecutive tracked words at start`);
      return true;
    }
    
    // Check if tracked words appear multiple times in the text
    // Look for patterns like "the right" appearing multiple times
    for (let phraseLength = 2; phraseLength <= Math.min(5, this.lastAddedWords.length); phraseLength++) {
      const trackedPhrase = this.lastAddedWords.slice(-phraseLength).join(' ');
      const textPhrase = textWords.slice(0, phraseLength).join(' ');
      
      if (trackedPhrase === textPhrase) {
        // Found a match - check if it appears multiple times
        let count = 0;
        for (let i = 0; i <= textWords.length - phraseLength; i++) {
          const currentPhrase = textWords.slice(i, i + phraseLength).join(' ');
          if (currentPhrase === trackedPhrase) {
            count++;
          }
        }
        
        if (count >= 2) {
          console.log(`REPETITION_TRACKED: Phrase "${trackedPhrase}" appears ${count} times`);
          return true;
        }
      }
    }
    
    // Check for progressive repetition pattern (e.g., "the ri the right t the right ti the right time")
    // This happens when speech recognition adds words progressively and repeats them
    if (textWords.length >= 3) {
      // Check if text contains progressive repetition of tracked words
      // Pattern: "word1", "word1 word2", "word1 word2 word3", etc.
      let progressiveRepetitions = 0;
      
      // Check for progressive patterns starting from different positions
      for (let startPos = 0; startPos < Math.min(3, textWords.length - 2); startPos++) {
        let matches = 0;
        
        // Check if we have progressive matches with tracked words
        for (let len = 2; len <= Math.min(5, this.lastAddedWords.length, textWords.length - startPos); len++) {
          const textPhrase = textWords.slice(startPos, startPos + len).join(' ');
          const trackedPhrase = this.lastAddedWords.slice(-len).join(' ');
          
          // Check for exact match or if one contains the other (allowing for partial words)
          if (textPhrase === trackedPhrase || 
              textPhrase.includes(trackedPhrase) || 
              trackedPhrase.includes(textPhrase)) {
            matches++;
          }
        }
        
        if (matches >= 2) {
          progressiveRepetitions++;
        }
      }
      
      if (progressiveRepetitions >= 1) {
        console.log(`REPETITION_TRACKED: Found progressive repetition pattern (${progressiveRepetitions} sequences)`);
        return true;
      }
      
      // Check for pattern where same phrase appears multiple times with small additions
      // e.g., "the right", "the right t", "the right ti", "the right time"
      for (let phraseLen = 2; phraseLen <= Math.min(4, this.lastAddedWords.length); phraseLen++) {
        const basePhrase = this.lastAddedWords.slice(-phraseLen).join(' ');
        let occurrences = 0;
        
        // Count how many times this phrase (or variations) appears in text
        for (let i = 0; i <= textWords.length - phraseLen; i++) {
          const textPhrase = textWords.slice(i, i + phraseLen).join(' ');
          
          // Check if phrases match or if one is a prefix of the other
          if (textPhrase === basePhrase || 
              textPhrase.startsWith(basePhrase) || 
              basePhrase.startsWith(textPhrase)) {
            occurrences++;
          }
        }
        
        if (occurrences >= 3) {
          console.log(`REPETITION_TRACKED: Phrase "${basePhrase}" appears ${occurrences} times with variations`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Detects if text contains repetition patterns (e.g., "can you can you can you")
   */
  private detectRepetitionPattern(text: string): boolean {
    if (!text || text.length < 10) {
      return false;
    }
    
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    if (words.length < 3) {
      return false;
    }
    
    // Check for repeated 2-word or 3-word phrases
    for (let phraseLength = 2; phraseLength <= 3; phraseLength++) {
      for (let i = 0; i <= words.length - phraseLength * 2; i++) {
        const phrase1 = words.slice(i, i + phraseLength).join(' ');
        const phrase2 = words.slice(i + phraseLength, i + phraseLength * 2).join(' ');
        
        if (phrase1 === phrase2) {
          // Found a repetition - check if it continues
          let repetitionCount = 2;
          for (let j = i + phraseLength * 2; j <= words.length - phraseLength; j += phraseLength) {
            const nextPhrase = words.slice(j, j + phraseLength).join(' ');
            if (nextPhrase === phrase1) {
              repetitionCount++;
            } else {
              break;
            }
          }
          
          // If we have 3+ repetitions, it's a pattern
          if (repetitionCount >= 3) {
            console.log(`REPETITION_PATTERN: Found ${repetitionCount} repetitions of "${phrase1}"`);
            return true;
          }
        }
      }
    }
    
    // Check for character-level repetition (e.g., "aaaa", "can can can")
    const normalizedText = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i < normalizedText.length - 6; i++) {
      const substr = normalizedText.substring(i, i + 3);
      const nextSubstr = normalizedText.substring(i + 3, i + 6);
      if (substr === nextSubstr && substr.length > 0 && !substr.match(/^[.,!?'"\s]+$/)) {
        // Check if this pattern repeats more
        let count = 2;
        for (let j = i + 6; j < normalizedText.length - 3; j += 3) {
          if (normalizedText.substring(j, j + 3) === substr) {
            count++;
          } else {
            break;
          }
        }
        if (count >= 3) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Checks if newText is a repetition loop of fullText
   */
  private isRepetitionLoop(fullText: string, newText: string): boolean {
    if (!fullText || !newText) {
      return false;
    }
    
    const fullTextLower = fullText.toLowerCase().trim();
    const newTextLower = newText.toLowerCase().trim();
    
    // If texts are identical, it's not a loop (just a duplicate)
    if (fullTextLower === newTextLower) {
      return false;
    }
    
    // Only check for loops if fullText is relatively short (less than 50 chars)
    // Long texts can naturally contain similar phrases without being loops
    if (fullTextLower.length > 50) {
      // For long texts, only check if newText is significantly longer and contains fullText multiple times
      if (newTextLower.length > fullTextLower.length * 1.5) {
        let count = 0;
        let index = 0;
        while ((index = newTextLower.indexOf(fullTextLower, index)) !== -1) {
          count++;
          index += fullTextLower.length;
        }
        
        // Only consider it a loop if fullText appears 3+ times
        if (count >= 3) {
          console.log(`REPETITION_LOOP: fullText appears ${count} times in newText (long text)`);
          return true;
        }
      }
      return false;
    }
    
    // For shorter texts, check if newText contains fullText multiple times
    let count = 0;
    let index = 0;
    while ((index = newTextLower.indexOf(fullTextLower, index)) !== -1) {
      count++;
      index += fullTextLower.length;
    }
    
    // For short texts, 2+ occurrences is suspicious
    if (count >= 2) {
      console.log(`REPETITION_LOOP: fullText appears ${count} times in newText`);
      return true;
    }
    
    // Check if newText is fullText with small additions that repeat
    if (newTextLower.startsWith(fullTextLower)) {
      const addedPart = newTextLower.slice(fullTextLower.length).trim();
      // Only consider it a loop if addedPart is significant and appears in fullText
      if (addedPart && addedPart.length > 5 && fullTextLower.includes(addedPart)) {
        // Check how many times addedPart appears in fullText
        let addedCount = 0;
        let addedIndex = 0;
        while ((addedIndex = fullTextLower.indexOf(addedPart, addedIndex)) !== -1) {
          addedCount++;
          addedIndex += addedPart.length;
        }
        if (addedCount >= 2) {
          console.log(`REPETITION_LOOP: Added part "${addedPart}" appears ${addedCount} times in fullText`);
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Checks if addedPart is a repetitive addition to fullText
   */
  private isRepetitiveAddition(fullText: string, addedPart: string): boolean {
    if (!addedPart || addedPart.length < 3) {
      return false;
    }
    
    const fullTextLower = fullText.toLowerCase();
    const addedPartLower = addedPart.toLowerCase();
    
    // Check if addedPart contains words that already appear multiple times in fullText
    const addedWords = addedPartLower.split(/\s+/).filter(w => w.length > 2);
    const fullWords = fullTextLower.split(/\s+/);
    
    let repeatedWordCount = 0;
    for (const word of addedWords) {
      const countInFull = fullWords.filter(w => w === word).length;
      if (countInFull >= 3) {
        repeatedWordCount++;
      }
    }
    
    // If more than 50% of added words are already repeated in fullText, it's likely repetitive
    if (addedWords.length > 0 && repeatedWordCount / addedWords.length > 0.5) {
      return true;
    }
    
    // Check if addedPart itself contains repetition patterns
    if (this.detectRepetitionPattern(addedPart)) {
      return true;
    }
    
    // Check if addedPart is a substring that appears multiple times in fullText
    if (fullTextLower.includes(addedPartLower)) {
      let count = 0;
      let index = 0;
      while ((index = fullTextLower.indexOf(addedPartLower, index)) !== -1) {
        count++;
        index += addedPartLower.length;
      }
      if (count >= 2) {
        return true;
      }
    }
    
    return false;
  }
  
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation based on common words
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }
  
  private lastLanguageCheck: string = '';
  private lastLanguageCheckTime: number = 0;
  private lowConfidenceCount: number = 0;
  private languageMismatchCount: number = 0;
  private lastLowConfidenceText: string = '';
  
  private checkLanguageByConfidence(confidence: number, text: string, currentLanguage: string): void {
    if (!text || text.trim().length === 0) {
      return;
    }
    
    // In manual speaker mode, don't perform automatic language switching
    // The user has explicitly chosen which speaker/language to use
    if (this.manualSpeakerMode) {
      return;
    }
    
    // Use the new sophisticated analysis on the full transcript text
    // This analyzes the last 3 words against multiple languages
    const last3WordsAnalysis = this.analyzeLastWordsForLanguage(this.fullTranscriptText || text, 3);
    
    // Also use the simple detection as a fallback
    const detectedLanguage = this.detectLanguageFromText(text);
    
    // Prefer the sophisticated analysis if available
    const finalDetectedLanguage = last3WordsAnalysis.detectedLanguage || detectedLanguage;
    
    if (finalDetectedLanguage) {
      // Always check if detected language differs from current language
      if (finalDetectedLanguage !== currentLanguage) {
        this.languageMismatchCount++;
        console.log(`LANG_MISMATCH: Detected (${finalDetectedLanguage}) != Current (${currentLanguage}), text="${text}", count=${this.languageMismatchCount}, confidence=${confidence.toFixed(3)}, analysisConfidence=${last3WordsAnalysis.confidence.toFixed(3)}`);
        
        // Only switch if we have strong evidence (high analysis confidence OR very low recognition confidence)
        // This prevents switching too frequently on ambiguous cases
        if ((confidence < 0.3 && last3WordsAnalysis.confidence > 0.6) || last3WordsAnalysis.confidence > 0.85) {
          console.log(`LANG_MISMATCH: Strong evidence (recognition: ${confidence.toFixed(3)}, analysis: ${last3WordsAnalysis.confidence.toFixed(3)}) + language mismatch - switching to ${finalDetectedLanguage}`);
          this.checkAndSwitchLanguage(finalDetectedLanguage);
          this.languageMismatchCount = 0;
          this.lowConfidenceCount = 0;
          return;
        }
        
        // If we detected a language change point, switch immediately
        if (last3WordsAnalysis.changePoint > 0) {
          console.log(`LANG_MISMATCH: Language change detected at word ${last3WordsAnalysis.changePoint} - switching to ${finalDetectedLanguage}`);
          this.checkAndSwitchLanguage(finalDetectedLanguage);
          this.languageMismatchCount = 0;
          this.lowConfidenceCount = 0;
          return;
        }
        
        // Even with higher confidence, if we consistently detect different language, switch
        // But require more consistent mismatches to avoid switching too frequently
        if (this.languageMismatchCount >= 3 && last3WordsAnalysis.confidence > 0.6) {
          console.log(`LANG_MISMATCH: Consistent mismatch (${this.languageMismatchCount} times) + analysis confidence (${last3WordsAnalysis.confidence.toFixed(3)}) - switching to ${finalDetectedLanguage}`);
          this.checkAndSwitchLanguage(finalDetectedLanguage);
          this.languageMismatchCount = 0;
          this.lowConfidenceCount = 0;
          return;
        }
      } else if (finalDetectedLanguage === currentLanguage) {
        // Language matches - reset mismatch counter
        if (this.languageMismatchCount > 0) {
          console.log(`LANG_MATCH: Language matches (${currentLanguage}), resetting mismatch counter`);
          this.languageMismatchCount = 0;
        }
      }
    }
    
    // Low confidence suggests wrong language
    if (confidence < 0.6) {
      this.lowConfidenceCount++;
      this.lastLowConfidenceText = text;
      
      console.log(`LOW_CONFIDENCE: confidence=${confidence.toFixed(3)}, text="${text}", currentLang=${currentLanguage}, count=${this.lowConfidenceCount}`);
      
      // If confidence is VERY low (like 0.010), check if the detected language is different
      // Only switch if we're confident the detected language is correct
      if (confidence < 0.1 && this.lowConfidenceCount >= 2) {
        // Use sophisticated analysis to determine the correct language
        const last3WordsAnalysis = this.analyzeLastWordsForLanguage(text, Math.min(5, text.split(/\s+/).length));
        const detectedLanguage = this.detectLanguageFromText(text);
        
        // Only switch if analysis strongly suggests a different language
        if (last3WordsAnalysis.detectedLanguage && last3WordsAnalysis.detectedLanguage !== currentLanguage && last3WordsAnalysis.confidence > 0.8) {
          console.log(`LOW_CONFIDENCE: Very low confidence (${confidence.toFixed(3)}) + high analysis confidence (${last3WordsAnalysis.confidence.toFixed(3)}) - switching to ${last3WordsAnalysis.detectedLanguage}`);
          this.checkAndSwitchLanguage(last3WordsAnalysis.detectedLanguage);
          this.lowConfidenceCount = 0;
          this.languageMismatchCount = 0;
          return;
        } else if (detectedLanguage && detectedLanguage !== currentLanguage) {
          // Fallback to simple detection
          const detectedLangType = detectedLanguage.startsWith('he-') || detectedLanguage.startsWith('iw-') ? 'hebrew' : 
                                  detectedLanguage.startsWith('en-') ? 'english' : 
                                  detectedLanguage.startsWith('ar-') ? 'arabic' : 'unknown';
          const currentLangType = currentLanguage.startsWith('he-') || currentLanguage.startsWith('iw-') ? 'hebrew' : 
                                 currentLanguage.startsWith('en-') ? 'english' : 
                                 currentLanguage.startsWith('ar-') ? 'arabic' : 'unknown';
          
          // Only switch if language types are different (e.g., Hebrew vs English)
          if (detectedLangType !== currentLangType && detectedLangType !== 'unknown') {
            console.log(`LOW_CONFIDENCE: Very low confidence (${confidence.toFixed(3)}) + language type mismatch (${currentLangType} -> ${detectedLangType}) - switching to ${detectedLanguage}`);
            this.checkAndSwitchLanguage(detectedLanguage);
            this.lowConfidenceCount = 0;
            this.languageMismatchCount = 0;
            return;
          }
        }
      }
      
      // If we have multiple low confidence results, use the sophisticated analysis
      // But require higher confidence from analysis to avoid false switches
      if (this.lowConfidenceCount >= 3) {
        const last3WordsAnalysisForLowConf = this.analyzeLastWordsForLanguage(text, Math.min(5, text.split(/\s+/).length));
        if (last3WordsAnalysisForLowConf.detectedLanguage && last3WordsAnalysisForLowConf.detectedLanguage !== currentLanguage && last3WordsAnalysisForLowConf.confidence > 0.7) {
          console.log(`LOW_CONFIDENCE: Multiple low confidence (${this.lowConfidenceCount}) + high analysis confidence (${last3WordsAnalysisForLowConf.confidence.toFixed(3)}) - switching to ${last3WordsAnalysisForLowConf.detectedLanguage}`);
          this.checkAndSwitchLanguage(last3WordsAnalysisForLowConf.detectedLanguage);
          this.lowConfidenceCount = 0;
          this.languageMismatchCount = 0;
        } else if (detectedLanguage && detectedLanguage !== currentLanguage) {
          // Check if language types are different
          const detectedLangType = detectedLanguage.startsWith('he-') || detectedLanguage.startsWith('iw-') ? 'hebrew' : 
                                  detectedLanguage.startsWith('en-') ? 'english' : 
                                  detectedLanguage.startsWith('ar-') ? 'arabic' : 'unknown';
          const currentLangType = currentLanguage.startsWith('he-') || currentLanguage.startsWith('iw-') ? 'hebrew' : 
                                 currentLanguage.startsWith('en-') ? 'english' : 
                                 currentLanguage.startsWith('ar-') ? 'arabic' : 'unknown';
          
          if (detectedLangType !== currentLangType && detectedLangType !== 'unknown') {
            console.log(`LOW_CONFIDENCE: Multiple low confidence (${this.lowConfidenceCount}) + language type mismatch (${currentLangType} -> ${detectedLangType}) - switching to ${detectedLanguage}`);
            this.checkAndSwitchLanguage(detectedLanguage);
            this.lowConfidenceCount = 0;
            this.languageMismatchCount = 0;
          }
        }
      }
    } else if (confidence >= 0.7) {
      // High confidence - reset the counter if language matches
      if (finalDetectedLanguage === currentLanguage && this.lowConfidenceCount > 0) {
        console.log(`HIGH_CONFIDENCE: confidence=${confidence.toFixed(3)}, language matches - resetting counters`);
        this.lowConfidenceCount = 0;
      }
    }
  }
  
  private checkAndSwitchLanguage(detectedLanguage: string): void {
    if (!detectedLanguage || !this.isListening) {
      return;
    }
    
    // In manual speaker mode, don't perform automatic language switching
    // The user has explicitly chosen which speaker/language to use
    if (this.manualSpeakerMode) {
      return;
    }
    
    // Prevent checking too frequently (debounce)
    const now = Date.now();
    if (this.lastLanguageCheck === detectedLanguage && (now - this.lastLanguageCheckTime) < 500) {
      return; // Same language check within 500ms, skip
    }
    this.lastLanguageCheck = detectedLanguage;
    this.lastLanguageCheckTime = now;
    
    // Determine which language should be used for recognition
    let targetLanguage: string | null = null;
    
    // Check if detected language matches language A
    if (detectedLanguage === this.selectedLanguageA ||
        (detectedLanguage.startsWith('he-') && this.selectedLanguageA.startsWith('he-')) ||
        (detectedLanguage.startsWith('ar-') && this.selectedLanguageA.startsWith('ar-')) ||
        (detectedLanguage.startsWith('iw-') && this.selectedLanguageA.startsWith('iw-'))) {
      targetLanguage = this.selectedLanguageA;
    }
    // Check if detected language matches language B
    else if (detectedLanguage === this.selectedLanguageB ||
             (detectedLanguage.startsWith('en-') && this.selectedLanguageB.startsWith('en-')) ||
             (detectedLanguage.startsWith('ar-') && this.selectedLanguageB.startsWith('ar-'))) {
      targetLanguage = this.selectedLanguageB;
    }
    
    // If we found a target language, check if we need to switch
    if (targetLanguage) {
      const currentLanguage = this.speechRecognitionService.getLanguageA();
      
      // Check if we need to switch
      if (currentLanguage !== targetLanguage) {
        console.log(`CHECK_LANG: Switch needed: ${currentLanguage} -> ${targetLanguage} (detected: ${detectedLanguage})`);
        this.speechRecognitionService.switchRecognitionLanguage(targetLanguage);
        this.lowConfidenceCount = 0; // Reset counters after switch
        this.languageMismatchCount = 0;
      } else {
        console.log(`CHECK_LANG: No switch needed, already using ${currentLanguage}`);
      }
    } else {
      console.log(`CHECK_LANG: No target language found for detected: ${detectedLanguage}`);
    }
  }
  
  private lastFullTextLength: number = 0;
  
  private checkFullTextLanguage(): void {
    // Check the dominant language in the full text
    if (!this.fullTranscriptText || this.fullTranscriptText.trim().length === 0) {
      return;
    }
    
    // In manual speaker mode, don't perform automatic language switching
    // The user has explicitly chosen which speaker/language to use
    if (this.manualSpeakerMode) {
      return;
    }
    
    // NEW APPROACH: Analyze the last 3 words against multiple languages
    // This helps detect language changes more accurately
    const last3WordsAnalysis = this.analyzeLastWordsForLanguage(this.fullTranscriptText, 3);
    
    if (last3WordsAnalysis.detectedLanguage) {
      console.log(`CHECK_FULL_LANG: Last 3 words analysis - Detected: ${last3WordsAnalysis.detectedLanguage}, Confidence: ${last3WordsAnalysis.confidence.toFixed(3)}, ChangePoint: ${last3WordsAnalysis.changePoint}`);
      
      // If confidence is high or we detected a language change, switch
      if (last3WordsAnalysis.confidence > 0.6 || last3WordsAnalysis.changePoint > 0) {
        this.checkAndSwitchLanguage(last3WordsAnalysis.detectedLanguage);
      }
    } else {
      // Fallback: use the old method
      const currentLength = this.fullTranscriptText.length;
      const newPart = currentLength > this.lastFullTextLength 
        ? this.fullTranscriptText.slice(this.lastFullTextLength).trim()
        : this.fullTranscriptText.slice(-30).trim();
      
      this.lastFullTextLength = currentLength;
      
      if (newPart && newPart.length > 0) {
        console.log(`CHECK_FULL_LANG: Fallback - Checking new part: "${newPart}"`);
        const detectedLanguage = this.detectLanguageFromText(newPart);
        console.log(`CHECK_FULL_LANG: Fallback - Detected language: ${detectedLanguage}`);
        
        if (detectedLanguage) {
          this.checkAndSwitchLanguage(detectedLanguage);
        }
      }
    }
  }
  
  /**
   * Analyzes the last N words of the text against multiple languages to determine
   * the most likely language and the exact point where language changed.
   * This is more sophisticated than simple character pattern matching.
   */
  private analyzeLastWordsForLanguage(text: string, wordCount: number = 3): {
    detectedLanguage: string | null;
    confidence: number;
    changePoint: number; // Index in words where language changed (0 = no change)
  } {
    if (!text || text.trim().length === 0) {
      return { detectedLanguage: null, confidence: 0, changePoint: 0 };
    }
    
    const cleanText = text.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return { detectedLanguage: null, confidence: 0, changePoint: 0 };
    }
    
    // Get the last N words
    const lastWords = words.slice(-wordCount);
    if (lastWords.length === 0) {
      return { detectedLanguage: null, confidence: 0, changePoint: 0 };
    }
    
    // Helper function to get the matching language code from selected languages
    const getMatchingLanguageCode = (languageType: 'he' | 'en' | 'ar'): string => {
      if (languageType === 'he') {
        if (this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-')) {
          return this.selectedLanguageA;
        }
        if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
          return this.selectedLanguageB;
        }
        return 'he-IL';
      } else if (languageType === 'en') {
        if (this.selectedLanguageA.startsWith('en-')) {
          return this.selectedLanguageA;
        }
        if (this.selectedLanguageB.startsWith('en-')) {
          return this.selectedLanguageB;
        }
        return 'en-US';
      } else if (languageType === 'ar') {
        if (this.selectedLanguageA.startsWith('ar-')) {
          return this.selectedLanguageA;
        }
        if (this.selectedLanguageB.startsWith('ar-')) {
          return this.selectedLanguageB;
        }
        return 'ar-SA';
      }
      return '';
    };

    // Define language patterns for multiple languages
    const languagePatterns = [
      {
        name: 'hebrew',
        codes: ['he-IL', 'iw-IL'],
        pattern: /[\u0590-\u05FF]/,
        countPattern: /[\u0590-\u05FF]/g,
        selectedCode: getMatchingLanguageCode('he')
      },
      {
        name: 'english',
        codes: ['en-US', 'en-GB'],
        pattern: /[a-zA-Z]/,
        countPattern: /[a-zA-Z]/g,
        selectedCode: getMatchingLanguageCode('en')
      },
      {
        name: 'arabic',
        codes: ['ar-SA', 'ar-EG', 'ar-IL'],
        pattern: /[\u0600-\u06FF]/,
        countPattern: /[\u0600-\u06FF]/g,
        selectedCode: getMatchingLanguageCode('ar')
      },
      {
        name: 'french',
        codes: ['fr-FR'],
        pattern: /[a-zA-Zàâäéèêëïîôùûüÿç]/,
        countPattern: /[a-zA-Zàâäéèêëïîôùûüÿç]/g,
        selectedCode: 'fr-FR'
      },
      {
        name: 'spanish',
        codes: ['es-ES', 'es-MX'],
        pattern: /[a-zA-Záéíóúñü]/,
        countPattern: /[a-zA-Záéíóúñü]/g,
        selectedCode: 'es-ES'
      },
      {
        name: 'german',
        codes: ['de-DE'],
        pattern: /[a-zA-Zäöüß]/,
        countPattern: /[a-zA-Zäöüß]/g,
        selectedCode: 'de-DE'
      },
      {
        name: 'russian',
        codes: ['ru-RU'],
        pattern: /[\u0400-\u04FF]/,
        countPattern: /[\u0400-\u04FF]/g,
        selectedCode: 'ru-RU'
      },
      {
        name: 'chinese',
        codes: ['zh-CN', 'zh-TW'],
        pattern: /[\u4E00-\u9FFF]/,
        countPattern: /[\u4E00-\u9FFF]/g,
        selectedCode: 'zh-CN'
      },
      {
        name: 'japanese',
        codes: ['ja-JP'],
        pattern: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/,
        countPattern: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g,
        selectedCode: 'ja-JP'
      },
      {
        name: 'korean',
        codes: ['ko-KR'],
        pattern: /[\uAC00-\uD7AF]/,
        countPattern: /[\uAC00-\uD7AF]/g,
        selectedCode: 'ko-KR'
      }
    ];
    
    // Analyze each word individually
    const wordScores: Array<{ word: string; language: string; score: number }> = [];
    
    for (const word of lastWords) {
      const wordScoresForWord: { [lang: string]: number } = {};
      
      for (const langPattern of languagePatterns) {
        const matches = word.match(langPattern.countPattern);
        const matchCount = matches ? matches.length : 0;
        const totalChars = word.replace(/[\s.,!?'"-]/g, '').length;
        
        if (totalChars > 0) {
          // Score based on percentage of matching characters
          const score = matchCount / totalChars;
          wordScoresForWord[langPattern.name] = score;
        }
      }
      
      // Find the best matching language for this word
      let bestLang = '';
      let bestScore = 0;
      for (const [lang, score] of Object.entries(wordScoresForWord)) {
        if (score > bestScore) {
          bestScore = score;
          bestLang = lang;
        }
      }
      
      if (bestLang && bestScore > 0.5) {
        const langPattern = languagePatterns.find(lp => lp.name === bestLang);
        if (langPattern) {
          wordScores.push({
            word: word,
            language: langPattern.selectedCode,
            score: bestScore
          });
        }
      }
    }
    
    if (wordScores.length === 0) {
      return { detectedLanguage: null, confidence: 0, changePoint: 0 };
    }
    
    // Find the dominant language in the last words
    const languageCounts: { [lang: string]: { count: number; totalScore: number } } = {};
    
    for (const ws of wordScores) {
      if (!languageCounts[ws.language]) {
        languageCounts[ws.language] = { count: 0, totalScore: 0 };
      }
      languageCounts[ws.language].count++;
      languageCounts[ws.language].totalScore += ws.score;
    }
    
    // Find the language with highest count and score
    let bestLanguage = '';
    let bestCount = 0;
    let bestTotalScore = 0;
    
    for (const [lang, data] of Object.entries(languageCounts)) {
      if (data.count > bestCount || (data.count === bestCount && data.totalScore > bestTotalScore)) {
        bestCount = data.count;
        bestTotalScore = data.totalScore;
        bestLanguage = lang;
      }
    }
    
    // Calculate confidence (average score of words in the best language)
    const confidence = bestLanguage && bestCount > 0 
      ? languageCounts[bestLanguage].totalScore / bestCount 
      : 0;
    
    // Find the change point: where did the language change?
    // Look backwards from the last word to find where language changed
    let changePoint = 0;
    if (wordScores.length > 1 && bestLanguage) {
      // Check if all words are in the same language
      const allSameLanguage = wordScores.every(ws => ws.language === bestLanguage);
      
      if (!allSameLanguage) {
        // Find the first word (from the end) that's in a different language
        for (let i = wordScores.length - 1; i >= 0; i--) {
          if (wordScores[i].language !== bestLanguage) {
            changePoint = i + 1; // Language changed after this word
            break;
          }
        }
      }
    }
    
    // Only return a language if it matches one of our selected languages
    const matchesLanguageA = bestLanguage === this.selectedLanguageA ||
      (bestLanguage.startsWith('he-') && this.selectedLanguageA.startsWith('he-')) ||
      (bestLanguage.startsWith('iw-') && this.selectedLanguageA.startsWith('iw-')) ||
      (bestLanguage.startsWith('ar-') && this.selectedLanguageA.startsWith('ar-')) ||
      (bestLanguage.startsWith('en-') && this.selectedLanguageA.startsWith('en-'));
    
    const matchesLanguageB = bestLanguage === this.selectedLanguageB ||
      (bestLanguage.startsWith('he-') && this.selectedLanguageB.startsWith('he-')) ||
      (bestLanguage.startsWith('iw-') && this.selectedLanguageB.startsWith('iw-')) ||
      (bestLanguage.startsWith('ar-') && this.selectedLanguageB.startsWith('ar-')) ||
      (bestLanguage.startsWith('en-') && this.selectedLanguageB.startsWith('en-'));
    
    if (matchesLanguageA || matchesLanguageB) {
      return {
        detectedLanguage: bestLanguage,
        confidence: confidence,
        changePoint: changePoint
      };
    }
    
    return { detectedLanguage: null, confidence: 0, changePoint: 0 };
  }
  
  /**
   * Removes overlapping words from new text that match previous text
   * Handles three cases:
   * 1. Previous text appears at the start of new text
   * 2. Previous text appears at the end of new text
   * 3. Previous text appears anywhere inside new text (full containment)
   * Returns only the new part without duplicates
   */
  private removeOverlappingWords(previousText: string, newText: string): string {
    if (!previousText || !newText) {
      return newText;
    }
    
    // Normalize texts - split into words, ignore empty strings
    const previousWords = previousText.trim().split(/\s+/).filter(w => w.length > 0);
    const newWords = newText.trim().split(/\s+/).filter(w => w.length > 0);
    
    if (previousWords.length === 0 || newWords.length === 0) {
      return newText;
    }
    
    // Case 1: Check if previous text appears at the start of new text
    if (newWords.length >= previousWords.length) {
      const newStart = newWords.slice(0, previousWords.length);
      let matchesStart = true;
      for (let i = 0; i < previousWords.length; i++) {
        if (previousWords[i].toLowerCase() !== newStart[i].toLowerCase()) {
          matchesStart = false;
          break;
        }
      }
      if (matchesStart) {
        const remainingWords = newWords.slice(previousWords.length);
        const result = remainingWords.join(' ');
        console.log(`REMOVE_OVERLAP: Previous text found at start, removed. Previous: "${previousText}", New: "${newText}", Result: "${result}"`);
        return result;
      }
    }
    
    // Case 2: Check if previous text appears at the end of new text
    if (newWords.length >= previousWords.length) {
      const newEnd = newWords.slice(-previousWords.length);
      let matchesEnd = true;
      for (let i = 0; i < previousWords.length; i++) {
        if (previousWords[i].toLowerCase() !== newEnd[i].toLowerCase()) {
          matchesEnd = false;
          break;
        }
      }
      if (matchesEnd) {
        const remainingWords = newWords.slice(0, newWords.length - previousWords.length);
        const result = remainingWords.join(' ');
        console.log(`REMOVE_OVERLAP: Previous text found at end, removed. Previous: "${previousText}", New: "${newText}", Result: "${result}"`);
        return result;
      }
    }
    
    // Case 3: Check if previous text appears anywhere inside new text (full containment)
    // This handles cases like: previous="היי", new="זה היי מה נשמע"
    if (newWords.length > previousWords.length) {
      // Try to find the previous text sequence anywhere in the new text
      for (let startIdx = 0; startIdx <= newWords.length - previousWords.length; startIdx++) {
        const candidate = newWords.slice(startIdx, startIdx + previousWords.length);
        let matches = true;
        for (let i = 0; i < previousWords.length; i++) {
          if (previousWords[i].toLowerCase() !== candidate[i].toLowerCase()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          // Found the previous text inside new text - remove it
          const before = newWords.slice(0, startIdx);
          const after = newWords.slice(startIdx + previousWords.length);
          const result = [...before, ...after].join(' ').trim();
          console.log(`REMOVE_OVERLAP: Previous text found inside, removed. Previous: "${previousText}", New: "${newText}", Result: "${result}"`);
          return result || newText; // If result is empty, return original (shouldn't happen)
        }
      }
    }
    
    // Case 4: Check for partial overlap at start (last N words of previous match first N words of new)
    let maxOverlap = 0;
    const maxCheckLength = Math.min(previousWords.length, newWords.length);
    
    for (let overlap = 1; overlap <= maxCheckLength; overlap++) {
      // Check if the last 'overlap' words of previousText match the first 'overlap' words of newText
      const previousEnd = previousWords.slice(-overlap);
      const newStart = newWords.slice(0, overlap);
      
      // Compare word by word (case-insensitive for better matching)
      let matches = true;
      for (let i = 0; i < overlap; i++) {
        if (previousEnd[i].toLowerCase() !== newStart[i].toLowerCase()) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        maxOverlap = overlap;
      } else {
        // Once we find a mismatch, we can stop (we want the maximum continuous overlap)
        break;
      }
    }
    
    // If we found an overlap, remove those words from the beginning of newText
    if (maxOverlap > 0) {
      const remainingWords = newWords.slice(maxOverlap);
      const result = remainingWords.join(' ');
      console.log(`REMOVE_OVERLAP: Found ${maxOverlap} overlapping words at boundary, removed from start. Previous: "${previousText}", New: "${newText}", Result: "${result}"`);
      return result;
    }
    
    // No overlap found, return the new text as is
    return newText;
  }

  /**
   * Adds the current fullTranscriptText to history as a new line(s)
   * This is used when there's a speech gap - we want to save the current text
   * and start a new line, without deleting existing history
   */
  private addCurrentTextToHistoryAsNewLine(): void {
    if (!this.fullTranscriptText || this.fullTranscriptText.trim().length === 0) {
      return;
    }

    // IMPORTANT: Remove ALL live segments first (they are only for display, not saved)
    // Keep only saved history (savedHistoryCount)
    if (this.transcriptHistory.length > this.savedHistoryCount) {
      this.transcriptHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
    }

    // Get the text to save - save it as is
    const textToSave = this.fullTranscriptText.trim();

    // Check if we have at least 2 words before saving
    const words = textToSave.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length < this.MIN_BUFFER_WORDS) {
      console.log(`MIN_WORDS: Text has only ${words.length} word(s), need at least ${this.MIN_BUFFER_WORDS}, skipping save`);
      return;
    }

    // Check if this text is identical to the last saved entry (prevent exact duplicates)
    if (this.transcriptHistory.length > 0) {
      const lastEntry = this.transcriptHistory[this.transcriptHistory.length - 1];
      if (lastEntry.speaker === this.currentSpeaker && lastEntry.text && lastEntry.text.trim().toLowerCase() === textToSave.trim().toLowerCase()) {
        console.log('EXACT_DUPLICATE: Text is identical to last entry, skipping save');
        return;
      }
    }

    // Save the text as a single entry under the current manual speaker
    const language = this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
    this.historyIdCounter++;
    this.transcriptHistory.push({
      speaker: this.currentSpeaker,
      text: textToSave.trim(),
      language: language,
      id: this.historyIdCounter
    });
    
    // Update saved history count - this is now the new saved count
    this.savedHistoryCount = this.transcriptHistory.length;
    
    // Remove duplicate messages from the same speaker
    this.removeConsecutiveDuplicateMessages();
    
    // Fix language detection errors retroactively
    this.fixLanguageDetectionErrors();
  }
  
  // Track the number of saved history entries (from speech gaps)
  private savedHistoryCount: number = 0;
  
  private updateHistoryFromFullText(): void {
    // Don't update history or create spinners when paused
    if (this.isPaused) {
      return;
    }
    
    // Get saved history (lines that were already saved after gaps)
    const savedHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
    const language = this.currentSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
    
    // If text is empty, show spinner if not paused
    if (!this.fullTranscriptText || this.fullTranscriptText.trim().length === 0) {
      // Remove any live segments (including waiting lines)
      if (this.transcriptHistory.length > this.savedHistoryCount) {
        this.transcriptHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
      }
      // If there's no waiting line, create one (spinner) as a LIVE segment (not saved)
      if (!this.isPaused) {
        const lastEntry = this.transcriptHistory.length > 0 ? this.transcriptHistory[this.transcriptHistory.length - 1] : null;
        if (!lastEntry || !lastEntry.isWaiting) {
          this.historyIdCounter++;
          this.lastEmptyLineId = this.historyIdCounter;
          // IMPORTANT: This is a LIVE segment (id > savedHistoryCount), it will NOT be saved
          this.transcriptHistory.push({
            speaker: this.currentSpeaker,
            text: '',
            language: language,
            id: this.lastEmptyLineId,
            isWaiting: true
          });
          // DO NOT update savedHistoryCount - this is a live segment
        }
      }
      return;
    }
    
    // We have text - show it immediately (no minimum word requirement)
    // Remove any waiting lines from saved history
    const filteredHistory = savedHistory.filter(item => !item.isWaiting);
    
    // For live segments, don't remove overlapping words - just show the full text as is
    // Overlap removal only happens when saving after a gap (in addCurrentTextToHistoryAsNewLine)
    const textToDisplay = this.fullTranscriptText.trim();
    
    // Always have exactly ONE live segment that gets updated
    // Remove any existing live segments first (they are only for display, not saved)
    // Keep only saved history, then add/update the single live segment
    const liveSegmentId = this.savedHistoryCount + 1;
    
    // Check if there's already a live segment for this speaker
    const hasLiveSegment = this.transcriptHistory.length > this.savedHistoryCount;
    const existingLiveSegment = hasLiveSegment ? this.transcriptHistory[this.transcriptHistory.length - 1] : null;
    
    if (existingLiveSegment && existingLiveSegment.speaker === this.currentSpeaker) {
      // Update existing live segment with full text
      // IMPORTANT: Remove isWaiting flag since we have text now
      this.transcriptHistory = [...filteredHistory, {
        ...existingLiveSegment,
        text: textToDisplay,
        language: language,
        isWaiting: false // Remove waiting flag since we have text
      }];
      console.log(`UPDATE_HISTORY: Updated existing live segment: "${textToDisplay}"`);
    } else {
      // Create new live segment with full text
      // IMPORTANT: This is a live segment (id > savedHistoryCount), it will NOT be saved
      this.transcriptHistory = [...filteredHistory, {
        speaker: this.currentSpeaker,
        text: textToDisplay,
        language: language,
        id: liveSegmentId,
        isWaiting: false // Not waiting since we have text
      }];
      console.log(`UPDATE_HISTORY: Created new live segment: "${textToDisplay}"`);
    }
    // Clear lastEmptyLineId since we're not using a waiting line anymore
    this.lastEmptyLineId = null;
    
    // Don't call removeConsecutiveDuplicateMessages or fixLanguageDetectionErrors here
    // These should only be called when saving text after a gap, not during live updates
  }

  onSpeakerToggle(newSpeaker: 'A' | 'B'): void {
    if (newSpeaker !== this.currentSpeaker) {
      console.log(`SPEAKER_SWITCH: Switching from ${this.currentSpeaker} to ${newSpeaker}`);
      
      // Save whether we were listening before switching
      const wasListening = this.isListening && !this.isPaused;
      
      // CRITICAL: Stop current recognition first to prevent mixed text
      // This ensures we get a clean restart with the new speaker
      if (wasListening) {
        console.log('SPEAKER_SWITCH: Stopping recognition to prevent mixed text...');
        this.speechRecognitionService.stopListening();
      }
      
      // Perform the switch immediately (or after a brief delay if we stopped)
      const performSwitch = () => {
        this.performSpeakerSwitch(newSpeaker, wasListening);
      };
      
      if (wasListening) {
        // Wait a moment for recognition to fully stop before switching
        setTimeout(performSwitch, 150);
      } else {
        performSwitch();
      }
    }
  }
  
  private performSpeakerSwitch(newSpeaker: 'A' | 'B', wasListening: boolean): void {
    // Finalize current accumulated text under the previous speaker before switching
    if (this.fullTranscriptText && this.fullTranscriptText.trim().length > 0) {
      this.addCurrentTextToHistoryAsNewLine();
    }
    
    // CRITICAL: Always reset ALL transcript state variables when switching speakers
    // This prevents any text from the previous speaker from appearing in the new speaker's line
    this.fullTranscriptText = '';
    this.lastAddedWords = [];
    this.lastFullTextLength = 0;
    this.lastResultTime = 0;
    this.lastSavedText = '';
    this.lastEmptyLineId = null;
    
    // Start a fresh buffering window for the new speaker
    this.bufferingActive = true;
    this.utteranceStartTime = Date.now();
    
    // Update current speaker
    this.currentSpeaker = newSpeaker;
    
    // Update or create spinner for the new speaker
    // IMPORTANT: Always remove ALL live segments (with text or waiting) when switching speakers
    // This ensures clean state for the new speaker
    const savedHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
    const newLanguage = newSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
    
    // Always create a fresh waiting line for the new speaker
    // Remove any existing live segments first (both with text and waiting)
    this.historyIdCounter++;
    this.lastEmptyLineId = this.historyIdCounter;
    this.transcriptHistory = [...savedHistory, {
      speaker: newSpeaker,
      text: '',
      language: newLanguage,
      id: this.lastEmptyLineId,
      isWaiting: true
    }];
    // DO NOT update savedHistoryCount - this is a live segment
    
    // Restart recognition with the new speaker's language
    const targetLanguage = newSpeaker === 'A' ? this.selectedLanguageA : this.selectedLanguageB;
    console.log(`SPEAKER_SWITCH: Restarting recognition with language ${targetLanguage} for speaker ${newSpeaker}`);
    
    // If we were listening, restart with the new language
    if (wasListening) {
      // Restart listening with the new language
      this.speechRecognitionService.startListening(this.selectedLanguageA, this.selectedLanguageB);
      
      // Switch to the target language after a brief delay
      setTimeout(() => {
        this.speechRecognitionService.switchRecognitionLanguage(targetLanguage);
      }, 200);
    }
    
    this.cdr.detectChanges();
  }
  
  /**
   * Fixes language detection errors retroactively
   * Checks if text was assigned to the wrong speaker based on actual text content
   * For example: "shalom" should be Hebrew (speaker B) not English (speaker A)
   */
  private fixLanguageDetectionErrors(): void {
    if (this.manualSpeakerMode) {
      return;
    }
    if (this.transcriptHistory.length === 0) {
      return;
    }
    
    let fixed = false;
    
    // Common Hebrew words that might be transcribed as English
    const hebrewWordsInEnglish: { [key: string]: string } = {
      'shalom': 'שלום',
      'ma': 'מה',
      'nishma': 'נשמע',
      'shlomcha': 'שלומך',
      'shlomech': 'שלומך',
      'shlom': 'שלום',
      'tov': 'טוב',
      'ken': 'כן',
      'lo': 'לא',
      'ani': 'אני',
      'ata': 'אתה',
      'at': 'את',
      'hu': 'הוא',
      'hi': 'היא',
      'anachnu': 'אנחנו',
      'atem': 'אתם',
      'hen': 'הן',
      'ze': 'זה',
      'zot': 'זאת',
      'eich': 'איך',
      'lama': 'למה',
      'eifo': 'איפה',
      'matai': 'מתי',
      'kama': 'כמה',
      'maher': 'מהר',
      'lent': 'לאט',
      'yoter': 'יותר',
      'pachot': 'פחות',
      'gam': 'גם',
      'aval': 'אבל',
      'od': 'עוד',
      'rak': 'רק',
      'kol': 'כל',
      'echad': 'אחד',
      'shtaim': 'שתיים',
      'shalosh': 'שלוש',
      'arba': 'ארבע',
      'chamesh': 'חמש',
      'shesh': 'שש',
      'sheva': 'שבע',
      'shmone': 'שמונה',
      'tesha': 'תשע',
      'eser': 'עשר',
      'boker': 'בוקר',
      'erev': 'ערב',
      'layla': 'לילה',
      'yom': 'יום',
      'shavua': 'שבוע',
      'chodesh': 'חודש',
      'shana': 'שנה',
      'achshav': 'עכשיו',
      'az': 'אז',
      'acharei': 'אחרי',
      'lifnei': 'לפני',
      'asher': 'אשר',
      'shel': 'של',
      'oto': 'אותו',
      'ota': 'אותה',
      'otam': 'אותם',
      'otan': 'אותן',
      'yafe': 'יפה',
      'ra': 'רע',
      'gadol': 'גדול',
      'katan': 'קטן',
      'chadash': 'חדש',
      'yashan': 'ישן',
      'cham': 'חם',
      'kar': 'קר',
      'chashuv': 'חשוב',
      'mutzlach': 'מוצלח',
      'mazal': 'מזל',
      'toda': 'תודה',
      'bevakasha': 'בבקשה',
      'slicha': 'סליחה'
    };
    
    for (let i = 0; i < this.transcriptHistory.length; i++) {
      const entry = this.transcriptHistory[i];
      const text = entry.text.trim().toLowerCase();
      
      if (!text || text.length === 0) {
        continue;
      }

      // If entry is labeled Hebrew but contains no Hebrew chars and has Latin chars — correct to English speaker
      const hasHebrewCharsQuick = /[\u0590-\u05FF]/.test(entry.text);
      const hasLatinCharsQuick = /[a-zA-Z]/.test(entry.text);
      if (!hasHebrewCharsQuick && hasLatinCharsQuick && (entry.language.startsWith('he-') || entry.language.startsWith('iw-'))) {
        const englishLangQuick = this.selectedLanguageA.startsWith('en-')
          ? this.selectedLanguageA
          : (this.selectedLanguageB.startsWith('en-') ? this.selectedLanguageB : 'en-US');
        const englishSpeakerQuick = this.getSpeakerForLanguage(englishLangQuick);
        console.log(`FIX_LANG: Latin-only text wrongly assigned to Hebrew -> switching to ${englishSpeakerQuick} (${englishLangQuick}) for "${entry.text.substring(0, 30)}..."`);
        entry.language = englishLangQuick;
        entry.speaker = englishSpeakerQuick;
        fixed = true;
        continue;
      }
      
      // Check if text contains Hebrew words transcribed as English
      // If speaker B is Hebrew and text contains Hebrew words in English, it's likely Hebrew
      if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
        const words = text.split(/\s+/);
        let hebrewWordCount = 0;
        
        // Check for common Hebrew phrases
        const hebrewPhrases = [
          'ma nishma', 'מה נשמע',
          'ma shlomcha', 'מה שלומך',
          'ma shlomech', 'מה שלומך',
          'ma kore', 'מה קורה',
          'eich kore', 'איך קורה',
          'eich ze', 'איך זה',
          'ma ze', 'מה זה',
          'ma kara', 'מה קרה',
          'eich at', 'איך את',
          'eich ata', 'איך אתה',
          'ma at', 'מה את',
          'ma ata', 'מה אתה'
        ];
        
        // Check for Hebrew phrases (case-insensitive)
        const textLower = text.toLowerCase();
        let hasHebrewPhrase = false;
        for (let j = 0; j < hebrewPhrases.length; j += 2) {
          if (textLower.includes(hebrewPhrases[j])) {
            hasHebrewPhrase = true;
            break;
          }
        }
        
        for (const word of words) {
          const cleanWord = word.replace(/[.,!?'"-]/g, '').toLowerCase();
          if (hebrewWordsInEnglish[cleanWord]) {
            hebrewWordCount++;
          }
        }
        
        // Special case: "shalom" is a very common Hebrew word that might be transcribed as English
        // If the text is just "shalom" or starts with "shalom", it's likely Hebrew
        const isShalom = textLower === 'shalom' || textLower.startsWith('shalom ');
        
        // If text contains Hebrew words/phrases and is assigned to speaker A (English), fix it
        // Require at least 1 Hebrew word (like "shalom") or 2 Hebrew words or 1 Hebrew phrase to avoid false positives
        if ((hebrewWordCount >= 1 || hasHebrewPhrase || isShalom) && entry.speaker === 'A' && entry.language.startsWith('en-')) {
          console.log(`FIX_LANG: Detected Hebrew words/phrases in English text "${entry.text.substring(0, 30)}..." (${hebrewWordCount} words, phrase: ${hasHebrewPhrase}, shalom: ${isShalom}) - fixing to speaker B (Hebrew)`);
          entry.speaker = 'B';
          entry.language = this.selectedLanguageB;
          fixed = true;
          continue;
        }
      }
      
      // Detect the actual language from the text content
      const actualLanguage = this.detectLanguageFromText(entry.text);
      
      if (!actualLanguage) {
        continue; // Can't detect language, skip
      }
      
      // Check if the detected language matches the assigned speaker
      const expectedSpeaker = this.getSpeakerForLanguage(actualLanguage);
      const currentSpeaker = entry.speaker;
      
      // If the actual language doesn't match the current speaker, fix it
      if (expectedSpeaker !== currentSpeaker) {
        // Check if this is a valid fix (language family matches)
        const isLanguageA = actualLanguage === this.selectedLanguageA || 
                           (actualLanguage.startsWith('he-') && this.selectedLanguageA.startsWith('he-')) ||
                           (actualLanguage.startsWith('iw-') && this.selectedLanguageA.startsWith('iw-')) ||
                           (actualLanguage.startsWith('en-') && this.selectedLanguageA.startsWith('en-')) ||
                           (actualLanguage.startsWith('ar-') && this.selectedLanguageA.startsWith('ar-'));
        const isLanguageB = actualLanguage === this.selectedLanguageB || 
                           (actualLanguage.startsWith('he-') && this.selectedLanguageB.startsWith('he-')) ||
                           (actualLanguage.startsWith('iw-') && this.selectedLanguageB.startsWith('iw-')) ||
                           (actualLanguage.startsWith('en-') && this.selectedLanguageB.startsWith('en-')) ||
                           (actualLanguage.startsWith('ar-') && this.selectedLanguageB.startsWith('ar-'));
        
        // Only fix if the detected language matches one of the selected languages
        if ((isLanguageA && expectedSpeaker === 'A') || (isLanguageB && expectedSpeaker === 'B')) {
          console.log(`FIX_LANG: Fixing language detection for "${entry.text.substring(0, 30)}..." - was ${currentSpeaker} (${entry.language}), should be ${expectedSpeaker} (${actualLanguage})`);
          
          // Update the entry
          entry.speaker = expectedSpeaker;
          entry.language = actualLanguage;
          fixed = true;
        }
      }
    }
    
    if (fixed) {
      console.log('FIX_LANG: Fixed language detection errors in history');
      this.cdr.detectChanges();
    }
  }
  
  /**
   * Removes consecutive duplicate messages from the same speaker
   * If the same speaker says the exact same text twice in a row, or if the new text contains the previous text, remove the previous one
   * IMPORTANT: Only processes saved history, not live segments
   */
  private removeConsecutiveDuplicateMessages(): void {
    // Only process saved history (up to savedHistoryCount), not live segments
    if (this.savedHistoryCount < 2) {
      return;
    }
    
    const savedHistory = this.transcriptHistory.slice(0, this.savedHistoryCount);
    const liveSegments = this.transcriptHistory.slice(this.savedHistoryCount);
    
    const filteredHistory: Array<{ speaker: 'A' | 'B', text: string, language: string, id: number, isWaiting?: boolean }> = [];
    
    for (let i = 0; i < savedHistory.length; i++) {
      const current = savedHistory[i];
      const normalizedCurrentText = current.text.trim().toLowerCase();
      
      // Skip empty messages
      if (!normalizedCurrentText || normalizedCurrentText.length === 0) {
        continue;
      }
      
      // Check if this is a duplicate of the previous message from the same speaker
      if (filteredHistory.length > 0) {
        const previous = filteredHistory[filteredHistory.length - 1];
        const normalizedPreviousText = previous.text.trim().toLowerCase();
        
        // If same speaker and same text (case-insensitive), skip this duplicate
        if (previous.speaker === current.speaker && normalizedPreviousText === normalizedCurrentText) {
          console.log(`DUPLICATE_MESSAGE: Removing duplicate message from ${current.speaker}: "${current.text}"`);
          continue;
        }
        
        // If same speaker and current text contains previous text (previous is a prefix), remove the previous one
        // This handles cases like: "שלום קוראים" followed by "שלום קוראים לי נדב"
        if (previous.speaker === current.speaker && normalizedCurrentText.includes(normalizedPreviousText) && normalizedCurrentText.length > normalizedPreviousText.length) {
          console.log(`DUPLICATE_MESSAGE: Removing shorter message that is contained in longer one. Previous: "${previous.text}", Current: "${current.text}"`);
          // Remove the previous one and keep the current (longer) one
          filteredHistory.pop();
        }
      }
      
      // Add the message if it's not a duplicate
      filteredHistory.push(current);
    }
    
    // Update the history with filtered results, keeping live segments
    if (filteredHistory.length !== savedHistory.length) {
      this.transcriptHistory = [...filteredHistory, ...liveSegments];
      // Update saved history count to match filtered saved history
      this.savedHistoryCount = filteredHistory.length;
    }
  }
  
  /**
   * Removes duplicate segments from the array
   * A segment is considered duplicate if it has the same text and language as a previous segment
   * Also checks for consecutive duplicates (same text appearing twice in a row)
   */
  private removeDuplicateSegments(segments: Array<{ text: string, language: string }>): Array<{ text: string, language: string }> {
    const uniqueSegments: Array<{ text: string, language: string }> = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const normalizedText = segment.text.trim().toLowerCase();
      
      // Skip empty segments
      if (!normalizedText || normalizedText.length === 0) {
        continue;
      }
      
      // Check if this segment is a duplicate of the previous one (consecutive duplicate)
      if (uniqueSegments.length > 0) {
        const lastSegment = uniqueSegments[uniqueSegments.length - 1];
        const lastNormalizedText = lastSegment.text.trim().toLowerCase();
        
        // If same text and language as previous segment, skip it
        if (normalizedText === lastNormalizedText && segment.language === lastSegment.language) {
          console.log(`DUPLICATE_SEGMENT: Skipping consecutive duplicate: "${segment.text}" (${segment.language})`);
          continue;
        }
      }
      
      // Check if this segment text already exists in the array (non-consecutive duplicate)
      // Only check for significant duplicates (more than 3 words)
      const segmentWords = normalizedText.split(/\s+/).filter(w => w.length > 0);
      if (segmentWords.length > 3) {
        const isDuplicate = uniqueSegments.some(existing => {
          const existingNormalized = existing.text.trim().toLowerCase();
          return existingNormalized === normalizedText && existing.language === segment.language;
        });
        
        if (isDuplicate) {
          console.log(`DUPLICATE_SEGMENT: Skipping non-consecutive duplicate: "${segment.text}" (${segment.language})`);
          continue;
        }
      }
      
      // Add the segment
      uniqueSegments.push(segment);
    }
    
    return uniqueSegments;
  }
  
  private splitTextByLanguage(text: string): Array<{ text: string, language: string }> {
    const segments: Array<{ text: string, language: string }> = [];
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    if (words.length === 0) {
      return segments;
    }
    
    // Process word by word with improved language detection
    let currentSegment = '';
    let currentLanguage = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Detect language of the current word more accurately
      // First, try to detect from the word itself
      let wordLanguage = this.detectLanguageFromText(word);
      
      // HARD RULE for latin-only tokens: map to configured English immediately
      if (!/[\u0590-\u05FF\u0600-\u06FF]/.test(word) && /[a-zA-Z]/.test(word)) {
        if (this.selectedLanguageA.startsWith('en-')) {
          wordLanguage = this.selectedLanguageA;
        } else if (this.selectedLanguageB.startsWith('en-')) {
          wordLanguage = this.selectedLanguageB;
        } else {
          wordLanguage = 'en-US';
        }
      }

      // If we couldn't detect from single word, use context (last 2-3 words)
      if (!wordLanguage && i > 0) {
        const contextStart = Math.max(0, i - 2);
        const contextWords = words.slice(contextStart, i + 1);
        const contextText = contextWords.join(' ');
        const analysis = this.analyzeLastWordsForLanguage(contextText, contextWords.length);
        wordLanguage = analysis.detectedLanguage || '';
      }
      
      // If still no language, try detectLanguageFromText again (it should handle this)
      if (!wordLanguage) {
        wordLanguage = this.detectLanguageFromText(word);
      }
      
      // Determine if this word should start a new segment
      const shouldStartNewSegment = this.shouldStartNewSegment(currentLanguage, wordLanguage, word);
      
      if (!currentSegment) {
        // Start new segment
        currentSegment = word;
        currentLanguage = wordLanguage || '';
      } else if (!shouldStartNewSegment) {
        // Same language - add to current segment
        currentSegment += ' ' + word;
        // Update language if we got a better detection
        if (wordLanguage && !currentLanguage) {
          currentLanguage = wordLanguage;
        }
      } else {
        // Language changed - save current segment and start new one
        if (currentSegment) {
          segments.push({
            text: currentSegment.trim(),
            language: currentLanguage || ''
          });
        }
        currentSegment = word;
        currentLanguage = wordLanguage || '';
      }
    }
    
    // Add last segment
    if (currentSegment) {
      const trimmedSegment = currentSegment.trim();
      // Only add if it's not empty and not a duplicate of the last segment
      if (trimmedSegment && (segments.length === 0 || segments[segments.length - 1].text !== trimmedSegment)) {
        segments.push({
          text: trimmedSegment,
          language: currentLanguage || this.detectLanguageFromText(currentSegment) || ''
        });
      }
    }
    
    // Final check: remove any duplicate consecutive segments
    return this.removeDuplicateSegments(segments);
  }
  
  /**
   * Determines if a new segment should be started based on language change
   */
  private shouldStartNewSegment(currentLanguage: string, wordLanguage: string, word: string): boolean {
    // If no current language, don't start new segment
    if (!currentLanguage) {
      return false;
    }
    
    // If no word language detected, don't start new segment (might be punctuation or number)
    if (!wordLanguage) {
      return false;
    }
    
    // If languages are the same, don't start new segment
    if (currentLanguage === wordLanguage) {
      return false;
    }
    
    // Check if languages are compatible (e.g., both Hebrew variants)
    const currentIsHebrew = currentLanguage.startsWith('he-') || currentLanguage.startsWith('iw-');
    const wordIsHebrew = wordLanguage.startsWith('he-') || wordLanguage.startsWith('iw-');
    if (currentIsHebrew && wordIsHebrew) {
      return false;
    }
    
    const currentIsEnglish = currentLanguage.startsWith('en-');
    const wordIsEnglish = wordLanguage.startsWith('en-');
    if (currentIsEnglish && wordIsEnglish) {
      return false;
    }
    
    const currentIsArabic = currentLanguage.startsWith('ar-');
    const wordIsArabic = wordLanguage.startsWith('ar-');
    if (currentIsArabic && wordIsArabic) {
      return false;
    }
    
    // If we have a clear language mismatch (e.g., Hebrew vs English), start new segment
    // Check character patterns to be sure
    const hasHebrewChars = /[\u0590-\u05FF]/.test(word);
    const hasArabicChars = /[\u0600-\u06FF]/.test(word);
    const hasLatinChars = /[a-zA-Z]/.test(word);
    
    const currentIsHebrewLang = currentIsHebrew;
    const currentIsArabicLang = currentIsArabic;
    const currentIsEnglishLang = currentIsEnglish;
    
    // If current is Hebrew and word has Latin chars (English), start new segment
    if (currentIsHebrewLang && hasLatinChars && !hasHebrewChars) {
      return true;
    }
    
    // If current is English and word has Hebrew chars, start new segment
    if (currentIsEnglishLang && hasHebrewChars && !hasLatinChars) {
      return true;
    }
    
    // If current is Arabic and word has different script, start new segment
    if (currentIsArabicLang && ((hasHebrewChars && !hasArabicChars) || (hasLatinChars && !hasArabicChars))) {
      return true;
    }
    
    // If languages are different and we detected them, start new segment
    return true;
  }
  
  private getSpeakerForLanguage(language: string): 'A' | 'B' {
    if (!language) {
      return 'A'; // Default
    }
    
    // Normalize language codes for comparison (handle he-IL vs iw-IL, etc.)
    const normalizeLang = (lang: string): string => {
      if (lang.startsWith('iw-')) {
        return 'he-' + lang.substring(3);
      }
      return lang;
    };
    
    const normalizedLanguage = normalizeLang(language);
    const normalizedA = normalizeLang(this.selectedLanguageA);
    const normalizedB = normalizeLang(this.selectedLanguageB);
    
    // Check exact match first
    if (normalizedLanguage === normalizedA || language === this.selectedLanguageA) {
      return 'A';
    }
    
    if (normalizedLanguage === normalizedB || language === this.selectedLanguageB) {
      return 'B';
    }
    
    // Check if language family matches (he-IL matches he-IL, en-US matches en-GB, etc.)
    const getLanguageFamily = (lang: string): string => {
      if (lang.startsWith('he-') || lang.startsWith('iw-')) {
        return 'he';
      } else if (lang.startsWith('en-')) {
        return 'en';
      } else if (lang.startsWith('ar-')) {
        return 'ar';
      }
      return lang.split('-')[0]; // Get first part of language code
    };
    
    const languageFamily = getLanguageFamily(language);
    const familyA = getLanguageFamily(this.selectedLanguageA);
    const familyB = getLanguageFamily(this.selectedLanguageB);
    
    if (languageFamily === familyA) {
      return 'A';
    } else if (languageFamily === familyB) {
      return 'B';
    }
    
    return 'A'; // Default
  }

  clearTranscript(): void {
    this.transcriptHistory = [];
    this.historyIdCounter = 0;
    this.savedHistoryCount = 0; // Reset saved history count
    this.fullTranscriptText = '';
    this.lastFullTextLength = 0;
    this.lowConfidenceCount = 0;
    this.languageMismatchCount = 0;
    this.lastLanguageCheck = '';
    this.lastLanguageCheckTime = 0;
    this.lastAddedWords = []; // Reset tracked words
    this.lastResultTime = 0; // Reset last result time
    this.lastSavedText = ''; // Reset saved text tracking
    this.lastEmptyLineId = null; // Reset empty line tracking
    // Clear analysis state
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
      this.analysisTimeout = undefined;
    }
    this.isAnalyzing = false;
    this.languageProbabilityA = 0;
    this.languageProbabilityB = 0;
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
    }
  }

  copyHistoryToClipboard(): void {
    // Copy all history in a stringified format suitable for copy/paste
    if (this.transcriptHistory.length > 0) {
      // Create a formatted string with all history information
      const historyData = {
        timestamp: new Date().toISOString(),
        languageA: this.selectedLanguageA,
        languageB: this.selectedLanguageB,
        conversation: this.transcriptHistory.map(item => ({
          speaker: item.speaker,
          text: item.text,
          language: item.language
        }))
      };
      
      // Format as a readable string
      const formattedText = JSON.stringify(historyData, null, 2);
      
      navigator.clipboard.writeText(formattedText).then(() => {
        console.log('History copied to clipboard in JSON format');
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

  getCompactHistory(): string {
    if (this.transcriptHistory.length === 0) {
      return '';
    }
    
    // Build compact history: (A)text(B)text(A)text...
    // No spaces between labels and text, exactly as user requested
    return this.transcriptHistory.map(item => {
      const speakerLabel = `(${item.speaker})`;
      return `${speakerLabel}${item.text}`;
    }).join('');
  }

  private detectLanguageFromText(text: string): string {
    if (!text || text.trim().length === 0) {
      return '';
    }

    // Remove RTL marks and trim
    const cleanText = text.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    
    if (cleanText.length === 0) {
      return '';
    }

    // Check for Hebrew characters
    const hebrewPattern = /[\u0590-\u05FF]/;
    const hasHebrew = hebrewPattern.test(cleanText);

    // Check for Arabic characters
    const arabicPattern = /[\u0600-\u06FF]/;
    const hasArabic = arabicPattern.test(cleanText);

    // Check for English/Latin characters
    const latinPattern = /[a-zA-Z]/;
    const hasLatin = latinPattern.test(cleanText);

    // QUICK RULE: For very short or latin-only snippets, force English mapping to configured language
    const isVeryShort = cleanText.split(/\s+/).filter(w => w).length <= 2 || cleanText.length <= 6;
    if (hasLatin && !hasHebrew && !hasArabic) {
      // If the latin text looks like Hebrew transliteration, map to Hebrew instead
      const translitScore = this.detectHebrewTransliteration(cleanText);
      if (translitScore > 0) {
        if (this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-')) {
          return this.selectedLanguageA;
        }
        if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
          return this.selectedLanguageB;
        }
        return 'he-IL';
      }
      if (this.selectedLanguageA.startsWith('en-')) {
        return this.selectedLanguageA;
      }
      if (this.selectedLanguageB.startsWith('en-')) {
        return this.selectedLanguageB;
      }
      if (isVeryShort) {
        return 'en-US';
      }
    }
    
    // Count characters
    const hebrewCount = (cleanText.match(/[\u0590-\u05FF]/g) || []).length;
    const latinCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
    const arabicCount = (cleanText.match(/[\u0600-\u06FF]/g) || []).length;

    // Check the last part of text to see what language was added (most important!)
    // Use last 20 characters to get better detection of what was JUST added
    const lastPart = cleanText.slice(-20).trim();
    const lastHasHebrew = hebrewPattern.test(lastPart);
    const lastHasLatin = latinPattern.test(lastPart);
    const lastHasArabic = arabicPattern.test(lastPart);
    
    // Count in last part
    const lastHebrewCount = (lastPart.match(/[\u0590-\u05FF]/g) || []).length;
    const lastLatinCount = (lastPart.match(/[a-zA-Z]/g) || []).length;
    const lastArabicCount = (lastPart.match(/[\u0600-\u06FF]/g) || []).length;
    
    // Calculate ratios for better detection
    const totalLastChars = lastHebrewCount + lastLatinCount + lastArabicCount;
    const lastHebrewRatio = totalLastChars > 0 ? lastHebrewCount / totalLastChars : 0;
    const lastLatinRatio = totalLastChars > 0 ? lastLatinCount / totalLastChars : 0;
    const lastArabicRatio = totalLastChars > 0 ? lastArabicCount / totalLastChars : 0;
    
    // Also check overall text ratios
    const totalChars = hebrewCount + latinCount + arabicCount;
    const overallHebrewRatio = totalChars > 0 ? hebrewCount / totalChars : 0;
    const overallLatinRatio = totalChars > 0 ? latinCount / totalChars : 0;
    const overallArabicRatio = totalChars > 0 ? arabicCount / totalChars : 0;
    
    console.log(`DETECT_LANG: Text="${cleanText.substring(0, 50)}", LastPart="${lastPart}", Hebrew=${lastHebrewCount}(${lastHebrewRatio.toFixed(2)}), Latin=${lastLatinCount}(${lastLatinRatio.toFixed(2)}), Arabic=${lastArabicCount}(${lastArabicRatio.toFixed(2)})`);
    
    // Helper function to get the matching language code from selected languages
    const getMatchingLanguage = (languageType: 'he' | 'en' | 'ar'): string => {
      if (languageType === 'he') {
        // Check if selectedLanguageA is Hebrew
        if (this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-')) {
          return this.selectedLanguageA;
        }
        // Check if selectedLanguageB is Hebrew
        if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
          return this.selectedLanguageB;
        }
        return 'he-IL'; // Default fallback
      } else if (languageType === 'en') {
        // Check if selectedLanguageA is English
        if (this.selectedLanguageA.startsWith('en-')) {
          return this.selectedLanguageA;
        }
        // Check if selectedLanguageB is English
        if (this.selectedLanguageB.startsWith('en-')) {
          return this.selectedLanguageB;
        }
        return 'en-US'; // Default fallback
      } else if (languageType === 'ar') {
        // Check if selectedLanguageA is Arabic
        if (this.selectedLanguageA.startsWith('ar-')) {
          return this.selectedLanguageA;
        }
        // Check if selectedLanguageB is Arabic
        if (this.selectedLanguageB.startsWith('ar-')) {
          return this.selectedLanguageB;
        }
        return 'ar-SA'; // Default fallback
      }
      return '';
    };

    // Transliteration heuristic: latin text that matches common Hebrew phrases/words
    if (hasLatin && !hasHebrew && !hasArabic) {
      const translitScore = this.detectHebrewTransliteration(cleanText);
      if (translitScore > 0) {
        const lang = getMatchingLanguage('he');
        console.log(`DETECT_LANG: ✓ Detected Hebrew via transliteration (score: ${translitScore.toFixed(2)}), returning ${lang}`);
        return lang;
      }
    }

    // Priority: Check last part first (what was just added)
    // Use ratios for better detection - require at least 60% of characters to be of one type
    // Hebrew detection: last part should be mostly Hebrew (60%+), OR overall text is mostly Hebrew (70%+)
    if ((lastHasHebrew && lastHebrewRatio > 0.6) || (hasHebrew && overallHebrewRatio > 0.7)) {
      // If last part is clearly Hebrew, prefer Hebrew
      if (lastHebrewRatio > lastLatinRatio && lastHebrewRatio > lastArabicRatio) {
        const lang = getMatchingLanguage('he');
        console.log(`DETECT_LANG: ✓ Detected Hebrew from last part (Hebrew: ${lastHebrewCount}, ratio: ${lastHebrewRatio.toFixed(2)}), returning ${lang}`);
        return lang;
      }
      // If overall text is mostly Hebrew, prefer Hebrew even if last part is mixed
      if (overallHebrewRatio > 0.7 && overallHebrewRatio > overallLatinRatio) {
        const lang = getMatchingLanguage('he');
        console.log(`DETECT_LANG: ✓ Detected Hebrew (dominant overall: ratio: ${overallHebrewRatio.toFixed(2)}), returning ${lang}`);
        return lang;
      }
    }
    
    // Arabic detection: similar logic
    if ((lastHasArabic && lastArabicRatio > 0.6) || (hasArabic && overallArabicRatio > 0.7)) {
      if (lastArabicRatio > lastLatinRatio && lastArabicRatio > lastHebrewRatio) {
        const lang = getMatchingLanguage('ar');
        console.log(`DETECT_LANG: ✓ Detected Arabic from last part (Arabic: ${lastArabicCount}, ratio: ${lastArabicRatio.toFixed(2)}), returning ${lang}`);
        return lang;
      }
      if (overallArabicRatio > 0.7 && overallArabicRatio > overallLatinRatio) {
        const lang = getMatchingLanguage('ar');
        console.log(`DETECT_LANG: ✓ Detected Arabic (dominant overall: ratio: ${overallArabicRatio.toFixed(2)}), returning ${lang}`);
        return lang;
      }
    }
    
    // English detection: last part should be mostly Latin (60%+), AND overall text should not be mostly Hebrew/Arabic
    if (lastHasLatin && lastLatinRatio > 0.6 && overallLatinRatio > 0.6) {
      // Only detect as English if overall text is not dominated by Hebrew/Arabic
      if (overallHebrewRatio < 0.5 && overallArabicRatio < 0.5) {
        const lang = getMatchingLanguage('en');
        console.log(`DETECT_LANG: ✓ Detected English from last part (Latin: ${lastLatinCount}, ratio: ${lastLatinRatio.toFixed(2)}), returning ${lang}`);
        return lang;
      }
    }

    // Fallback: use dominant language in entire text (if ratios are clear)
    if (hasHebrew && overallHebrewRatio > 0.5 && overallHebrewRatio > overallLatinRatio && overallHebrewRatio > overallArabicRatio) {
      const lang = getMatchingLanguage('he');
      console.log(`DETECT_LANG: ✓ Fallback: Detected Hebrew (overall ratio: ${overallHebrewRatio.toFixed(2)}), returning ${lang}`);
      return lang;
    }
    
    if (hasLatin && overallLatinRatio > 0.5 && overallLatinRatio > overallHebrewRatio && overallLatinRatio > overallArabicRatio) {
      const lang = getMatchingLanguage('en');
      console.log(`DETECT_LANG: ✓ Fallback: Detected English (overall ratio: ${overallLatinRatio.toFixed(2)}), returning ${lang}`);
      return lang;
    }
    
    if (hasArabic && overallArabicRatio > 0.5 && overallArabicRatio > overallHebrewRatio && overallArabicRatio > overallLatinRatio) {
      const lang = getMatchingLanguage('ar');
      console.log(`DETECT_LANG: ✓ Fallback: Detected Arabic (overall ratio: ${overallArabicRatio.toFixed(2)}), returning ${lang}`);
      return lang;
    }

    return '';
  }

  /**
   * Returns a score (>0 when match) if latin text likely represents Hebrew transliteration.
   * Simple heuristic based on common words/phrases.
   */
  private detectHebrewTransliteration(text: string): number {
    const t = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t) return 0;
    const phrases = [
      'ma nishma', 'ma shlomcha', 'ma shlomech', 'ma kore', 'ma ze', 'eich ata', 'eich at',
      'boker tov', 'erev tov'
    ];
    const words = [
      'shalom', 'nishma', 'toda', 'slicha', 'ken', 'lo', 'yalla', 'achshav', 'eifo', 'lama', 'yom', 'layla', 'erev', 'boker'
    ];
    let score = 0;
    for (const p of phrases) {
      if (t.includes(p)) score += 0.8;
    }
    const tokens = t.split(' ');
    for (const w of tokens) {
      if (words.includes(w)) score += 0.2;
    }
    return score;
  }

  private checkForLanguageChangeInText(oldText: string, newText: string): { changed: boolean, oldTextCleaned: string, newTextOnly: string } {
    if (!oldText || oldText.length === 0) {
      return { changed: false, oldTextCleaned: '', newTextOnly: newText };
    }

    // Get the part that was added
    const addedText = newText.length > oldText.length ? newText.slice(oldText.length).trim() : '';
    
    if (!addedText || addedText.length === 0) {
      return { changed: false, oldTextCleaned: oldText, newTextOnly: '' };
    }

    // Detect language of old text and added text
    const oldLanguage = this.detectLanguageFromText(oldText);
    const addedLanguage = this.detectLanguageFromText(addedText);

    // If the added text is in a different language, we need to split
    if (oldLanguage && addedLanguage && oldLanguage !== addedLanguage) {
      // Find where the language change happened in the old text
      // We'll keep only the text that matches the old language
      const oldTextCleaned = this.extractTextByLanguage(oldText, oldLanguage);
      return { 
        changed: true, 
        oldTextCleaned: oldTextCleaned, 
        newTextOnly: addedText 
      };
    }

    // Check if new text overall has different dominant language
    const newLanguage = this.detectLanguageFromText(newText);
    if (oldLanguage && newLanguage && oldLanguage !== newLanguage) {
      // Split the text - keep old language part, extract new language part
      const oldTextCleaned = this.extractTextByLanguage(oldText, oldLanguage);
      const newTextOnly = this.extractTextByLanguage(newText, newLanguage);
      // Only return changed if newTextOnly is different from what was added
      if (newTextOnly !== oldTextCleaned) {
        return { 
          changed: true, 
          oldTextCleaned: oldTextCleaned, 
          newTextOnly: newTextOnly.replace(oldTextCleaned, '').trim() 
        };
      }
    }

    return { changed: false, oldTextCleaned: oldText, newTextOnly: addedText };
  }

  private extractTextByLanguage(text: string, targetLanguage: string): string {
    if (!text || !targetLanguage) {
      return text;
    }

    // Remove RTL marks
    const cleanText = text.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    
    // Determine character patterns based on language
    let pattern: RegExp;
    if (targetLanguage.startsWith('he-') || targetLanguage.startsWith('iw-')) {
      pattern = /[\u0590-\u05FF\s]+/g;
    } else if (targetLanguage.startsWith('ar-')) {
      pattern = /[\u0600-\u06FF\s]+/g;
    } else if (targetLanguage.startsWith('en-')) {
      pattern = /[a-zA-Z\s]+/g;
    } else {
      return text; // Unknown language, return as is
    }

    // Extract all matches and join, preserving word boundaries
    const matches = cleanText.match(pattern);
    if (matches) {
      return matches.join('').trim().replace(/\s+/g, ' ');
    }

    return '';
  }

  private scrollToTop(): void {
    const historyList = document.querySelector('.history-list');
    if (historyList) {
      historyList.scrollTop = 0;
    }
  }

  /**
   * Returns the transcript history in reverse order (newest first)
   */
  get reversedTranscriptHistory(): Array<{ speaker: 'A' | 'B', text: string, language: string, id: number, isWaiting?: boolean }> {
    return [...this.transcriptHistory].reverse();
  }

  /**
   * Schedules language analysis - waits for message to complete before analyzing
   */
  private scheduleLanguageAnalysis(): void {
    // Clear existing timeout
    if (this.analysisTimeout) {
      clearTimeout(this.analysisTimeout);
    }
    
    // Show spinner immediately
    this.isAnalyzing = true;
    this.cdr.detectChanges();
    
    // Schedule analysis after delay
    this.analysisTimeout = setTimeout(() => {
      this.performLanguageAnalysis();
    }, this.ANALYSIS_DELAY);
  }
  
  /**
   * Performs language analysis on the current transcript text
   */
  private performLanguageAnalysis(): void {
    if (!this.fullTranscriptText || this.fullTranscriptText.trim().length === 0) {
      this.isAnalyzing = false;
      this.languageProbabilityA = 0;
      this.languageProbabilityB = 0;
      this.cdr.detectChanges();
      return;
    }
    
    // Calculate probabilities for both languages
    const probabilities = this.calculateLanguageProbability(this.fullTranscriptText);
    
    this.languageProbabilityA = probabilities.probabilityA;
    this.languageProbabilityB = probabilities.probabilityB;
    
    // Hide spinner after a short delay to show the results
    setTimeout(() => {
      this.isAnalyzing = false;
      this.cdr.detectChanges();
    }, 300);
    
    this.cdr.detectChanges();
  }
  
  /**
   * Calculates the probability that the text is in language A or B
   * Returns probabilities as percentages (0-100)
   */
  private calculateLanguageProbability(text: string): { probabilityA: number, probabilityB: number } {
    if (!text || text.trim().length === 0) {
      return { probabilityA: 0, probabilityB: 0 };
    }
    
    // Analyze the text for language detection
    const analysis = this.analyzeLastWordsForLanguage(text, Math.min(10, text.split(/\s+/).length));
    const detectedLanguage = analysis.detectedLanguage || '';
    const confidence = analysis.confidence;
    
    // Count characters for each language
    const hebrewPattern = /[\u0590-\u05FF]/g;
    const arabicPattern = /[\u0600-\u06FF]/g;
    const latinPattern = /[a-zA-Z]/g;
    
    const hebrewCount = (text.match(hebrewPattern) || []).length;
    const arabicCount = (text.match(arabicPattern) || []).length;
    const latinCount = (text.match(latinPattern) || []).length;
    const totalChars = hebrewCount + arabicCount + latinCount;
    
    if (totalChars === 0) {
      return { probabilityA: 50, probabilityB: 50 };
    }
    
    // Determine which language family matches each selected language
    const isLanguageAHebrew = this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-');
    const isLanguageAArabic = this.selectedLanguageA.startsWith('ar-');
    const isLanguageAEnglish = this.selectedLanguageA.startsWith('en-');
    
    const isLanguageBHebrew = this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-');
    const isLanguageBArabic = this.selectedLanguageB.startsWith('ar-');
    const isLanguageBEnglish = this.selectedLanguageB.startsWith('en-');
    
    // Calculate character-based probabilities
    let charProbabilityA = 0;
    let charProbabilityB = 0;
    
    if (isLanguageAHebrew && hebrewCount > 0) {
      charProbabilityA += (hebrewCount / totalChars) * 100;
    }
    if (isLanguageAArabic && arabicCount > 0) {
      charProbabilityA += (arabicCount / totalChars) * 100;
    }
    if (isLanguageAEnglish && latinCount > 0) {
      charProbabilityA += (latinCount / totalChars) * 100;
    }
    
    if (isLanguageBHebrew && hebrewCount > 0) {
      charProbabilityB += (hebrewCount / totalChars) * 100;
    }
    if (isLanguageBArabic && arabicCount > 0) {
      charProbabilityB += (arabicCount / totalChars) * 100;
    }
    if (isLanguageBEnglish && latinCount > 0) {
      charProbabilityB += (latinCount / totalChars) * 100;
    }
    
    // Use detected language and confidence to adjust probabilities
    let finalProbabilityA = charProbabilityA;
    let finalProbabilityB = charProbabilityB;
    
    // Transliteration boost for Hebrew if snippet is latin but matches Hebrew phrases/words
    const hasHebChars = hebrewCount > 0;
    const hasArChars = arabicCount > 0;
    const hasLatChars = latinCount > 0;
    if (!hasHebChars && !hasArChars && hasLatChars) {
      const translitScore = this.detectHebrewTransliteration(text);
      if (translitScore > 0) {
        const boost = Math.min(30, translitScore * 40); // up to +30%
        if (isLanguageAHebrew) {
          finalProbabilityA += boost;
          finalProbabilityB = Math.max(0, finalProbabilityB - boost / 2);
        } else if (isLanguageBHebrew) {
          finalProbabilityB += boost;
          finalProbabilityA = Math.max(0, finalProbabilityA - boost / 2);
        }
      }
    }
    
    // If we detected a language with high confidence, boost that language's probability
    if (detectedLanguage) {
      // Helper function to check if two language codes match (same language, different variants)
      // e.g., "he-IL" matches "he-US", "en-US" matches "en-GB", etc.
      const languagesMatch = (lang1: string, lang2: string): boolean => {
        if (lang1 === lang2) {
          return true; // Exact match
        }
        // Extract language prefix (part before the dash)
        const prefix1 = lang1.split('-')[0];
        const prefix2 = lang2.split('-')[0];
        return prefix1 === prefix2; // Same language family
      };
      
      const isDetectedLanguageA = languagesMatch(detectedLanguage, this.selectedLanguageA);
      const isDetectedLanguageB = languagesMatch(detectedLanguage, this.selectedLanguageB);
      
      if (isDetectedLanguageA) {
        finalProbabilityA = Math.min(100, charProbabilityA + (confidence * 30));
        finalProbabilityB = Math.max(0, charProbabilityB - (confidence * 20));
      } else if (isDetectedLanguageB) {
        finalProbabilityB = Math.min(100, charProbabilityB + (confidence * 30));
        finalProbabilityA = Math.max(0, charProbabilityA - (confidence * 20));
      }
    }
    
    // Normalize to ensure they sum to 100
    const total = finalProbabilityA + finalProbabilityB;
    if (total > 0) {
      finalProbabilityA = Math.round((finalProbabilityA / total) * 100);
      finalProbabilityB = Math.round((finalProbabilityB / total) * 100);
    } else {
      finalProbabilityA = 50;
      finalProbabilityB = 50;
    }
    
    return {
      probabilityA: finalProbabilityA,
      probabilityB: finalProbabilityB
    };
  }

  /**
   * Logs per-snippet probability for Speaker A/B with a fixed tag for diagnostics.
   */
  private logNewVoiceData(snippet: string): void {
    if (!snippet || snippet.trim().length === 0) {
      return;
    }
    const { probabilityA, probabilityB } = this.calculateLanguageProbability(snippet);
    const labelA = this.getSelectedLanguageNameA();
    const labelB = this.getSelectedLanguageNameB();
    // Log as JSON string so it renders across lines in the console
    const payload = {
      tag: 'NEW_VOICE_DATA',
      snippet,
      speakerA: {
        languageName: labelA,
        probabilityPercent: probabilityA
      },
      speakerB: {
        languageName: labelB,
        probabilityPercent: probabilityB
      }
    };
    console.log(JSON.stringify(payload));
  }

  getStatusIcon(): string {
    // If listening and not paused, show pause icon
    if (this.isListening && !this.isPaused) {
      return 'pause';
    }
    // If listening but paused, show mic icon (to resume)
    if (this.isListening && this.isPaused) {
      return 'mic';
    }
    // Otherwise, show default icons based on status
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



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
  transcriptHistory: Array<{ speaker: 'A' | 'B', text: string, language: string, id: number }> = [];
  private historyIdCounter = 0;
  
  // Full transcript text - accumulates all text without duplicates
  private fullTranscriptText: string = '';

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

    // Load saved language preferences
    const savedLanguageA = localStorage.getItem('translator-language-a');
    const savedLanguageB = localStorage.getItem('translator-language-b');
    if (savedLanguageA) {
      this.selectedLanguageA = savedLanguageA;
    }
    if (savedLanguageB) {
      this.selectedLanguageB = savedLanguageB;
    }

    // Subscribe to transcript updates - LIVE transcription to history
    this.transcriptSubscription = this.speechRecognitionService.transcript$.subscribe(result => {
      if (result.speaker && result.transcript && result.transcript.trim()) {
        const trimmedText = result.transcript.trim();
        
        // Check confidence score - if it's low, the current language might be wrong
        if (result.confidence !== undefined) {
          this.checkLanguageByConfidence(result.confidence, trimmedText, result.language);
        }
        
        // Update full transcript text - add only new parts without duplicates
        this.updateFullTranscript(trimmedText);
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

  private updateFullTranscript(newText: string): void {
    // Remove RTL marks and normalize
    const cleanNewText = newText.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    const cleanFullText = this.fullTranscriptText.replace(/[\u200E-\u200F\u202A-\u202E]/g, '').trim();
    
    if (!cleanNewText) {
      return;
    }
    
    // If full text is empty, just set it to the new text
    if (!cleanFullText) {
      this.fullTranscriptText = cleanNewText;
    console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
    
    // Check and switch language based on the full text
    this.checkFullTextLanguage();
    
    this.updateHistoryFromFullText();
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 100);
    return;
    }
    
    // Most common case: new text is an extension of the full text (starts with full text)
    // This happens when the recognition continues from where it left off
    if (cleanNewText.startsWith(cleanFullText)) {
      // New text is an extension - just update to the new text
      this.fullTranscriptText = cleanNewText;
    console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
    
    // Check and switch language based on the full text
    this.checkFullTextLanguage();
    
    this.updateHistoryFromFullText();
    this.cdr.detectChanges();
    setTimeout(() => this.scrollToBottom(), 100);
    return;
    }
    
    // Check if new text is already fully contained in full text
    // This can happen when the recognition sends an older/interim result
    if (cleanFullText.includes(cleanNewText)) {
      // New text is already in full text
      // Only update if new text is significantly longer (contains full text + more)
      if (cleanNewText.length > cleanFullText.length * 1.1) {
        // New text is much longer - it might be a corrected/expanded version
        this.fullTranscriptText = cleanNewText;
        console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
        this.updateHistoryFromFullText();
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 100);
      }
      // Otherwise, it's already contained - no update needed
      return;
    }
    
    // Check if full text is a prefix of new text (shouldn't happen, but just in case)
    if (cleanFullText.startsWith(cleanNewText)) {
      // Full text already contains more than new text - no update needed
      return;
    }
    
    // Find overlap from the end of full text to the beginning of new text
    // This handles cases where the recognition restarts or there's partial overlap
    // We look for word-level overlap, not just character-level
    const fullWords = cleanFullText.split(/\s+/);
    const newWords = cleanNewText.split(/\s+/);
    
    // Find the longest overlap of words from the end of full text to the start of new text
    let maxOverlapWords = 0;
    for (let i = 1; i <= Math.min(fullWords.length, newWords.length); i++) {
      const fullSuffix = fullWords.slice(-i).join(' ');
      const newPrefix = newWords.slice(0, i).join(' ');
      
      if (fullSuffix === newPrefix) {
        maxOverlapWords = i;
      }
    }
    
    // If we found word-level overlap, add only the non-overlapping words
    if (maxOverlapWords > 0) {
      const addedWords = newWords.slice(maxOverlapWords);
      if (addedWords.length > 0) {
        const addedText = addedWords.join(' ');
        this.fullTranscriptText = cleanFullText + ' ' + addedText;
        console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
        this.updateHistoryFromFullText();
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 100);
      }
    } else {
      // No overlap found - this might be a completely new phrase
      // Check if the new text is very different (less than 30% similarity)
      // If so, it's probably a new sentence/phrase - append it
      const similarity = this.calculateTextSimilarity(cleanFullText, cleanNewText);
      if (similarity < 0.3) {
        // Very different text - append as new phrase
        this.fullTranscriptText = cleanFullText + ' ' + cleanNewText;
        console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
        this.updateHistoryFromFullText();
        this.cdr.detectChanges();
        setTimeout(() => this.scrollToBottom(), 100);
      }
      // If similarity is high, it might be a duplicate or correction - skip it
    }
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
    // Check if the detected language from text differs from current language
    const detectedLanguage = this.detectLanguageFromText(text);
    
    if (text && text.trim().length > 0) {
      // Always check if detected language differs from current language
      if (detectedLanguage && detectedLanguage !== currentLanguage) {
        this.languageMismatchCount++;
        console.log(`LANG_MISMATCH: Detected (${detectedLanguage}) != Current (${currentLanguage}), text="${text}", count=${this.languageMismatchCount}, confidence=${confidence.toFixed(3)}`);
        
        // If confidence is also low, switch immediately
        if (confidence < 0.6) {
          console.log(`LANG_MISMATCH: Low confidence (${confidence.toFixed(3)}) + language mismatch - switching immediately`);
          this.checkAndSwitchLanguage(detectedLanguage);
          this.languageMismatchCount = 0;
          this.lowConfidenceCount = 0;
          return;
        }
        
        // Even with higher confidence, if we consistently detect different language, switch
        if (this.languageMismatchCount >= 2) {
          console.log(`LANG_MISMATCH: Consistent mismatch (${this.languageMismatchCount} times) - switching to ${detectedLanguage}`);
          this.checkAndSwitchLanguage(detectedLanguage);
          this.languageMismatchCount = 0;
          this.lowConfidenceCount = 0;
          return;
        }
      } else if (detectedLanguage === currentLanguage) {
        // Language matches - reset mismatch counter
        if (this.languageMismatchCount > 0) {
          console.log(`LANG_MATCH: Language matches (${currentLanguage}), resetting mismatch counter`);
          this.languageMismatchCount = 0;
        }
      }
      
      // Low confidence suggests wrong language
      if (confidence < 0.6) {
        this.lowConfidenceCount++;
        this.lastLowConfidenceText = text;
        
        console.log(`LOW_CONFIDENCE: confidence=${confidence.toFixed(3)}, text="${text}", currentLang=${currentLanguage}, count=${this.lowConfidenceCount}`);
        
        // If we have multiple low confidence results, try to detect the language from text
        if (this.lowConfidenceCount >= 3 && detectedLanguage && detectedLanguage !== currentLanguage) {
          console.log(`LOW_CONFIDENCE: Multiple low confidence (${this.lowConfidenceCount}) + language mismatch - switching to ${detectedLanguage}`);
          this.checkAndSwitchLanguage(detectedLanguage);
          this.lowConfidenceCount = 0;
          this.languageMismatchCount = 0;
        }
      } else if (confidence >= 0.7) {
        // High confidence - reset the counter if language matches
        if (detectedLanguage === currentLanguage && this.lowConfidenceCount > 0) {
          console.log(`HIGH_CONFIDENCE: confidence=${confidence.toFixed(3)}, language matches - resetting counters`);
          this.lowConfidenceCount = 0;
        }
      }
    }
  }
  
  private checkAndSwitchLanguage(detectedLanguage: string): void {
    if (!detectedLanguage || !this.isListening) {
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
    
    // Get only the NEW part that was just added (not the entire text)
    const currentLength = this.fullTranscriptText.length;
    const newPart = currentLength > this.lastFullTextLength 
      ? this.fullTranscriptText.slice(this.lastFullTextLength).trim()
      : this.fullTranscriptText.slice(-30).trim(); // Fallback: last 30 chars
    
    this.lastFullTextLength = currentLength;
    
    if (!newPart || newPart.length === 0) {
      return;
    }
    
    console.log(`CHECK_FULL_LANG: Checking new part: "${newPart}"`);
    const detectedLanguage = this.detectLanguageFromText(newPart);
    console.log(`CHECK_FULL_LANG: Detected language: ${detectedLanguage}`);
    
    if (detectedLanguage) {
      this.checkAndSwitchLanguage(detectedLanguage);
    } else {
      // If we can't detect from new part, check last 20 chars of full text
      const last20Chars = this.fullTranscriptText.slice(-20).trim();
      const fallbackLanguage = this.detectLanguageFromText(last20Chars);
      console.log(`CHECK_FULL_LANG: Fallback check (last 20 chars): "${last20Chars}" -> ${fallbackLanguage}`);
      if (fallbackLanguage) {
        this.checkAndSwitchLanguage(fallbackLanguage);
      }
    }
  }
  
  private updateHistoryFromFullText(): void {
    // Parse the full text and create history entries by speaker/language
    // This is a simplified version - you might want to improve the parsing logic
    if (!this.fullTranscriptText) {
      this.transcriptHistory = [];
      return;
    }
    
    // For now, we'll create a single entry with the full text
    // Later we can improve this to split by speaker/language changes
    const detectedLanguage = this.detectLanguageFromText(this.fullTranscriptText);
    
    // Simple approach: create one entry per language segment
    // Split text by language changes
    const segments = this.splitTextByLanguage(this.fullTranscriptText);
    
    this.transcriptHistory = segments.map((segment, index) => {
      const speaker = this.getSpeakerForLanguage(segment.language);
      return {
        speaker: speaker,
        text: segment.text,
        language: segment.language,
        id: index + 1
      };
    });
  }
  
  private splitTextByLanguage(text: string): Array<{ text: string, language: string }> {
    const segments: Array<{ text: string, language: string }> = [];
    const words = text.split(/\s+/);
    
    let currentSegment = '';
    let currentLanguage = '';
    
    for (const word of words) {
      const wordLanguage = this.detectLanguageFromText(word);
      const segmentLanguage = currentSegment ? this.detectLanguageFromText(currentSegment) : '';
      
      if (!currentSegment) {
        // Start new segment
        currentSegment = word;
        currentLanguage = wordLanguage || segmentLanguage;
      } else if (wordLanguage === segmentLanguage || (!wordLanguage && segmentLanguage)) {
        // Same language - add to current segment
        currentSegment += ' ' + word;
      } else {
        // Language changed - save current segment and start new one
        if (currentSegment) {
          segments.push({
            text: currentSegment.trim(),
            language: currentLanguage || segmentLanguage || ''
          });
        }
        currentSegment = word;
        currentLanguage = wordLanguage || '';
      }
    }
    
    // Add last segment
    if (currentSegment) {
      segments.push({
        text: currentSegment.trim(),
        language: currentLanguage || this.detectLanguageFromText(currentSegment) || ''
      });
    }
    
    return segments;
  }
  
  private getSpeakerForLanguage(language: string): 'A' | 'B' {
    if (!language) {
      return 'A'; // Default
    }
    
    if (language === this.selectedLanguageA || 
        (language.startsWith('he-') && this.selectedLanguageA.startsWith('he-')) ||
        (language.startsWith('ar-') && this.selectedLanguageA.startsWith('ar-'))) {
      return 'A';
    } else if (language === this.selectedLanguageB ||
               (language.startsWith('en-') && this.selectedLanguageB.startsWith('en-')) ||
               (language.startsWith('ar-') && this.selectedLanguageB.startsWith('ar-'))) {
      return 'B';
    }
    
    return 'A'; // Default
  }

  clearTranscript(): void {
    this.transcriptHistory = [];
    this.historyIdCounter = 0;
    this.fullTranscriptText = '';
    this.lastFullTextLength = 0;
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
    
    console.log(`DETECT_LANG: Text="${cleanText}", LastPart="${lastPart}", Hebrew=${lastHebrewCount}, Latin=${lastLatinCount}, Arabic=${lastArabicCount}`);
    
    // Priority: Check last part first (what was just added)
    // IMPORTANT: If last part has Latin and more Latin than Hebrew/Arabic, it's English
    // This should be checked FIRST to catch English words even if there's Hebrew before
    if (lastHasLatin && lastLatinCount > lastHebrewCount && lastLatinCount > lastArabicCount) {
      const lang = this.selectedLanguageA.startsWith('en-') ? this.selectedLanguageA : 
                   (this.selectedLanguageB.startsWith('en-') ? this.selectedLanguageB : 'en-US');
      console.log(`DETECT_LANG: ✓ Detected English from last part (Latin: ${lastLatinCount} > Hebrew: ${lastHebrewCount}), returning ${lang}`);
      return lang;
    }
    
    // If last part has Hebrew and more Hebrew than Latin, it's Hebrew
    if (lastHasHebrew && lastHebrewCount > lastLatinCount) {
      const lang = (this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-')) ? this.selectedLanguageA : 
                   ((this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) ? this.selectedLanguageB : 'he-IL');
      console.log(`DETECT_LANG: ✓ Detected Hebrew from last part (Hebrew: ${lastHebrewCount} > Latin: ${lastLatinCount}), returning ${lang}`);
      return lang;
    }
    
    // If last part has Arabic and more Arabic than Latin, it's Arabic
    if (lastHasArabic && lastArabicCount > lastLatinCount) {
      const lang = this.selectedLanguageA.startsWith('ar-') ? this.selectedLanguageA : 
                   (this.selectedLanguageB.startsWith('ar-') ? this.selectedLanguageB : 'ar-SA');
      console.log(`DETECT_LANG: ✓ Detected Arabic from last part, returning ${lang}`);
      return lang;
    }

    // Fallback: use dominant language in entire text
    if (hasHebrew && hebrewCount >= latinCount && hebrewCount >= arabicCount) {
      if (this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-')) {
        return this.selectedLanguageA;
      } else if (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-')) {
        return this.selectedLanguageB;
      }
      return 'he-IL';
    }
    
    if (hasLatin && latinCount > hebrewCount && latinCount > arabicCount) {
      if (this.selectedLanguageA.startsWith('en-')) {
        return this.selectedLanguageA;
      } else if (this.selectedLanguageB.startsWith('en-')) {
        return this.selectedLanguageB;
      }
      return 'en-US';
    }
    
    if (hasArabic && arabicCount > hebrewCount && arabicCount > latinCount) {
      if (this.selectedLanguageA.startsWith('ar-')) {
        return this.selectedLanguageA;
      } else if (this.selectedLanguageB.startsWith('ar-')) {
        return this.selectedLanguageB;
      }
      return 'ar-SA';
    }

    return '';
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

  private scrollToBottom(): void {
    const historyList = document.querySelector('.history-list');
    if (historyList) {
      historyList.scrollTop = historyList.scrollHeight;
    }
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



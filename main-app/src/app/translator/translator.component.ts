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
  
  // Track last added words to detect repetitions
  private lastAddedWords: string[] = [];
  private readonly MAX_TRACKED_WORDS = 10; // Track last 10 words
  
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
    
    // Reset counters and state
    this.fullTranscriptText = '';
    this.lastFullTextLength = 0;
    this.transcriptHistory = [];
    this.historyIdCounter = 0;
    this.lowConfidenceCount = 0;
    this.languageMismatchCount = 0;
    this.lastLanguageCheck = '';
    this.lastLanguageCheckTime = 0;
    this.lastAddedWords = []; // Reset tracked words

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
    
    // Check for repetition patterns BEFORE processing
    if (this.detectRepetitionPattern(cleanNewText)) {
      console.log(`REPETITION_DETECTED: Skipping repetitive text: "${cleanNewText.substring(0, 50)}..."`);
      return;
    }
    
    // If full text is empty, just set it to the new text
    if (!cleanFullText) {
      this.fullTranscriptText = cleanNewText;
      // Update tracked words
      this.updateTrackedWords(cleanNewText);
      console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
      
      // Check and switch language based on the full text
      this.checkFullTextLanguage();
      
      this.updateHistoryFromFullText();
      this.cdr.detectChanges();
      setTimeout(() => this.scrollToBottom(), 100);
      return;
    }
    
    // Check if new text is a repetition loop (contains full text multiple times or similar pattern)
    if (this.isRepetitionLoop(cleanFullText, cleanNewText)) {
      console.log(`REPETITION_LOOP: Detected loop pattern, skipping update`);
      return;
    }
    
    // Most common case: new text is an extension of the full text (starts with full text)
    // This happens when the recognition continues from where it left off
    if (cleanNewText.startsWith(cleanFullText)) {
      // Extract only the NEW part
      const addedPart = cleanNewText.slice(cleanFullText.length).trim();
      
      // Check if the added part is just a repetition of existing text
      if (this.isRepetitiveAddition(cleanFullText, addedPart)) {
        console.log(`REPETITIVE_ADDITION: Added part is repetitive, skipping`);
        return;
      }
      
      // Check if added part repeats the last tracked words
      if (this.containsLastTrackedWords(addedPart)) {
        console.log(`REPETITION_TRACKED_WORDS: Added part contains tracked words, skipping`);
        return;
      }
      
      // New text is an extension - just update to the new text
      this.fullTranscriptText = cleanNewText;
      
      // Update tracked words with the newly added words
      this.updateTrackedWords(addedPart);
      
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
        // Check for repetition before updating
        if (!this.isRepetitionLoop(cleanFullText, cleanNewText)) {
          // New text is much longer - it might be a corrected/expanded version
          this.fullTranscriptText = cleanNewText;
          console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
          this.updateHistoryFromFullText();
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 100);
        }
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
        
        // Check if added text is repetitive
        if (!this.isRepetitiveAddition(cleanFullText, addedText)) {
          // Check if added text repeats the last tracked words
          if (!this.containsLastTrackedWords(addedText)) {
            this.fullTranscriptText = cleanFullText + ' ' + addedText;
            // Update tracked words
            this.updateTrackedWords(addedText);
            console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
            this.updateHistoryFromFullText();
            this.cdr.detectChanges();
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            console.log(`REPETITION_TRACKED_WORDS: Added text contains tracked words, skipping`);
          }
        } else {
          console.log(`REPETITIVE_ADDITION: Added text is repetitive, skipping`);
        }
      }
    } else {
      // No overlap found - this might be a completely new phrase
      // Check if the new text is very different (less than 30% similarity)
      // If so, it's probably a new sentence/phrase - append it
      const similarity = this.calculateTextSimilarity(cleanFullText, cleanNewText);
      if (similarity < 0.3) {
        // Check if new text repeats the last tracked words
        if (!this.containsLastTrackedWords(cleanNewText)) {
          // Very different text - append as new phrase
          this.fullTranscriptText = cleanFullText + ' ' + cleanNewText;
          // Update tracked words
          this.updateTrackedWords(cleanNewText);
          console.log(`UPDATE_TEXT ${this.fullTranscriptText}`);
          this.updateHistoryFromFullText();
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 100);
        } else {
          console.log(`REPETITION_TRACKED_WORDS: New text contains tracked words, skipping`);
        }
      }
      // If similarity is high, it might be a duplicate or correction - skip it
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
    
    // Check if newText contains fullText multiple times
    const fullTextLower = fullText.toLowerCase();
    const newTextLower = newText.toLowerCase();
    
    // Count how many times fullText appears in newText
    let count = 0;
    let index = 0;
    while ((index = newTextLower.indexOf(fullTextLower, index)) !== -1) {
      count++;
      index += fullTextLower.length;
    }
    
    if (count >= 2) {
      console.log(`REPETITION_LOOP: fullText appears ${count} times in newText`);
      return true;
    }
    
    // Check if newText is fullText with small additions that repeat
    if (newTextLower.startsWith(fullTextLower)) {
      const addedPart = newTextLower.slice(fullTextLower.length).trim();
      if (addedPart && fullTextLower.includes(addedPart)) {
        // The added part already exists in fullText - likely a loop
        return true;
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
        
        // If confidence is low OR analysis confidence is high, switch immediately
        if (confidence < 0.6 || last3WordsAnalysis.confidence > 0.7) {
          console.log(`LANG_MISMATCH: Low recognition confidence (${confidence.toFixed(3)}) OR high analysis confidence (${last3WordsAnalysis.confidence.toFixed(3)}) + language mismatch - switching immediately`);
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
        if (this.languageMismatchCount >= 2) {
          console.log(`LANG_MISMATCH: Consistent mismatch (${this.languageMismatchCount} times) - switching to ${finalDetectedLanguage}`);
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
      
      // If we have multiple low confidence results, use the sophisticated analysis
      if (this.lowConfidenceCount >= 2) {
        if (last3WordsAnalysis.detectedLanguage && last3WordsAnalysis.detectedLanguage !== currentLanguage) {
          console.log(`LOW_CONFIDENCE: Multiple low confidence (${this.lowConfidenceCount}) + language mismatch from analysis - switching to ${last3WordsAnalysis.detectedLanguage}`);
          this.checkAndSwitchLanguage(last3WordsAnalysis.detectedLanguage);
          this.lowConfidenceCount = 0;
          this.languageMismatchCount = 0;
        } else if (detectedLanguage && detectedLanguage !== currentLanguage) {
          console.log(`LOW_CONFIDENCE: Multiple low confidence (${this.lowConfidenceCount}) + language mismatch - switching to ${detectedLanguage}`);
          this.checkAndSwitchLanguage(detectedLanguage);
          this.lowConfidenceCount = 0;
          this.languageMismatchCount = 0;
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
    
    // Define language patterns for multiple languages
    const languagePatterns = [
      {
        name: 'hebrew',
        codes: ['he-IL', 'iw-IL'],
        pattern: /[\u0590-\u05FF]/,
        countPattern: /[\u0590-\u05FF]/g,
        selectedCode: this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-') 
          ? this.selectedLanguageA 
          : (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-') ? this.selectedLanguageB : 'he-IL')
      },
      {
        name: 'english',
        codes: ['en-US', 'en-GB'],
        pattern: /[a-zA-Z]/,
        countPattern: /[a-zA-Z]/g,
        selectedCode: this.selectedLanguageA.startsWith('en-') 
          ? this.selectedLanguageA 
          : (this.selectedLanguageB.startsWith('en-') ? this.selectedLanguageB : 'en-US')
      },
      {
        name: 'arabic',
        codes: ['ar-SA', 'ar-EG', 'ar-IL'],
        pattern: /[\u0600-\u06FF]/,
        countPattern: /[\u0600-\u06FF]/g,
        selectedCode: this.selectedLanguageA.startsWith('ar-') 
          ? this.selectedLanguageA 
          : (this.selectedLanguageB.startsWith('ar-') ? this.selectedLanguageB : 'ar-SA')
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
      
      // If we couldn't detect from single word, use context (last 2-3 words)
      if (!wordLanguage && i > 0) {
        const contextStart = Math.max(0, i - 2);
        const contextWords = words.slice(contextStart, i + 1);
        const contextText = contextWords.join(' ');
        const analysis = this.analyzeLastWordsForLanguage(contextText, contextWords.length);
        wordLanguage = analysis.detectedLanguage || '';
      }
      
      // If still no language, check if word has clear language markers
      if (!wordLanguage) {
        // Check for Hebrew characters
        if (/[\u0590-\u05FF]/.test(word)) {
          wordLanguage = this.selectedLanguageA.startsWith('he-') || this.selectedLanguageA.startsWith('iw-') 
            ? this.selectedLanguageA 
            : (this.selectedLanguageB.startsWith('he-') || this.selectedLanguageB.startsWith('iw-') ? this.selectedLanguageB : 'he-IL');
        }
        // Check for Arabic characters
        else if (/[\u0600-\u06FF]/.test(word)) {
          wordLanguage = this.selectedLanguageA.startsWith('ar-') 
            ? this.selectedLanguageA 
            : (this.selectedLanguageB.startsWith('ar-') ? this.selectedLanguageB : 'ar-SA');
        }
        // Check for Latin/English characters
        else if (/[a-zA-Z]/.test(word)) {
          wordLanguage = this.selectedLanguageA.startsWith('en-') 
            ? this.selectedLanguageA 
            : (this.selectedLanguageB.startsWith('en-') ? this.selectedLanguageB : 'en-US');
        }
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
      segments.push({
        text: currentSegment.trim(),
        language: currentLanguage || this.detectLanguageFromText(currentSegment) || ''
      });
    }
    
    return segments;
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
    this.lowConfidenceCount = 0;
    this.languageMismatchCount = 0;
    this.lastLanguageCheck = '';
    this.lastLanguageCheckTime = 0;
    this.lastAddedWords = []; // Reset tracked words
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

  getCompactHistory(): string {
    if (this.transcriptHistory.length === 0) {
      return '';
    }
    
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



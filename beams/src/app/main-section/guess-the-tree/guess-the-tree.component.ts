import { Component, OnInit } from '@angular/core';

interface Tree {
  id: string;
  name: string;
  revealed: boolean;
  inputs: string[][];
  hints?: Set<string>; // Set של "rowIndex-charIndex" של hints
}

@Component({
  selector: 'app-guess-the-tree',
  templateUrl: './guess-the-tree.component.html',
  styleUrls: ['./guess-the-tree.component.css']
})
export class GuessTheTreeComponent implements OnInit {
  // שלושת העצים
  trees: Tree[] = [
    { id: 'tree1', name: 'קרמבולה', revealed: false, inputs: [], hints: new Set() },
    { id: 'tree2', name: 'מנגו מאיה', revealed: false, inputs: [], hints: new Set() },
    { id: 'tree3', name: 'לימון סיני', revealed: false, inputs: [], hints: new Set() }
  ];

  currentTreeIndex: number = 0;
  showTitleAnimation: boolean = true;
  showConfetti: boolean = false;
  allRevealed: boolean = false;
  showGuessResult: boolean = false;
  guessResultMessage: string = '';
  guessResultType: 'success' | 'failure' = 'success';
  
  // הודעות כישלון חמודות
  failureMessages: string[] = [
    '😅 לא נורא אמא! תנסי שוב, אני מאמין בך! 😊',
    '🤗 חסרת מזל הפעם! אבל את אלופה ואני יודע שתתגברי! 🌟',
    '💪 לא הצלחת הפעם... אבל את תמיד מצליחה! נסי שוב! ❤️',
    '😌 עוד ניסיון אחד אמא! אני יודע שאת יכולה! 🙏',
    '🌈 אין דבר כזה כישלון, רק ניסיונות! נסי שוב! ✨',
    '👑 אמא, את היורשת המלכותית! עוד נסיון ינצח! 💎',
    '🌟 לא משנה כמה פעמים, את תמיד תוכלי! נסי שוב! 🌈',
    '🎯 הקסם שלך עובד בשיבוץ! עוד ניסיון לא יזיק! ✨',
    '💝 את הכי טובה בעולם! נסי עוד פעם ואני בטוח שתתגברי! 🌸',
    '🥰 אמא יקרה שלי, את הכי חזקה! נסי שוב! 💖'
  ];
  
  // הודעות הצלחה לכל עץ
  getSuccessMessage(treeIndex: number): string {
    const messages = [
      '🎉 אימוץ! כל הכבוד, חשפת את העץ הראשון - קרמבולה! 🍉✨',
      '🎉 וואו! את אלופה! חשפת את מנגו מאיה שכזאת! כמו שאת אוהבת! 🥭🌟',
      '🎉 מזל טוב אמא! את חושפת את לימון סיני! את סיימת את כל המשחק! 🍋💖'
    ];
    return messages[treeIndex];
  }

  ngOnInit() {
    // אתחל את הנתונים
    this.trees.forEach(tree => {
      const words = tree.name.split(' ');
      tree.inputs = words.map(word => word.split('').map(() => ''));
    });

    // הסתר את אנימציית הכותרת אחרי זמן והעבר פוקוס לאות הראשונה של העץ הראשון
    setTimeout(() => {
      this.showTitleAnimation = false;
      // פוקוס על האות הראשונה של העץ הראשון
      setTimeout(() => {
        const element = document.getElementById(`input-0-0-0`);
        element?.focus();
      }, 100);
    }, 3000);
  }

  getCurrentTree(): Tree {
    return this.trees[this.currentTreeIndex];
  }

  getInputValue(rowIndex: number, charIndex: number): string {
    const tree = this.getCurrentTree();
    const row = tree.inputs[rowIndex];
    return row && row[charIndex] || '';
  }

  setInputValue(treeIndex: number, rowIndex: number, charIndex: number, value: string): void {
    // רק לעץ הנוכחי מותר להקליד
    if (treeIndex !== this.currentTreeIndex) {
      return;
    }
    
    const tree = this.trees[treeIndex];
    if (!tree.revealed && tree.inputs[rowIndex] && tree.inputs[rowIndex][charIndex] === '') {
      const row = [...tree.inputs[rowIndex]];
      row[charIndex] = value.toUpperCase();
      tree.inputs = tree.inputs.map((r, i) => i === rowIndex ? row : r);
      
      // חכה קצת ואז עבור לתיבה הבאה או בדוק את הניחוש
      setTimeout(() => {
        // מצא את התיבה הבאה הפנויה (לא "revealed" ולא מלאה)
        const nextInput = this.findNextTrulyEmptyInput(rowIndex, charIndex, tree);
        if (nextInput) {
          // יש תיבה פנויה - עבור אליה
          const [nextRow, nextChar] = nextInput;
          const element = document.getElementById(`input-${treeIndex}-${nextRow}-${nextChar}`);
          element?.focus();
        } else {
          // אין תיבות פנויות - בדוק את הניחוש
          console.log('DEBUG: No empty inputs found, checking guess for tree:', tree.name);
          this.checkAndHandleGuess(tree, treeIndex);
        }
      }, 50);
    }
  }

  findNextTrulyEmptyInput(rowIndex: number, charIndex: number, tree: Tree): [number, number] | null {
    const words = tree.name.split(' ');
    
    // איטרציה על כל המילים והאותיות מהמיקום הנוכחי
    for (let i = rowIndex; i < words.length; i++) {
      const startJ = (i === rowIndex) ? charIndex + 1 : 0;
      
      for (let j = startJ; j < words[i].length; j++) {
        // בדוק שהאות לא גלויה ולא מלאה
        if (!this.isCharRevealed(tree, i, j) && !tree.inputs[i][j]) {
          return [i, j];
        }
      }
    }
    
    return null;
  }

  findNextEmptyInput(rowIndex: number, charIndex: number, tree: Tree): [number, number] | null {
    const words = tree.name.split(' ');
    
    // איטרציה על כל המילים והאותיות מהמיקום הנוכחי
    for (let i = rowIndex; i < words.length; i++) {
      // התחל מהמיקום הבא במילה הנוכחית, או מההתחלה במילים הבאות
      const startJ = (i === rowIndex) ? charIndex + 1 : 0;
      
      for (let j = startJ; j < words[i].length; j++) {
        // בדוק אם האות לא גלויה (לא חלק מ-"revealed")
        if (!this.isCharRevealed(tree, i, j)) {
          return [i, j];
        }
      }
    }
    
    // לא נמצאו תיבות פנויות
    return null;
  }

  checkAndHandleGuess(tree: Tree, treeIndex: number): void {
    console.log('DEBUG: checkAndHandleGuess called for tree:', treeIndex);
    
    // אם העץ כבר נחשף - אל תוצג הודעת כישלון
    if (tree.revealed) {
      console.log('DEBUG: Tree already revealed, returning');
      return;
    }
    
    const words = tree.name.split(' ');
    
    // ספור רק תיבות שאינן גלויות (לא "revealed")
    let nonRevealedChars = 0;
    let filledNonRevealedChars = 0;
    
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        if (!this.isCharRevealed(tree, i, j)) {
          nonRevealedChars++;
          if (tree.inputs[i] && tree.inputs[i][j]) {
            filledNonRevealedChars++;
          }
        }
      }
    }
    
    console.log('DEBUG: nonRevealedChars:', nonRevealedChars, 'filledNonRevealedChars:', filledNonRevealedChars);
    
    // בדוק אם יש תיבות לא-גלויות וצריך לבדוק את הניחוש
    const needsCheck = (filledNonRevealedChars === nonRevealedChars && nonRevealedChars > 0) || 
                      (nonRevealedChars === 0 && this.isAllInputsFilled(tree));
    
    if (needsCheck) {
      console.log('DEBUG: Checking guess...');
      if (this.checkGuess()) {
        console.log('DEBUG: Guess is CORRECT!');
        // ניחוש נכון!
        this.showGuessResult = true;
        this.guessResultMessage = this.getSuccessMessage(treeIndex);
        this.guessResultType = 'success';
        
        setTimeout(() => {
          this.showGuessResult = false;
          this.revealTree();
          // עבר לעץ הבא אם יש
          if (treeIndex < this.trees.length - 1) {
            this.currentTreeIndex++;
            setTimeout(() => {
              const nextTree = this.trees[this.currentTreeIndex];
              const firstEmptyInput = this.findFirstEmptyInputInTree(nextTree);
              if (firstEmptyInput) {
                const [rowIndex, charIndex] = firstEmptyInput;
                const element = document.getElementById(`input-${this.currentTreeIndex}-${rowIndex}-${charIndex}`);
                element?.focus();
              }
            }, 100);
          }
        }, 1000);
      } else {
        console.log('DEBUG: Guess is WRONG!');
        // ניחוש שגוי
        this.showGuessResult = true;
        this.guessResultMessage = this.getRandomFailureMessage();
        this.guessResultType = 'failure';
        
        setTimeout(() => {
          this.revealRandomLetter();
          this.resetNonRevealedInputs(tree);
          this.showGuessResult = false;
          
          // העבר פוקוס לאינפוט הראשון שפנוי
          setTimeout(() => {
            const firstEmptyInput = this.findFirstEmptyInputInTree(tree);
            if (firstEmptyInput) {
              const [rowIndex, charIndex] = firstEmptyInput;
              const element = document.getElementById(`input-${treeIndex}-${rowIndex}-${charIndex}`);
              element?.focus();
            }
          }, 100);
        }, 3000);
      }
    }
  }
  
  findFirstEmptyInputInTree(tree: Tree): [number, number] | null {
    const words = tree.name.split(' ');
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        // בדוק אם האות הזו לא revealed
        if (!this.isCharRevealed(tree, i, j)) {
          // אם היא לא revealed, בדוק אם היא ריקה
          const isEmpty = !tree.inputs[i] || !tree.inputs[i][j] || tree.inputs[i][j] === '';
          if (isEmpty) {
            return [i, j];
          }
        }
      }
    }
    return null;
  }

  isAllInputsFilled(tree: Tree): boolean {
    const words = tree.name.split(' ');
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        if (!tree.inputs[i] || !tree.inputs[i][j]) {
          return false;
        }
      }
    }
    return true;
  }

  focusNextEmptyInput(tree: Tree): void {
    const words = tree.name.split(' ');
    
    // מצא את ה-input הפנוי הראשון
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        if (!this.isCharRevealed(tree, i, j) && !tree.inputs[i][j]) {
          setTimeout(() => {
            const element = document.getElementById(`input-${i}-${j}`);
            element?.focus();
          }, 10);
          return;
        }
      }
    }
  }

  moveToNextInput(treeIndex: number, rowIndex: number, charIndex: number): void {
    const tree = this.trees[treeIndex];
    const words = tree.name.split(' ');
    const currentWord = words[rowIndex];
    
    if (charIndex < currentWord.length - 1) {
      // עדיין באותה מילה - עבור לאות הבאה
      const nextCharIndex = charIndex + 1;
      if (!this.isCharRevealed(tree, rowIndex, nextCharIndex)) {
        setTimeout(() => {
          const element = document.getElementById(`input-${treeIndex}-${rowIndex}-${nextCharIndex}`);
          element?.focus();
        }, 10);
      }
    } else if (rowIndex < words.length - 1) {
      // עבר למילה הבאה
      setTimeout(() => {
        const element = document.getElementById(`input-${treeIndex}-0-${rowIndex + 1}`);
        element?.focus();
      }, 10);
    }
  }

  isCharRevealed(tree: Tree, rowIndex: number, charIndex: number): boolean {
    // רק hints נחשבים כ-revealed
    const hintKey = `${rowIndex}-${charIndex}`;
    return tree.hints?.has(hintKey) || false;
  }

  checkGuess(): boolean {
    const tree = this.getCurrentTree();
    const userGuess = tree.inputs.map(row => row.join('')).join(' ').trim();
    console.log('DEBUG: checkGuess - userGuess:', userGuess, 'tree.name:', tree.name);
    const isCorrect = userGuess === tree.name;
    console.log('DEBUG: checkGuess result:', isCorrect);
    return isCorrect;
  }

  onKeyDown(event: KeyboardEvent, treeIndex: number, rowIndex: number, charIndex: number): void {
    // רק לעץ הנוכחי מותר להקליד
    if (treeIndex !== this.currentTreeIndex) {
      return;
    }
    
    const tree = this.trees[treeIndex];
    
    if (event.key === 'Backspace') {
      const currentRow = tree.inputs[rowIndex];
      if (currentRow && currentRow[charIndex]) {
        // יש תוכן - מחק אותה
        const row = [...tree.inputs[rowIndex]];
        row[charIndex] = '';
        tree.inputs = tree.inputs.map((r, i) => i === rowIndex ? row : r);
      } else {
        // אין תוכן - חזור לאות הקודמת
        this.moveToPreviousInput(treeIndex, rowIndex, charIndex);
      }
    }
  }

  moveToPreviousInput(treeIndex: number, rowIndex: number, charIndex: number): void {
    if (charIndex > 0) {
      // חזור לאות הקודמת באותה מילה
      setTimeout(() => {
        const element = document.getElementById(`input-${treeIndex}-${rowIndex}-${charIndex - 1}`);
        element?.focus();
      }, 10);
    } else if (rowIndex > 0) {
      // חזור לאות האחרונה של המילה הקודמת
      const tree = this.trees[treeIndex];
      const words = tree.name.split(' ');
      const prevWordLength = words[rowIndex - 1].length;
      setTimeout(() => {
        const element = document.getElementById(`input-${treeIndex}-${rowIndex - 1}-${prevWordLength - 1}`);
        element?.focus();
      }, 10);
    }
  }


  revealTree(): void {
    const tree = this.getCurrentTree();
    const words = tree.name.split(' ');
    
    // חשף את העץ - כל האותיות עוברות למצב revealed
    const revealedInputs = words.map(word => word.split('').map(c => c));
    tree.inputs = revealedInputs;
    tree.revealed = true;
    
    // הוסף את כל האותיות כ-hints (במצב revealed)
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        tree.hints?.add(`${i}-${j}`);
      }
    }
    
    // הצג אפקט קונפטי
    this.showConfetti = true;

    // בדוק אם כל העצים נחשפו
    setTimeout(() => {
      this.checkAllRevealed();
    }, 2000);

    // הסתר קונפטי אחרי זמן
    setTimeout(() => {
      this.showConfetti = false;
    }, 2000);
  }

  revealRandomLetter(): void {
    const tree = this.getCurrentTree();
    const words = tree.name.split(' ');
    
    // מצא אות שלא נתגלתה עדיין (לא hint)
    const revealedPositions = tree.hints || new Set<string>();
    const availablePositions: number[][] = [];
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < words[i].length; j++) {
        const hintKey = `${i}-${j}`;
        if (!revealedPositions.has(hintKey)) {
          availablePositions.push([i, j]);
        }
      }
    }

    if (availablePositions.length > 0) {
      const randomPos = availablePositions[Math.floor(Math.random() * availablePositions.length)];
      const [rowIndex, charIndex] = randomPos;
      
      // הוסף hint
      tree.hints?.add(`${rowIndex}-${charIndex}`);
      
      // חשף את האות
      const row = [...tree.inputs[rowIndex]];
      row[charIndex] = words[rowIndex][charIndex];
      tree.inputs = tree.inputs.map((r, i) => i === rowIndex ? row : r);
      
      // אתחל את השאר
      this.resetNonRevealedInputs(tree);
    }
  }

  resetNonRevealedInputs(tree: Tree): void {
    const words = tree.name.split(' ');
    const newInputs = tree.inputs.map((row, rowIndex) => 
      row.map((char, charIndex) => 
        this.isCharRevealed(tree, rowIndex, charIndex) ? char : ''
      )
    );
    tree.inputs = newInputs;
  }

  checkAllRevealed(): void {
    if (this.trees.every(tree => tree.revealed)) {
      this.allRevealed = true;
      this.showConfetti = true;
      
      // הודעה אחרונה לאמא
      setTimeout(() => {
        this.showGuessResult = true;
        this.guessResultMessage = '💖 אמא היקרה שלי, אני אוהב אותך מעל הכל! תודה על כל דבר שלך! 💖';
        this.guessResultType = 'success';
        
        setTimeout(() => {
          this.showGuessResult = false;
        }, 3000);
      }, 2000);
    }
  }

  switchTree(index: number): void {
    if (!this.allRevealed) {
      this.currentTreeIndex = index;
      this.showConfetti = false;
    }
  }

  canSwitchTree(): boolean {
    return !this.allRevealed;
  }

  getRandomConfetti(): string {
    const emojis = ['🎉', '🎊', '🎈', '🎁', '🎂', '🎅', '✨', '🎃'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
  
  getRandomFailureMessage(): string {
    const randomIndex = Math.floor(Math.random() * this.failureMessages.length);
    return this.failureMessages[randomIndex];
  }
}

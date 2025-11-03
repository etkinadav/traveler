import { Component, Input, ViewChild, ElementRef, OnInit, AfterViewInit, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-drawing',
  templateUrl: './drawing.component.html',
  styleUrls: ['./drawing.component.css']
})
export class DrawingComponent implements OnInit, AfterViewInit, OnChanges {
  @Input() isDrillingMode: boolean = false; // flag שמציין שזה מצב קידוח
  @Input() beamType: string = ''; // סוג הקורה (קורת רגל, קורת מדף וכו')
  @Input() product: any = null; // כל האובייקט של המוצר בקונפיגורציה הנוכחית
  @Input() beamLength: number = 0; // אורך הקורה בס"מ
  @Input() beamWidth: number = 0; // רוחב הקורה בס"מ
  @ViewChild('container', { static: false }) containerRef!: ElementRef;
  
  calculatedHeight: number = 10; // גובה ברירת מחדל
  
  // ערכי דיבוג
  containerWidth: number = 0; // X - רוחב הקונטיינר בפיקסלים
  containerHeight: number = 0; // Y - גובה הקונטיינר בפיקסלים
  beamLengthPx: number = 0; // x - אורך הקורה בפיקסלים
  beamWidthPx: number = 0; // y - עובי הקורה בפיקסלים
  
  // מערך הקדחים
  holes: Array<{x: number, y: number, left: number, top: number}> = [];
  
  ngOnInit() {
    this.calculateHeight();
  }
  
  /**
   * מאתחל קדח אחד לפי ערכי X ו-Y יחסיים (0-1)
   */
  initializeHoles() {
    if (this.holes.length === 0) {
      // קדח אחד בערכי X = 0.25, Y = 0.5
      this.createHole(0.25, 0.5);
    } else {
      // אם כבר יש קדחים, רק נעדכן את המיקומים
      this.updateHolesPositions();
    }
  }
  
  /**
   * יוצר קדח לפי ערכי X ו-Y יחסיים (0-1)
   * X = 0 → שמאל, X = 1 → ימין
   * Y = 0 → למעלה, Y = 1 → למטה
   * @param x - מיקום אופקי יחסי (0 עד 1)
   * @param y - מיקום אנכי יחסי (0 עד 1)
   */
  createHole(x: number, y: number) {
    if (!this.containerRef || !this.containerRef.nativeElement) {
      return;
    }
    
    const rectangle = this.containerRef.nativeElement.querySelector('.beam-rectangle');
    if (!rectangle) {
      return;
    }
    
    // שימוש ב-getBoundingClientRect() כדי לקבל מידות מדויקות
    const rect = rectangle.getBoundingClientRect();
    const rectWidth = rect.width;  // כולל border
    const rectHeight = rect.height; // כולל border
    
    // חישוב מיקום לפי ערכי X ו-Y יחסיים
    // X = 0 → left = 0, X = 1 → left = rectWidth
    // Y = 0 → top = 0, Y = 1 → top = rectHeight
    const finalLeft = rectWidth * x;
    const finalTop = rectHeight * y;
    
    // מרכז העיגול - עם transform: translate(-50%, -50%) המרכז יהיה ב-(finalLeft, finalTop)
    this.holes.push({
      x: x,
      y: y,
      left: finalLeft,
      top: finalTop
    });
  }
  
  /**
   * מעדכן את מיקומי כל הקדחים לאחר שינויי מידות
   */
  updateHolesPositions() {
    if (!this.containerRef || !this.containerRef.nativeElement) {
      return;
    }
    
    const rectangle = this.containerRef.nativeElement.querySelector('.beam-rectangle');
    if (!rectangle) {
      return;
    }
    
    // שימוש ב-getBoundingClientRect() כדי לקבל מידות מדויקות
    const rect = rectangle.getBoundingClientRect();
    const rectWidth = rect.width;  // כולל border
    const rectHeight = rect.height; // כולל border
    
    this.holes = this.holes.map(hole => {
      // חישוב מיקום לפי ערכי X ו-Y יחסיים (0-1)
      const finalLeft = rectWidth * hole.x;
      const finalTop = rectHeight * hole.y;
      
      return {
        ...hole,
        left: finalLeft,
        top: finalTop
      };
    });
  }
  
  ngAfterViewInit() {
    this.calculateHeight();
  }
  
  ngOnChanges(changes: SimpleChanges) {
    if (changes['beamLength'] || changes['beamWidth']) {
      this.calculateHeight();
    }
  }
  
  calculateHeight() {
    if (!this.beamLength || !this.beamWidth || !this.containerRef) {
      this.calculatedHeight = 10;
      return;
    }
    
    // חישוב גובה לשמירה על פרופורציה נכונה של הקורה
    // אם רוחב הקורה הוא beamWidth ואורך הקורה הוא beamLength,
    // אז היחס בין אורך לרוחב הוא beamLength / beamWidth
    // אם רוחב הקונטיינר הוא containerWidth, אז הגובה צריך להיות:
    // (רוחב_קונטיינר * רוחב_קורה) / אורך_קורה = containerWidth * (beamWidth / beamLength)
    setTimeout(() => {
      if (this.containerRef && this.containerRef.nativeElement) {
        const containerWidth = this.containerRef.nativeElement.offsetWidth;
        const containerHeight = this.containerRef.nativeElement.offsetHeight;
        
        // שמירת ערכי הקונטיינר
        this.containerWidth = containerWidth; // X
        this.containerHeight = containerHeight; // Y
        
        if (containerWidth > 0 && this.beamLength > 0 && this.beamWidth > 0) {
          // חישוב גובה לפי הנוסחה המדויקת:
          // גובה = (רוחב_קורה / אורך_קורה) * רוחב_קונטיינר
          // דוגמה: רוחב קורה = 5 ס"מ, אורך קורה = 40 ס"מ, רוחב קונטיינר = 200px
          // גובה = (5 / 40) * 200 = 0.125 * 200 = 25px
          this.calculatedHeight = (this.beamWidth / this.beamLength) * containerWidth;
          
          // חישוב ערכים בפיקסלים:
          // x - אורך הקורה בפיקסלים = רוחב הקונטיינר (כי המלבן הוא 100% רוחב)
          this.beamLengthPx = containerWidth;
          
          // y - עובי הקורה בפיקסלים = הגובה המחושב
          this.beamWidthPx = this.calculatedHeight;
          
          // הגבלת מינימום ומקסימום
          if (this.calculatedHeight < 3) {
            this.calculatedHeight = 3;
            this.beamWidthPx = 3;
          }
          if (this.calculatedHeight > 45) {
            this.calculatedHeight = 45;
            this.beamWidthPx = 45;
          }
          
          // עדכון מיקומי הקדחים לאחר חישוב הגובה
          setTimeout(() => {
            if (this.holes.length === 0) {
              this.initializeHoles();
            } else {
              this.updateHolesPositions();
            }
          }, 10);
        } else {
          // אפס ערכים אם אין נתונים
          this.beamLengthPx = 0;
          this.beamWidthPx = 0;
        }
      }
    }, 0);
  }
}

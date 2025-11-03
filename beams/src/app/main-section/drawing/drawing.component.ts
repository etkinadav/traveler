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
  
  ngOnInit() {
    this.calculateHeight();
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
        } else {
          // אפס ערכים אם אין נתונים
          this.beamLengthPx = 0;
          this.beamWidthPx = 0;
        }
      }
    }, 0);
  }
}

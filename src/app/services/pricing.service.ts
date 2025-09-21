import { Injectable } from '@angular/core';
import { BinPacking } from 'binpacking';

@Injectable({
  providedIn: 'root'
})
export class PricingService {

  constructor() { }

  /**
   * חישוב מחיר עבור נתוני קורות
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns מחיר כולל
   */
  async calculatePrice(beamsData: any[], forgingData: any[]): Promise<number> {
    // שימוש באלגוריתם חיתוך איטרטיבי משופר
    const result = await this.calculateIterativeOptimalCutting(beamsData, forgingData);
    return result.totalPrice;
  }
  
  /**
   * חישוב אופטימלי של חיתוך קורות עץ
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns אובייקט עם מחיר כולל ותוכנית חיתוך מפורטת
   */
  calculateOptimalCutting(beamsData: any[], forgingData: any[]): { totalPrice: number, cuttingPlan: any[] } {
    let totalPrice = 0;
    let allCuttingPlans: any[] = [];
    
    // עיבוד כל סוג קורה
    beamsData.forEach((beamData, index) => {
      
      // יצירת רשימת חיתוכים נדרשים
      const requiredCuts: number[] = [];


      
      // שימוש ב-sizes במקום totalSizes כדי לקבל את כל החתיכות
      beamData.sizes.forEach((cutLength: number) => {
        requiredCuts.push(cutLength);
      });
      

      
      // קבלת אפשרויות הקורות הזמינות
      const beamOptions = this.getBeamOptions(beamData.type);

      
      // חישוב אופטימלי עם binpacking
      const optimalSolution = this.calculateOptimalCuttingForBeamType(requiredCuts, beamOptions);

      
      // הדפסת לוגים מפורטים לכל קורה

      optimalSolution.beams.forEach((beam: any, beamIndex: number) => {
        const beamLength = beam.totalLength;
        const beamPrice = this.getBeamPriceByLength(beamLength, beamData.type);
        const cuts = beam.cuts;
        const remaining = beam.remaining;
        

        
        // הוספה לתוכנית החיתוך הכוללת עם כל הפרטים
        allCuttingPlans.push({
          beamNumber: allCuttingPlans.length + 1,
          beamLength: beamLength,
          beamPrice: beamPrice,
          cuts: cuts,
          remaining: remaining,
          waste: remaining,
          beamType: beamData.beamTranslatedName || beamData.beamName
        });
      });

      
      // חישוב מחיר עבור הפתרון האופטימלי
      const beamTypePrice = this.calculatePriceForOptimalSolution(optimalSolution, beamData.type);


      
      totalPrice += beamTypePrice;
    });
    
    // עיבוד ברגים (ללא חיתוך אופטימלי)
    forgingData.forEach((forgingItem, index) => {

      
      const length = forgingItem.length;
      const count = forgingItem.count;
      
      const pricePerLength = this.findPriceForLength(forgingItem.type, length);
      const forgingPrice = pricePerLength * count;
      
      totalPrice += forgingPrice;
    });
    


    
    return {
      totalPrice: totalPrice,
      cuttingPlan: allCuttingPlans
    };
  }
  
  /**
   * חישוב איטרטיבי משופר של חיתוך קורות עץ
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns אובייקט עם מחיר כולל ותוכנית חיתוך מפורטת
   */
  private async calculateIterativeOptimalCutting(beamsData: any[], forgingData: any[]): Promise<{ totalPrice: number, cuttingPlan: any[] }> {

    
    let bestSolution = null;
    let bestCost = Infinity;
    let iteration = 0;
    let maxIterations = 20;
    let sameResultCount = 0;
    let lastResult = null;
    let maxSameResults = 3;
    
    const startTime = Date.now();
    
    while (iteration < maxIterations) {
      iteration++;

      
      // חישוב פתרון נוכחי עם שינויים אקראיים קלים
      const currentSolution = this.calculateOptimalCuttingWithVariations(beamsData, forgingData, iteration);
      

      
      // בדיקה אם זה הפתרון הטוב ביותר עד כה
      if (currentSolution.totalPrice < bestCost) {
        bestCost = currentSolution.totalPrice;
        bestSolution = currentSolution;

        sameResultCount = 0; // איפוס מונה התוצאות הזהות
      } else {
        sameResultCount++;

      }
      
      // בדיקה אם הגענו לאותה תוצאה יותר מדי פעמים
      if (sameResultCount >= maxSameResults) {

        break;
      }
      
      // בדיקה אם עברו יותר מ-3 שניות
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 3000) {

        break;
      }
      
      lastResult = currentSolution.totalPrice;
      
      // השהיה קצרה בין איטרציות
      if (iteration < maxIterations) {
        await this.delay(100); // השהיה של 100ms בין איטרציות
      }
    }
    




    
    return bestSolution || this.calculateOptimalCutting(beamsData, forgingData);
  }
  
  /**
   * חישוב אופטימלי עם וריאציות אקראיות
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @param iteration - מספר האיטרציה
   * @returns פתרון עם וריאציות
   */
  private calculateOptimalCuttingWithVariations(beamsData: any[], forgingData: any[], iteration: number): { totalPrice: number, cuttingPlan: any[] } {

    
    let totalPrice = 0;
    let allCuttingPlans: any[] = [];
    
    // עיבוד כל סוג קורה עם וריאציות
    beamsData.forEach((beamData, index) => {

      
      // יצירת רשימת חיתוכים נדרשים
      const requiredCuts: number[] = [];
      beamData.sizes.forEach((cutLength: number) => {
        requiredCuts.push(cutLength);
      });
      
      // הוספת וריאציות אקראיות קלות
      const variedCuts = this.addRandomVariations(requiredCuts, iteration);
      


      
      // קבלת אפשרויות הקורות הזמינות
      const beamOptions = this.getBeamOptions(beamData.type);
      
      // חישוב אופטימלי עם binpacking
      const optimalSolution = this.calculateOptimalCuttingForBeamType(variedCuts, beamOptions);
      
      // הדפסת לוגים מפורטים לכל קורה
      optimalSolution.beams.forEach((beam: any, beamIndex: number) => {
        const beamLength = beam.totalLength;
        const beamPrice = this.getBeamPriceByLength(beamLength, beamData.type);
        const cuts = beam.cuts;
        const remaining = beam.remaining;
        

        
        // הוספה לתוכנית החיתוך הכוללת עם כל הפרטים
        allCuttingPlans.push({
          beamNumber: allCuttingPlans.length + 1,
          beamLength: beamLength,
          beamPrice: beamPrice,
          cuts: cuts,
          remaining: remaining,
          waste: remaining,
          beamType: beamData.beamTranslatedName || beamData.beamName
        });
      });
      
      // חישוב מחיר עבור הפתרון האופטימלי
      const beamTypePrice = this.calculatePriceForOptimalSolution(optimalSolution, beamData.type);
      totalPrice += beamTypePrice;
    });
    
    // עיבוד ברגים (ללא חיתוך אופטימלי)
    forgingData.forEach((forgingItem, index) => {
      const length = forgingItem.length;
      const count = forgingItem.count;
      
      const pricePerLength = this.findPriceForLength(forgingItem.type, length);
      const forgingPrice = pricePerLength * count;
      
      totalPrice += forgingPrice;
    });
    
    return {
      totalPrice: totalPrice,
      cuttingPlan: allCuttingPlans
    };
  }
  
  /**
   * הוספת וריאציות אקראיות קלות לרשימת החיתוכים
   * @param cuts - רשימת חיתוכים מקורית
   * @param iteration - מספר האיטרציה
   * @returns רשימת חיתוכים עם וריאציות
   */
  private addRandomVariations(cuts: number[], iteration: number): number[] {
    const variedCuts = [...cuts];
    
    // הוספת וריאציות קלות בהתאם לאיטרציה
    if (iteration % 3 === 1) {
      // שינוי סדר החיתוכים
      return this.shuffleArray(variedCuts);
    } else if (iteration % 3 === 2) {
      // הוספת חיתוך קצר נוסף (לפעמים עוזר)
      variedCuts.push(10); // חיתוך של 10 ס"מ
      return variedCuts;
    } else {
      // שינוי קל בגודל החיתוכים
      return variedCuts.map(cut => cut + (Math.random() - 0.5) * 0.1); // שינוי של עד ±0.05 ס"מ
    }
  }
  
  /**
   * ערבוב מערך
   * @param array - המערך לערבוב
   * @returns מערך מעורבב
   */
  private shuffleArray(array: any[]): any[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * השהיה
   * @param ms - מילישניות להשהיה
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * חישוב אופטימלי של חיתוך עבור סוג קורה ספציפי
   * @param requiredCuts - רשימת אורכים נדרשים
   * @param beamOptions - אפשרויות קורות זמינות
   * @returns פתרון אופטימלי
   */
  private calculateOptimalCuttingForBeamType(requiredCuts: number[], beamOptions: any[]): any {
    if (requiredCuts.length === 0) {
      return { beams: [], totalWaste: 0, totalCost: 0 };
    }
    
    // מיון אורכים בסדר יורד (First Fit Decreasing)
    const sortedCuts = [...requiredCuts].sort((a, b) => b - a);
    
    let bestSolution = null;
    let bestCost = Infinity;
    
    // בדיקת כל אפשרות קורה
    beamOptions.forEach(beamOption => {
      const solution = this.packCutsIntoBeams(sortedCuts, beamOption.length, beamOption.price);
      
      if (solution.totalCost < bestCost) {
        bestCost = solution.totalCost;
        bestSolution = solution;
      }
    });
    
    return bestSolution || { beams: [], totalWaste: 0, totalCost: 0 };
  }
  
  /**
   * אריזה של חיתוכים לתוך קורות באורך נתון
   * @param cuts - רשימת חיתוכים
   * @param beamLength - אורך הקורה
   * @param beamPrice - מחיר הקורה
   * @returns פתרון אריזה
   */
  private packCutsIntoBeams(cuts: number[], beamLength: number, beamPrice: number): any {
    const bins: any[] = [];
    let totalWaste = 0;
    



    
    cuts.forEach((cutLength, cutIndex) => {

      
      let bestBinIndex = -1;
      let bestFit = Infinity;
      
      // חיפוש הקורה הטובה ביותר עבור החיתוך הנוכחי
      for (let i = 0; i < bins.length; i++) {

        if (bins[i].remaining >= cutLength) {
          // בחירת הקורה עם הכי פחות מקום פנוי (Best Fit)
          if (bins[i].remaining < bestFit) {
            bestFit = bins[i].remaining;
            bestBinIndex = i;

          }
        }
      }
      
      // אם נמצאה קורה מתאימה, הוספה אליה
      if (bestBinIndex !== -1) {
        bins[bestBinIndex].cuts.push(cutLength);
        bins[bestBinIndex].remaining -= cutLength;

      } else {
        // אם לא נמצאה קורה מתאימה, יצירת קורה חדשה
        bins.push({
          cuts: [cutLength],
          remaining: beamLength - cutLength,
          totalLength: beamLength
        });

      }
    });
    
    // חישוב פסולת כוללת
    bins.forEach(bin => {
      totalWaste += bin.remaining;
    });
    


    bins.forEach((bin, index) => {

    });


    

    return {
      beams: bins,
      totalWaste: totalWaste,
      totalCost: bins.length * beamPrice,
      beamCount: bins.length,
      wastePercentage: (totalWaste / (bins.length * beamLength)) * 100
    };
  }
  
  /**
   * קבלת אפשרויות קורות זמינות עבור סוג קורה
   * @param beamType - סוג הקורה
   * @returns רשימת אפשרויות קורות
   */
  private getBeamOptions(beamType: any): any[] {


    
    // בדיקה אם יש נתוני מחירים אמיתיים
    if (beamType && beamType.length && Array.isArray(beamType.length)) {

      
      // הדפסת כל נתון מחיר
      beamType.length.forEach((priceData: any, index: number) => {




      });
      
      // המרה מהנתונים האמיתיים
      const convertedOptions = beamType.length.map((priceData: any) => ({
        length: priceData.length / 10, // המרה ממ"מ לס"מ
        price: priceData.price
      }));
      

      return convertedOptions;
    }
    

    // בשלב זה נחזיר אפשרויות ברירת מחדל
    // בהמשך זה יבוא מהנתונים האמיתיים
    return [
      { length: 300, price: 50 }, // 3 מטר
      { length: 400, price: 65 }, // 4 מטר
      { length: 500, price: 80 }, // 5 מטר
      { length: 600, price: 95 }  // 6 מטר
    ];
  }
  
  /**
   * חישוב מחיר עבור פתרון אופטימלי
   * @param solution - פתרון אופטימלי
   * @param beamType - סוג הקורה
   * @returns מחיר כולל
   */
  private calculatePriceForOptimalSolution(solution: any, beamType: any): number {
    return solution.totalCost;
  }
  
  /**
   * חיפוש מחיר עבור אורך נתון
   * @param type - סוג הקורה/בורג
   * @param length - אורך בס"מ
   * @returns מחיר ליחידה
   */
  private findPriceForLength(type: any, length: number): number {

    
    // בשלב זה נחזיר תמיד מחיר קבוע לצורך בדיקה
    return 5;
  }
  
  /**
   * קבלת תוכנית חיתוך מפורטת
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns תוכנית חיתוך מפורטת
   */
  getCuttingPlan(beamsData: any[], forgingData: any[]): any[] {
    const result = this.calculateOptimalCutting(beamsData, forgingData);
    return result.cuttingPlan;
  }
  
  /**
   * קבלת מחיר קורה לפי אורך
   * @param length - אורך הקורה בס"מ
   * @param beamType - סוג הקורה עם נתוני המחירים
   * @returns מחיר הקורה
   */
  private getBeamPriceByLength(length: number, beamType?: any): number {



    
    const beamOptions = this.getBeamOptions(beamType);

    
    // הדפסת כל אפשרות
    beamOptions.forEach((option: any, index: number) => {

    });
    
    const beamOption = beamOptions.find(option => option.length === length);

    
    const price = beamOption ? beamOption.price : 0;

    
    return price;
  }
}

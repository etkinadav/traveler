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
    console.log('=== PRICING SERVICE - CALCULATING PRICE ===');
    console.log('Beams data:', beamsData);
    console.log('Forging data:', forgingData);
    
    // שימוש באלגוריתם חיתוך איטרטיבי משופר
    const result = await this.calculateIterativeOptimalCutting(beamsData, forgingData);
    console.log('PRICE! Final Result:', result);
    return result.totalPrice;
  }
  
  /**
   * חישוב אופטימלי של חיתוך קורות עץ
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns אובייקט עם מחיר כולל ותוכנית חיתוך מפורטת
   */
  calculateOptimalCutting(beamsData: any[], forgingData: any[]): { totalPrice: number, cuttingPlan: any[] } {
    console.log('PRICE! === OPTIMAL CUTTING CALCULATION ===');
    
    let totalPrice = 0;
    let allCuttingPlans: any[] = [];
    
    // עיבוד כל סוג קורה
    beamsData.forEach((beamData, index) => {
      console.log(`PRICE! === PROCESSING BEAM TYPE ${index + 1} ===`);
      console.log('PRICE! beamData:', beamData);
      console.log('PRICE! beamData.type:', beamData.type);
      console.log('PRICE! beamData.type.length:', beamData.type.length);
      
      // יצירת רשימת חיתוכים נדרשים
      const requiredCuts: number[] = [];
      console.log(`PRICE! beamData.sizes:`, beamData.sizes);
      console.log(`PRICE! beamData.totalSizes:`, beamData.totalSizes);
      
      // שימוש ב-sizes במקום totalSizes כדי לקבל את כל החתיכות
      beamData.sizes.forEach((cutLength: number) => {
        requiredCuts.push(cutLength);
      });
      
      console.log(`PRICE! Required cuts for beam type ${index + 1}:`, requiredCuts);
      
      // קבלת אפשרויות הקורות הזמינות
      const beamOptions = this.getBeamOptions(beamData.type);
      console.log(`PRICE! Available beam options:`, beamOptions);
      
      // חישוב אופטימלי עם binpacking
      const optimalSolution = this.calculateOptimalCuttingForBeamType(requiredCuts, beamOptions);
      console.log(`PRICE! Optimal solution for beam type ${index + 1}:`, optimalSolution);
      
      // הדפסת לוגים מפורטים לכל קורה
      console.log(`PRICE! === תוכנית חיתוך עבור סוג קורה ${index + 1} ===`);
      optimalSolution.beams.forEach((beam: any, beamIndex: number) => {
        const beamLength = beam.totalLength;
        const beamPrice = this.getBeamPriceByLength(beamLength, beamData.type);
        const cuts = beam.cuts;
        const remaining = beam.remaining;
        
        console.log(`PRICE! קורה באורך ${beamLength} (מחיר ${beamPrice}) → חתיכות: [${cuts.join(', ')}], נותר: ${remaining} ס"מ`);
        
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
      console.log('PRICE! '); // שורה ריקה להפרדה
      
      // חישוב מחיר עבור הפתרון האופטימלי
      const beamTypePrice = this.calculatePriceForOptimalSolution(optimalSolution, beamData.type);
      console.log(`PRICE! מחיר כולל לסוג קורה ${index + 1}: ${beamTypePrice}`);
      console.log('PRICE! '); // שורה ריקה להפרדה
      
      totalPrice += beamTypePrice;
    });
    
    // עיבוד ברגים (ללא חיתוך אופטימלי)
    forgingData.forEach((forgingItem, index) => {
      console.log(`PRICE! Processing forging ${index + 1}:`, forgingItem);
      
      const length = forgingItem.length;
      const count = forgingItem.count;
      
      const pricePerLength = this.findPriceForLength(forgingItem.type, length);
      const forgingPrice = pricePerLength * count;
      
      totalPrice += forgingPrice;
    });
    
    console.log(`PRICE! סה"כ מחיר: ${totalPrice}`);
    console.log('PRICE! === סיום חישוב אופטימלי ===');
    
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
    console.log('PRICE! === ITERATIVE OPTIMAL CUTTING CALCULATION ===');
    
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
      console.log(`PRICE! === ITERATION ${iteration} ===`);
      
      // חישוב פתרון נוכחי עם שינויים אקראיים קלים
      const currentSolution = this.calculateOptimalCuttingWithVariations(beamsData, forgingData, iteration);
      
      console.log(`PRICE! Iteration ${iteration} cost: ${currentSolution.totalPrice}`);
      
      // בדיקה אם זה הפתרון הטוב ביותר עד כה
      if (currentSolution.totalPrice < bestCost) {
        bestCost = currentSolution.totalPrice;
        bestSolution = currentSolution;
        console.log(`PRICE! New best solution found! Cost: ${bestCost}`);
        sameResultCount = 0; // איפוס מונה התוצאות הזהות
      } else {
        sameResultCount++;
        console.log(`PRICE! Same result count: ${sameResultCount}`);
      }
      
      // בדיקה אם הגענו לאותה תוצאה יותר מדי פעמים
      if (sameResultCount >= maxSameResults) {
        console.log(`PRICE! Stopping: Same result ${maxSameResults} times in a row`);
        break;
      }
      
      // בדיקה אם עברו יותר מ-3 שניות
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > 3000) {
        console.log(`PRICE! Stopping: Time limit reached (${elapsedTime}ms)`);
        break;
      }
      
      lastResult = currentSolution.totalPrice;
      
      // השהיה קצרה בין איטרציות
      if (iteration < maxIterations) {
        await this.delay(100); // השהיה של 100ms בין איטרציות
      }
    }
    
    console.log(`PRICE! === ITERATIVE CALCULATION COMPLETED ===`);
    console.log(`PRICE! Total iterations: ${iteration}`);
    console.log(`PRICE! Best cost: ${bestCost}`);
    console.log(`PRICE! Time taken: ${Date.now() - startTime}ms`);
    
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
    console.log(`PRICE! === CALCULATING WITH VARIATIONS (Iteration ${iteration}) ===`);
    
    let totalPrice = 0;
    let allCuttingPlans: any[] = [];
    
    // עיבוד כל סוג קורה עם וריאציות
    beamsData.forEach((beamData, index) => {
      console.log(`PRICE! === PROCESSING BEAM TYPE ${index + 1} (Iteration ${iteration}) ===`);
      
      // יצירת רשימת חיתוכים נדרשים
      const requiredCuts: number[] = [];
      beamData.sizes.forEach((cutLength: number) => {
        requiredCuts.push(cutLength);
      });
      
      // הוספת וריאציות אקראיות קלות
      const variedCuts = this.addRandomVariations(requiredCuts, iteration);
      
      console.log(`PRICE! Original cuts: [${requiredCuts.join(', ')}]`);
      console.log(`PRICE! Varied cuts: [${variedCuts.join(', ')}]`);
      
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
        
        console.log(`PRICE! קורה באורך ${beamLength} (מחיר ${beamPrice}) → חתיכות: [${cuts.join(', ')}], נותר: ${remaining} ס"מ`);
        
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
    
    console.log(`PRICE! === PACK CUTS INTO BEAMS ===`);
    console.log(`PRICE! Beam length: ${beamLength}cm, Price: ${beamPrice}₪`);
    console.log(`PRICE! Cuts to pack: [${cuts.join(', ')}]`);
    
    cuts.forEach((cutLength, cutIndex) => {
      console.log(`PRICE! Processing cut ${cutIndex + 1}: ${cutLength}cm`);
      
      let bestBinIndex = -1;
      let bestFit = Infinity;
      
      // חיפוש הקורה הטובה ביותר עבור החיתוך הנוכחי
      for (let i = 0; i < bins.length; i++) {
        console.log(`PRICE!   Checking bin ${i + 1}: remaining=${bins[i].remaining}cm, cuts=[${bins[i].cuts.join(', ')}]`);
        if (bins[i].remaining >= cutLength) {
          // בחירת הקורה עם הכי פחות מקום פנוי (Best Fit)
          if (bins[i].remaining < bestFit) {
            bestFit = bins[i].remaining;
            bestBinIndex = i;
            console.log(`PRICE!   Found better fit: bin ${i + 1} with ${bins[i].remaining}cm remaining`);
          }
        }
      }
      
      // אם נמצאה קורה מתאימה, הוספה אליה
      if (bestBinIndex !== -1) {
        bins[bestBinIndex].cuts.push(cutLength);
        bins[bestBinIndex].remaining -= cutLength;
        console.log(`PRICE!   Added ${cutLength}cm to bin ${bestBinIndex + 1}. New remaining: ${bins[bestBinIndex].remaining}cm`);
      } else {
        // אם לא נמצאה קורה מתאימה, יצירת קורה חדשה
        bins.push({
          cuts: [cutLength],
          remaining: beamLength - cutLength,
          totalLength: beamLength
        });
        console.log(`PRICE!   Created new bin ${bins.length} for ${cutLength}cm. Remaining: ${beamLength - cutLength}cm`);
      }
    });
    
    // חישוב פסולת כוללת
    bins.forEach(bin => {
      totalWaste += bin.remaining;
    });
    
    console.log(`PRICE! === FINAL RESULT ===`);
    console.log(`PRICE! Total bins: ${bins.length}`);
    bins.forEach((bin, index) => {
      console.log(`PRICE! Bin ${index + 1}: cuts=[${bin.cuts.join(', ')}], remaining=${bin.remaining}cm`);
    });
    console.log(`PRICE! Total waste: ${totalWaste}cm, Total cost: ${bins.length * beamPrice}₪`);
    console.log(`PRICE! === END PACK CUTS ===`);
    
    console.log(`PRICE! === END PACK CUTS ===`, {
      beams: bins,
      totalWaste: totalWaste,
      totalCost: bins.length * beamPrice,
      beamCount: bins.length,
      wastePercentage: (totalWaste / (bins.length * beamLength)) * 100
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
    console.log('PRICE! === GET BEAM OPTIONS ===');
    console.log('PRICE! beamType:', beamType);
    
    // בדיקה אם יש נתוני מחירים אמיתיים
    if (beamType && beamType.length && Array.isArray(beamType.length)) {
      console.log('PRICE! Found real pricing data:', beamType.length);
      
      // הדפסת כל נתון מחיר
      beamType.length.forEach((priceData: any, index: number) => {
        console.log(`PRICE! Price data ${index + 1}:`, priceData);
        console.log(`PRICE!   - length (mm): ${priceData.length}`);
        console.log(`PRICE!   - length (cm): ${priceData.length / 10}`);
        console.log(`PRICE!   - price: ${priceData.price}`);
      });
      
      // המרה מהנתונים האמיתיים
      const convertedOptions = beamType.length.map((priceData: any) => ({
        length: priceData.length / 10, // המרה ממ"מ לס"מ
        price: priceData.price
      }));
      
      console.log('PRICE! Converted beam options:', convertedOptions);
      return convertedOptions;
    }
    
    console.log('PRICE! Using default pricing data');
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
    console.log(`PRICE! Finding price for type: ${type}, length: ${length}cm`);
    
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
    console.log(`PRICE! === GET BEAM PRICE BY LENGTH ===`);
    console.log(`PRICE! Looking for price for length: ${length}cm`);
    console.log(`PRICE! beamType provided:`, beamType);
    
    const beamOptions = this.getBeamOptions(beamType);
    console.log('PRICE! Available beam options:', beamOptions);
    
    // הדפסת כל אפשרות
    beamOptions.forEach((option: any, index: number) => {
      console.log(`PRICE! Option ${index + 1}: length=${option.length}cm, price=${option.price}`);
    });
    
    const beamOption = beamOptions.find(option => option.length === length);
    console.log(`PRICE! Found beam option:`, beamOption);
    
    const price = beamOption ? beamOption.price : 0;
    console.log(`PRICE! Returning price: ${price}`);
    
    return price;
  }
}

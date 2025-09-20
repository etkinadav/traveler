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
  calculatePrice(beamsData: any[], forgingData: any[]): number {
    console.log('=== PRICING SERVICE - CALCULATING PRICE ===');
    console.log('Beams data:', beamsData);
    console.log('Forging data:', forgingData);
    
    // שימוש באלגוריתם חיתוך אופטימלי
    const result = this.calculateOptimalCutting(beamsData, forgingData);
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
      beamData.totalSizes.forEach((sizeData: any) => {
        for (let i = 0; i < sizeData.count; i++) {
          requiredCuts.push(sizeData.length);
        }
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
        
        console.log(`PRICE! קורה באורך ${beamLength} (מחיר ${beamPrice}) → חתיכות: [${cuts.join(', ')}]`);
        
        // הוספה לתוכנית החיתוך הכוללת
        allCuttingPlans.push({
          beamNumber: allCuttingPlans.length + 1,
          beamLength: beamLength,
          beamPrice: beamPrice,
          cuts: cuts,
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
    
    cuts.forEach(cutLength => {
      let placed = false;
      
      // חיפוש קורה קיימת עם מקום פנוי
      for (let i = 0; i < bins.length; i++) {
        if (bins[i].remaining >= cutLength) {
          bins[i].cuts.push(cutLength);
          bins[i].remaining -= cutLength;
          placed = true;
          break;
        }
      }
      
      // אם לא נמצאה קורה מתאימה, יצירת קורה חדשה
      if (!placed) {
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

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BinPacking } from 'binpacking';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

// ממשקים עבור ברגים
export interface ScrewPackage {
  name: string;
  translatedName: string;
  amount: number;
  price: number;
}

export interface Screw {
  _id: string;
  name: string;
  translatedName: string;
  length: number;
  width: number;
  packages: ScrewPackage[];
}

@Injectable({
  providedIn: 'root'
})
export class PricingService {
  private screwsData: Screw[] = [];
  private readonly SCREWS_API_URL = environment.apiUrl + '/screws/';

  constructor(private http: HttpClient) {
    // טעינת נתוני ברגים בעת אתחול הסרוויס
    this.loadScrewsData();
  }

  /**
   * טעינת נתוני ברגים מה-DB (בדיוק כמו שהקורות נטענים)
   */
  private async loadScrewsData() {
    try {
      this.screwsData = await firstValueFrom(this.http.get<Screw[]>(this.SCREWS_API_URL));
      console.log('✅ Screws data loaded:', this.screwsData.length, 'types');
      console.log('📦 Screws data details:', this.screwsData);
      
      // בדיקה אם יש packages לכל בורג
      this.screwsData.forEach((screw, index) => {
        if (!screw.packages || screw.packages.length === 0) {
          console.error(`❌ Screw ${index + 1} (${screw.name}) has NO packages!`);
        } else {
          console.log(`✅ Screw ${index + 1} (${screw.name}): ${screw.packages.length} packages`);
        }
      });
    } catch (error) {
      console.error('❌ Error loading screws data:', error);
      this.screwsData = [];
    }
  }

  /**
   * חישוב הקופסאות האופטימליות עבור כמות ברגים מסוימת
   * (הועבר מ-ScrewsService)
   */
  private calculateOptimalPackages(screw: Screw, requiredAmount: number): {
    packages: { package: ScrewPackage, quantity: number }[],
    totalAmount: number,
    totalPrice: number
  } {
    if (!screw || !screw.packages || screw.packages.length === 0) {
      return { packages: [], totalAmount: 0, totalPrice: 0 };
    }

    // מיון הקופסאות לפי גודל (מהגדול לקטן)
    const sortedPackages = [...screw.packages].sort((a, b) => b.amount - a.amount);

    const selectedPackages: { package: ScrewPackage, quantity: number }[] = [];
    let remainingAmount = requiredAmount;
    let totalPrice = 0;

    // אלגוריתם חמדני: בחר את הקופסה הגדולה ביותר שמתאימה
    for (const pkg of sortedPackages) {
      if (remainingAmount <= 0) break;

      const boxesNeeded = Math.ceil(remainingAmount / pkg.amount);
      
      if (boxesNeeded > 0) {
        selectedPackages.push({
          package: pkg,
          quantity: boxesNeeded
        });
        totalPrice += boxesNeeded * pkg.price;
        remainingAmount -= boxesNeeded * pkg.amount;
      }
    }

    // חישוב הכמות הסופית שהתקבלה
    const totalAmount = selectedPackages.reduce((sum, item) => 
      sum + (item.package.amount * item.quantity), 0
    );

    return {
      packages: selectedPackages,
      totalAmount: totalAmount,
      totalPrice: totalPrice
    };
  }

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
        
        // חישוב מחיר חיתוכים
        const pricePerCut = beamData.type?.pricePerCut || 0;
        // +1 לחיתוך ניקוי ראשוני של הקצה
        const numberOfCuts = cuts.length + 1;
        const totalCuttingPrice = pricePerCut * numberOfCuts;

        
        // הוספה לתוכנית החיתוך הכוללת עם כל הפרטים
        allCuttingPlans.push({
          beamNumber: allCuttingPlans.length + 1,
          beamLength: beamLength,
          beamPrice: beamPrice,
          cuts: cuts,
          remaining: remaining,
          waste: remaining,
          beamType: beamData.beamTranslatedName || beamData.beamName,
          beamWoodType: beamData.beamWoodType, // סוג העץ
          pricePerCut: pricePerCut, // מחיר לחיתוך
          numberOfCuts: numberOfCuts, // כמות חיתוכים (כולל ניקוי)
          totalCuttingPrice: totalCuttingPrice // מחיר חיתוכים כולל
        });
      });

      
      // חישוב מחיר עבור הפתרון האופטימלי
      const beamTypePrice = this.calculatePriceForOptimalSolution(optimalSolution, beamData.type);
      
      // חישוב מחיר חיתוכים כולל לסוג קורה זה (+1 לכל קורה עבור ניקוי)
      const pricePerCut = beamData.type?.pricePerCut || 0;
      const totalCutsForBeamType = optimalSolution.beams.reduce((sum: number, beam: any) => sum + beam.cuts.length + 1, 0);
      const cuttingPriceForBeamType = pricePerCut * totalCutsForBeamType;

      
      totalPrice += beamTypePrice + cuttingPriceForBeamType;
    });
    
    // עיבוד ברגים - חישוב מחיר לפי קופסאות אופטימליות
    forgingData.forEach((forgingItem, index) => {
      const length = forgingItem.length;
      const count = forgingItem.count;
      
      // העברת הכמות לפונקציה כדי לקבל מחיר כולל של קופסאות
      const forgingPrice = this.findPriceForLength(forgingItem.type, length, count);
      
      console.log(`📌 Screw item ${index + 1}: length=${length}cm, count=${count}, price=${forgingPrice}₪`);
      
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
        
        // חישוב מחיר חיתוכים
        const pricePerCut = beamData.type?.pricePerCut || 0;
        // +1 לחיתוך ניקוי ראשוני של הקצה
        const numberOfCuts = cuts.length + 1;
        const totalCuttingPrice = pricePerCut * numberOfCuts;

        
        // הוספה לתוכנית החיתוך הכוללת עם כל הפרטים
        allCuttingPlans.push({
          beamNumber: allCuttingPlans.length + 1,
          beamLength: beamLength,
          beamPrice: beamPrice,
          cuts: cuts,
          remaining: remaining,
          waste: remaining,
          beamType: beamData.beamTranslatedName || beamData.beamName,
          beamWoodType: beamData.beamWoodType, // סוג העץ
          pricePerCut: pricePerCut, // מחיר לחיתוך
          numberOfCuts: numberOfCuts, // כמות חיתוכים (כולל ניקוי)
          totalCuttingPrice: totalCuttingPrice // מחיר חיתוכים כולל
        });
      });
      
      // חישוב מחיר עבור הפתרון האופטימלי
      const beamTypePrice = this.calculatePriceForOptimalSolution(optimalSolution, beamData.type);
      
      // חישוב מחיר חיתוכים כולל לסוג קורה זה (+1 לכל קורה עבור ניקוי)
      const pricePerCut = beamData.type?.pricePerCut || 0;
      const totalCutsForBeamType = optimalSolution.beams.reduce((sum: number, beam: any) => sum + beam.cuts.length + 1, 0);
      const cuttingPriceForBeamType = pricePerCut * totalCutsForBeamType;
      
      totalPrice += beamTypePrice + cuttingPriceForBeamType;
    });
    
    // עיבוד ברגים - חישוב מחיר לפי קופסאות אופטימליות
    forgingData.forEach((forgingItem, index) => {
      const length = forgingItem.length;
      const count = forgingItem.count;
      
      // העברת הכמות לפונקציה כדי לקבל מחיר כולל של קופסאות
      const forgingPrice = this.findPriceForLength(forgingItem.type, length, count);
      
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
    const sawKerf = 0.5; // ניקיון מסור - 0.5 ס"מ לכל חיתוך
    



    
    cuts.forEach((cutLength, cutIndex) => {
      // הוספת ניקיון מסור לאורך החיתוך
      const actualCutLength = cutLength + sawKerf;

      
      let bestBinIndex = -1;
      let bestFit = Infinity;
      
      // חיפוש הקורה הטובה ביותר עבור החיתוך הנוכחי
      for (let i = 0; i < bins.length; i++) {

        if (bins[i].remaining >= actualCutLength) {
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
        bins[bestBinIndex].remaining -= actualCutLength; // שימוש ב-actualCutLength עם הניקיון

      } else {
        // אם לא נמצאה קורה מתאימה, יצירת קורה חדשה
        bins.push({
          cuts: [cutLength],
          remaining: beamLength - actualCutLength, // שימוש ב-actualCutLength עם הניקיון
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
   * @param count - כמות הברגים (אופציונלי)
   * @returns מחיר ליחידה או מחיר כולל אם סופק count
   */
  findPriceForLength(type: any, length: number, count?: number): number {
    // אם אין נתוני ברגים, החזר 0
    if (!this.screwsData || this.screwsData.length === 0) {
      console.warn('⚠️ No screws data available for pricing');
      return 0;
    }

    // מציאת הבורג הקרוב ביותר לאורך המבוקש
    const closestScrew = this.screwsData.reduce((closest, current) => {
      const currentDiff = Math.abs(current.length - length);
      const closestDiff = Math.abs(closest.length - length);
      return currentDiff < closestDiff ? current : closest;
    });

    if (!closestScrew) {
      console.warn('⚠️ No matching screw found for length:', length);
      return 0;
    }

    // בדיקה אם יש packages
    if (!closestScrew.packages || closestScrew.packages.length === 0) {
      console.warn('⚠️ Screw has no packages:', closestScrew.name);
      return 0;
    }

    // אם סופקה כמות, חשב את המחיר הכולל עבור הקופסאות האופטימליות
    if (count && count > 0) {
      const result = this.calculateOptimalPackages(closestScrew, count);
      return result.totalPrice;
    }

    // אם לא סופקה כמות, החזר מחיר ליחידה (מהקופסה הקטנה ביותר)
    const smallestPackage = closestScrew.packages.reduce((smallest, current) => 
      current.amount < smallest.amount ? current : smallest, 
      closestScrew.packages[0] // ערך התחלתי למניעת שגיאה
    );
    
    return smallestPackage.price / smallestPackage.amount;
  }
  
  /**
   * קבלת תוכנית חיתוך מפורטת
   * @param beamsData - נתוני הקורות מ-BeamsDataForPricing
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns תוכנית חיתוך מפורטת
   */
  async getCuttingPlan(beamsData: any[], forgingData: any[]): Promise<any[]> {
    const result = await this.calculateIterativeOptimalCutting(beamsData, forgingData);
    return result.cuttingPlan;
  }

  /**
   * קבלת פירוט קופסאות ברגים
   * @param forgingData - נתוני הברגים מ-ForgingDataForPricing
   * @returns רשימת קופסאות ברגים מפורטת
   */
  getScrewsPackagingPlan(forgingData: any[]): any[] {
    if (!this.screwsData || this.screwsData.length === 0) {
      return [];
    }

    // שלב 1: מציאת הבורג המתאים לכל דרישה ואיחוד ברגים זהים
    const screwRequirements = new Map<string, { screw: any, totalAmount: number, originalRequirements: any[] }>();

    forgingData.forEach((forgingItem) => {
      const length = forgingItem.length;
      const count = forgingItem.count;

      // מציאת הבורג המתאים
      const closestScrew = this.screwsData.reduce((closest, current) => {
        const currentDiff = Math.abs(current.length - length);
        const closestDiff = Math.abs(closest.length - length);
        
        // אם המרחקים שווים, בחר את הגדול יותר
        if (currentDiff === closestDiff) {
          return current.length > closest.length ? current : closest;
        }
        
        // אחרת בחר את הקרוב יותר
        return currentDiff < closestDiff ? current : closest;
      });

      if (!closestScrew) {
        return;
      }

      const screwKey = closestScrew._id;
      
      if (screwRequirements.has(screwKey)) {
        // איחוד עם בורג קיים
        const existing = screwRequirements.get(screwKey)!;
        existing.totalAmount += count;
        existing.originalRequirements.push(forgingItem);
      } else {
        // בורג חדש
        screwRequirements.set(screwKey, {
          screw: closestScrew,
          totalAmount: count,
          originalRequirements: [forgingItem]
        });
      }
    });

    // שלב 2: חישוב הקופסאות האופטימליות לכל בורג
    const packagingPlan: any[] = [];

    screwRequirements.forEach((requirement) => {
      const result = this.calculateOptimalPackages(requirement.screw, requirement.totalAmount);

      // בדיקה שיש קופסאות
      if (result.packages && result.packages.length > 0) {
        // תיקון קידוד - החלפת הטקסט השגוי בטקסט נכון
        const fixedPackage = { ...result.packages[0].package };
        
        // תיקון translatedName של הקופסא
        if (fixedPackage.translatedName && (fixedPackage.translatedName.includes('?') || fixedPackage.translatedName.includes('׳'))) {
          const amount = fixedPackage.amount;
          fixedPackage.translatedName = `קופסת ${amount} יח'`;
        }
        
        // תיקון translatedName של הבורג
        let fixedScrewTranslatedName = requirement.screw.translatedName;
        if (fixedScrewTranslatedName && (fixedScrewTranslatedName.includes('?') || fixedScrewTranslatedName.includes('׳'))) {
          const length = requirement.screw.length;
          const width = requirement.screw.width;
          fixedScrewTranslatedName = `ברגי ${width} על ${length}`;
        }
        
        packagingPlan.push({
          screwTypeName: requirement.screw.name,
          screwTranslatedName: fixedScrewTranslatedName,
          screwLength: requirement.screw.length,
          screwWidth: requirement.screw.width,
          requiredAmount: requirement.totalAmount,
          optimalPackage: fixedPackage, // הקופסא האופטימלית עם תיקון קידוד
          numPackages: result.packages[0].quantity,
          totalAmount: result.totalAmount,
          totalPrice: result.totalPrice,
          originalRequirements: requirement.originalRequirements
        });
      }
    });

    return packagingPlan;
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


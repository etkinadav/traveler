import { Injectable } from '@angular/core';

// Interface for input configuration (format 1)
export interface InputConfiguration {
  inputName: string;
  value: any;
  selectedBeamIndex?: number;
  selectedTypeIndex?: number;
}

export interface SelectedCorner {
  cornerType: string;
  cornerData: any;
}

// Interface for product configuration (format 1)
export interface ProductConfiguration {
  productName: string;
  translatedProductName: string;
  inputConfigurations: InputConfiguration[];
  selectedCorners: SelectedCorner[];
  originalProductData: any; // The original product object as it was
}

// Interface for cut lists (format 2)
export interface CutList {
  corners: {
    cornerType: string;
    length: number;
    quantity: number;
  }[];
  screws: {
    screwType: string;
    length: number;
    quantity: number;
  }[];
}

// Interface for organized arrangement (format 3)
export interface OrganizedArrangement {
  corners: {
    cornerType: string;
    length: number;
    quantity: number;
    arrangement: any; // The arrangement data after price calculation
  }[];
  screwBoxes: {
    screwType: string;
    length: number;
    quantity: number;
    boxPrice: number;
    arrangement: any; // The arrangement data after price calculation
  }[];
}

// Interface for pricing information
export interface PricingInfo {
  totalPrice: number;
  cutCornersPrice: {
    cornerPrice: number;
    cuttingPrice: number;
    cornerUnitPrice: number;
    units: number;
    total: number;
  };
  screwsPrice: {
    boxPrice: number;
    unitsPerType: { screwType: string; quantity: number }[];
    boxPricePerType: { screwType: string; price: number }[];
  };
  // מידע נוסף על עריכת המוצר
  editingInfo: {
    // האם המשתמש ערך את הכמויות (שונה מהמקורי)
    wasEdited: boolean;
    // אופציות שנבחרו (V) וכמה כל אחת עולה
    selectedOptions: {
      drawing: { enabled: boolean; price: number };
      beams: { enabled: boolean; price: number };
      cutting: { enabled: boolean; price: number };
      screws: { enabled: boolean; price: number };
    };
    // מחירים לפני ואחרי עריכה
    pricesComparison: {
      originalTotal: number;
      editedTotal: number;
      originalBeams: number;
      editedBeams: number;
      originalCutting: number;
      editedCutting: number;
      originalScrews: number;
      editedScrews: number;
    };
    // כמויות מעודכנות של קורות וברגים אחרי עריכה
    updatedQuantities: {
      beams: { beamType: string; originalQuantity: number; editedQuantity: number }[];
      screws: { screwType: string; originalQuantity: number; editedQuantity: number }[];
    };
    // האם הקורות מספיקות לבניית הרהיט
    isCuttingPossible: boolean;
  };
}

// Interface for product dimensions
export interface ProductDimensions {
  length: number; // אורך בס"מ
  width: number;   // רוחב בס"מ
  height: number; // גובה בס"מ
}

// Interface for complete basket item
export interface BasketItem {
  id: string;
  productConfiguration: ProductConfiguration;
  cutList: CutList;
  organizedArrangement: OrganizedArrangement;
  pricingInfo: PricingInfo;
  dimensions: ProductDimensions; // מידות סופיות של המוצר
  addedToBasketAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ProductBasketService {
  private basketItems: BasketItem[] = [];

  constructor() {
    // Load basket from localStorage on service initialization
    this.loadBasketFromStorage();
  }

  /**
   * Calculate final product dimensions based on configuration
   */
  calculateProductDimensions(productConfiguration: ProductConfiguration): ProductDimensions {
    const params = productConfiguration.inputConfigurations;
    
    // חיפוש פרמטרים של מידות
    let width = 0;
    let height = 0;
    let length = 0;
    
    console.log('🔍 DIMENSIONS DEBUG - inputConfigurations:', params);
    
    // חיפוש ראשון - לפי שמות פרמטרים
    params.forEach(param => {
      const paramName = param.inputName.toLowerCase();
      const value = param.value;
      
      console.log(`🔍 DIMENSIONS DEBUG - param: ${paramName}, value: ${value}, type: ${typeof value}`);
      
      if (paramName.includes('width') || paramName.includes('רוחב')) {
        width = typeof value === 'number' ? value : parseFloat(value) || 0;
        console.log(`🔍 DIMENSIONS DEBUG - width set to: ${width}`);
      } else if (paramName.includes('height') || paramName.includes('גובה')) {
        height = typeof value === 'number' ? value : parseFloat(value) || 0;
        console.log(`🔍 DIMENSIONS DEBUG - height set to: ${height}`);
      } else if (paramName.includes('length') || paramName.includes('אורך') || paramName.includes('depth') || paramName.includes('עומק')) {
        length = typeof value === 'number' ? value : parseFloat(value) || 0;
        console.log(`🔍 DIMENSIONS DEBUG - length set to: ${length}`);
      }
    });
    
    // חיפוש שני - לפי שמות נפוצים
    if (width === 0 || height === 0 || length === 0) {
      params.forEach(param => {
        const paramName = param.inputName.toLowerCase();
        const value = param.value;
        
        if (paramName.includes('x') && width === 0) {
          width = typeof value === 'number' ? value : parseFloat(value) || 0;
        } else if (paramName.includes('y') && height === 0) {
          height = typeof value === 'number' ? value : parseFloat(value) || 0;
        } else if (paramName.includes('z') && length === 0) {
          length = typeof value === 'number' ? value : parseFloat(value) || 0;
        }
      });
    }
    
    // חיפוש שלישי - לפי סדר הפרמטרים (אם יש 3 פרמטרים מספריים)
    if (width === 0 || height === 0 || length === 0) {
      const numericParams = params.filter(param => {
        const value = param.value;
        return typeof value === 'number' && value > 0;
      });
      
      console.log(`🔍 DIMENSIONS DEBUG - numericParams found: ${numericParams.length}`);
      
      if (numericParams.length >= 3) {
        // נניח שהסדר הוא: width, depth, height
        width = numericParams[0].value;
        length = numericParams[1].value;
        height = numericParams[2].value;
        console.log(`🔍 DIMENSIONS DEBUG - set by order: width=${width}, length=${length}, height=${height}`);
      }
    }
    
    console.log(`🔍 DIMENSIONS DEBUG - final values: width=${width}, height=${height}, length=${length}`);
    
    // אם עדיין לא נמצאו מידות, נשתמש בערכים ברירת מחדל
    if (width === 0 || isNaN(width)) width = 50; // 50 ס"מ ברירת מחדל
    if (height === 0 || isNaN(height)) height = 30; // 30 ס"מ ברירת מחדל  
    if (length === 0 || isNaN(length)) length = 40; // 40 ס"מ ברירת מחדל
    
    const result = {
      length: Math.round(length * 10) / 10, // עיגול לעשירית
      width: Math.round(width * 10) / 10,
      height: Math.round(height * 10) / 10
    };
    
    console.log(`🔍 DIMENSIONS DEBUG - final result:`, result);
    
    return result;
  }

  /**
   * Add a new product to the basket
   * This method is called when user saves an order (clicks "Continue" button when logged in)
   */
  addToBasket(
    productConfiguration: ProductConfiguration,
    cutList: CutList,
    organizedArrangement: OrganizedArrangement,
    pricingInfo: PricingInfo,
    dimensions?: ProductDimensions
  ): void {
    // אם לא סופקו מידות, נחשב אותן
    const finalDimensions = dimensions || this.calculateProductDimensions(productConfiguration);
    
    const basketItem: BasketItem = {
      id: this.generateUniqueId(),
      productConfiguration,
      cutList,
      organizedArrangement,
      pricingInfo,
      dimensions: finalDimensions,
      addedToBasketAt: new Date()
    };

    this.basketItems.push(basketItem);
    this.saveBasketToStorage();

    // Console logging with BASKET-NEW-ITEM prefix
    console.log('BASKET-NEW-ITEM: Product Configuration', productConfiguration);
    console.log('BASKET-NEW-ITEM: Cut List', cutList);
    console.log('BASKET-NEW-ITEM: Organized Arrangement', organizedArrangement);
    console.log('BASKET-NEW-ITEM: Pricing Info', pricingInfo);
    console.log('BASKET-NEW-ITEM: Complete Basket Item', basketItem);
    
    // לוג מפורט של המידע החדש
    console.log('BASKET-NEW-ITEM: Editing Info', {
      wasEdited: pricingInfo.editingInfo.wasEdited,
      selectedOptions: pricingInfo.editingInfo.selectedOptions,
      pricesComparison: pricingInfo.editingInfo.pricesComparison,
      updatedQuantities: pricingInfo.editingInfo.updatedQuantities,
      isCuttingPossible: pricingInfo.editingInfo.isCuttingPossible
    });
    
    // לוג נוסף עם המוצר החדש בלבד
    console.log('BASKET-NEW-ITEM - NEW!', basketItem);
    
    // לוג עם כל המוצרים בסל
    console.log('BASKET-NEW-ITEM - ALL', [...this.basketItems]);
  }

  /**
   * Get all items in the basket
   */
  getBasketItems(): BasketItem[] {
    return [...this.basketItems];
  }

  /**
   * Get basket item by ID
   */
  getBasketItemById(id: string): BasketItem | undefined {
    return this.basketItems.find(item => item.id === id);
  }

  /**
   * Remove item from basket
   */
  removeFromBasket(id: string): void {
    this.basketItems = this.basketItems.filter(item => item.id !== id);
    this.saveBasketToStorage();
  }

  /**
   * Clear all items from basket
   */
  clearBasket(): void {
    this.basketItems = [];
    this.saveBasketToStorage();
  }

  /**
   * Get total basket value
   */
  getTotalBasketValue(): number {
    return this.basketItems.reduce((total, item) => total + item.pricingInfo.totalPrice, 0);
  }

  /**
   * Get basket items count
   */
  getBasketItemsCount(): number {
    return this.basketItems.length;
  }

  /**
   * Check if basket is empty
   */
  isBasketEmpty(): boolean {
    return this.basketItems.length === 0;
  }

  /**
   * Generate unique ID for basket items
   */
  private generateUniqueId(): string {
    return 'basket-item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Save basket to localStorage
   */
  private saveBasketToStorage(): void {
    try {
      localStorage.setItem('product-basket', JSON.stringify(this.basketItems));
    } catch (error) {
      console.error('Error saving basket to localStorage:', error);
    }
  }

  /**
   * Load basket from localStorage
   */
  private loadBasketFromStorage(): void {
    try {
      const storedBasket = localStorage.getItem('product-basket');
      if (storedBasket) {
        this.basketItems = JSON.parse(storedBasket).map((item: any) => ({
          ...item,
          addedToBasketAt: new Date(item.addedToBasketAt)
        }));
      }
    } catch (error) {
      console.error('Error loading basket from localStorage:', error);
      this.basketItems = [];
    }
  }

  /**
   * Get basket summary for display
   */
  getBasketSummary(): {
    totalItems: number;
    totalValue: number;
    items: { name: string; price: number; addedAt: Date }[];
  } {
    return {
      totalItems: this.basketItems.length,
      totalValue: this.getTotalBasketValue(),
      items: this.basketItems.map(item => ({
        name: item.productConfiguration.productName,
        price: item.pricingInfo.totalPrice,
        addedAt: item.addedToBasketAt
      }))
    };
  }
}

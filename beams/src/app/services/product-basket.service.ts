import { Injectable } from '@angular/core';

// Interface for input configuration (format 1)
export interface InputConfiguration {
  inputName: string;
  value: any;
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
}

// Interface for complete basket item
export interface BasketItem {
  id: string;
  productConfiguration: ProductConfiguration;
  cutList: CutList;
  organizedArrangement: OrganizedArrangement;
  pricingInfo: PricingInfo;
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
   * Add a new product to the basket
   * This method is called when user saves an order (clicks "Continue" button when logged in)
   */
  addToBasket(
    productConfiguration: ProductConfiguration,
    cutList: CutList,
    organizedArrangement: OrganizedArrangement,
    pricingInfo: PricingInfo
  ): void {
    const basketItem: BasketItem = {
      id: this.generateUniqueId(),
      productConfiguration,
      cutList,
      organizedArrangement,
      pricingInfo,
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

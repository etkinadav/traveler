import { Component, OnInit } from '@angular/core';
import { ProductBasketService, BasketItem } from '../../services/product-basket.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-shopping-cart',
  templateUrl: './shopping-cart.component.html',
  styleUrls: ['./shopping-cart.component.css'],
  providers: [DatePipe]
})
export class ShoppingCartComponent implements OnInit {
  basketItems: BasketItem[] = [];
  totalPrice: number = 0;
  
  // מצב עריכה עבור כל מוצר
  editingStates: { [key: string]: boolean } = {};
  
  constructor(
    private basketService: ProductBasketService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadBasket();
  }

  /**
   * טעינת הסל מהשירות
   */
  loadBasket(): void {
    this.basketItems = this.basketService.getBasketItems();
    this.calculateTotalPrice();
  }

  /**
   * חישוב המחיר הכולל
   */
  calculateTotalPrice(): void {
    this.totalPrice = this.basketService.getTotalBasketValue();
  }

  /**
   * הסרת מוצר מהסל
   */
  removeItem(itemId: string): void {
    this.basketService.removeFromBasket(itemId);
    this.loadBasket();
  }

  /**
   * ניקוי כל הסל
   */
  clearBasket(): void {
    if (confirm('האם אתה בטוח שברצונך לנקות את כל הסל?')) {
      this.basketService.clearBasket();
      this.loadBasket();
    }
  }

  /**
   * פתיחת/סגירת מצב עריכה למוצר
   */
  toggleEditMode(itemId: string): void {
    this.editingStates[itemId] = !this.editingStates[itemId];
  }

  /**
   * בדיקה האם מוצר במצב עריכה
   */
  isEditing(itemId: string): boolean {
    return this.editingStates[itemId] || false;
  }

  /**
   * עדכון כמות קורה
   */
  updateBeamQuantity(item: BasketItem, beamIndex: number, newQuantity: number): void {
    // TODO: עדכון הכמות במבנה הנתונים
    console.log('Updating beam quantity:', item.id, beamIndex, newQuantity);
  }

  /**
   * עדכון כמות ברגים
   */
  updateScrewQuantity(item: BasketItem, screwIndex: number, newQuantity: number): void {
    // TODO: עדכון הכמות במבנה הנתונים
    console.log('Updating screw quantity:', item.id, screwIndex, newQuantity);
  }

  /**
   * המשך לתשלום
   */
  proceedToCheckout(): void {
    if (this.basketItems.length === 0) {
      alert('הסל ריק. נא להוסיף מוצרים לפני המשך לתשלום.');
      return;
    }
    // TODO: מעבר לדף התשלום
    console.log('Proceeding to checkout with items:', this.basketItems);
  }

  /**
   * חזרה לקטלוג
   */
  continueShopping(): void {
    this.router.navigate(['/']);
  }

  /**
   * חזרה לאחור
   */
  goBack(): void {
    window.history.back();
  }

  /**
   * האם הסל ריק
   */
  isBasketEmpty(): boolean {
    return this.basketItems.length === 0;
  }

  /**
   * קבלת תיאור מוצר
   */
  getProductDescription(item: BasketItem): string {
    return item.productConfiguration.translatedProductName || item.productConfiguration.productName;
  }

  /**
   * קבלת מספר הקורות במוצר
   */
  getBeamsCount(item: BasketItem): number {
    return item.pricingInfo.editingInfo.updatedQuantities.beams.reduce(
      (sum, beam) => sum + beam.editedQuantity, 0
    );
  }

  /**
   * קבלת מספר הברגים במוצר
   */
  getScrewsCount(item: BasketItem): number {
    return item.pricingInfo.editingInfo.updatedQuantities.screws.reduce(
      (sum, screw) => sum + screw.editedQuantity, 0
    );
  }

  /**
   * עיצוב תאריך להוספה לסל
   */
  formatDate(date: Date): string {
    return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '';
  }

  /**
   * קבלת מוצר לתצוגה מיני
   */
  getProductForPreview(item: BasketItem): any {
    // מחזיר את המוצר המקורי מהקונפיגורציה
    const originalData = item.productConfiguration.originalProductData;
    
    // יצירת מוצר מעודכן עם הפרמטרים הנכונים
    const updatedProduct = {
      ...originalData,
      // עדכון הפרמטרים מהקונפיגורציה השמורה
      params: this.getUpdatedParamsFromConfiguration(item)
    };
    
    return updatedProduct;
  }

  /**
   * קבלת פרמטרים מעודכנים מהקונפיגורציה
   */
  private getUpdatedParamsFromConfiguration(item: BasketItem): any[] {
    const originalParams = item.productConfiguration.originalProductData.params || [];
    
    // עדכון הפרמטרים עם הערכים השמורים בקונפיגורציה
    return originalParams.map((param: any) => {
      const configParam = item.productConfiguration.inputConfigurations.find(
        (config: any) => config.inputName === param.name
      );
      
      if (configParam) {
        // עדכון הערך מהקונפיגורציה השמורה
        return {
          ...param,
          value: configParam.value
        };
      }
      
      return param;
    });
  }

  /**
   * עדכון נתוני קורות לתצוגה מיני
   */
  private updateBeamsDataForPreview(item: BasketItem): any[] {
    const originalBeams = item.productConfiguration.originalProductData.BeamsDataForPricing || [];
    
    return originalBeams.map((beam: any, index: number) => {
      const beamUpdate = item.pricingInfo.editingInfo.updatedQuantities.beams[index];
      
      if (beamUpdate && beamUpdate.editedQuantity !== beamUpdate.originalQuantity) {
        // עדכון הכמות בהתאם לעריכה
        const updatedBeam = { ...beam };
        
        // עדכון totalSizes בהתאם לכמות המעודכנת
        if (updatedBeam.totalSizes && updatedBeam.totalSizes.length > 0) {
          const totalPieces = beamUpdate.editedQuantity * (beam.totalSizes[0]?.count || 1);
          updatedBeam.totalSizes = [{
            ...beam.totalSizes[0],
            count: totalPieces
          }];
        }
        
        return updatedBeam;
      }
      
      return beam;
    });
  }

  /**
   * עדכון נתוני ברגים לתצוגה מיני
   */
  private updateScrewsDataForPreview(item: BasketItem): any[] {
    const originalScrews = item.productConfiguration.originalProductData.ForgingDataForPricing || [];
    
    return originalScrews.map((screw: any, index: number) => {
      const screwUpdate = item.pricingInfo.editingInfo.updatedQuantities.screws[index];
      
      if (screwUpdate && screwUpdate.editedQuantity !== screwUpdate.originalQuantity) {
        // עדכון הכמות בהתאם לעריכה
        return {
          ...screw,
          count: screwUpdate.editedQuantity
        };
      }
      
      return screw;
    });
  }

  /**
   * קבלת אינדקס הקונפיגורציה
   */
  getConfigurationIndex(item: BasketItem): number {
    // מחזיר את האינדקס של הקונפיגורציה שנבחרה מהמוצר המקורי
    return item.productConfiguration.originalProductData?.configurationIndex || 0;
  }
}

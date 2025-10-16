import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductBasketService, BasketItem } from '../../services/product-basket.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-shopping-cart',
  templateUrl: './shopping-cart.component.html',
  styleUrls: ['./shopping-cart.component.css'],
  providers: [DatePipe]
})
export class ShoppingCartComponent implements OnInit, OnDestroy {
  basketItems: BasketItem[] = [];
  totalPrice: number = 0;
  
  // מצב עריכה עבור כל מוצר
  editingStates: { [key: string]: boolean } = {};
  
  // למניעת לוגים חוזרים
  private debugLogsShown = new Set<string>();
  private debugLogsTimer: any = null;
  private debugLogsEnabled = true;
  private basketSubscription: Subscription = new Subscription();
  
  constructor(
    private basketService: ProductBasketService,
    private router: Router,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadBasket();
    
    // הפעלת טיימר לכיבוי לוגים אחרי 3 שניות
    this.debugLogsTimer = setTimeout(() => {
      this.debugLogsEnabled = false;
      console.log('🔍 DEBUG - Debug logs disabled after 3 seconds');
    }, 3000);
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
    
    // לוג חד פעמי לכל מוצר (רק ב-3 השניות הראשונות)
    const logKey = `getProductForPreview_${item.id}`;
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey)) {
      console.log('CHECK-MINI-BASKET - getProductForPreview:', {
        itemId: item.id,
        originalDataExists: !!originalData,
        originalDataKeys: originalData ? Object.keys(originalData) : [],
        originalParams: originalData?.params || [],
        originalParamsCount: originalData?.params?.length || 0,
        inputConfigurations: item.productConfiguration.inputConfigurations,
        inputConfigurationsCount: item.productConfiguration.inputConfigurations.length
      });
      this.debugLogsShown.add(logKey);
    }
    
    // יצירת מוצר מעודכן עם הפרמטרים הנכונים
    const updatedProduct = {
      ...originalData,
      // עדכון הפרמטרים מהקונפיגורציה השמורה
      params: this.getUpdatedParamsFromConfiguration(item)
    };
    
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey + '_result')) {
      console.log('CHECK-MINI-BASKET - Updated Product for Preview:', {
        itemId: item.id,
        updatedProductKeys: Object.keys(updatedProduct),
        updatedParamsCount: updatedProduct.params?.length || 0,
        updatedParams: updatedProduct.params?.map(p => ({ name: p.name, type: p.type, value: p.value })) || [],
        hasBeams: updatedProduct.params?.some(p => p.beams) || false,
        beamTypes: updatedProduct.params?.filter(p => p.beams).map(p => ({ name: p.name, beamsCount: p.beams?.length })) || [],
        configurationIndex: updatedProduct.configurationIndex || 0
      });
      this.debugLogsShown.add(logKey + '_result');
    }
    
    return updatedProduct;
  }

  /**
   * קבלת פרמטרים מעודכנים מהקונפיגורציה
   */
  private getUpdatedParamsFromConfiguration(item: BasketItem): any[] {
    // אם אין פרמטרים ב-originalProductData, ננסה לבנות אותם מ-inputConfigurations
    let originalParams = item.productConfiguration.originalProductData.params || [];
    
    // לוג חד פעמי לכל מוצר (רק ב-3 השניות הראשונות)
    const logKey = `getUpdatedParamsFromConfiguration_${item.id}`;
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey)) {
      console.log('🔍 DEBUG - getUpdatedParamsFromConfiguration:', {
        itemId: item.id,
        originalParamsCount: originalParams.length,
        originalParams: originalParams.map(p => ({ name: p.name, type: p.type, value: p.value })),
        inputConfigurations: item.productConfiguration.inputConfigurations,
        originalProductDataKeys: item.productConfiguration.originalProductData ? Object.keys(item.productConfiguration.originalProductData) : []
      });
      this.debugLogsShown.add(logKey);
    }
    
    // אם אין פרמטרים ב-originalProductData, ננסה לבנות פרמטרים בסיסיים
    if (originalParams.length === 0 && item.productConfiguration.inputConfigurations.length > 0) {
      if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey + '_creating_params')) {
        console.log('🔍 DEBUG - No original params found, creating basic params from inputConfigurations');
        this.debugLogsShown.add(logKey + '_creating_params');
      }
      
      // ננסה לבנות פרמטרים בסיסיים מה-inputConfigurations
      originalParams = item.productConfiguration.inputConfigurations.map((config: any) => {
        const paramType = this.getParamTypeFromInputName(config.inputName);
        
        // אם זה פרמטר קורות, נוסיף beams array בסיסי
        let param: any = {
          name: config.inputName,
          type: paramType,
          value: config.value,
          default: config.value
        };
        
        // הוספת beams array לפרמטרים של קורות
        if (paramType === 'beamArray' || paramType === 'beamSingle') {
          param.beams = [
            {
              name: 'קורה בסיסית',
              width: 50,
              height: 100,
              length: 1000,
              types: [
                {
                  name: 'סוג בסיסי',
                  length: 1000
                }
              ]
            }
          ];
          param.selectedBeamIndex = 0;
          param.selectedBeamTypeIndex = 0;
        }
        
        return param;
      });
    }
    
    // עדכון הפרמטרים עם הערכים השמורים בקונפיגורציה
    const updatedParams = originalParams.map((param: any) => {
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
    
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey + '_result')) {
      console.log('🔍 DEBUG - Updated Params Result:', {
        itemId: item.id,
        updatedParamsCount: updatedParams.length,
        updatedParams: updatedParams.map(p => ({ name: p.name, type: p.type, value: p.value }))
      });
      this.debugLogsShown.add(logKey + '_result');
    }
    
    return updatedParams;
  }

  private getParamTypeFromInputName(inputName: string): string {
    // מיפוי שמות inputs לסוגי פרמטרים
    const typeMap: { [key: string]: string } = {
      'width': 'number',
      'height': 'number', 
      'depth': 'number',
      'length': 'number',
      'shelfs': 'beamArray',
      'beam': 'beamSingle',
      'frame': 'beamSingle',
      'legs': 'beamSingle'
    };
    
    return typeMap[inputName] || 'number';
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
    const configurationIndex = item.productConfiguration.originalProductData?.configurationIndex || 0;
    
    // לוג חד פעמי לכל מוצר (רק ב-3 השניות הראשונות)
    const logKey = `getConfigurationIndex_${item.id}`;
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey)) {
      console.log('🔍 DEBUG - getConfigurationIndex:', {
        itemId: item.id,
        configurationIndex: configurationIndex,
        originalProductDataExists: !!item.productConfiguration.originalProductData
      });
      this.debugLogsShown.add(logKey);
    }
    
    return configurationIndex;
  }

  ngOnDestroy(): void {
    this.basketSubscription.unsubscribe();
    
    // ניקוי הטיימר
    if (this.debugLogsTimer) {
      clearTimeout(this.debugLogsTimer);
    }
  }
}

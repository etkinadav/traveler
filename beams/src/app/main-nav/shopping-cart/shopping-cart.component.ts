import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { ProductBasketService, BasketItem } from '../../services/product-basket.service';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { DialogService } from '../../dialog/dialog.service';

@Component({
  selector: 'app-shopping-cart',
  templateUrl: './shopping-cart.component.html',
  styleUrls: ['./shopping-cart.component.css'],
  providers: [DatePipe],
  animations: [
    trigger('fadeInOut', [
      state('in', style({ opacity: 1 })),
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0.3s ease-in')
      ]),
      transition(':leave', [
        animate('0.3s ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class ShoppingCartComponent implements OnInit, OnDestroy, AfterViewInit {
  basketItems: BasketItem[] = [];
  totalPrice: number = 0;
  
  // מצב עריכה עבור כל מוצר
  editingStates: { [key: string]: boolean } = {};
  
  // למניעת לוגים חוזרים
  private debugLogsShown = new Set<string>();
  private debugLogsTimer: any = null;
  private debugLogsEnabled = true;
  private basketSubscription: Subscription = new Subscription();
  
  // לכיסוי המודלים התלת-ממדיים
  showHintMap: { [key: string]: boolean } = {};
  
  // מעקב אחר overlays שהוסרו
  overlayRemovedMap: { [key: string]: boolean } = {};

  // Cache למוצרים מעובדים כדי למנוע יצירה מחדש כל הזמן
  private productPreviewCache = new Map<string, any>();
  
  // מערכת lazy loading לתלת מימד
  @ViewChildren('cartItem') cartItems!: QueryList<ElementRef>;
  private visibleItemIndices = new Set<number>(); // אינדקסים נראים כרגע
  private loadedItemIndices = new Set<number>(); // אינדקסים של מוצרים שהתלת מימד שלהם נטען
  private previousVisibleIndices: number[] = []; // אינדקסים נראים בפעם הקודמת
  private visibilityCheckInterval: any;
  
  constructor(
    private basketService: ProductBasketService,
    private router: Router,
    private dialogService: DialogService,
    private datePipe: DatePipe,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadBasket();
    
    // Preload טקסטורות לתלת מימד
    this.preloadTextures();
    
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

  // פונקציה לטעינה מוקדמת של טקסטורות
  private preloadTextures(): void {
    // רשימת טקסטורות שמושתמשות בתלת מימד
    const textures = [
      'assets/textures/pine.jpg',
      'assets/textures/oak.jpg'
    ];
    
    // טעינת כל טקסטורה
    textures.forEach(texturePath => {
      const img = new Image();
      img.onload = () => {
        // Texture preloaded silently
      };
      img.onerror = () => {
        // Failed to preload texture silently
      };
      img.src = texturePath;
    });
  }

  // פונקציה לבדיקה אם מוצר נראה (לשימוש ב-HTML)
  isItemVisible(index: number): boolean {
    return this.visibleItemIndices.has(index);
  }

  // פונקציה לבדיקה אם מוצר נטען (לשימוש ב-HTML)
  isItemLoaded(index: number): boolean {
    return this.loadedItemIndices.has(index);
  }

  // פונקציה לסימון מוצר כנטען
  markItemAsLoaded(index: number): void {
    this.loadedItemIndices.add(index);
    this.changeDetectorRef.detectChanges();
  }

  /**
   * חישוב המחיר הכולל
   */
  calculateTotalPrice(): void {
    this.totalPrice = this.basketService.getTotalBasketValue();
  }

  /**
   * קבלת המידות של מוצר בסל
   */
  getProductDimensions(item: BasketItem): string {
    if (!item.dimensions) {
      return 'מידות לא זמינות';
    }
    
    const { length, width, height } = item.dimensions;
    return `${length} × ${width} × ${height} ס"מ`;
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
   * בדיקה האם המוצר עבר שינויים קבועים (לא במצב המקורי)
   */
  isProductModified(item: BasketItem): boolean {
    return item.pricingInfo.editingInfo.wasEdited;
  }

  /**
   * קבלת סטטוס המוצר (מקורי או מעודכן)
   */
  getProductStatus(item: BasketItem): string {
    return this.isProductModified(item) ? 'מעודכן' : 'מקורי';
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

  async clearCart(): Promise<void> {
    const confirmed = await this.dialogService.onOpenDeleteCartConfirmationDialog({
      type: 'cart'
    });

    if (confirmed) {
      this.basketService.clearBasket();
      // ניקוי cache כשמנקים את הסל
      this.productPreviewCache.clear();
      this.loadBasket();
    }
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
    // בדיקה אם יש כבר cache למוצר הזה
    const cacheKey = `${item.id}_${item.productConfiguration.inputConfigurations.length}`;
    if (this.productPreviewCache.has(cacheKey)) {
      return this.productPreviewCache.get(cacheKey);
    }

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
        originalParamsWithBeams: originalData?.params?.map(p => ({
          name: p.name,
          type: p.type,
          hasBeams: !!p.beams,
          beamsCount: p.beams?.length || 0
        })) || [],
        inputConfigurations: item.productConfiguration.inputConfigurations,
        inputConfigurationsCount: item.productConfiguration.inputConfigurations.length
      });
      this.debugLogsShown.add(logKey);
    }
    
    // החזרת המוצר המקורי כמו בקובץ בחירת המוצר
    // עדכון הפרמטרים עם הערכים שנשמרו
    if (originalData && originalData.params) {
      
               const updatedParams = originalData.params.map(param => {
                 const configParam = item.productConfiguration.inputConfigurations.find(
                   config => config.inputName === param.name
                 );
                 if (configParam) {
                   const updatedParam = {
                     ...param,
                     value: configParam.value,
                     // שימור selectedBeamIndex ו-selectedTypeIndex שחיוניים לבחירת הקורה והטקסטורה
                     selectedBeamIndex: configParam.selectedBeamIndex !== undefined ? configParam.selectedBeamIndex : param.selectedBeamIndex,
                     // לוג לבדיקה
                     debug_selectedTypeIndex: configParam.selectedTypeIndex,
                     debug_selectedBeamIndex: configParam.selectedBeamIndex
                   };
                   
                   // רק אם יש selectedTypeIndex ב-configParam, נקצה selectedBeamTypeIndex
                   if (configParam.selectedTypeIndex !== undefined) {
                     updatedParam.selectedBeamTypeIndex = configParam.selectedTypeIndex;
                   } else if (param.selectedTypeIndex !== undefined) {
                     updatedParam.selectedBeamTypeIndex = param.selectedTypeIndex;
                   }
                   // אם אין בכלל, לא נקצה את השדה הזה
                   
                   return updatedParam;
                 }
                 return param;
               });
      
      
      
      const updatedProduct = {
        ...originalData,
        params: updatedParams
      };
    
      
      // שמירה ב-cache
      this.productPreviewCache.set(cacheKey, updatedProduct);
      return updatedProduct;
    }
    
    // אם אין params, החזר את הנתונים המקוריים
    const result = originalData;
    this.productPreviewCache.set(cacheKey, result);
    return result;
  }

  /**
   * קבלת פרמטרים מעודכנים מהקונפיגורציה - לא בשימוש יותר
   */
  private getUpdatedParamsFromConfiguration_OLD(item: BasketItem): any[] {
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
          // ננסה לקבל את ה-beams מהפרמטר המקורי אם קיים
          const originalParam = item.productConfiguration.originalProductData?.params?.find(
            (p: any) => p.name === config.inputName
          );
          
          if (originalParam && originalParam.beams) {
            // השתמש ב-beams המקוריים
            param.beams = originalParam.beams;
            param.selectedBeamIndex = originalParam.selectedBeamIndex || 0;
            param.selectedBeamTypeIndex = config.selectedTypeIndex !== undefined ? config.selectedTypeIndex : (originalParam.selectedTypeIndex || 0);
          } else {
            // השתמש ב-beams בסיסיים
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
        const updatedParam = {
          ...param,
          value: configParam.value
        };
        
        // אם זה פרמטר קורות, וודא שיש לו beams
        if ((param.type === 'beamArray' || param.type === 'beamSingle') && !updatedParam.beams) {
          // ננסה לקבל את ה-beams מהפרמטר המקורי אם קיים
          const originalParam = item.productConfiguration.originalProductData?.params?.find(
            (p: any) => p.name === param.name
          );
          
          if (originalParam && originalParam.beams) {
            updatedParam.beams = originalParam.beams;
            updatedParam.selectedBeamIndex = originalParam.selectedBeamIndex || 0;
            updatedParam.selectedBeamTypeIndex = configParam.selectedTypeIndex !== undefined ? configParam.selectedTypeIndex : (originalParam.selectedTypeIndex || 0);
          }
        }
        
        return updatedParam;
      }
      
      return param;
    });
    
    if (this.debugLogsEnabled && !this.debugLogsShown.has(logKey + '_result')) {
      console.log('🔍 DEBUG - Updated Params Result:', {
        itemId: item.id,
        updatedParamsCount: updatedParams.length,
        updatedParams: updatedParams.map(p => ({
          name: p.name,
          type: p.type,
          value: p.value,
          hasBeams: !!p.beams,
          beamsCount: p.beams?.length || 0,
          beams: p.beams?.map(b => ({
            name: b.name,
            width: b.width,
            height: b.height,
            length: b.length,
            typesCount: b.types?.length || 0
          })) || []
        }))
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

  /**
   * הסרת הכיסוי מהמודל התלת-ממדי
   */
  removeOverlay(event: Event, miniPreview: any, itemId: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    // סימון שה-overlay הוסר עבור המוצר הזה
    this.overlayRemovedMap[itemId] = true;
    
    // הסתרת הטקסט hint
    this.showHintMap[itemId] = false;
    
    if (miniPreview && miniPreview.removeOverlay) {
      miniPreview.removeOverlay();
    }
  }
  
  /**
   * בדיקה האם ה-overlay הוסר עבור מוצר מסוים
   */
  isOverlayRemoved(itemId: string): boolean {
    return this.overlayRemovedMap[itemId] || false;
  }

  /**
   * הצגת טקסט הוראה בריחוף
   */
  showHintForProduct(productId: string): void {
    this.showHintMap[productId] = true;
  }

  /**
   * הסתרת טקסט הוראה בריחוף
   */
  hideHintForProduct(productId: string): void {
    this.showHintMap[productId] = false;
  }

  /**
   * מחיקת פריט מהסל
   */
  async removeItem(itemId: string): Promise<void> {
    const item = this.basketItems.find(i => i.id === itemId);
    const itemName = item?.productConfiguration.originalProductData?.name || 'הפריט';

    const confirmed = await this.dialogService.onOpenDeleteCartConfirmationDialog({
      type: 'item',
      itemName: itemName
    });

    if (confirmed) {
      this.basketService.removeFromBasket(itemId);
      this.loadBasket();
    }
  }

  ngAfterViewInit(): void {
    // עקוב אחרי שינויים ב-cartItems
    this.cartItems.changes.subscribe(() => {
      // אם יש שינוי בפריטים, הפעל מחדש את הבדיקה
      setTimeout(() => {
        this.checkItemVisibility();
      }, 100);
    });
    
    // רישום ראשוני - עם setTimeout כדי לתת ל-DOM להתעדכן
    setTimeout(() => {
      // הפעל את מערכת הבדיקה
      this.startVisibilityChecker();
    }, 500);
  }

  // פונקציה לבדיקת נראות פריטים
  private checkItemVisibility() {
    if (!this.cartItems || this.cartItems.length === 0) {
      return;
    }

    const visibleIndices: number[] = [];
    const viewportHeight = window.innerHeight;
    const margin = 200; // Extra margin for better UX

    this.cartItems.forEach((itemRef, index) => {
      if (itemRef && itemRef.nativeElement) {
        const rect = itemRef.nativeElement.getBoundingClientRect();
        const isVisible = rect.top < viewportHeight + margin && rect.bottom > -margin;
        
        if (isVisible) {
          visibleIndices.push(index);
        }
      }
    });

    // מיון האינדקסים כדי להשוות בצורה נכונה
    visibleIndices.sort((a, b) => a - b);

    // בדיקה אם יש שינוי מהפעם הקודמת
    const hasChanged = this.arraysAreDifferent(this.previousVisibleIndices, visibleIndices);
    
    if (hasChanged) {
      // מציאת האינדקסים שנוספו והוסרו
      const addedIndices = visibleIndices.filter(index => !this.previousVisibleIndices.includes(index));
      const removedIndices = this.previousVisibleIndices.filter(index => !visibleIndices.includes(index));
      
      // הדפסת השינויים
      if (addedIndices.length > 0 || removedIndices.length > 0) {
        if (addedIndices.length > 0) {
          console.log(`  ➕ Added: [${addedIndices.join(', ')}]`);
        }
        if (removedIndices.length > 0) {
          console.log(`  ➖ Removed: [${removedIndices.join(', ')}]`);
        }
      }
      
      // עדכון הערך הישן
      this.previousVisibleIndices = [...visibleIndices];
      
      // עדכון ה-Set של האינדקסים הנראים
      this.visibleItemIndices = new Set(visibleIndices);
      
      // הפעלת change detection כדי לעדכן את ה-DOM
      this.ngZone.run(() => {
        this.changeDetectorRef.detectChanges();
      });
    }
  }

  // פונקציה להשוואת מערכים
  private arraysAreDifferent(arr1: number[], arr2: number[]): boolean {
    if (arr1.length !== arr2.length) return true;
    return arr1.some((val, index) => val !== arr2[index]);
  }

  // הפעלת מערכת בדיקת הנראות
  private startVisibilityChecker(): void {
    // בדיקה ראשונית
    this.checkItemVisibility();
    
    // בדיקה כל 500ms
    this.visibilityCheckInterval = setInterval(() => {
      this.checkItemVisibility();
    }, 500);
    
    // בדיקה גם על scroll ו-resize
    window.addEventListener('scroll', () => this.checkItemVisibility());
    window.addEventListener('resize', () => this.checkItemVisibility());
  }

  ngOnDestroy(): void {
    this.basketSubscription.unsubscribe();
    
    // ניקוי הטיימר
    if (this.debugLogsTimer) {
      clearTimeout(this.debugLogsTimer);
    }
    
    // ניקוי מערכת בדיקת הנראות
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
    }
    
    // הסרת event listeners
    window.removeEventListener('scroll', () => this.checkItemVisibility());
    window.removeEventListener('resize', () => this.checkItemVisibility());
  }
}

import { Component, OnInit, OnDestroy, ViewChildren, QueryList, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone, HostListener } from '@angular/core';
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
  
  
  // למניעת לוגים חוזרים
  private debugLogsShown = new Set<string>();
  private debugLogsTimer: any = null;
  private debugLogsEnabled = true;
  private basketSubscription: Subscription = new Subscription();
  
  // לכיסוי המודלים התלת-ממדיים
  showHintMap: { [key: string]: boolean } = {};
  
  // מעקב אחר overlays שהוסרו
  overlayRemovedMap: { [key: string]: boolean } = {};

  // מעקב אחר תפריטים פתוחים
  itemMenuOpenMap: { [key: string]: boolean } = {};

  /**
   * בדיקה אם תפריט מוצר פתוח
   */
  isItemMenuOpen(itemId: string): boolean {
    return this.itemMenuOpenMap[itemId] || false;
  }

  /**
   * פתיחה/סגירה של תפריט מוצר
   */
  toggleItemMenu(itemId: string): void {
    // סגירת כל התפריטים האחרים
    Object.keys(this.itemMenuOpenMap).forEach(id => {
      if (id !== itemId) {
        this.itemMenuOpenMap[id] = false;
      }
    });
    
    // פתיחה/סגירה של התפריט הנוכחי
    this.itemMenuOpenMap[itemId] = !this.itemMenuOpenMap[itemId];
    
    console.log('Menu toggled for item:', itemId, 'is open:', this.itemMenuOpenMap[itemId]);
  }

  /**
   * סגירת תפריט מוצר
   */
  closeItemMenu(itemId: string): void {
    this.itemMenuOpenMap[itemId] = false;
  }

  /**
   * עריכת מוצר
   */
  editItem(item: BasketItem): void {
    // TODO: ניווט לעמוד עריכת המוצר עם הפרמטרים הנכונים
    console.log('עריכת מוצר:', item);
  }


  // Cache למוצרים מעובדים כדי למנוע יצירה מחדש כל הזמן
  private productPreviewCache = new Map<string, any>();
  
  // מערכת lazy loading לתלת מימד
  @ViewChildren('cartItem') cartItems!: QueryList<ElementRef>;
  private visibleItemIndices = new Set<number>(); // אינדקסים נראים כרגע
  private loadedItemIndices = new Set<number>(); // אינדקסים של מוצרים שהתלת מימד שלהם נטען
  private previousVisibleIndices: number[] = []; // אינדקסים נראים בפעם הקודמת
  private visibilityCheckInterval: any = null;
  
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
    
    // לוג עם כל הפרמטרים של כל המוצרים בסל
    console.log('PRODUCTS_IN_B - All products in basket:', JSON.stringify({
      totalItems: this.basketItems.length,
      products: this.basketItems.map(item => ({
        id: item.id,
        productName: item.productConfiguration.productName,
        translatedProductName: item.productConfiguration.translatedProductName,
        dimensions: item.dimensions,
        inputConfigurations: item.productConfiguration.inputConfigurations,
        originalProductData: {
          name: item.productConfiguration.originalProductData?.name,
          model: item.productConfiguration.originalProductData?.model,
          params: item.productConfiguration.originalProductData?.params?.map(p => ({
            name: p.name,
            type: p.type,
            default: p.default,
            value: p.value,
            selectedBeamIndex: p.selectedBeamIndex,
            selectedTypeIndex: p.selectedTypeIndex
          }))
        },
        pricingInfo: {
          totalPrice: item.pricingInfo.totalPrice,
          wasEdited: item.pricingInfo.editingInfo.wasEdited
        }
      }))
    }, null, 2));
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
    try {
      console.log('CHACK_ROT_BAS - markItemAsLoaded:', JSON.stringify({ index, loaded: true }, null, 2));
    } catch {}
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
   * כותרת הכרטיסיה לפי מצב: מקורי -> שם הדגם המלא; מותאם -> singleNames + " בהתאמה אישית"
   */
  getCardTitle(item: BasketItem): string {
    const isModified = this.isProductModified(item);
    const original = item.productConfiguration.originalProductData || {} as any;

    if (!isModified) {
      // מציגים את שם הקונפיגורציה (לדוגמה: "שולחן קפה קטן")
      const configIndex = original.configurationIndex || 0;
      const configs = original.configurations || [];
      const configName = configs[configIndex]?.translatedName;
      return configName || item.productConfiguration.translatedProductName || original.translatedName || item.productConfiguration.productName || '';
    }

    // מותאם אישית: קובעים טיפוס יחיד מתוך singleNames לפי המפתח product בקונפיגורציה הנוכחית
    const configIndex = original.configurationIndex || 0;
    const configs = original.configurations || [];
    const singleNames = original.singleNames || {};
    const productKey = configs[configIndex]?.product;
    const single = (productKey && singleNames[productKey]) ? singleNames[productKey] : (original.translatedName || item.productConfiguration.translatedProductName || item.productConfiguration.productName || '');
    return single ? `${single} בהתאמה אישית` : 'בהתאמה אישית';
  }

  /**
   * החזרת שם המודל (model) להצגה בשורה השנייה
   */
  getProductModel(item: BasketItem): string {
    const original = item.productConfiguration.originalProductData as any;
    return (original && original.model) ? original.model : '';
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
    
    
    // החזרת המוצר המקורי כמו בקובץ בחירת המוצר
    // עדכון הפרמטרים עם הערכים שנשמרו
    if (originalData && originalData.params) {
      
               const updatedParams = originalData.params.map(param => {
                 const configParam = item.productConfiguration.inputConfigurations.find(
                   config => config.inputName === param.name
                 );
                 if (configParam) {
                   // אם יש ערך ב-configParam, נשתמש בו
                   const currentValue = configParam.value !== undefined ? configParam.value : param.default;
                   
                   const updatedParam = {
                     ...param,
                     value: currentValue,
                     // עדכון ה-default עם הערך הנוכחי - זה חשוב למידות!
                     default: currentValue,
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
      
      
      // התאמת פרמטרים למידות שנשמרו בסל במקרה שאין value ב-inputConfigurations
      const patchedParams = updatedParams.map(p => {
        if (!item.dimensions) return p;
        const name = (p.name || '').toLowerCase();
        // מיפוי ישיר: width -> dimensions.width, depth -> dimensions.length, height -> dimensions.height
        if (name === 'width' && typeof item.dimensions.width === 'number') {
          return { ...p, default: item.dimensions.width, value: item.dimensions.width };
        }
        if ((name === 'depth' || name === 'length') && typeof item.dimensions.length === 'number') {
          return { ...p, default: item.dimensions.length, value: item.dimensions.length };
        }
        if (name === 'height' && typeof item.dimensions.height === 'number') {
          return { ...p, default: item.dimensions.height, value: item.dimensions.height };
        }
        return p;
      });

      const updatedProduct = {
        ...originalData,
        params: patchedParams
      };
    
      // לוג מפורט לבדיקת עדכון המידות
      console.log('PRODUCTS_IN_B - Updated product for 3D display:', JSON.stringify({
        itemId: item.id,
        productName: originalData.name,
        originalParams: originalData.params.map(p => ({ name: p.name, default: p.default, value: p.value })),
        updatedParams: patchedParams.map(p => ({ name: p.name, default: p.default, value: p.value })),
        inputConfigurations: item.productConfiguration.inputConfigurations,
        dimensions: item.dimensions
      }, null, 2));
      
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
    
    // לוג חד-פעמי לכל מוצר למניעת ספאם
    const onceKey = `PRODUCTS_IN_B_configIndex_${item.id}`;
    // @ts-ignore - using runtime Set guard map declared above
    if (!(this as any).debugLogsShown?.has(onceKey)) {
    console.log('PRODUCTS_IN_B - Configuration index for 3D display:', JSON.stringify({
      itemId: item.id,
      productName: item.productConfiguration.productName,
      configurationIndex: configurationIndex,
      originalProductDataExists: !!item.productConfiguration.originalProductData
    }, null, 2));
      // @ts-ignore
      (this as any).debugLogsShown?.add(onceKey);
    }
    
    return configurationIndex;
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
      // הפעל את מערכת הבדיקה מיד לאחר הרינדור הראשוני
      this.startVisibilityChecker();
    }, 0);
  }

  // פונקציה לבדיקת נראות פריטים
  private checkItemVisibility() {
    if (!this.cartItems || this.cartItems.length === 0) {
      return;
    }

    const visibleIndices: number[] = [];
    const viewportHeight = window.innerHeight;
    const margin = 0; // zero margin to avoid counting offscreen items as visible

    this.cartItems.forEach((itemRef, index) => {
      if (itemRef && itemRef.nativeElement) {
        const rect = itemRef.nativeElement.getBoundingClientRect();
        // Strict intersection with viewport (no margin)
        const isVisible = rect.top < viewportHeight && rect.bottom > 0;
        // לוג הוסר כדי למנוע ספאם
        
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
      
      // לוג הוסר כדי למנוע ספאם
      
      // עדכון הערך הישן
      this.previousVisibleIndices = [...visibleIndices];
      
      // עדכון ה-Set של האינדקסים הנראים
      this.visibleItemIndices = new Set(visibleIndices);
      // לוג הוסר כדי למנוע ספאם
      
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
    // נקה אינטרוול קודם אם קיים
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }
    // לוג הוסר כדי למנוע ספאם
    this.checkItemVisibility();
    // בדיקה מחזורית
    this.visibilityCheckInterval = setInterval(() => {
      this.checkItemVisibility();
    }, 500);
  }

  private stopVisibilityChecker(): void {
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll(): void {
    this.checkItemVisibility();
  }

  @HostListener('window:resize', ['$event'])
  onWindowResize(): void {
    this.checkItemVisibility();
  }

  /**
   * הסרת overlay ממוצר
   */
  removeOverlay(event: Event, miniPreview: any, itemId: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    this.overlayRemovedMap[itemId] = true;
    this.hideHintForProduct(itemId);
    
    // הפעלת אינטראקציה עם המודל התלת-ממדי
    if (miniPreview && miniPreview.enableInteraction) {
      miniPreview.enableInteraction();
    }
  }


  ngOnDestroy(): void {
    this.basketSubscription.unsubscribe();
    
    // ניקוי הטיימר
    if (this.debugLogsTimer) {
      clearTimeout(this.debugLogsTimer);
    }
    
    // ניקוי מערכת בדיקת הנראות
    this.stopVisibilityChecker();
  }
}

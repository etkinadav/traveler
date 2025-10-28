import { Component, OnInit, OnDestroy, Inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { DirectionService } from '../../direction.service';
import { AuthService } from 'src/app/auth/auth.service';
import { DialogService } from 'src/app/dialog/dialog.service';
import { TranslateService } from '@ngx-translate/core';

import { MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface ProductEditInfoData {
  product: any;
  currentParams: any[];
  currentConfiguration: any;
}

@Component({
  selector: 'app-product-edit-info',
  templateUrl: './product-edit-info.component.html',
  styleUrls: ['./product-edit-info.component.css'],
})

export class ProductEditInfoComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('nameInput') nameInputRef: ElementRef;
  @ViewChild('singleNameInput') singleNameInputRef: ElementRef;
  @ViewChild('pluralNameInput') pluralNameInputRef: ElementRef;
  isRTL: boolean = true;
  private directionSubscription: Subscription;
  isDarkMode: boolean = false;
  isLoading: boolean = false;

  userId: string;
  userIsAuthenticated = false;
  private authStatusSub: Subscription;

  // נתוני המוצר
  product: any = {};
  currentParams: any[] = [];
  currentConfiguration: any = {};

  // עריכת שם המוצר
  isEditingName: boolean = false;
  editedProductName: string = '';
  originalProductName: string = '';
  currentDisplayName: string = ''; // השם הנוכחי שמוצג (יכול להשתנות)

  // עריכת שמות קטגוריות
  isEditingSingleName: boolean = false;
  editedSingleCategoryName: string = '';
  originalSingleCategoryName: string = '';
  currentSingleCategoryName: string = '';

  isEditingPluralName: boolean = false;
  editedPluralCategoryName: string = '';
  originalPluralCategoryName: string = '';
  currentPluralCategoryName: string = '';

  constructor(
    private directionService: DirectionService,
    private authService: AuthService,
    private dialogService: DialogService,
    private translateService: TranslateService,
    @Inject(MAT_DIALOG_DATA) public data: ProductEditInfoData,
  ) {
    this.product = data.product || {};
    this.currentParams = data.currentParams || [];
    this.currentConfiguration = data.currentConfiguration || {};
    
    // הגדרת השמות המקוריים והנוכחיים
    this.originalProductName = this.product?.translatedName || this.product?.name || this.translateService.instant('product-edit-info.product-unavailable');
    this.currentDisplayName = this.originalProductName; // בהתחלה זהה למקורי
    this.editedProductName = this.currentDisplayName;

    // הגדרת שמות הקטגוריות המקוריים והנוכחיים
    this.initializeCategoryNames();
  }

  async ngOnInit() {
    this.isLoading = true;
    this.directionSubscription = this.directionService.direction$.subscribe(direction => {
      this.isRTL = direction === 'rtl';
    });

    this.directionService.isDarkMode$.subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });

    this.userId = this.authService.getUserId();
    this.userIsAuthenticated = this.authService.getIsAuth();
    this.authStatusSub = this.authService
      .getAuthStatusListener()
      .subscribe(isAuthenticated => {
        this.userIsAuthenticated = isAuthenticated;
        this.userId = this.authService.getUserId();
      });

    // הדפסת כל המידע לקונסול
    this.logProductInformation();

    this.isLoading = false;
  }

  ngAfterViewInit() {
    // לא צריך כלום כרגע
  }

  closeProductEditInfoDialog() {
    this.dialogService.onCloseProductEditInfoDialog();
  }

  ngOnDestroy() {
    this.directionSubscription.unsubscribe();
    this.authStatusSub.unsubscribe();
  }

  /**
   * הדפסת כל המידע של המוצר והקונפיגורציה הנוכחית לקונסול
   */
  logProductInformation() {
    console.log('=== PRODUCT EDIT INFO DIALOG ===');
    
    // מידע כללי על המוצר
    console.log('🛠️ PRODUCT GENERAL INFO:', {
      productExists: !!this.product,
      productName: this.product?.name,
      productModel: this.product?.model,
      productId: this.product?._id,
      translatedName: this.product?.translatedName,
      configurationIndex: this.product?.configurationIndex,
      configurationName: this.product?.configurationName
    });

    // מידע על singleNames אם קיים
    if (this.product?.singleNames) {
      console.log('📝 SINGLE NAMES:', this.product.singleNames);
    }

    // מידע על configurations אם קיים
    if (this.product?.configurations) {
      console.log('⚙️ AVAILABLE CONFIGURATIONS:', this.product.configurations.map((config, index) => ({
        index,
        name: config.name,
        translatedName: config.translatedName,
        product: config.product
      })));
    }

    // פרמטרים נוכחיים
    console.log('📊 CURRENT PARAMETERS (' + this.currentParams.length + ' total):');
    this.currentParams.forEach((param, index) => {
      console.log(`  Parameter ${index + 1}:`, {
        name: param.name,
        translatedName: param.translatedName,
        type: param.type,
        currentValue: param.default,
        min: param.min,
        max: param.max,
        unit: param.unit,
        selectedBeamIndex: param.selectedBeamIndex,
        selectedTypeIndex: param.selectedTypeIndex,
        beamInfo: param.selectedBeamIndex !== undefined && param.beams ? {
          selectedBeam: param.beams[param.selectedBeamIndex]?.translatedName,
          selectedType: param.beams[param.selectedBeamIndex]?.types?.[param.selectedTypeIndex]?.translatedName
        } : null
      });

      // אם יש מערך של ערכים (כמו מדפים)
      if (Array.isArray(param.default)) {
        console.log(`    Values array (${param.default.length} items):`, param.default);
      }
    });

    // קונפיגורציה נוכחית נוספת
    console.log('🔧 CURRENT CONFIGURATION:', this.currentConfiguration);

    // כל האוביקט המלא של המוצר
    console.log('🏗️ COMPLETE PRODUCT OBJECT:', this.product);

    console.log('=== END PRODUCT EDIT INFO ===');
  }

  /**
   * החזרת שם המוצר להצגה (השם הנוכחי, לא המקורי)
   */
  getProductDisplayName(): string {
    return this.currentDisplayName || this.translateService.instant('product-edit-info.product-unavailable');
  }

  /**
   * החזרת פרמטרים גלויים בלבד (ללא isVisual)
   */
  getVisibleParams(): any[] {
    return this.currentParams.filter(param => !param.isVisual);
  }

  /**
   * ספירת פרמטרים מוסתרים
   */
  getHiddenParamsCount(): number {
    return this.currentParams.filter(param => param.isVisual).length;
  }

  /**
   * קביעת טקסט סוג הפרמטר
   */
  getParameterTypeText(param: any): string {
    if (this.isArrayParameter(param)) {
      return this.translateService.instant('product-edit-info.array');
    }
    if (this.hasBeamSelection(param)) {
      return this.translateService.instant('product-edit-info.beam-selection');
    }
    switch (param.type) {
      case 1: return this.translateService.instant('product-edit-info.integer');
      case 2: return this.translateService.instant('product-edit-info.decimal');
      case 3: return this.translateService.instant('product-edit-info.text');
      default: return this.translateService.instant('product-edit-info.not-available');
    }
  }

  /**
   * בדיקה אם הפרמטר הוא מערך
   */
  isArrayParameter(param: any): boolean {
    return Array.isArray(param.default);
  }

  /**
   * בדיקה אם הפרמטר כולל בחירת קורה
   */
  hasBeamSelection(param: any): boolean {
    return param.beams && param.beams.length > 0 && param.selectedBeamIndex !== undefined;
  }

  /**
   * עיצוב ערך הפרמטר להצגה
   */
  formatParameterValue(param: any): string {
    if (param.default === undefined || param.default === null) {
      return this.translateService.instant('product-edit-info.not-defined');
    }

    let value = param.default;
    let unit = param.unit || '';

    // אם זה מספר, נעגל לשתי ספרות אחרי הנקודה
    if (typeof value === 'number') {
      value = Math.round(value * 100) / 100;
    }

    return value + (unit ? ' ' + unit : '');
  }

  /**
   * קבלת שם הקורה שנבחרה
   */
  getSelectedBeamName(param: any): string {
    if (!this.hasBeamSelection(param)) {
      return this.translateService.instant('product-edit-info.not-available');
    }
    
    const selectedBeam = param.beams[param.selectedBeamIndex];
    return selectedBeam?.translatedName || selectedBeam?.name || this.translateService.instant('product-edit-info.not-available');
  }

  /**
   * קבלת סוג העץ שנבחר
   */
  getSelectedWoodType(param: any): string {
    if (!this.hasBeamSelection(param)) {
      return this.translateService.instant('product-edit-info.not-available');
    }

    const selectedBeam = param.beams[param.selectedBeamIndex];
    const selectedType = selectedBeam?.types?.[param.selectedTypeIndex];
    
    return selectedType?.translatedName || selectedType?.name || this.translateService.instant('product-edit-info.not-available');
  }

  /**
   * בדיקה האם פרמטר עם בחירת קורה צריך להציג ערך נוכחי
   * פרמטרים כמו "קורת רגל" הם singleBeam ללא ערך
   * פרמטרים כמו מדפים עם קורות הם עם ערך
   */
  needsValueDisplay(param: any): boolean {
    // אם זה מערך, לא צריך ערך נוכחי (כבר מטופל בנפרד)
    if (this.isArrayParameter(param)) {
      return false;
    }
    
    // אם זה פרמטר beamSingle שהוא קורה יחידה (כמו קורת רגל), לא צריך ערך
    if (param.type === 'beamSingle') {
      return false;
    }
    
    // אחרת, כן צריך ערך נוכחי
    return true;
  }

  /**
   * התחלת עריכת שם המוצר
   */
  startEditingName(): void {
    this.isEditingName = true;
    this.editedProductName = this.currentDisplayName;
    
    // התמקדות בשדה הטקסט אחרי שהוא נטען
    setTimeout(() => {
      if (this.nameInputRef) {
        this.nameInputRef.nativeElement.focus();
        this.nameInputRef.nativeElement.select();
      }
    }, 100);
  }

  /**
   * ביטול עריכת שם המוצר
   */
  cancelEditingName(): void {
    this.isEditingName = false;
    this.editedProductName = this.currentDisplayName; // חזרה לערך הנוכחי
  }

  /**
   * שמירת שם המוצר החדש
   */
  saveProductName(): void {
    if (this.editedProductName.trim()) {
      // עדכון השם הנוכחי לערך החדש
      this.currentDisplayName = this.editedProductName.trim();
      console.log('שם מוצר חדש נשמר:', this.currentDisplayName);
      console.log('האם שונה מהמקורי:', this.isNameModified());
      this.isEditingName = false;
    }
  }

  /**
   * קבלת השם הנוכחי להצגה
   */
  getCurrentDisplayName(): string {
    return this.currentDisplayName;
  }

  /**
   * בדיקה האם השם שונה מהמקורי
   */
  isNameModified(): boolean {
    return this.currentDisplayName !== this.originalProductName;
  }

  /**
   * קביעת סטטוס שם המוצר (הכותרת הראשית)
   */
  getProductNameStatus(): 'original' | 'new' {
    return this.currentDisplayName === this.originalProductName ? 'original' : 'new';
  }


  /**
   * אתחול שמות הקטגוריות על פי הקונפיגורציה הנוכחית
   */
  private initializeCategoryNames(): void {
    const configIndex = this.product?.configurationIndex || 0;
    const configs = this.product?.configurations || [];
    const currentConfig = configs[configIndex];
    
    if (!currentConfig) {
      this.originalSingleCategoryName = this.translateService.instant('product-edit-info.not-available');
      this.originalPluralCategoryName = this.translateService.instant('product-edit-info.not-available');
    } else {
      const productKey = currentConfig.product;
      const singleNames = this.product?.singleNames || {};
      const names = this.product?.names || {};
      
      this.originalSingleCategoryName = singleNames[productKey] || this.translateService.instant('product-edit-info.not-defined');
      this.originalPluralCategoryName = names[productKey] || this.translateService.instant('product-edit-info.not-defined');
    }
    
    this.currentSingleCategoryName = this.originalSingleCategoryName;
    this.currentPluralCategoryName = this.originalPluralCategoryName;
    this.editedSingleCategoryName = this.currentSingleCategoryName;
    this.editedPluralCategoryName = this.currentPluralCategoryName;
  }

  /**
   * תחילת עריכת שם קטגוריה ביחיד
   */
  startEditingSingleName(): void {
    this.isEditingSingleName = true;
    this.editedSingleCategoryName = this.currentSingleCategoryName;
    setTimeout(() => {
      if (this.singleNameInputRef) {
        this.singleNameInputRef.nativeElement.focus();
      }
    }, 100);
  }

  /**
   * ביטול עריכת שם קטגוריה ביחיד
   */
  cancelEditingSingleName(): void {
    this.isEditingSingleName = false;
    this.editedSingleCategoryName = this.currentSingleCategoryName;
  }

  /**
   * שמירת שם קטגוריה ביחיד
   */
  saveSingleCategoryName(): void {
    this.currentSingleCategoryName = this.editedSingleCategoryName.trim();
    this.isEditingSingleName = false;
    console.log('שם קטגוריה ביחיד עודכן:', this.currentSingleCategoryName);
  }

  /**
   * תחילת עריכת שם קטגוריה ברבים
   */
  startEditingPluralName(): void {
    this.isEditingPluralName = true;
    this.editedPluralCategoryName = this.currentPluralCategoryName;
    setTimeout(() => {
      if (this.pluralNameInputRef) {
        this.pluralNameInputRef.nativeElement.focus();
      }
    }, 100);
  }

  /**
   * ביטול עריכת שם קטגוריה ברבים
   */
  cancelEditingPluralName(): void {
    this.isEditingPluralName = false;
    this.editedPluralCategoryName = this.currentPluralCategoryName;
  }

  /**
   * שמירת שם קטגוריה ברבים
   */
  savePluralCategoryName(): void {
    this.currentPluralCategoryName = this.editedPluralCategoryName.trim();
    this.isEditingPluralName = false;
    console.log('שם קטגוריה ברבים עודכן:', this.currentPluralCategoryName);
  }

  /**
   * בדיקה האם שם הקטגוריה ביחיד שונה מהמקורי
   */
  isSingleNameModified(): boolean {
    return this.currentSingleCategoryName !== this.originalSingleCategoryName;
  }

  /**
   * בדיקה האם שם הקטגוריה ברבים שונה מהמקורי
   */
  isPluralNameModified(): boolean {
    return this.currentPluralCategoryName !== this.originalPluralCategoryName;
  }

  /**
   * שמירת שינויים - מדפיס את כל המידע ל-console
   */
  saveChanges(): void {
    const allData = {
      product: this.product,
      currentParams: this.currentParams,
      currentConfiguration: this.currentConfiguration,
      editedNames: {
        productName: {
          original: this.originalProductName,
          current: this.currentDisplayName,
          modified: this.isNameModified()
        },
        singleCategoryName: {
          original: this.originalSingleCategoryName,
          current: this.currentSingleCategoryName,
          modified: this.isSingleNameModified()
        },
        pluralCategoryName: {
          original: this.originalPluralCategoryName,
          current: this.currentPluralCategoryName,
          modified: this.isPluralNameModified()
        }
      },
      visibleParams: this.getVisibleParams(),
      hiddenParamsCount: this.getHiddenParamsCount()
    };

    console.log('=== SAVE CHANGES - ALL DATA ===');
    console.log(JSON.stringify(allData, null, 2));
    console.log('=== END SAVE CHANGES ===');
  }

  /**
   * מחיקת דגם - מדפיס את כל המידע ל-console
   */
  deleteModel(): void {
    const deleteData = {
      modelToDelete: this.product?.model,
      productId: this.product?._id,
      productName: this.currentDisplayName,
      allProductData: this.product,
      timestamp: new Date().toISOString()
    };

    console.log('=== DELETE MODEL - ALL DATA ===');
    console.log(JSON.stringify(deleteData, null, 2));
    console.log('=== END DELETE MODEL ===');
  }


  /**
   * קביעת סטטוס שם הקטגוריה ביחיד
   */
  getSingleNameStatus(): 'original' | 'other' | 'new' {
    if (this.currentSingleCategoryName === this.originalSingleCategoryName) {
      return 'original';
    }

    // בדיקה אם הערך קיים ב-singleNames
    const singleNames = this.product?.singleNames || {};
    const singleNamesValues = Object.values(singleNames);
    
    if (singleNamesValues.includes(this.currentSingleCategoryName)) {
      return 'other';
    }

    return 'new';
  }

  /**
   * קביעת סטטוס שם הקטגוריה ברבים
   */
  getPluralNameStatus(): 'original' | 'other' | 'new' {
    if (this.currentPluralCategoryName === this.originalPluralCategoryName) {
      return 'original';
    }

    // בדיקה אם הערך קיים ב-names
    const names = this.product?.names || {};
    const namesValues = Object.values(names);
    
    if (namesValues.includes(this.currentPluralCategoryName)) {
      return 'other';
    }

    return 'new';
  }

  /**
   * קבלת טקסט התג לפי סטטוס
   */
  getStatusText(status: 'original' | 'other' | 'new'): string {
    switch (status) {
      case 'original':
        return this.translateService.instant('product-edit-info.status-original');
      case 'other':
        return this.translateService.instant('product-edit-info.status-other');
      case 'new':
        return this.translateService.instant('product-edit-info.status-new');
      default:
        return '';
    }
  }

  /**
   * קבלת מחלקת CSS לתג לפי סטטוס
   */
  getStatusClass(status: 'original' | 'other' | 'new'): string {
    switch (status) {
      case 'original':
        return 'status-tag-original';
      case 'other':
        return 'status-tag-other';
      case 'new':
        return 'status-tag-new';
      default:
        return '';
    }
  }
}

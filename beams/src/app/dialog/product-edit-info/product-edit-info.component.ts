import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { DirectionService } from '../../direction.service';
import { AuthService } from 'src/app/auth/auth.service';
import { DialogService } from 'src/app/dialog/dialog.service';

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

export class ProductEditInfoComponent implements OnInit, OnDestroy {
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

  constructor(
    private directionService: DirectionService,
    private authService: AuthService,
    private dialogService: DialogService,
    @Inject(MAT_DIALOG_DATA) public data: ProductEditInfoData,
  ) {
    this.product = data.product || {};
    this.currentParams = data.currentParams || [];
    this.currentConfiguration = data.currentConfiguration || {};
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
   * החזרת שם המוצר להצגה
   */
  getProductDisplayName(): string {
    return this.product?.translatedName || this.product?.name || 'מוצר לא זמין';
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
      return 'מערך';
    }
    if (this.hasBeamSelection(param)) {
      return 'בחירת קורה';
    }
    switch (param.type) {
      case 1: return 'מספר שלם';
      case 2: return 'מספר עשרוני';
      case 3: return 'טקסט';
      default: return 'לא זמין';
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
      return 'לא מוגדר';
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
      return 'לא זמין';
    }
    
    const selectedBeam = param.beams[param.selectedBeamIndex];
    return selectedBeam?.translatedName || selectedBeam?.name || 'לא זמין';
  }

  /**
   * קבלת סוג העץ שנבחר
   */
  getSelectedWoodType(param: any): string {
    if (!this.hasBeamSelection(param)) {
      return 'לא זמין';
    }

    const selectedBeam = param.beams[param.selectedBeamIndex];
    const selectedType = selectedBeam?.types?.[param.selectedTypeIndex];
    
    return selectedType?.translatedName || selectedType?.name || 'לא זמין';
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
}

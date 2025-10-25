import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ViewChildren, QueryList, ElementRef, ChangeDetectorRef, NgZone } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { DirectionService } from '../../direction.service';
import { DataSharingService } from '../data-shering-service/data-sharing.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from "src/app/auth/auth.service";

import { UsersService } from 'src/app/services/users.service';
import { DialogService } from 'src/app/dialog/dialog.service';
import { set } from 'lodash';
@Component({
  selector: 'app-choose-product',
  templateUrl: './choose-product.component.html',
  styleUrls: ['./choose-product.component.scss'],
  host: {
    class: 'fill-screen'
  },
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('150ms ease-in', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('150ms ease-out', style({ opacity: 0 }))
      ])
    ])
  ]
})

export class ChooseProductComponent implements OnInit, OnDestroy, AfterViewInit {
  isRTL: boolean = true;
  isDarkMode: boolean = false;
  private directionSubscription: Subscription;
  private comparisonLogsShown = new Set<string>();
  public hoveredPrintingService: string = '';
  public printingService: string = '';
  continueToServiceText: string = '';
  userIsAuthenticated = false;
  userId: string;
  private authStatusSub: Subscription;
  isSystemSet: boolean = false;
  
  // משתנים למוצרים
  products: any[] = [];
  groupedProducts: { productType: string; productTypeName: string; items: any[]; emptyCardsCount: number }[] = []; // מוצרים מקובצים לפי product
  isLoading: boolean = true; // מתחיל ב-true כדי להציג מצב טעינה
  error: string | null = null;
  selectedProduct: any = null;
  hoveredProduct: any = null;

  // מפה של קורות לפי ID
  beamsMap: Map<string, any> = new Map();
  beamsLoaded: boolean = false;

  // הוסר - מערכת התמונות המתחלפות נמחקה
  
  // משתנים לאפקט slide
  displayedTitle: string = '';
  displayedText: string = '';
  displayedSubtitle: string = '';
  isTransitioning: boolean = false;
  currentTransitionKey: string = 'card-' + Math.random();
  
  // טקסט ברירת מחדל עד שהתרגום נטען
  defaultTitle: string = '';
  defaultText: string = '';
  defaultSubtitle: string = '';
  
  // מפה להצגת טקסט ההוראה בריחוף לכל מוצר
  showHintMap: { [key: string]: boolean } = {};
  
  // מערכת בדיקת נראות כרטיסיות
  private visibilityCheckInterval: any = null;
  private previousVisibleIndices: number[] = []; // שמירת הערך הישן
  private visibleProductIndices = new Set<number>(); // אינדקסים נראים כרגע
  private loadedProductIndices = new Set<number>(); // אינדקסים של מוצרים שהתלת מימד שלהם נטען
  @ViewChildren('productCard', { read: ElementRef }) productCards!: QueryList<ElementRef>;
  

  // משתנה לעקיבה אחרי כמות האלמנטים ברוחב המסך
  elementsPerRow: number = 1; // ברירת מחדל - מובייל

  // פונקציה לקבלת כמות מוצרי הטעינה (פעמיים כמות האלמנטים בשורה)
  getLoadingItems(): number[] {
    const count = this.elementsPerRow * 2;
    return Array(count).fill(0).map((_, index) => index + 1);
  }

  // פונקציה לקבלת כרטיסיות כותרת (כמות האלמנטים בשורה)
  getTitleCards(): number[] {
    return Array(this.elementsPerRow).fill(0).map((_, index) => index + 1);
  }


  // פונקציות לקביעת border מקווקוו לפי הלוגיקה המורכבת
  
  // קווקוו עליון
  shouldShowTopBorder(groupIndex: number, productIndex: number): boolean {
    // כרגע תמיד false
    return false;
    
    // const x = groupIndex + 1; // מספר קבוצה
    // const y = productIndex + 1; // מספר סידורי בקבוצה
    // const n = this.elementsPerRow; // כמות בשורה
    // const globalIndex = this.getGlobalProductIndex(groupIndex, productIndex);
    // const r = (globalIndex % n) + 1; // מיקום מימין
    
    // תנאי: x > 1 וגם y <= (n + 1 - r)
    // return x > 1 && y <= (n + 1 - r);
  }

  // קווקוו תחתון
  shouldShowBottomBorder(groupIndex: number, productIndex: number): boolean {
    const x = groupIndex + 1; // מספר קבוצה
    const totalGroups = this.groupedProducts.length; // כמות קבוצות כוללת
    const group = this.groupedProducts[groupIndex];
    const totalInGroup = group.items.length; // כמות כרטיסיות בקבוצה
    const n = this.elementsPerRow; // כמות בשורה
    
    // תנאי 1: x != totalGroups (לא קבוצה אחרונה)
    if (x === totalGroups) return false;
    
    // תנאי 2: ה-n האחרונים בקבוצה מקבלים bottom border
    const lastNStartIndex = Math.max(0, totalInGroup - n); // תחילת ה-n האחרונים
    return productIndex >= lastNStartIndex;
  }

  // קווקוו ימני
  shouldShowRightBorder(groupIndex: number, productIndex: number): boolean {
    // כרגע תמיד false
    return false;
  }

  // קווקוו שמאלי
  shouldShowLeftBorder(groupIndex: number, productIndex: number): boolean {
    const x = groupIndex + 1; // מספר קבוצה
    const totalGroups = this.groupedProducts.length; // כמות קבוצות כוללת
    const y = productIndex + 1; // מספר סידורי בקבוצה
    const n = this.elementsPerRow; // כמות בשורה
    const globalIndex = this.getGlobalProductIndex(groupIndex, productIndex);
    const r = (globalIndex % n) + 1; // מיקום מימין
    const group = this.groupedProducts[groupIndex];
    const totalInGroup = group.items.length; // כמות כרטיסיות בקבוצה
    
    // תנאי חדש: אם זו הקבוצה האחרונה ביותר - לא יהיה border-left
    if (x === totalGroups) return false;
    
    // תנאי 1: r != n (לא האחרונה בשורה)
    if (r === n) return false;
    
    // תנאי 2: y == totalInGroup (האחרונה בקבוצה)
    return y === totalInGroup;
  }

  // פונקציה לעדכון כמות האלמנטים ברוחב המסך
  // נקודות קפיצה hardcoded - מסונכרן בדיוק עם ה-CSS:
  // 0-499px: 1 בשורה
  // 500-749px: 2 בשורה (500px = 250×2)
  // 750-999px: 3 בשורה (750px = 250×3)
  // 1000px+: 4 בשורה (1000px = 250×4)
  updateElementsPerRow(): void {
    const windowWidth = window.innerWidth;
    
    // Breakpoints מותאמים בדיוק ל-CSS media queries
    // שימוש ב->= כדי שיתאימו ל-min-width ב-CSS
    if (windowWidth >= 1000) {
      this.elementsPerRow = 4; // 1000px ומעלה
    } else if (windowWidth >= 750) {
      this.elementsPerRow = 3; // 750-999px
    } else if (windowWidth >= 500) {
      this.elementsPerRow = 2; // 500-749px
    } else {
      this.elementsPerRow = 1; // 0-499px
    }
    
    // עדכון כרטיסיות ריקות לפי n החדש
    this.updateEmptyCards();
  }
  
  // פונקציה לעדכון כרטיסיות ריקות בקבוצות
  updateEmptyCards(): void {
    if (!this.groupedProducts || this.groupedProducts.length === 0) {
      return;
    }
    
    this.groupedProducts.forEach((group, groupIndex) => {
      // הסרת כל הכרטיסיות הריקות הקיימות
      group.items = group.items.filter(item => !item.isEmpty);
      
      const n = this.elementsPerRow; // כמות בשורה
      
      // 1. חישוב r של הכרטיסייה הראשונה בקבוצה (אינדקס מ-0)
      const firstProductGlobalIndex = this.getGlobalProductIndex(groupIndex, 0);
      const firstProductRIndex = firstProductGlobalIndex % n; // אינדקס מ-0 (הימנית = 0)
      
      // 2. אורך הקבוצה
      const groupLength = group.items.length;
      
      // 3. חיבור של סעיפים 1 ו-2
      const sum = firstProductRIndex + groupLength;
      
      // 4. חיסור n מהתוצאה
      const result = sum - n;
      
      console.log(`📋 Group ${groupIndex + 1} (${group.productTypeName}): firstRIndex=${firstProductRIndex}, groupLength=${groupLength}, sum=${sum}, n=${n}, result=${result}`);
      
      // קביעת כמות כרטיסיות ריקות לפי הלוגיקה החדשה
      if (result <= 0 || result >= n) {
        // אם הערך שווה ל-0 או שלילי, או גדול/שווה ל-n - לא יהיו כרטיסיות ריקות
        group.emptyCardsCount = 0;
        console.log(`   ❌ No empty cards: result=${result}`);
      } else {
        // אם הערך חיובי וקטן מ-n - נחזיר את n פחות הערך ככמות הכרטיסיות הריקות
        group.emptyCardsCount = n - result;
        console.log(`   ✅ Adding ${n - result} empty cards to group ${groupIndex + 1} (n=${n} - result=${result})`);
      }
      
      // הוספת כרטיסיות ריקות חדשות
      for (let i = 0; i < group.emptyCardsCount; i++) {
        group.items.push({
          isEmpty: true,
          _id: `empty-${group.productType}-${i}`,
          name: '',
          translatedName: ''
        });
      }
    });
  }

  

  constructor(
    private directionService: DirectionService,
    private dataSharingService: DataSharingService,
    private router: Router,
    private authService: AuthService,
    private dialogService: DialogService,
    private translateService: TranslateService,
    private http: HttpClient,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone) {
    // מחיקת הגדרות מוצר מ-localStorage כשנכנסים לעמוד בחירת המוצר
    this.clearProductSettingsFromStorage();
    
    this.translateService.onLangChange.subscribe(() => {
      this.updatecontinueToServiceText();
      this.updateDefaultTexts();
    });
    
    // עדכון טקסטים ברירת מחדל
    this.updateDefaultTexts();
  }

  // פונקציה ללוגים מהתבנית
  logProductCreation(product: any) {
    // לוג חד פעמי להשוואה
    const logKey = `choose-product-${product.id || product.name}`;
    if (!this.comparisonLogsShown.has(logKey)) {
      console.log('CHECK-MINI-CHOOSE - Product passed to mini preview:', {
        productId: product.id || product.name,
        productKeys: Object.keys(product),
        hasParams: !!product.params,
        paramsCount: product.params?.length || 0,
        params: product.params?.map(p => ({ name: p.name, type: p.type, value: p.value })) || [],
        configurationIndex: product.configurationIndex || 0,
        hasBeams: product.params?.some(p => p.beams) || false,
        beamTypes: product.params?.filter(p => p.beams).map(p => ({ name: p.name, beamsCount: p.beams?.length })) || []
      });
      this.comparisonLogsShown.add(logKey);
    }
  }

  // פונקציה לבדיקת מוצר כשעוברים עליו עם העכבר
  onHoverProduct(product: any) {
    if (product && !product.isEmpty) {
      this.hoveredProduct = product;
      
      // עדכון hoveredPrintingService כדי להציג טקסטים בקנבס
      this.hoveredPrintingService = product.name || 'product';
      
      // לוג חד פעמי להשוואה
      const logKey = `choose-hover-${product.id || product.name}`;
      // לוג מפורט חד פעמי
      if (!this.comparisonLogsShown.has(logKey + '_detailed')) {
      // Detailed choose log
      // Detailed choose log
        this.comparisonLogsShown.add(logKey + '_detailed');
        this.comparisonLogsShown.add('ngOnInit_products');
      }
    } else {
      this.hoveredProduct = null;
      this.hoveredPrintingService = '';
    }
  }
  
  // פונקציה לבדיקה אם מוצר נראה (לשימוש ב-HTML)
  isProductVisible(index: number): boolean {
    const isVisible = this.visibleProductIndices.has(index);
    // console.log(`🔍 isProductVisible(${index}): ${isVisible}`);
    return isVisible;
  }
  
  // פונקציה לבדיקה אם מוצר נטען (לשימוש ב-HTML)
  isProductLoaded(index: number): boolean {
    return this.loadedProductIndices.has(index);
  }
  
  // פונקציה לסימון מוצר כנטען
  markProductAsLoaded(index: number): void {
    this.loadedProductIndices.add(index);
    this.changeDetectorRef.detectChanges();
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
  
  // פונקציה לבדיקת נראות כרטיסיות
  private checkCardVisibility() {
    if (!this.productCards || this.productCards.length === 0) {
      return;
    }

    const visibleIndices: number[] = [];
    const viewportHeight = window.innerHeight;
    const margin = 200; // Extra margin for better UX

    this.productCards.forEach((cardRef, localIndex) => {
      if (cardRef && cardRef.nativeElement) {
        const rect = cardRef.nativeElement.getBoundingClientRect();
        const isVisible = rect.top < viewportHeight + margin && rect.bottom > -margin;
        
        if (isVisible) {
          // קבל את האינדקס הגלובלי מהתכונה data-product-index
          const globalIndexAttr = cardRef.nativeElement.getAttribute('data-product-index');
          if (globalIndexAttr !== null) {
            const globalIndex = parseInt(globalIndexAttr);
            if (!isNaN(globalIndex)) {
              visibleIndices.push(globalIndex);
            }
          }
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
    }
    
    // עדכון ה-Set של האינדקסים הנראים
    this.visibleProductIndices = new Set(visibleIndices);
    
    // הפעלת change detection כדי לעדכן את ה-DOM
    this.ngZone.run(() => {
      this.changeDetectorRef.detectChanges();
    });
  }

  // פונקציה לבדיקה אם שני arrays שונים
  private arraysAreDifferent(arr1: number[], arr2: number[]): boolean {
    if (arr1.length !== arr2.length) {
      return true;
    }
    
    // מיון שני ה-arrays להשוואה
    const sorted1 = [...arr1].sort((a, b) => a - b);
    const sorted2 = [...arr2].sort((a, b) => a - b);
    
    for (let i = 0; i < sorted1.length; i++) {
      if (sorted1[i] !== sorted2[i]) {
        return true;
      }
    }
    
    return false;
  }

  // הפעלת מערכת בדיקת נראות
  private startVisibilityChecker() {
    // Clear any existing interval
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
    }
    
    this.visibilityCheckInterval = setInterval(() => {
      this.checkCardVisibility();
    }, 500); // Check every 0.5 seconds
  }

  private stopVisibilityChecker() {
    if (this.visibilityCheckInterval) {
      clearInterval(this.visibilityCheckInterval);
      this.visibilityCheckInterval = null;
    }
  }

  // Event listeners for scroll and resize
  @HostListener('window:scroll', ['$event'])
  onScroll(event: Event) {
    this.checkCardVisibility();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: Event) {
    this.updateElementsPerRow();
    this.checkCardVisibility();
  }
  
  // פונקציה לחישוב אינדקס גלובלי של מוצר בקבוצה
  getGlobalProductIndex(groupIndex: number, itemIndex: number): number {
    let globalIndex = 0;
    
    // סכימת כל המוצרים בקבוצות הקודמות
    for (let i = 0; i < groupIndex; i++) {
      globalIndex += this.groupedProducts[i].items.length;
    }
    
    // הוספת האינדקס בקבוצה הנוכחית
    globalIndex += itemIndex;
    
    return globalIndex;
  }

  // פונקציה לקבלת קלאס align-items לפי מיקום בקבוצה
  getAlignItemsClass(groupIndex: number, itemIndex: number): string {
    // מיקום זוגי (0, 2, 4, 6...): align-end
    // מיקום אי-זוגי (1, 3, 5, 7...): align-center
    return itemIndex % 2 === 0 ? 'align-end' : 'align-center';
  }

  ngOnInit() {
    // עדכון כמות האלמנטים ברוחב המסך
    this.updateElementsPerRow();
    
    // הצגת טקסט ברירת מחדל מיד כדי למנוע כרטיסאי ריקה
    this.displayedTitle = this.defaultTitle;
    this.displayedText = this.defaultText;
    this.displayedSubtitle = this.defaultSubtitle;
    
    // Preload טקסטורות לתלת מימד
    this.preloadTextures();
    
    this.directionService.direction$.subscribe(direction => {
      this.isRTL = direction === 'rtl';
    });

    this.directionService.isDarkMode$.subscribe(isDarkMode => {
      this.isDarkMode = isDarkMode;
    });

    this.dataSharingService.getPrintingService().subscribe((value) => {
      this.printingService = value;
      this.updatecontinueToServiceText();
    });
    
    // משיכת כל הקורות (אם קיים endpoint) ואז המוצרים
    this.loadBeamsAndProducts();
    
    // לוג ראשון של המוצרים
    setTimeout(() => {
      if (this.products && this.products.length > 0 && !this.comparisonLogsShown.has('ngOnInit_products')) {
        console.log('CHECK-MINI-CHOOSE - Products loaded in ngOnInit:', {
          totalProducts: this.products.length,
          firstProduct: this.products[0] ? {
            productId: this.products[0].id || this.products[0].name,
            productKeys: Object.keys(this.products[0]),
            hasParams: !!this.products[0].params,
            paramsCount: this.products[0].params?.length || 0,
            params: this.products[0].params?.map(p => ({ name: p.name, type: p.type, value: p.value })) || [],
            hasBeams: this.products[0].params?.some(p => p.beams) || false
          } : null
        });
      }
    }, 1000);
    
    // הוסר - החלפת תמונות נמחקה
    
    // listener לשינוי גודל החלון
    window.addEventListener('resize', () => {
      this.updateElementsPerRow();
    });

    this.userId = this.authService.getUserId();
    this.userIsAuthenticated = this.authService.getIsAuth();
    this.authStatusSub = this.authService
      .getAuthStatusListener()
      .subscribe(isAuthenticated => {
        this.userIsAuthenticated = isAuthenticated;
        this.userId = this.authService.getUserId();
      });
    
    
  }
  

  ngAfterViewInit() {
    // עקוב אחרי שינויים ב-productCards
    this.productCards.changes.subscribe(() => {
      // אם יש שינוי בכרטיסיות, הפעל מחדש את הבדיקה
      setTimeout(() => {
        this.checkCardVisibility();
      }, 100);
    });
    
    // רישום ראשוני - עם setTimeout כדי לתת ל-DOM להתעדכן
    setTimeout(() => {
      // הפעל את מערכת הבדיקה
      this.startVisibilityChecker();
    }, 0);
  }

  ngOnDestroy() {
    // ניקוי subscriptions אם יש
    this.stopVisibilityChecker();
  }

  onHoverPrintingService(value: string) {
    this.hoveredPrintingService = value;
  }

  onChoosePrintingService(value: string) {
    if (value === "express" || value === "plotter" || value === "ph") {
      this.printingService = value;
      this.updatecontinueToServiceText();
      this.onSetPrintingService();
    }
  }

  onSetPrintingService() {
    if (this.printingService === "express" || this.printingService === "plotter") {
      this.dataSharingService.setPrintingService(this.printingService);
      this.router.navigate(['/branch']);
    }
    if (this.printingService === "ph") {
      this.dataSharingService.setPrintingService("ph");
      this.router.navigate(['/product']);
    }
  }

  updatecontinueToServiceText() {
    this.continueToServiceText =
      this.translateService.instant('choose-system.continue-to') +
      this.translateService.instant('choose-system.title-short-' + this.printingService);
  }

  updateDefaultTexts() {
    this.defaultTitle = this.translateService.instant('choose-product.default-title');
    this.defaultText = this.translateService.instant('choose-product.default-text');
    this.defaultSubtitle = this.translateService.instant('choose-product.default-subtitle');
  }

  // step-item-trans-plotter


  // פונקציות למוצרים
  onChooseProduct(product: any) {
    this.selectedProduct = product;
    // מעבר לעמוד המוצר ב-/beams
    this.router.navigate(['/beams'], { 
      queryParams: { 
        productId: product._id,
        productName: product.name 
      } 
    });
  }


  // פונקציה למשיכת קורות ואז מוצרים
  loadBeamsAndProducts() {
    // ניסיון למשוך קורות - אם נכשל, פשוט ממשיכים למוצרים
    this.http.get('/api/beam').subscribe({
      next: (data: any) => {
        // יצירת מפה של קורות לפי ID
        data.forEach((beam: any) => {
          const beamId = beam._id || beam.$oid;
          if (beamId) {
            this.beamsMap.set(beamId, beam);
          }
        });
        
        this.beamsLoaded = true;
        // טעינת מוצרים
        this.loadAllProducts();
      },
      error: (error) => {
        this.beamsLoaded = false;
        // ממשיכים למוצרים גם בלי קורות
        this.loadAllProducts();
      }
    });
  }

  // פונקציה למשיכת כל המוצרים
  loadAllProducts() {
    this.isLoading = true;
    this.error = null;
    
    this.http.get('/api/products').subscribe({
      next: (data: any) => {
        // עיבוד המוצרים - שכפול לפי דגמי משנה
        this.products = this.processProductsWithConfigurations(data);
        
        // קיבוץ המוצרים לפי product type
        this.groupedProducts = this.groupProductsByType(this.products, data);
        
        // עדכון כרטיסיות ריקות
        this.updateEmptyCards();
        
        // אתחול showHintMap לכל המוצרים כ-false
        this.products.forEach((product, index) => {
          const productKey = product._id + '_' + index;
          this.showHintMap[productKey] = false;
        });
        
        this.isLoading = false;
      },
      error: (error) => {
        this.error = this.translateService.instant('choose-product.error-loading-products');
        this.isLoading = false;
        console.error('Error loading products:', error);
      }
    });
  }

  isSu() {
    if (localStorage.getItem("roles")?.includes("su")) {
      return true;
    }
    return false;
  }

  // פונקציה לניווט למוצר
  navigateToProduct(product: any) {
    if (product && product.name && product._id) {
      // ניווט לעמוד המוצר עם שם המוצר ו-ID
      let url = `/beams?product=${encodeURIComponent(product.name)}&productId=${product._id}`;
      
      // אם זה תת-מוצר (יש configurationIndex), מוסיפים אותו ל-URL
      if (product.configurationIndex !== undefined) {
        url += `&configIndex=${product.configurationIndex}`;
      }
      
      window.location.href = url;
    } else {
      // אם אין שם מוצר, ניווט לעמוד הכללי
      window.location.href = '/beams';
    }
  }

  // הוסר - כל מערכת התמונות המתחלפות והטקסטים נמחקה
  
  // ==================
  
  // פונקציות לניהול הטקסט לכל מוצר
  showHintForProduct(productId: string): void {
    this.showHintMap[productId] = true;
  }
  
  hideHintForProduct(productId: string): void {
    this.showHintMap[productId] = false;
  }
  
  // פונקציה להסרת הכיסוי עם אפקט ripple
  removeOverlay(event: MouseEvent, miniPreview: any): void {
    const overlay = event.target as HTMLElement;
    
    // יצירת אפקט ripple
    const ripple = document.createElement('div');
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.background = 'rgba(255, 255, 255, 0.6)';
    ripple.style.transform = 'scale(0)';
    ripple.style.animation = 'ripple 0.6s linear';
    ripple.style.left = (event.offsetX - 10) + 'px';
    ripple.style.top = (event.offsetY - 10) + 'px';
    ripple.style.width = '20px';
    ripple.style.height = '20px';
    ripple.style.pointerEvents = 'none';
    
    overlay.appendChild(ripple);
    
    // הפסקת הסיבוב האוטומטי של המודל
    if (miniPreview && miniPreview.stopAutoRotation) {
      miniPreview.stopAutoRotation();
    }
    
    // הסרת הכיסוי אחרי 100ms
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 100);
    
    // הסרת ה-ripple אחרי האנימציה
    setTimeout(() => {
      if (ripple.parentNode) {
        ripple.parentNode.removeChild(ripple);
      }
    }, 600);
  }

  // פונקציה לעיבוד מוצרים עם דגמי משנה
  processProductsWithConfigurations(products: any[]): any[] {
    const processedProducts: any[] = [];
    
    products.forEach((product: any) => {
      // בדיקה אם יש למוצר דגמי משנה (configurations ראשי)
      if (product.configurations && product.configurations.length > 0) {
        // שכפול המוצר לכל דגם משנה
        product.configurations.forEach((config: any, configIndex: number) => {
          // יצירת עותק עמוק של המוצר
          const clonedProduct = JSON.parse(JSON.stringify(product));
          
          // שינוי שם המוצר לשם דגם המשנה
          clonedProduct.translatedName = config.translatedName;
          clonedProduct.configurationName = config.name;
          clonedProduct.configurationIndex = configIndex;
          
          // עדכון הפרמטרים לפי דגם המשנה
          clonedProduct.params = this.updateParamsWithConfiguration(clonedProduct.params, configIndex, product);
          
          processedProducts.push(clonedProduct);
        });
      } else {
        // מוצר ללא דגמי משנה - מוסיף כמו שהוא
        processedProducts.push(product);
      }
    });
    
    return processedProducts;
  }
  
  // פונקציה לעדכון פרמטרים לפי דגם משנה
  updateParamsWithConfiguration(params: any[], configIndex: number, product: any): any[] {
    
    return params.map((param: any) => {
      const updatedParam = { ...param };
      
      // עדכון default לפי configurations
      if (param.configurations && param.configurations[configIndex] !== undefined) {
        updatedParam.default = param.configurations[configIndex];
      }
      
      // עדכון beamsConfigurations - מציאת הקורה לפי name מתוך רשימת beams של אותו אינפוט
      if (param.beamsConfigurations && param.beamsConfigurations[configIndex] && param.beams && param.beams.length > 0) {
        const beamName = param.beamsConfigurations[configIndex];
        
        // חיפוש הקורה ברשימת beams של האינפוט
        let foundBeamId: string | null = null;
        
        for (const beamRef of param.beams) {
          // בדיקה אם beamRef הוא אובייקט מלא או רק ID
          const beamId = beamRef.$oid || beamRef._id || beamRef;
          
          // אופציה 1: ה-beamRef עצמו מכיל את כל המידע (כולל name)
          if (beamRef.name === beamName) {
            foundBeamId = beamId;
            break;
          }
          
          // אופציה 2: משתמשים ב-beamsMap אם קיים
          if (this.beamsLoaded && this.beamsMap.size > 0) {
            const beam = this.beamsMap.get(beamId);
            if (beam && beam.name === beamName) {
              foundBeamId = beamId;
              break;
            }
          }
        }
        
        if (foundBeamId) {
          // עדכון defaultType ל-ID של הקורה שנמצאה
          updatedParam.defaultType = { $oid: foundBeamId };
        } else {
          // פתרון גיבוי: אם לא נמצאה קורה לפי שם, נשתמש ב-configIndex כאינדקס ישיר
          
          if (param.beams[configIndex]) {
            const fallbackBeamId = param.beams[configIndex].$oid || param.beams[configIndex]._id;
            if (fallbackBeamId) {
              updatedParam.defaultType = { $oid: fallbackBeamId };
            }
          }
        }
      }
      
      return updatedParam;
    });
  }

  // פונקציה לקיבוץ מוצרים לפי product type
  groupProductsByType(processedProducts: any[], originalProducts: any[]): { productType: string; productTypeName: string; items: any[]; emptyCardsCount: number }[] {
    const groups: { [key: string]: { productType: string; productTypeName: string; items: any[]; emptyCardsCount: number } } = {};
    
    processedProducts.forEach((product: any) => {
      // מציאת המוצר המקורי כדי לקבל את names
      const originalProduct = originalProducts.find((p: any) => p._id === product._id || p._id?.$oid === product._id);
      
      // קבלת ה-product type מה-configuration (אם קיים)
      const config = product.configurations?.[product.configurationIndex];
      const productType = config?.product || product.name; // אם אין product בconfig, נשתמש ב-name
      
      // קבלת השם המתורגם של ה-product type מ-names
      const productTypeName = originalProduct?.names?.[productType] || productType;
      
      // אם עדיין לא קיימת קבוצה לסוג הזה, ניצור אותה
      if (!groups[productType]) {
        groups[productType] = {
          productType: productType,
          productTypeName: productTypeName,
          items: [],
          emptyCardsCount: 0 // ברירת מחדל - אין כרטיסיות ריקות
        };
      }
      
      // הוספת המוצר לקבוצה
      groups[productType].items.push(product);
    });
    
    // המרה למערך
    // הכרטיסיות הריקות יתווספו אוטומטית ב-updateEmptyCards שנקראת לאחר מכן    
    return Object.values(groups);
  }
  
  /**
   * מחיקת כל ההגדרות של המוצר מ-localStorage
   */
  private clearProductSettingsFromStorage(): void {
    try {
      // מחיקת כל המפתחות הקשורים למוצרים
      const keysToRemove: string[] = [];
      
      // חיפוש כל המפתחות ב-localStorage שמתחילים ב-selectedBeamIndex_
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('selectedBeamIndex_')) {
          keysToRemove.push(key);
        }
      }
      
      // מחיקת מפתחות נוספים הקשורים להגדרות מוצר
      const additionalKeys = [
        'lastSelectedProductId',
        'lastConfigIndex', 
        'beam-configuration'
      ];
      
      additionalKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          keysToRemove.push(key);
        }
      });
      
      // מחיקת כל המפתחות שנמצאו
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Removed product setting from localStorage:', key);
      });
      
      console.log('✅ Cleared all product settings from localStorage (choose-product)');
    } catch (error) {
      console.error('❌ Error clearing product settings from localStorage:', error);
    }
  }
}


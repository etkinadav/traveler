import { Component, OnInit, OnDestroy, HostListener, AfterViewInit, ViewChildren, QueryList, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { trigger, state, style, transition, animate } from '@angular/animations';

import { DirectionService } from '../../direction.service';
import { DataSharingService } from '../data-shering-service/data-sharing.service';
import { TranslateService } from '@ngx-translate/core';
import { AuthService } from "src/app/auth/auth.service";

import { UsersService } from 'src/app/super-management/user/users.service';
import { DialogService } from 'src/app/dialog/dialog.service';
import { set } from 'lodash';
@Component({
  selector: 'app-choose-printing-system',
  templateUrl: './choose-printing-system.component.html',
  styleUrls: ['./choose-printing-system.component.scss'],
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

export class ChoosePrintingSystemComponent implements OnInit, OnDestroy, AfterViewInit {
  isRTL: boolean = true;
  isDarkMode: boolean = false;
  private directionSubscription: Subscription;
  public hoveredPrintingService: string = '';
  public printingService: string = '';
  continueToServiceText: string = '';
  userIsAuthenticated = false;
  userId: string;
  private authStatusSub: Subscription;
  isSystemSet: boolean = false;
  
  // משתנים למוצרים
  products: any[] = [];
  groupedProducts: { productType: string; productTypeName: string; items: any[] }[] = []; // מוצרים מקובצים לפי product
  isLoading: boolean = true; // מתחיל ב-true כדי להציג מצב טעינה
  error: string | null = null;
  selectedProduct: any = null;
  hoveredProduct: any = null;

  // מפה של קורות לפי ID
  beamsMap: Map<string, any> = new Map();
  beamsLoaded: boolean = false;

  // משתנים לתמונות מתחלפות
  imageKeys: string[] = ['kids', 'hangar', 'garden', 'flexable', 'beergarden', 'inside'];
  currentImageIndex: number = 0;
  imageRotationInterval: any;
  
  // משתנים לאפקט slide
  displayedTitle: string = '';
  displayedText: string = '';
  displayedSubtitle: string = '';
  isTransitioning: boolean = false;
  currentTransitionKey: string = 'card-' + Math.random();
  
  // טקסט ברירת מחדל עד שהתרגום נטען
  defaultTitle: string = 'פינות משחקים';
  defaultText: string = 'צרו פינות משחקים ופנאי עבור ילדים עם מדפים צבעוניים ובטיחותיים';
  defaultSubtitle: string = 'פינות פנאי לילדים';
  
  // מפה להצגת טקסט ההוראה בריחוף לכל מוצר
  showHintMap: { [key: string]: boolean } = {};
  
  // Intersection Observer למעקב אחר מוצרים נראים
  private intersectionObserver: IntersectionObserver | null = null;
  visibleProductIndices: Set<number> = new Set();
  
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
    const y = productIndex + 1; // מספר סידורי בקבוצה
    const totalGroups = this.groupedProducts.length; // כמות קבוצות כוללת
    const group = this.groupedProducts[groupIndex];
    const totalInGroup = group.items.length; // כמות כרטיסיות בקבוצה
    const n = this.elementsPerRow; // כמות בשורה
    const globalIndex = this.getGlobalProductIndex(groupIndex, productIndex);
    const r = (globalIndex % n) + 1; // מיקום מימין
    
    // תנאי: x != totalGroups וגם (totalInGroup - y) <= r
    return x !== totalGroups && (totalInGroup - y) <= r;
  }

  // קווקוו ימני
  shouldShowRightBorder(groupIndex: number, productIndex: number): boolean {
    // כרגע תמיד false
    return false;
  }

  // קווקוו שמאלי
  shouldShowLeftBorder(groupIndex: number, productIndex: number): boolean {
    const y = productIndex + 1; // מספר סידורי בקבוצה
    const n = this.elementsPerRow; // כמות בשורה
    const globalIndex = this.getGlobalProductIndex(groupIndex, productIndex);
    const r = (globalIndex % n) + 1; // מיקום מימין
    const group = this.groupedProducts[groupIndex];
    const totalInGroup = group.items.length; // כמות כרטיסיות בקבוצה
    
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
  }

  

  constructor(
    private directionService: DirectionService,
    private dataSharingService: DataSharingService,
    private router: Router,
    private authService: AuthService,
    private dialogService: DialogService,
    private translateService: TranslateService,
    private http: HttpClient) {
    this.translateService.onLangChange.subscribe(() => {
      this.updatecontinueToServiceText();
    });
  }

  // פונקציה ללוגים מהתבנית
  logProductCreation(product: any) {
    // Log for debugging if needed
  }
  
  // פונקציה לבדוק אם מוצר נראה במסך
  isProductVisible(index: number): boolean {
    // אם ה-Observer עדיין לא רץ, נניח שהמוצרים הראשונים נראים
    if (this.visibleProductIndices.size === 0) {
      return index < 5; // 5 מוצרים ראשונים כברירת מחדל
    }
    return this.visibleProductIndices.has(index);
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

  ngOnInit() {
    // עדכון כמות האלמנטים ברוחב המסך
    this.updateElementsPerRow();
    
    // הצגת טקסט ברירת מחדל מיד כדי למנוע כרטיסאי ריקה
    this.displayedTitle = this.defaultTitle;
    this.displayedText = this.defaultText;
    this.displayedSubtitle = this.defaultSubtitle;
    
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
    

    // התחלת החלפת התמונות
    this.startImageRotation();
    
    // עדכון טקסט ראשון - עם עיכוב קטן כדי לתת זמן לתרגום להיטען
    setTimeout(() => {
      this.updateTextImmediately();
    }, 100);
    
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
    
    // אתחול Intersection Observer
    this.initIntersectionObserver();
    
    // לוג מפורט של כל ה-borders אחרי 3 שניות
    setTimeout(() => {
      console.log('=== BORDER DEBUG LOG ===');
      console.log(`n (elementsPerRow) = ${this.elementsPerRow}`);
      this.groupedProducts.forEach((group, groupIndex) => {
        console.log(`\n📦 Group ${groupIndex + 1}: ${group.productTypeName}`);
        group.items.forEach((product, productIndex) => {
          const globalIndex = this.getGlobalProductIndex(groupIndex, productIndex);
          const s = globalIndex + 1;
          const r = (globalIndex % this.elementsPerRow) + 1;
          const x = groupIndex + 1; // מספר קבוצה
          
          const hasTop = this.shouldShowTopBorder(groupIndex, productIndex);
          const hasRight = this.shouldShowRightBorder(groupIndex, productIndex);
          const hasBottom = this.shouldShowBottomBorder(groupIndex, productIndex);
          const hasLeft = this.shouldShowLeftBorder(groupIndex, productIndex);
          
          const borders = [];
          if (hasTop) borders.push('top');
          if (hasRight) borders.push('right');
          if (hasBottom) borders.push('bottom');
          if (hasLeft) borders.push('left');
          
          const borderStr = borders.length > 0 ? borders.join('-') : 'none';
          console.log(`  x-${x}-r-${r}-s-${s}-${borderStr} | ${product.translatedName}`);
        });
      });
      console.log('\n=== END BORDER LOG ===');
    }, 3000);
  }
  
  private initIntersectionObserver() {
    // יצירת observer שמזהה כשאלמנט נכנס או יוצא מהמסך
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        let hasChanges = false;
        entries.forEach((entry) => {
          const index = parseInt(entry.target.getAttribute('data-product-index') || '-1');
          if (index >= 0) {
            if (entry.isIntersecting) {
              // המוצר נראה במסך
              if (!this.visibleProductIndices.has(index)) {
                this.visibleProductIndices.add(index);
                hasChanges = true;
              }
            } else {
              // המוצר לא נראה במסך
              if (this.visibleProductIndices.has(index)) {
                this.visibleProductIndices.delete(index);
                hasChanges = true;
              }
            }
          }
        });
        
        // אם יש שינויים, נעדכן את ה-UI
        if (hasChanges) {
          // Angular change detection יזהה את השינוי
          this.visibleProductIndices = new Set(this.visibleProductIndices);
        }
      },
      {
        root: null, // viewport
        rootMargin: '50px', // מרחק נוסף כדי לטעון מעט לפני שהמוצר נכנס למסך
        threshold: 0.1 // 10% מהאלמנט צריך להיות נראה
      }
    );
  }

  ngAfterViewInit() {
    // עקוב אחרי שינויים ב-productCards והרשם ל-Observer
    this.productCards.changes.subscribe(() => {
      this.observeProductCards();
    });
    
    // רישום ראשוני - עם setTimeout כדי לתת ל-DOM להתעדכן
    setTimeout(() => {
      this.observeProductCards();
    }, 0);
  }
  
  private observeProductCards() {
    if (!this.intersectionObserver) return;
    
    this.productCards.forEach((card: ElementRef) => {
      this.intersectionObserver!.observe(card.nativeElement);
    });
  }
  
  ngOnDestroy() {
    // this.authStatusSub.unsubscribe();
    // עצירת החלפת התמונות
    this.stopImageRotation();
    
    // ניקוי Intersection Observer
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
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

  onHoverProduct(product: any) {
    this.hoveredProduct = product;
    // עדכון hoveredPrintingService כדי להציג טקסטים בקנבס
    if (product) {
      this.hoveredPrintingService = product.name || 'product';
    } else {
      this.hoveredPrintingService = '';
    }
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
        
        // אתחול showHintMap לכל המוצרים כ-false
        this.products.forEach((product, index) => {
          const productKey = product._id + '_' + index;
          this.showHintMap[productKey] = false;
        });
        
        this.isLoading = false;
      },
      error: (error) => {
        this.error = 'שגיאה בטעינת המוצרים';
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

  // פונקציות להחלפת תמונות
  startImageRotation() {
    this.imageRotationInterval = setInterval(() => {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.imageKeys.length;
      
      // עדכון הטקסט עם התמונה
      this.updateTextImmediately();
    }, 10000); // החלפה כל 10 שניות - מסונכרן עם התמונות
  }

  stopImageRotation() {
    if (this.imageRotationInterval) {
      clearInterval(this.imageRotationInterval);
    }
  }

  getCurrentImagePath(): string {
    const currentKey = this.imageKeys[this.currentImageIndex];
    return `../../../assets/images/ondi-example/ondi-example-${currentKey}.png`;
  }

  // פונקציה לקבלת כל נתיבי התמונות לסרט
  getAllImagePaths(): string[] {
    return this.imageKeys.map(key => `../../../assets/images/ondi-example/ondi-example-${key}.png`);
  }
  
  trackByTransitionKey(index: number, key: string): string {
    return key;
  }

  updateTextImmediately() {
    // הטקסט מתחלף עם התמונות
    const currentKey = this.imageKeys[this.currentImageIndex];
    
    // עדכון מפתח האנימציה לחומר מעבר פשוט
    this.currentTransitionKey = 'card-' + currentKey + '-' + Date.now();
    
    // קבלת הטקסטים מתורגמים
    const titleKey = 'choose-system.empty-title-' + currentKey;
    const textKey = 'choose-system.empty-text-' + currentKey;
    const subtitleKey = 'choose-system.empty-subtitle-' + currentKey;
    
    const title = this.translateService.instant(titleKey);
    const text = this.translateService.instant(textKey);
    const subtitle = this.translateService.instant(subtitleKey);
    
    // עדכון הטקסט
    if (!title.includes('choose-system.empty-title-')) {
      this.displayedTitle = title;
    }
    
    if (!text.includes('choose-system.empty-text-')) {
      this.displayedText = text;
    }
    
    if (!subtitle.includes('choose-system.empty-subtitle-')) {
      this.displayedSubtitle = subtitle;
    }
    
    // אם התרגום עדיין לא עובד, retry אחרי זמן קצר
    if (title.includes('choose-system.empty-title-') || this.displayedTitle === '') {
      setTimeout(() => {
        this.updateTextImmediately();
      }, 500);
    }
  }
  
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
  groupProductsByType(processedProducts: any[], originalProducts: any[]): { productType: string; productTypeName: string; items: any[] }[] {
    const groups: { [key: string]: { productType: string; productTypeName: string; items: any[] } } = {};
    
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
          items: []
        };
      }
      
      // הוספת המוצר לקבוצה
      groups[productType].items.push(product);
    });
    
    // המרה למערך
    return Object.values(groups);
  }
}


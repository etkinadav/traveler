import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
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

export class ChoosePrintingSystemComponent implements OnInit, OnDestroy {
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

  // פונקציה לעדכון כמות האלמנטים ברוחב המסך
  // נקודות קפיצה hardcoded - מסונכרן בדיוק עם ה-CSS:
  // 0-499px: 1 בשורה
  // 500-749px: 2 בשורה (500px = 250×2)
  // 750-999px: 3 בשורה (750px = 250×3)
  // 1000px+: 4 בשורה (1000px = 250×4)
  updateElementsPerRow(): void {
    const windowWidth = window.innerWidth;
    
    // Hardcoded breakpoints - בדיוק כמו ב-CSS
    if (windowWidth >= 1000) {
      this.elementsPerRow = 4; // 1000px ומעלה
    } else if (windowWidth >= 750) {
      this.elementsPerRow = 3; // 750-999px
    } else if (windowWidth >= 500) {
      this.elementsPerRow = 2; // 500-749px
    } else {
      this.elementsPerRow = 1; // 0-499px
    }
    
    console.log('Window width:', windowWidth, 'px | Cards per row:', this.elementsPerRow);
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
  }

  ngOnDestroy() {
    // this.authStatusSub.unsubscribe();
    // עצירת החלפת התמונות
    this.stopImageRotation();
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
    console.log('נבחר מוצר:', product);
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
        console.log(`CHACK-BEAM-MINI: ניווט לתת-מוצר: ${product.translatedName} (configuration #${product.configurationIndex})`);
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
          
          console.log(`CHACK-BEAM-MINI: ✅ מוצר שנוצר: ${clonedProduct.translatedName}`);
          console.log(`CHACK-BEAM-MINI:    📋 פרמטרים מעודכנים:`, clonedProduct.params.map((p: any) => ({
            name: p.name,
            default: p.default,
            defaultType: p.defaultType,
            beamsConfigurations: p.beamsConfigurations
          })));
          
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
    console.log(`CHACK-BEAM-MINI: === עדכון פרמטרים למוצר: ${product.translatedName} (configuration #${configIndex}) ===`);
    
    return params.map((param: any) => {
      const updatedParam = { ...param };
      
      // עדכון default לפי configurations
      if (param.configurations && param.configurations[configIndex] !== undefined) {
        console.log(`CHACK-BEAM-MINI: 📝 עדכון default עבור ${param.name}: ${param.default} -> ${param.configurations[configIndex]}`);
        updatedParam.default = param.configurations[configIndex];
      }
      
      // עדכון beamsConfigurations - מציאת הקורה לפי name מתוך רשימת beams של אותו אינפוט
      if (param.beamsConfigurations && param.beamsConfigurations[configIndex] && param.beams && param.beams.length > 0) {
        const beamName = param.beamsConfigurations[configIndex];
        
        console.log(`CHACK-BEAM-MINI: 🔍 מחפש קורה עבור פרמטר: ${param.name}`);
        console.log(`CHACK-BEAM-MINI:    📌 שם קורה מבוקש: "${beamName}"`);
        console.log(`CHACK-BEAM-MINI:    📌 defaultType לפני עדכון:`, param.defaultType);
        console.log(`CHACK-BEAM-MINI:    📌 רשימת beams זמינות (${param.beams.length}):`, param.beams.map((b: any) => ({ id: b._id || b.$oid, name: b.name })));
        
        // חיפוש הקורה ברשימת beams של האינפוט
        let foundBeamId: string | null = null;
        
        for (const beamRef of param.beams) {
          // בדיקה אם beamRef הוא אובייקט מלא או רק ID
          const beamId = beamRef.$oid || beamRef._id || beamRef;
          
          // אופציה 1: ה-beamRef עצמו מכיל את כל המידע (כולל name)
          if (beamRef.name === beamName) {
            foundBeamId = beamId;
            console.log(`CHACK-BEAM-MINI:    ✅ נמצאה קורה ישירות: ${beamRef.name} (ID: ${foundBeamId})`);
            break;
          }
          
          // אופציה 2: משתמשים ב-beamsMap אם קיים
          if (this.beamsLoaded && this.beamsMap.size > 0) {
            const beam = this.beamsMap.get(beamId);
            if (beam && beam.name === beamName) {
              foundBeamId = beamId;
              console.log(`CHACK-BEAM-MINI:    ✅ נמצאה קורה דרך beamsMap: ${beam.name} (ID: ${foundBeamId})`);
              break;
            }
          }
        }
        
        if (foundBeamId) {
          // עדכון defaultType ל-ID של הקורה שנמצאה
          updatedParam.defaultType = { $oid: foundBeamId };
          console.log(`CHACK-BEAM-MINI:    ✨ defaultType עודכן ל: { $oid: "${foundBeamId}" }`);
          console.log(`CHACK-BEAM-MINI:    📊 updatedParam.defaultType:`, updatedParam.defaultType);
        } else {
          console.log(`CHACK-BEAM-MINI:    ❌ לא נמצאה קורה מתאימה - defaultType נשאר: `, updatedParam.defaultType);
        }
      }
      
      return updatedParam;
    });
  }
}


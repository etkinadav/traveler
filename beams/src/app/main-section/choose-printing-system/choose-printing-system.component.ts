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

  // משתנים לאנימציה סינוסואידית
  animatedCards: any[] = [];
  cardCounter: number = 0;
  
  // רשימת הכרטיסיות
  cardTemplates = [
    {
      title: "בונים יחד זיכרונות",
      text: "מרכיבים רהיט עץ מלא והופכים זמן איכות עם האנשים שאתם אוהבים לחוויה שנשארת אתכם.",
      subtitle: "חוויתי. יצירתי. משמעותי."
    },
    {
      title: "ממחסן העצים – לרהיט שלך",
      text: "אתם מקבלים את הקורות ישר ממחסן העצים והופכים אותן לרהיט מוגמר במינימום עלות.",
      subtitle: "ישיר. פשוט. משתלם."
    },
    {
      title: "רהיט עץ מלא, בדיוק במידות שלך",
      text: "מקורות חתוכות לרהיט מותאם אישית בשניות, ובמחיר נמוך משל איקאה.",
      subtitle: "מדויק. איכותי. משתלם."
    },
    {
      title: "אותה מערכת – אין־סוף אפשרויות",
      text: "אתם מחליטים איך זה ייראה. מרכיבים, משנים ומשדרגים – הכול בידיים שלכם.",
      subtitle: "עיצוב. גמישות. חופש."
    },
    {
      title: "בונים מקום – ביחד",
      text: "שולחנות בר, ספסלים, בוטים ונדנדות – כל אחד יכול להרכיב לעצמו או כקבוצה. מתאים לפאבים, פופ-אפים, מסיבות גינה או מתחמי אירועים.",
      subtitle: "יחד זה פשוט יותר."
    },
    {
      title: "מתאים לכל פינה ולכל מטרה",
      text: "בין אם זה בחצר, במשרד או בבית – הרהיט שלכם משתלב בכל מקום.",
      subtitle: "חזק. איכותי. ורסטילי."
    }
  ];

  

  constructor(
    private directionService: DirectionService,
    private dataSharingService: DataSharingService,
    private router: Router,
    private authService: AuthService,
    private dialogService: DialogService,
    private translateService: TranslateService,
    private http: HttpClient) {
    console.log('=== ChoosePrintingSystemComponent constructor התחיל ===');
    console.log('HttpClient injected:', this.http);
    this.translateService.onLangChange.subscribe(() => {
      this.updatecontinueToServiceText();
    });
  }

  ngOnInit() {
    console.log('=== ChoosePrintingSystemComponent ngOnInit התחיל ===');
    
    // הצגת טקסט ברירת מחדל מיד כדי למנוע כרטיסאי ריקה
    this.displayedTitle = this.defaultTitle;
    this.displayedText = this.defaultText;
    this.displayedSubtitle = this.defaultSubtitle;
    
    console.log('טקסט ברירת מחדל:', { displayedTitle: this.displayedTitle, displayedText: this.displayedText, displayedSubtitle: this.displayedSubtitle });
    
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
    
    // משיכת כל המוצרים
    console.log('קורא לפונקציה loadAllProducts');
    this.loadAllProducts();
    
    // התחלת אנימציית הכרטיסיות
    this.startCardAnimation();

    // התחלת החלפת התמונות
    this.startImageRotation();
    
    // עדכון טקסט ראשון - עם עיכוב קטן כדי לתת זמן לתרגום להיטען
    console.log('מתחיל עדכון טקסט ראשון...');
    setTimeout(() => {
      this.updateTextImmediately();
    }, 100);

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

  // פונקציה למשיכת כל המוצרים
  loadAllProducts() {
    console.log('=== loadAllProducts התחיל ===');
    this.isLoading = true;
    this.error = null;
    
    console.log('שולח בקשה ל-/api/products');
    this.http.get('/api/products').subscribe({
      next: (data: any) => {
        this.products = data;
        this.isLoading = false;
        console.log('=== כל המוצרים מהבקאנד ===');
        console.log('כמות מוצרים:', data.length);
        console.log('רשימת מוצרים:', data);
        console.log('פירוט כל מוצר:');
        data.forEach((product: any, index: number) => {
          console.log(`מוצר ${index + 1}:`, {
            id: product._id,
            name: product.name,
            params: product.params?.length || 0,
            translatedName: product.translatedName || 'ללא שם'
          });
        });
        console.log('=== סיום רשימת המוצרים ===');
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
      window.location.href = `/beams?product=${encodeURIComponent(product.name)}&productId=${product._id}`;
    } else {
      // אם אין שם מוצר, ניווט לעמוד הכללי
      window.location.href = '/beams';
    }
  }

  // פונקציות להחלפת תמונות
  startImageRotation() {
    this.imageRotationInterval = setInterval(() => {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.imageKeys.length;
      console.log('תמונה וטקסט מתחלפים ל:', this.imageKeys[this.currentImageIndex]);
      
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
    
    console.log('=== updateTextImmediately התחיל ===');
    console.log('currentKey:', currentKey);
    console.log('currentImageIndex:', this.currentImageIndex);
    
    // עדכון מפתח האנימציה לחומר מעבר פשוט
    this.currentTransitionKey = 'card-' + currentKey + '-' + Date.now();
    
    // קבלת הטקסטים מתורגמים
    const titleKey = 'choose-system.empty-title-' + currentKey;
    const textKey = 'choose-system.empty-text-' + currentKey;
    const subtitleKey = 'choose-system.empty-subtitle-' + currentKey;
    
    console.log('מפתחות תרגום:', { titleKey, textKey, subtitleKey });
    
    const title = this.translateService.instant(titleKey);
    const text = this.translateService.instant(textKey);
    const subtitle = this.translateService.instant(subtitleKey);
    
    console.log('תרגומים:', { title, text, subtitle, currentKey });
    console.log('title.includes check:', title.includes('choose-system.empty-title-'));
    
    // עדכון הטקסט
    if (!title.includes('choose-system.empty-title-')) {
      this.displayedTitle = title;
      console.log('כותרת עודכנה ל:', this.displayedTitle);
    } else {
      console.log('כותרת לא עודכנה - תרגום לא מוכן');
    }
    
    if (!text.includes('choose-system.empty-text-')) {
      this.displayedText = text;
      console.log('טקסט עודכן ל:', this.displayedText);
    } else {
      console.log('טקסט לא עודכן - תרגום לא מוכן');
    }
    
    if (!subtitle.includes('choose-system.empty-subtitle-')) {
      this.displayedSubtitle = subtitle;
      console.log('סלוגן עודכן ל:', this.displayedSubtitle);
    } else {
      console.log('סלוגן לא עודכן - תרגום לא מוכן');
    }
    
    console.log('טקסט סופי:', { displayedTitle: this.displayedTitle, displayedText: this.displayedText, displayedSubtitle: this.displayedSubtitle });
    
    // אם התרגום עדיין לא עובד, retry אחרי זמן קצר
    if (title.includes('choose-system.empty-title-') || this.displayedTitle === '') {
      console.log('מנסה שוב אחרי 500ms...');
      setTimeout(() => {
        this.updateTextImmediately();
      }, 500);
    }
    
    console.log('=== updateTextImmediately הסתיים ===');
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

  // פונקציות לאנימציה סינוסואידית
  trackByCardId(index: number, card: any): string {
    return card.id;
  }

  startCardAnimation(): void {
    // המתנה לטעינת התרגום
    setTimeout(() => {
      // התחלה עם הכרטיסיה הראשונה
      this.animateNextCard(0);
    }, 1000);
  }

  animateNextCard(cardIndex: number): void {
    // אם סיימנו את כל הכרטיסיות - מתחילים מחדש
    if (cardIndex >= this.cardTemplates.length) {
      // מתחילים מחזור חדש מהכרטיסיה הראשונה
      setTimeout(() => {
        this.animateNextCard(0);
      }, 10000); // המתנה של 10 שניות לפני תחילת מחזור חדש
      return;
    }

    // הפעלת הכרטיסיה הנוכחית
    this.animateSingleCard(cardIndex);
    
    // הפעלת הכרטיסיה הבאה אחרי שהנוכחית מסיימת את האנימציה המלא (10 שניות)
    setTimeout(() => {
      this.animateNextCard(cardIndex + 1);
    }, 10000); // 10 שניות - זמן האנימציה המלא
  }

  animateSingleCard(cardIndex: number): void {
    // יצירת כרטיסיה עם ערכים רנדומליים
    const cardTemplate = this.cardTemplates[cardIndex];
    const card = {
      id: `card-${Date.now()}-${cardIndex}`,
      title: cardTemplate.title,
      text: cardTemplate.text,
      subtitle: cardTemplate.subtitle,
      delay: 0,
      amplitude: 50 + Math.random() * 100, // רנדומלי 50-150px
      frequency: 1.5 + Math.random() * 1.5, // רנדומלי 1.5-3
      phase: Math.random() * 360 // רנדומלי 0-360 מעלות
    };
    
    this.animatedCards.push(card);
    console.log(`[${new Date().toLocaleTimeString()}] כרטיסיה ${cardIndex + 1} נוצרה:`, card.title);
    
    // הסרת כרטיסיה אחרי 10 שניות - זה הסוף
    setTimeout(() => {
      const index = this.animatedCards.findIndex(c => c.id === card.id);
      if (index > -1) {
        console.log(`[${new Date().toLocaleTimeString()}] כרטיסיה ${cardIndex + 1} נמחקה:`, card.title);
        this.animatedCards.splice(index, 1);
      }
    }, 10000);
  }
}

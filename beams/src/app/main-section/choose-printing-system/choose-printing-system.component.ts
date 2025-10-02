import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  }
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

  // משתנים לטקסטים מתחלפים
  currentTextIndex: number = 0;
  textChangeInterval: any;
  isTextChanging: boolean = false;
  
  // משתנים לתמונות מתחלפות
  currentImageIndex: number = 0;
  isImageChanging: boolean = false;
  imageKeys: string[] = ['kids', 'flexable', 'beergarden', 'inside', 'garden', 'hangar'];
  currentImagePath: string = '';
  

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

    // התחלת אנימציית הטקסטים המתחלפים
    this.startTextRotation();
    
    // אתחול נתיב התמונה הראשונה
    this.updateCurrentImagePath();

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
    // עצירת רוטציית הטקסטים
    this.stopTextRotation();
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

  // פונקציות לטקסטים מתחלפים
  startTextRotation() {
    this.textChangeInterval = setInterval(() => {
      this.changeText();
    }, 10000); // החלפה כל 10 שניות
  }

  stopTextRotation() {
    if (this.textChangeInterval) {
      clearInterval(this.textChangeInterval);
    }
  }

  changeText() {
    this.isTextChanging = true;
    this.changeImage(); // החלפת תמונה יחד עם טקסט
    setTimeout(() => {
      this.currentTextIndex = (this.currentTextIndex + 1) % this.imageKeys.length; // 6 טקסטים ותמונות
      this.isTextChanging = false;
    }, 800); // זמן ארוך יותר לאנימציה חלקה
  }

  // פונקציות לתמונות מתחלפות
  changeImage() {
    this.isImageChanging = true;
    setTimeout(() => {
      this.currentImageIndex = (this.currentImageIndex + 1) % this.imageKeys.length;
      this.updateCurrentImagePath();
      this.isImageChanging = false;
    }, 300); // fade out/in מהיר
  }

  updateCurrentImagePath() {
    const key = this.imageKeys[this.currentImageIndex];
    this.currentImagePath = `../../../assets/images/ondi-example/ondi-example-${key}.png`;
    console.log('Current image path:', this.currentImagePath);
  }

  getCurrentImage(): string {
    return this.currentImagePath;
  }

  getCurrentTitle(): string {
    const key = this.imageKeys[this.currentTextIndex];
    return `choose-system.empty-title-${key}`;
  }

  getCurrentText(): string {
    const key = this.imageKeys[this.currentTextIndex];
    return `choose-system.empty-text-${key}`;
  }

  getCurrentSubtitle(): string {
    const key = this.imageKeys[this.currentTextIndex];
    return `choose-system.empty-subtitle-${key}`;
  }

  // פונקציות דיבוג לתמונות
  onImageError(event: any) {
    console.error('Image failed to load:', event.target.src);
    console.error('Error details:', event);
  }

  onImageLoad(event: any) {
    console.log('Image loaded successfully:', event.target.src);
  }
  
  // ==================
}

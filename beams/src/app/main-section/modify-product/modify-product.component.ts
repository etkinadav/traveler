import {
    Component,
    ElementRef,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    OnInit,
    ChangeDetectorRef,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { PricingService } from '../../services/pricing.service';
import { DialogService } from '../../dialog/dialog.service';
import { ProductBasketService, ProductConfiguration, CutList, OrganizedArrangement, PricingInfo } from '../../services/product-basket.service';
import { MatMenuTrigger } from '@angular/material/menu';
import * as THREE from 'three';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';
interface Shelf {
    gap: number; // רווח מהמדף שמתחתיו (או מהרצפה)
}
@Component({
    selector: 'app-modify-product',
    templateUrl: './modify-product.component.html',
    styleUrls: ['./modify-product.component.scss'],
    animations: [
        trigger('fadeInScale', [
            transition(':enter', [
                style({ opacity: 0, transform: 'scale(0.8)' }),
                animate('600ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
            ])
        ]),
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
export class ModifyProductComponent implements AfterViewInit, OnDestroy, OnInit {
    // Debug mode - set to true to enable console logs
    private enableDebugLogs = false;
    
    // מניעת לוגים אינסופיים עבור CHACK_is-reinforcement-beams-outside
    private reinforcementLogPrinted = false;
    
    // משתנה למניעת לוגים חוזרים של animate
    private animationLogged = false;
    
    // משתנה למניעת לוג חוזר של קורת רגל מיטה
    private futonLegBeamLogged = false;
    
    // Performance tracking
    private performanceTimers: Map<string, number> = new Map();
    
    // מצב עריכה - האם זה מוצר בעריכה או מוצר חדש
    isEditMode = false;
    
    // משתנה למניעת לוגים חוזרים של getDisplayProductName
    private displayNameLogged = false;
    
    // משתנה למניעת לוגים חוזרים של hasProductParametersChanged
    private paramChangedLogged = false;

    
    // קריאה ראשונית לבדיקת isEditMode
    checkIsEditModeInitialValue() {
    }
    
    // Debug helper function - only logs when enableDebugLogs is true
    private debugLog(...args: any[]): void {
        if (this.enableDebugLogs) {
        }
    }
    
    // פונקציה לקבלת שם המוצר להצגה (מקורי או מותאם אישית)
    // שימוש ב-getter כדי ש-Angular יעדכן אותו אוטומטית
    get getDisplayProductName(): string {
        // לוג חד פעמי בלבד כדי למנוע לוגים אינסופיים
        if (!this.displayNameLogged) {
            console.log('CHECK_IS_MODIFIED - getDisplayProductName called (first time only)');
            console.log('CHECK_IS_MODIFIED - product exists:', !!this.product);
            console.log('CHECK_IS_MODIFIED - selectedProductName:', this.selectedProductName);
            console.log('CHECK_IS_MODIFIED - originalProductParams length:', this.originalProductParams?.length || 0);
            console.log('CHECK_IS_MODIFIED - params length:', this.params?.length || 0);
            this.displayNameLogged = true;
        }
        
        if (!this.product) {
            return this.selectedProductName || '';
        }
        
        // בדיקה אם יש שינויים בפרמטרים מהמקור
        const hasChanges = this.hasProductParametersChanged();
        
        if (!hasChanges) {
            // מציגים את שם הקונפיגורציה (לדוגמה: "שולחן קפה קטן")
            const configIndex = this.product.configurationIndex || 0;
            const configs = this.product.configurations || [];
            const configName = configs[configIndex]?.translatedName;
            return configName || this.product.translatedName || this.selectedProductName || '';
        }

        // מותאם אישית: קובעים טיפוס יחיד מתוך singleNames לפי המפתח product בקונפיגורציה הנוכחית
        const configIndex = this.product.configurationIndex || 0;
        const configs = this.product.configurations || [];
        const singleNames = this.product.singleNames || {};
        const productKey = configs[configIndex]?.product;
        const single = (productKey && singleNames[productKey]) ? singleNames[productKey] : (this.product.translatedName || this.selectedProductName || '');
        return single ? `${single} בהתאמה אישית` : 'בהתאמה אישית';
    }
    
    // Performance timing helper - disabled for cleaner logs
    private startTimer(label: string): void {
        this.performanceTimers.set(label, performance.now());
    }
    
    private endTimer(label: string): void {
        const startTime = this.performanceTimers.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            this.performanceTimers.delete(label);
        }
    }
    
    private isUserAuthenticated = false;
    private authToken: string | null = null;
    
    // Validation messages (הוסרו - משתמשים ב-SnackBar)
    // Helper for numeric step
    getStep(type: number): number {
        return 1 / Math.pow(10, type);
    }

    // פונקציה לבדיקת קיום ברגים פעילים (count > 0)
    hasActiveScrews(): boolean {
        if (!this.ForgingDataForPricing || this.ForgingDataForPricing.length === 0) {
            return false;
        }
        
        return this.ForgingDataForPricing.some(screw => screw.count > 0);
    }

    // פונקציה לקבלת ברגים פעילים בלבד (count > 0) עם איחוד כפילויות
    getActiveScrews(): any[] {
        if (!this.ForgingDataForPricing || this.ForgingDataForPricing.length === 0) {
            return [];
        }
        
        const activeScrews = this.ForgingDataForPricing.filter(screw => screw.count > 0);
        
        // איחוד כפילויות - ברגים עם אותו אורך
        const mergedScrews = new Map<number, any>();
        
        activeScrews.forEach(screw => {
            const length = screw.length;
            if (mergedScrews.has(length)) {
                // איחוד עם בורג קיים
                const existing = mergedScrews.get(length)!;
                existing.count += screw.count;
            } else {
                // בורג חדש
                mergedScrews.set(length, { ...screw });
            }
        });
        
        return Array.from(mergedScrews.values());
    }
    // ...existing code...
    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        
        // כששוסגרים את התפריט - לצמצם את המחיר
        if (!this.drawerOpen) {
            this.isPriceMinimized = true;
            // סגירת תפריט המחיר כשסוגרים את תפריט המידות
            this.isPriceManuOpen = false;
        }
        
        // קריאה ל-onResize ללא איפוס isPriceMinimized
        setTimeout(() => {
            this.onResizeWithoutReset();
        }, 310); // Wait for transition to finish
    }
    toggleWireframe() {
        
        // במובייל (sm ומטה, רוחב <= 576px) לא לאפשר הפעלת הקוביה בכלל
        const isMobile = window.innerWidth <= 576;
        
        if (isMobile) {
            // במובייל - לא לעשות כלום, הקוביה לא תופיע
            return;
        }
        
        this.showWireframe = !this.showWireframe;
        
        if (this.showWireframe) {
            this.addWireframeCube();
        } else {
            this.removeWireframeCube();
        }
    }
    
    // פונקציה להפעלת מצב שקוף
    toggleTransparentMode() {
        // במוצר קורות - לא לאפשר מצב שקוף
        if (this.isBelams) {
            return;
        }
        
        this.isTransparentMode = !this.isTransparentMode;
        // עדכון המודל כדי להחיל את השקיפות
        this.updateBeams(); // עם אנימציה רגילה
    }
    
    // ניווט לעמוד הבית (בחירת מוצר)
    navigateToHome() {
        this.router.navigate(['/main-section/choose-printing-system']);
    }
    
    
    // פתיחה/סגירה של תפריט אפשרויות נוספות
    toggleOptionsMenu() {
        this.isOptionsMenuOpen = !this.isOptionsMenuOpen;
        // סגירת תפריט ניהול המערכת אם הוא פתוח
        if (this.isOptionsMenuOpen) {
            this.isSystemMenuOpen = false;
        }
    }
    
    // פתיחה/סגירה של תפריט ניהול המערכת
    toggleSystemMenu() {
        this.isSystemMenuOpen = !this.isSystemMenuOpen;
        // סגירת תפריט האפשרויות אם הוא פתוח
        if (this.isSystemMenuOpen) {
            this.isOptionsMenuOpen = false;
        }
    }
    
    // הפעלת קוביית ניווט במובייל
    toggleNavigationCube() {
        this.showNavigationCube = !this.showNavigationCube;
        // סגירת תפריט האפשרויות
        this.isOptionsMenuOpen = false;
    }
    
    // צמצום/הרחבת תפריט המחיר
    togglePriceMinimize() {
        this.isPriceMinimized = !this.isPriceMinimized;
        
        // סגירת תפריט המחיר כשמצמצמים
        if (this.isPriceMinimized) {
            this.isPriceManuOpen = false;
        }
    }
    
    // הרחבת תפריט המחיר ופתיחת תפריט האופציות
    expandAndOpenPricingOptions() {
        // שלב 1: הרחבת התפריט (אם הוא מצומצם)
        if (this.isPriceMinimized) {
            this.isPriceMinimized = false;
            
            // שלב 2: פתיחת תפריט 3 האופציות אחרי 100ms
            setTimeout(() => {
                if (this.pricingMenuTrigger) {
                    this.pricingMenuTrigger.openMenu();
                }
            }, 100);
        } else {
            // אם התפריט כבר מורחב, פשוט פותחים/סוגרים את תפריט האופציות
            if (this.pricingMenuTrigger) {
                this.pricingMenuTrigger.toggleMenu();
            }
        }
    }
    
    
    // פונקציה לטיפול בהוספה לסל או עדכון לפי מצב עריכה
    handleAddToCart() {
        // בדיקה אם יש אזהרות - אם כן, פתיחת תפריט האזהרה
        if (this.checkIfHasDimensionsAlert() || this.hasHiddenBeams || this.hasNoMiddleBeams) {
            this.showWarningMenu = true;
            return;
        }
        
        // אם אין אזהרות, ישר לביצוע הפעולה
        this.confirmAddToCart();
    }
    
    // פונקציה לביצוע הוספה לסל או עדכון
    confirmAddToCart() {
        // סגירת תפריט האזהרה אם פתוח
        this.showWarningMenu = false;
        
        try {
            // בדיקה אם זה מצב עריכה - עדכון מוצר קיים
            const editingItemId = localStorage.getItem('editingItemId');
            
            if (this.isEditMode && editingItemId) {
                // מצב עריכה - עדכון מוצר קיים
                this.updateProductInBasket(editingItemId);
            } else {
                // מצב רגיל - הוספת מוצר חדש
                this.addProductToBasket();
            }
        } catch (error) {
            console.error('❌ Error in confirmAddToCart:', error);
        }
    }
    
    // פונקציה להוספת המוצר לסל
    addProductToBasket() {
        try {
            
            // יצירת קונפיגורציה של המוצר (פורמט 1)
            
            const productConfiguration: ProductConfiguration = {
                productName: this.selectedProductName || 'Unknown Product',
                translatedProductName: this.selectedProductName || 'Unknown Product',
                inputConfigurations: this.params.map(param => ({
                    inputName: param.name,
                    // שולחים את הערך האמיתי שהמשתמש עובד איתו (default הוא הערך המעודכן אצלנו)
                    value: param?.default,
                    selectedBeamIndex: param.selectedBeamIndex,
                    selectedTypeIndex: param.selectedTypeIndex
                })),
                selectedCorners: this.params.map(param => ({
                    cornerType: param.name,
                    cornerData: param.selectedBeamIndex !== undefined ? param.beams[param.selectedBeamIndex] : null
                })),
                originalProductData: this.product
            };

            // יצירת רשימת חיתוך (פורמט 2)
            const cutList: CutList = {
                corners: this.BeamsDataForPricing?.map(beamData => ({
                    cornerType: beamData.beamName,
                    length: beamData.type.length,
                    quantity: beamData.totalSizes.reduce((sum, size) => sum + size.count, 0)
                })) || [],
                screws: this.ForgingDataForPricing?.map(forgingData => ({
                    screwType: forgingData.type,
                    length: forgingData.length,
                    quantity: forgingData.count
                })) || []
            };

            // יצירת הסידור המאורגן (פורמט 3)
            const organizedArrangement: OrganizedArrangement = {
                corners: this.cuttingPlan?.map(beam => ({
                    cornerType: beam.beamType,
                    length: beam.beamLength,
                    quantity: beam.cuts.length,
                    arrangement: beam
                })) || [],
                screwBoxes: this.screwsPackagingPlan?.map(pkg => ({
                    screwType: pkg.screwTranslatedName,
                    length: pkg.optimalPackage.length,
                    quantity: pkg.numPackages,
                    boxPrice: pkg.optimalPackage.price,
                    arrangement: pkg
                })) || []
            };

            // יצירת מידע המחירים
            const pricingInfo: PricingInfo = {
                totalPrice: this.calculatedPrice || 0,
                cutCornersPrice: {
                    cornerPrice: this.cuttingPlan?.reduce((sum, beam) => sum + beam.beamPrice, 0) || 0,
                    cuttingPrice: this.drawingPrice || 0,
                    cornerUnitPrice: this.cuttingPlan?.[0]?.beamPrice || 0,
                    units: this.cuttingPlan?.reduce((sum, beam) => sum + beam.cuts.length, 0) || 0,
                    total: (this.cuttingPlan?.reduce((sum, beam) => sum + beam.beamPrice, 0) || 0) + (this.drawingPrice || 0)
                },
                screwsPrice: {
                    boxPrice: this.screwsPackagingPlan?.reduce((sum, pkg) => sum + pkg.totalPrice, 0) || 0,
                    unitsPerType: this.ForgingDataForPricing?.map(forgingData => ({
                        screwType: forgingData.type,
                        quantity: forgingData.count
                    })) || [],
                    boxPricePerType: this.screwsPackagingPlan?.map(pkg => ({
                        screwType: pkg.screwTranslatedName,
                        price: pkg.optimalPackage.price
                    })) || []
                },
                // מידע נוסף על עריכת המוצר
                editingInfo: {
                    // האם המשתמש ערך את הכמויות או הפרמטרים
                    wasEdited: (() => {
                        const hasBeamsChanged = this.hasBeamsChanged;
                        const hasScrewsChanged = this.hasScrewsChanged;
                        const hasParamsChanged = this.hasProductParametersChanged();
                        const wasEdited = hasBeamsChanged || hasScrewsChanged || hasParamsChanged;
                        
                        
                        return wasEdited;
                    })(),
                    // אופציות שנבחרו (V) וכמה כל אחת עולה
                    selectedOptions: {
                        drawing: { 
                            enabled: true, // תמיד מופעל
                            price: this.drawingPrice || 0 
                        },
                        beams: { 
                            enabled: this.isBeamsEnabled, 
                            price: this.isBeamsEnabled ? this.getBeamsOnlyPrice() : 0 
                        },
                        cutting: { 
                            enabled: this.isCuttingEnabled, 
                            price: this.isCuttingEnabled ? this.getCuttingPrice() : 0 
                        },
                        screws: { 
                            enabled: this.isScrewsEnabled, 
                            price: this.isScrewsEnabled ? this.getScrewsPrice() : 0 
                        }
                    },
                    // מחירים לפני ואחרי עריכה
                    pricesComparison: {
                        originalTotal: this.originalBeamsPrice + this.originalCuttingPrice + this.originalScrewsPrice + (this.drawingPrice || 0),
                        editedTotal: this.getFinalPrice(),
                        originalBeams: this.originalBeamsPrice,
                        editedBeams: this.getBeamsOnlyPrice(),
                        originalCutting: this.originalCuttingPrice,
                        editedCutting: this.getCuttingPrice(),
                        originalScrews: this.originalScrewsPrice,
                        editedScrews: this.getScrewsPrice()
                    },
                    // כמויות מעודכנות של קורות וברגים אחרי עריכה
                    updatedQuantities: {
                        beams: this.BeamsDataForPricing?.map((beam, index) => ({
                            beamType: beam.beamTranslatedName,
                            originalQuantity: this.originalBeamQuantities[index] || 0,
                            editedQuantity: this.getFullBeamsCount(beam)
                        })) || [],
                        screws: this.screwsPackagingPlan?.map((screw, index) => ({
                            screwType: screw.screwTranslatedName,
                            originalQuantity: this.originalScrewsData?.[index]?.numPackages || 0,
                            editedQuantity: screw.numPackages
                        })) || []
                    },
                    // האם הקורות מספיקות לבניית הרהיט
                    isCuttingPossible: this.isCuttingPossible
                }
            };

            // חישוב מידות המוצר לפני הוספה לסל
            const dimensions = this.getProductDimensionsRaw();
            
            
            // הוספה לסל
            this.productBasketService.addToBasket(
                productConfiguration,
                cutList,
                organizedArrangement,
                pricingInfo,
                dimensions
            );

            
            // ניווט לסל הקניות
            this.router.navigate(['/shopping-cart']);
            
        } catch (error) {
            console.error('❌ Error adding product to basket:', error);
        }
    }
    
    // פונקציה לעדכון מוצר קיים בסל
    updateProductInBasket(itemId: string) {
        try {
            
            // יצירת קונפיגורציה של המוצר (פורמט 1)
            const productConfiguration: ProductConfiguration = {
                productName: this.selectedProductName || 'Unknown Product',
                translatedProductName: this.selectedProductName || 'Unknown Product',
                inputConfigurations: this.params.map(param => ({
                    inputName: param.name,
                    value: param?.default,
                    selectedBeamIndex: param.selectedBeamIndex,
                    selectedTypeIndex: param.selectedTypeIndex
                })),
                selectedCorners: this.params.map(param => ({
                    cornerType: param.name,
                    cornerData: param.selectedBeamIndex !== undefined ? param.beams[param.selectedBeamIndex] : null
                })),
                originalProductData: this.product
            };

            // יצירת רשימת חיתוך (פורמט 2)
            const cutList: CutList = {
                corners: this.BeamsDataForPricing?.map(beamData => ({
                    cornerType: beamData.beamName,
                    length: beamData.type.length,
                    quantity: beamData.totalSizes.reduce((sum, size) => sum + size.count, 0)
                })) || [],
                screws: this.ForgingDataForPricing?.map(forgingData => ({
                    screwType: forgingData.type,
                    length: forgingData.length,
                    quantity: forgingData.count
                })) || []
            };

            // יצירת הסידור המאורגן (פורמט 3)
            const organizedArrangement: OrganizedArrangement = {
                corners: this.cuttingPlan?.map(beam => ({
                    cornerType: beam.beamType,
                    length: beam.beamLength,
                    quantity: beam.cuts.length,
                    arrangement: beam
                })) || [],
                screwBoxes: this.screwsPackagingPlan?.map(pkg => ({
                    screwType: pkg.screwTranslatedName,
                    length: pkg.optimalPackage.length,
                    quantity: pkg.numPackages,
                    boxPrice: pkg.optimalPackage.price,
                    arrangement: pkg
                })) || []
            };

            // יצירת מידע המחירים
            const pricingInfo: PricingInfo = {
                totalPrice: this.calculatedPrice || 0,
                cutCornersPrice: {
                    cornerPrice: this.cuttingPlan?.reduce((sum, beam) => sum + beam.beamPrice, 0) || 0,
                    cuttingPrice: this.drawingPrice || 0,
                    cornerUnitPrice: this.cuttingPlan?.[0]?.beamPrice || 0,
                    units: this.cuttingPlan?.reduce((sum, beam) => sum + beam.cuts.length, 0) || 0,
                    total: (this.cuttingPlan?.reduce((sum, beam) => sum + beam.beamPrice, 0) || 0) + (this.drawingPrice || 0)
                },
                screwsPrice: {
                    boxPrice: this.screwsPackagingPlan?.reduce((sum, pkg) => sum + pkg.totalPrice, 0) || 0,
                    unitsPerType: this.ForgingDataForPricing?.map(forgingData => ({
                        screwType: forgingData.type,
                        quantity: forgingData.count
                    })) || [],
                    boxPricePerType: this.screwsPackagingPlan?.map(pkg => ({
                        screwType: pkg.screwTranslatedName,
                        price: pkg.optimalPackage.price
                    })) || []
                },
                // מידע נוסף על עריכת המוצר
                editingInfo: {
                    wasEdited: (() => {
                        const hasBeamsChanged = this.hasBeamsChanged;
                        const hasScrewsChanged = this.hasScrewsChanged;
                        const hasParamsChanged = this.hasProductParametersChanged();
                        const wasEdited = hasBeamsChanged || hasScrewsChanged || hasParamsChanged;
                        
                        return wasEdited;
                    })(),
                    selectedOptions: {
                        drawing: { 
                            enabled: true,
                            price: this.drawingPrice || 0 
                        },
                        beams: { 
                            enabled: this.isBeamsEnabled, 
                            price: this.isBeamsEnabled ? this.getBeamsOnlyPrice() : 0 
                        },
                        cutting: { 
                            enabled: this.isCuttingEnabled, 
                            price: this.isCuttingEnabled ? this.getCuttingPrice() : 0 
                        },
                        screws: { 
                            enabled: this.isScrewsEnabled, 
                            price: this.isScrewsEnabled ? this.getScrewsPrice() : 0 
                        }
                    },
                    pricesComparison: {
                        originalTotal: this.originalBeamsPrice + this.originalCuttingPrice + this.originalScrewsPrice + (this.drawingPrice || 0),
                        editedTotal: this.getFinalPrice(),
                        originalBeams: this.originalBeamsPrice,
                        editedBeams: this.getBeamsOnlyPrice(),
                        originalCutting: this.originalCuttingPrice,
                        editedCutting: this.getCuttingPrice(),
                        originalScrews: this.originalScrewsPrice,
                        editedScrews: this.getScrewsPrice()
                    },
                    updatedQuantities: {
                        beams: this.BeamsDataForPricing?.map((beam, index) => ({
                            beamType: beam.beamTranslatedName,
                            originalQuantity: this.originalBeamQuantities[index] || 0,
                            editedQuantity: this.getFullBeamsCount(beam)
                        })) || [],
                        screws: this.screwsPackagingPlan?.map((screw, index) => ({
                            screwType: screw.screwTranslatedName,
                            originalQuantity: this.originalScrewsData?.[index]?.numPackages || 0,
                            editedQuantity: screw.numPackages
                        })) || []
                    },
                    isCuttingPossible: this.isCuttingPossible
                }
            };

            // חישוב מידות המוצר
            const dimensions = this.getProductDimensionsRaw();
            
            
            // עדכון המוצר בסל
            this.productBasketService.updateBasketItem(
                itemId,
                productConfiguration,
                cutList,
                organizedArrangement,
                pricingInfo,
                dimensions
            );

            
            // הסרת ה-editingItemId מ-localStorage
            localStorage.removeItem('editingItemId');
            
            // ניווט לסל הקניות
            this.router.navigate(['/shopping-cart']);
            
        } catch (error) {
            console.error('❌ Error updating product in basket:', error);
        }
    }

    // =====================
    // Input editing handlers
    // =====================

    onNumberFocus(param: any) {
        // שמירת ערך התחלה לעריכה כדי לזהות שינוי אמיתי
        if (param._editStartValue === undefined) {
            param._editStartValue = param.default;
        } else {
            param._editStartValue = param.default;
        }
        if (param.editingValue === undefined) {
            param.editingValue = param.default;
        }
    }

    onNumberCommit(param: any) {
        
        const raw = param.editingValue;
        const start = param._editStartValue;
        
        // בדיקה אם הערך תקין
        if (!this.isValidValue(raw, param)) {
            
            // איפוס הערך הזמני לערך הקודם
            param.editingValue = start;
            // איפוס ערכי עזר
            param._editStartValue = undefined;
            return;
        }
        
        const parsed = this.parseNumberWithinBounds(raw, param.min, param.max, param.default);
        const changed = parsed !== start;
        
        
        if (changed) {
            
            // עדכון הערך במודל
            param.default = parsed;
            // עדכון הערך הזמני גם כן
            param.editingValue = parsed;
            
            this.updateModel();
        }
        // איפוס ערכי עזר
        param._editStartValue = undefined;
    }

    onGenericNumberCommit(param: any) {
        
        const raw = param.editingValue;
        const start = param._editStartValue;
        
        // בדיקה אם הערך תקין
        if (!this.isValidValue(raw, param)) {
            
            // איפוס הערך הזמני לערך הקודם
            param.editingValue = start;
            // איפוס ערכי עזר
            param._editStartValue = undefined;
            return;
        }
        
        const parsed = this.parseNumberWithinBounds(raw, param.min, param.max, param.default);
        const changed = parsed !== start;
        
        
        if (changed) {
            
            // עדכון הערך במודל
            param.default = parsed;
            // עדכון הערך הזמני גם כן
            param.editingValue = parsed;
            
            // עדכון דרך הפונקציה הכללית כדי לשמר לוגיקת צד-שרת/אימות קיימת
            this.updateParameterValue(param, parsed);
        }
        param._editStartValue = undefined;
    }

    onShelfNumberFocus(param: any, index: number) {
        param._editStartArray = param._editStartArray || {};
        const logicalIndex = index;
        param._editStartArray[logicalIndex] = param.default[logicalIndex];
        if (!param._editingValues) param._editingValues = [];
        if (param._editingValues[logicalIndex] === undefined) {
            param._editingValues[logicalIndex] = param.default[logicalIndex];
        }
    }

    onShelfNumberCommit(param: any, index: number) {
        
        const logicalIndex = index;
        const start = param._editStartArray ? param._editStartArray[logicalIndex] : param.default[logicalIndex];
        const raw = param._editingValues ? param._editingValues[logicalIndex] : param.default[logicalIndex];
        
        // בדיקה אם הערך תקין
        if (!this.isValidValue(raw, param)) {
            
            // איפוס הערך הזמני לערך הקודם
            if (!param._editingValues) param._editingValues = [];
            param._editingValues[logicalIndex] = start;
            // איפוס ערכי עזר
            if (param._editStartArray) delete param._editStartArray[logicalIndex];
            return;
        }
        
        const parsed = this.parseNumberWithinBounds(raw, param.min, param.max, param.default[logicalIndex]);
        const changed = parsed !== start;
        
        
        if (changed) {
            
            // עדכון הערך במודל
            param.default[logicalIndex] = parsed;
            // עדכון הערך הזמני גם כן
            if (!param._editingValues) param._editingValues = [];
            param._editingValues[logicalIndex] = parsed;
            
            this.updateBeams();
        }
        if (param._editStartArray) delete param._editStartArray[logicalIndex];
    }

    private parseNumberWithinBounds(value: any, min: number, max: number, fallback: number): number {
        let num = typeof value === 'number' ? value : parseFloat(value);
        if (isNaN(num)) num = fallback;
        if (typeof min === 'number') num = Math.max(min, num);
        if (typeof max === 'number') num = Math.min(max, num);
        return num;
    }
    
    // בדיקה אם הערך תקין לפי ה-type (כמות הספרות אחרי הנקודה)
    private isValidDecimalPlaces(value: any, type: number): boolean {
        if (value === null || value === undefined || value === '') return false;
        
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        
        // בדיקה אם יש יותר ספרות אחרי הנקודה מה-type המותר
        const decimalPart = value.toString().split('.')[1];
        if (decimalPart && decimalPart.length > type) {
            return false;
        }
        
        return true;
    }
    
    // פונקציה לבדיקת תקינות ערך כוללת
    private isValidValue(value: any, param: any): boolean {
        // בדיקה אם זה מספר תקין
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        
        // בדיקה אם זה תקין לפי ה-type
        if (!this.isValidDecimalPlaces(value, param.type)) return false;
        
        return true;
    }

    // האם יש שינוי בערך העריכה לעומת ערך קיים
    shouldShowCommit(param: any): boolean {
        if (param && param.editingValue !== undefined) {
            // בדיקה אם הערך הגולמי שונה מהערך הנוכחי (ללא הגבלה)
            return param.editingValue !== param.default;
        }
        return false;
    }

    // טיפול ב-input event - רק מאחסן ערך זמני, ללא קלמפינג בזמן הקלדה
    onNumberInput(param: any, event: any) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            param.editingValue = value;
        }
    }
    
    // טיפול ב-input event למדפים - רק מאחסן ערך זמני למיקום המתאים
    onShelfNumberInput(param: any, event: any, index: number) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            const logicalIndex = index;
            if (!param._editingValues) param._editingValues = [];
            param._editingValues[logicalIndex] = value;
        }
    }

    // לחצן עדכון מהיר לאינפוט בודד
    onNumberQuickCommit(param: any, inputEl?: HTMLInputElement) {
        this.onNumberCommit(param);
        try { inputEl && inputEl.blur && inputEl.blur(); } catch {}
    }

    // לחצן עדכון מהיר לערך במערך (מדפים וכו')
    shouldShowShelfCommit(param: any, index: number): boolean {
        const logicalIndex = index;
        const hasEditing = param && param._editingValues && param._editingValues[logicalIndex] !== undefined;
        if (!hasEditing) return false;
        // בדיקה אם הערך הגולמי שונה מהערך הנוכחי (ללא הגבלה)
        return param._editingValues[logicalIndex] !== param.default[logicalIndex];
    }

    onShelfQuickCommit(param: any, index: number, inputEl?: HTMLInputElement) {
        this.onShelfNumberCommit(param, index);
        try { inputEl && inputEl.blur && inputEl.blur(); } catch {}
    }
    
    /**
     * פתיחת דיאלוג סל המוצרים
     */
    openShoppingCart() {
        this.router.navigate(['/shopping-cart']);
    }
    
    // משתנה לשליטה בתצוגת תפריט האזהרה
    showWarningMenu = false;
    
    // משתנים לשליטה בהצגת התרעות
    showHiddenBeamsWarning = true;
    showNoMiddleBeamsWarning = true;
    
    // פונקציות לסגירת התרעות
    dismissHiddenBeamsWarning() {
        this.showHiddenBeamsWarning = false;
    }
    
    dismissNoMiddleBeamsWarning() {
        this.showNoMiddleBeamsWarning = false;
    }
    
    
    // בדיקה אם יש צורך בהצגת אזהרה
    shouldShowWarning(): boolean {
        // בדיקה ישירה של dimensions-alert
        const hasDimensionsAlertNow = this.checkIfHasDimensionsAlert();
        const result = hasDimensionsAlertNow || this.hasHiddenBeams || this.hasNoMiddleBeams;
        return result;
    }
    
    // בדיקה ישירה אם יש dimensions-alert במוצר וגם יש הבדל בין הגובה שהוזן לגובה האמיתי
    checkIfHasDimensionsAlert(): boolean {
        // שלב 1: בדיקה אם יש restriction של dimensions-alert
        if (!this.product || !this.product.restrictions) {
            return false;
        }
        
        const dimensionsAlert = this.product.restrictions.find((r: any) => r.name === 'dimensions-allert' || r.name === 'dimensions-alert');
        
        if (!dimensionsAlert || dimensionsAlert.val !== true) {
            return false;
        }
        
        // שלב 2: בדיקה אם יש הפרש בין הגובה שהוזן לגובה האמיתי
        // 🎯 צריך לבדוק את הערכים הנוכחיים (הכי מעודכנים) של שניהם
        const actualHeight = this.getActualHeight();
        const userHeight = this.getUserDefinedHeight();
        
        // 🔍 השוואה מדויקת (עם סובלנות קטנה לשגיאות עיגול)
        const difference = Math.abs(actualHeight - userHeight);
        const hasDifference = difference > 0.01; // אם ההפרש גדול מ-0.01 ס"מ
        
        return hasDifference;
    }
    
    // קבלת הגובה האמיתי של המוצר
    getActualHeight(): number {
        const dimensions = this.getProductDimensionsRaw();
        const height = dimensions.height;
        return height;
    }
    
    // קבלת הגובה שהמשתמש הגדיר (הערך הנוכחי מהאינפוט)
    getUserDefinedHeight(): number {
        // 🎯 משתמשים ב-this.params (המערך הנוכחי והמעודכן) ולא ב-this.product.params
        const heightParam = this.params?.find((p: any) => p.name === 'height');
        if (heightParam && heightParam.default !== undefined && heightParam.default !== null) {
            // המרה למספר אם צריך
            const heightValue = typeof heightParam.default === 'number' ? heightParam.default : Number(heightParam.default);
            return isNaN(heightValue) ? 0 : heightValue;
        }
        return 0;
    }
    
    // חישוב ההפרש בין הגובה שהוגדר לגובה האמיתי
    getHeightDifference(): number {
        const actualHeight = this.getActualHeight();
        const userHeight = this.getUserDefinedHeight();
        const difference = actualHeight - userHeight;
        return difference;
    }
    
    // קבלת הטקסט המתאים להפרש הגובה
    getHeightDifferenceText(): string {
        const difference = this.getHeightDifference();
        if (difference > 0) {
            return 'יותר';
        } else if (difference < 0) {
            return 'פחות';
        } else {
            return 'בדיוק כמו';
        }
    }
    
    // קבלת ההפרש המוחלט בין הגובה שהוגדר לגובה האמיתי
    getAbsoluteHeightDifference(): number {
        const difference = this.getHeightDifference();
        const absoluteDifference = Math.abs(difference);
        return absoluteDifference;
    }
    
    // קבלת כמות הקורות החסרות
    getHiddenBeamsCount(): number {
        // החישוב מבוסס על הלוגיקה הקיימת של hasHiddenBeams
        // נצטרך למצוא את המספר המדויק של קורות חסרות
        return 2; // ברירת מחדל - ניתן לעדכן לפי הלוגיקה המדויקת
    }
    
    // קבלת שם סוג הקורה
    getBeamTypeName(): string {
        return 'מדף'; // ברירת מחדל - ניתן לעדכן לפי הלוגיקה המדויקת
    }
    
    // סגירת תפריט האזהרה
    closeWarningMenu() {
        this.showWarningMenu = false;
    }
    
    // איפוס מבט המצלמה לנקודת ההתחלה
    resetCameraView() {
        // סגירת תפריט האפשרויות
        this.isOptionsMenuOpen = false;
        
        // איפוס מוחלט של מיקום הסצנה לפני הכל
        this.scene.position.set(0, -120, 0);
        
        // קבלת מידות המוצר לחישוב מיקום אופטימלי
        const dimensions = this.getProductDimensionsRaw();
        
        // חישוב מיקום מצלמה אופטימלי על בסיס המידות
        const optimalPosition = this.calculateOptimalCameraPosition(dimensions);
        
        // איפוס המצלמה למיקום האופטימלי
        this.camera.position.set(optimalPosition.x, optimalPosition.y, optimalPosition.z);
        this.camera.lookAt(0, 0, 0);
        
        // המתנה של 100 מילישניות ואז הפעלת האנימציה בדיוק כמו בפתיחה
        setTimeout(() => {
            if (this.isBelams) {
                // עבור מוצר קורות - שימוש בפונקציה המיוחדת
                this.centerCameraOnBeams();
            } else {
                // עבור שאר המוצרים - שימוש בפונקציה הרגילה
                this.centerCameraOnWireframe();
            }
        }, 100);
        
    }
    
    // משתנים לניהול dropdowns
    openDropdowns: { [key: string]: boolean } = {};

    // פונקציות לניהול dropdowns
    toggleDropdown(type: string, param: any) {
        const key = `${type}_${param.name}`;
        this.openDropdowns[key] = !this.openDropdowns[key];
        
    }

    isDropdownOpen(type: string, param: any): boolean {
        const key = `${type}_${param.name}`;
        return this.openDropdowns[key] || false;
    }

    selectBeam(index: number, param: any) {
        
        // CHACK_TEXTURE - Log when selectBeam is called
        if (param.name === 'shelfs' || param.type === 'beamSingle') {
        }
        
        // Update the parameter object directly in this.product.params by name to ensure we modify the right object
        const beamParamIndex = this.product?.params?.findIndex((p: any) => 
            p.name === param.name && p.type === param.type
        );
        
        if (beamParamIndex !== undefined && beamParamIndex >= 0) {
            this.product.params[beamParamIndex].selectedBeamIndex = index;
            this.product.params[beamParamIndex].selectedTypeIndex = 0; // איפוס בחירת סוג העץ לסוג הראשון
        } else {
            console.error('CRITICAL - Could not find param in product.params!', {
                paramName: param.name,
                paramType: param.type
            });
        }
        
        param.selectedBeamIndex = index;
        param.selectedTypeIndex = 0; // איפוס בחירת סוג העץ לסוג הראשון
        
        // Save the selection to localStorage so it persists across page refreshes
        const storageKey = `selectedBeamIndex_${this.product?.name}_${param.name}`;
        localStorage.setItem(storageKey, index.toString());
        
        this.updateBeams();
        this.closeDropdown('beam', param);
    }

    selectType(index: number, param: any) {
          
          // CHACK_TEXTURE - Log when selectType is called
          if (param.name === 'shelfs' || param.type === 'beamSingle') {
          }
        
        // Update the parameter object directly in this.product.params by name to ensure we modify the right object
        const typeParamIndex = this.product?.params?.findIndex((p: any) => 
            p.name === param.name && p.type === param.type
        );
        
        if (typeParamIndex !== undefined && typeParamIndex >= 0) {
            this.product.params[typeParamIndex].selectedTypeIndex = index;
        } else {
            console.error('CRITICAL - Could not find param in product.params!', {
                paramName: param.name,
                paramType: param.type
            });
        }
        
        param.selectedTypeIndex = index;
        
        this.updateBeams();
        this.closeDropdown('type', param);
    }

    closeDropdown(type: string, param: any) {
        const key = `${type}_${param.name}`;
        this.openDropdowns[key] = false;
    }

    closeAllDropdowns() {
        this.openDropdowns = {};
    }

    // פונקציות לטיפול בבחירת קורות וסוגי עץ
    onBeamSelectionChange(event: any, param: any) {
        this.debugLog('=== onBeamSelectionChange נקרא ===');
        this.debugLog('event:', event);
        this.debugLog('param:', param);

        if (!param) {
            console.error('param is null or undefined!');
            return;
        }

        if (!param.beams || param.beams.length === 0) {
            console.error('param.beams is empty or undefined!', param.beams);
            return;
        }

        // קבלת הערך החדש מה-event
        const newValue = parseInt(event.target.value);
        this.debugLog('param.name:', param.name);
        this.debugLog('param.beams length:', param.beams.length);
        this.debugLog('newIndex:', newValue);
        this.debugLog('param.selectedBeamIndex לפני:', param.selectedBeamIndex);

        // עדכון הערך
        param.selectedBeamIndex = newValue;
        this.debugLog('param.selectedBeamIndex אחרי:', param.selectedBeamIndex);

        // איפוס בחירת סוג העץ לסוג הראשון ברשימה
        param.selectedTypeIndex = 0;
        this.debugLog('param.selectedTypeIndex אופס ל-0 (סוג העץ הראשון)');

        // קריאה לעדכון
        this.updateBeams();
    }
    
    onTypeSelectionChange(event: any, param: any) {
        this.debugLog('=== onTypeSelectionChange נקרא ===');
        this.debugLog('event:', event);
        this.debugLog('param:', param);

        if (!param) {
            console.error('param is null or undefined!');
            return;
        }

        // קבלת הערך החדש מה-event
        const newValue = parseInt(event.target.value);
        this.debugLog('param.name:', param.name);
        this.debugLog('newIndex:', newValue);
        this.debugLog('param.selectedTypeIndex לפני:', param.selectedTypeIndex);

        // עדכון הערך
        param.selectedTypeIndex = newValue;
        this.debugLog('param.selectedTypeIndex אחרי:', param.selectedTypeIndex);

        // קריאה לעדכון
        this.updateBeams();
    }
    
    // בדיקת מגבלות המוצר
    private checkProductRestrictions(product: any) {
        // איפוס המשתנה
        this.hasDimensionsAlert = false;
        
        // בדיקה אם יש restrictions
        if (!product.restrictions || !Array.isArray(product.restrictions)) {
            return;
        }
        
        // חיפוש מגבלת dimensions-alert
        const dimensionsAlertRestriction = product.restrictions.find(
            (r: any) => r.name === 'dimensions-alert' || r.name === 'dimensions-allert'
        );
        
        if (dimensionsAlertRestriction && dimensionsAlertRestriction.val === true) {
            this.hasDimensionsAlert = true;
        }
    }
    private removeWireframeCube() {
        const existingWireframe =
            this.scene.getObjectByName('productWireframe');
        if (existingWireframe) {
            this.scene.remove(existingWireframe);
        }
    }
    // פונקציית ניווט
    onNavigationClick(direction: string) {
        this.setCameraView(direction);
    }
    
    // פונקציה להגדרת תצוגת המצלמה עם אנימציה
    setCameraView(view: string) {
        if (!this.camera || !this.scene) return;
        
        const duration = 500; // 0.5 שניות
        const startTime = Date.now();
        
        // מיקום התחלתי
        const startPosition = this.camera.position.clone();
        const startRotation = this.scene.rotation.clone();
        
        // מיקום סופי
        let targetPosition: THREE.Vector3;
        let targetRotation: THREE.Euler;
        
        switch (view) {
            case 'top':
                targetPosition = new THREE.Vector3(0, 400, 0);
                targetRotation = new THREE.Euler(0, 0, 0);
                break;
            case 'bottom':
                targetPosition = new THREE.Vector3(0, -400, 0);
                targetRotation = new THREE.Euler(0, 0, 0);
                break;
            case 'left':
                targetPosition = new THREE.Vector3(-400, 0, 0);
                targetRotation = new THREE.Euler(0, 0, 0);
                break;
            case 'right':
                targetPosition = new THREE.Vector3(400, 0, 0);
                targetRotation = new THREE.Euler(0, 0, 0);
                break;
            case 'front':
                targetPosition = new THREE.Vector3(0, 0, 400);
                targetRotation = new THREE.Euler(0, 0, 0);
                break;
            default:
                // מצב ברירת מחדל - תצוגה איזומטרית
                targetPosition = new THREE.Vector3(280, 320, 480);
                targetRotation = new THREE.Euler(0, Math.PI / 6, 0);
        }
        
        // פונקציית אנימציה
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-in-out)
            const easeProgress = progress < 0.5 
                ? 2 * progress * progress 
                : 1 - Math.pow(-2 * progress + 2, 2) / 2;
            
            // אינטרפולציה של מיקום
            this.camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
            
            // אינטרפולציה של סיבוב
            this.scene.rotation.x = THREE.MathUtils.lerp(startRotation.x, targetRotation.x, easeProgress);
            this.scene.rotation.y = THREE.MathUtils.lerp(startRotation.y, targetRotation.y, easeProgress);
            this.scene.rotation.z = THREE.MathUtils.lerp(startRotation.z, targetRotation.z, easeProgress);
            
            // המשך האנימציה
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    
    // פונקציה לפתיחת/סגירת תפריט המחיר
    togglePriceMenu() {
        this.isPriceManuOpen = !this.isPriceManuOpen;
    }
    
    // פונקציה לטיפול בשינויי אינפוט מספרי (עדכון מיידי לחצים)
    onNumberInputChange(event: any, updateFunction: string, param?: any) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            // בדיקה אם זה שינוי על ידי חצים (לא הקלדה ידנית)
            const isArrowKey = event.inputType === undefined || event.inputType === 'insertReplacementText';
            if (isArrowKey) {
                // עדכון מיידי לחצים
                setTimeout(() => {
                    if (updateFunction === 'updateModel') {
                        this.updateModel();
                    }
                }, 0);
            } else if (param) {
                // עבור הקלדה ידנית - validation בזמן אמת אם יש פרמטר
                const validatedValue = this.validateParameterValue(param, value);
                if (validatedValue !== value) {
                    // אם הערך לא תקין, נחזיר אותו לערך המאומת
                    event.target.value = validatedValue;
                    param.default = validatedValue;
                }
            }
        }
    }
    
    // פונקציה לטיפול בשינויי אינפוט של פרמטרים
    onParameterInputChange(event: any, param: any) {
        const value = parseFloat(event.target.value);
        
        // Debug log for futon parameters
        if (this.isFuton && (param.name === 'width' || param.name === 'depth')) {
            this.debugLog(`DEBUG FUTON INPUT CHANGE - ${param.name}:`, {
                value: value,
                min: param.min,
                max: param.max,
                inputType: event.inputType,
                param: param
            });
        }
        
        if (!isNaN(value)) {
            // בדיקה אם זה שינוי על ידי חצים (לא הקלדה ידנית)
            const isArrowKey = event.inputType === undefined || event.inputType === 'insertReplacementText';
            if (isArrowKey) {
                // עדכון מיידי לחצים עם validation
                setTimeout(() => {
                    this.updateParameterValue(param, value);
                }, 0);
            } else {
                // עבור הקלדה ידנית - רק עדכון הערך ללא validation מיידי
                param.default = value;
            }
        }
    }
    
    // פונקציה לטיפול בשינויי אינפוט של מדפים
    onShelfInputChange(event: any, param: any, idx: number) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            // בדיקה אם זה שינוי על ידי חצים (לא הקלדה ידנית)
            const isArrowKey = event.inputType === undefined || event.inputType === 'insertReplacementText';
            if (isArrowKey) {
                // עדכון מיידי לחצים
                setTimeout(() => {
                    this.updateShelfParameterValue(param, value, param.default.length - 1 - idx);
                }, 0);
            }
        }
    }
    drawerOpen: boolean = true;
    showWireframe: boolean = false; // מצב ברירת מחדל: wireframe מוסתר
    isTransparentMode: boolean = false; // מצב שקוף
    isOptionsMenuOpen: boolean = false; // האם תפריט האפשרויות פתוח
    isSystemMenuOpen: boolean = false; // האם תפריט ניהול המערכת פתוח
    showNavigationCube: boolean = false; // קוביית ניווט במובייל
    isPriceMinimized: boolean = true; // האם תפריט המחיר מצומצם
    product: any = null;
    params: any[] = [];
    selectedProductName: string = ''; // שם המוצר שנבחר מה-URL
    isTable: boolean = false; // האם זה שולחן או ארון
    isPlanter: boolean = false; // האם זה עדנית עץ
    isBox: boolean = false; // האם זה קופסת עץ (זהה לעדנית)
    isBelams: boolean = false; // האם זה קורות לפי מידה
    isFuton: boolean = false; // האם זה בסיס מיטה
    isPriceManuOpen: boolean = false; // האם תפריט המחיר פתוח
    hasHiddenBeams: boolean = false; // האם יש קורות מוסתרות בגלל חסימת רגליים
    hiddenBeamsCount: number = 0; // כמות הקורות המוסתרות
    hasNoMiddleBeams: boolean = false; // האם נשארות רק שתי הקורות המקוצרות (אין קורות באמצע)
    hasShortenedBeamsRemoved: boolean = false; // האם הקורות המקוצרות הוסרו בגלל צרות מדי
    
    // האם יש התרעה כלשהי (לשימוש ב-CSS)
    get hasAnyAlert(): boolean {
        return this.hasHiddenBeams || this.hasNoMiddleBeams || this.hasShortenedBeamsRemoved;
    }

    getBeamTypeText(): string {
        if (this.isTable) {
            return 'פלטה';
        } else if (this.isFuton) {
            return 'פלטת מיטה';
        } else {
            return 'מדף';
        }
    }
    isLoading: boolean = true; // האם התצוגה נטענת - מתחיל ב-true כדי למנוע הבהוב
    isModelLoading: boolean = true; // האם המודל התלת-מימדי נטען - מתחיל ב-true כדי למנוע הבהוב
    hasDimensionsAlert: boolean = false; // האם למוצר יש מגבלה של התרעת אי התאמה במידות
    // נתונים לחישוב מחיר
    BeamsDataForPricing: any[] = []; // מערך של נתוני קורות לחישוב מחיר
    ForgingDataForPricing: any[] = []; // מערך של נתוני ברגים לחישוב מחיר
    calculatedPrice: number = 0; // מחיר מחושב
    cuttingPlan: any[] = []; // תוכנית חיתוך מפורטת
    screwsPackagingPlan: any[] = []; // תוכנית קופסאות ברגים מפורטת
    quantity: number = 1; // כמות יחידות להזמנה
    selectedPricingOption: 'cut' | 'full' | 'plan' = 'cut'; // אופציית תמחור: cut=חתוכות, full=שלמות+הוראות, plan=הוראות בלבד
    drawingPrice: number = 20; // עלות שרטוט/הוראות חיתוך
    
    // משתנים חדשים לתפריט הגמיש
    isBeamsEnabled: boolean = true; // האם קורות מופעלות
    isCuttingEnabled: boolean = true; // האם חיתוך מופעל
    isScrewsEnabled: boolean = true; // האם ברגים מופעלים
    isCuttingPossible: boolean = true; // האם הכמויות מספיקות לחיתוך
    
    // משתנים לכפתורי עריכה
    showBeamsEditOptions: boolean = false; // האם להציג אופציות עריכה לקורות
    showScrewsEditOptions: boolean = false; // האם להציג אופציות עריכה לברגים
    
    // משתנים לשמירת מצב לפני עריכה
    private originalBeamsData: any = null;
    private originalScrewsData: any = null;
    private originalBeamQuantities: number[] = []; // שמירת הכמויות המקוריות של הקורות
    
    // משתנים למחירים ספציפיים (מתעדכנים בזמן אמת)
    private dynamicBeamsPrice: number = 0;
    private dynamicCuttingPrice: number = 0;
    private dynamicScrewsPrice: number = 0;
    
    // משתנים למחירים המקוריים (להצגה כמחוקים)
    private originalBeamsPrice: number = 0;
    private originalCuttingPrice: number = 0;
    private originalScrewsPrice: number = 0;
    
    // משתנים לבדיקה אם יש שינויים
    private hasBeamsChanged: boolean = false;
    private hasScrewsChanged: boolean = false;
    @ViewChild(MatMenuTrigger) pricingMenuTrigger!: MatMenuTrigger;
    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private route: ActivatedRoute,
        private router: Router,
        private pricingService: PricingService,
        private dialogService: DialogService,
        private productBasketService: ProductBasketService,
        private cdr: ChangeDetectorRef
    ) {}
    ngOnInit() {
        // מחיקת הגדרות מוצר מ-localStorage כשנכנסים לעמוד
        this.clearProductSettingsFromStorage();
        
        // isLoading כבר מוגדר ל-true בברירת המחדל
        this.checkUserAuthentication();
        
        // הוספת listener לסגירת dropdowns כשלוחצים מחוץ להם
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.custom-dropdown')) {
                this.closeAllDropdowns();
            }
        });
        
        // קבלת פרמטר המוצר מה-URL
        this.route.queryParams.subscribe((params) => {
            
            if (params['product']) {
                this.selectedProductName = params['product'];
                this.isTable = this.selectedProductName === 'table';
                this.isPlanter = this.selectedProductName === 'planter';
                this.isBox = this.selectedProductName === 'box';
                this.isBelams = this.selectedProductName === 'beams';
                this.isFuton = this.selectedProductName === 'futon';
                
                
                // איפוס מצב שקוף במוצר קורות
                if (this.isBelams) {
                    this.isTransparentMode = false;
                }
                this.debugLog(
                    'מוצר נבחר:',
                    this.selectedProductName,
                    'שולחן:',
                    this.isTable,
                    'עדנית:',
                    this.isPlanter
                );
                // בדיקה אם זה מוצר שונה מהמוצר האחרון (כולל תת-מוצר)
                const lastProductId = localStorage.getItem('lastSelectedProductId');
                const lastConfigIndex = localStorage.getItem('lastConfigIndex');
                const currentProductId = params['productId'] || this.selectedProductName;
                const currentConfigIndex = params['configIndex'] !== undefined ? params['configIndex'] : undefined;
                
                
                // בדיקת מצב עריכה
                
                this.isEditMode = params['isEditMode'] === 'true' || params['isEditMode'] === true || params['isEditMode'] === 'True';
                
                
                
                // הגרלת change detection
                this.cdr.detectChanges();
                
                // יצירת מזהה ייחודי שכולל גם את ה-configIndex
                const lastFullId = lastConfigIndex !== null ? `${lastProductId}_config${lastConfigIndex}` : lastProductId;
                const currentFullId = currentConfigIndex !== undefined ? `${currentProductId}_config${currentConfigIndex}` : currentProductId;
                
                
                if (lastFullId && lastFullId !== currentFullId) {
                    this.clearUserConfiguration();
                }
                
                // שמירת המוצר והתת-מוצר הנוכחיים
                localStorage.setItem('lastSelectedProductId', currentProductId);
                if (currentConfigIndex !== undefined) {
                    localStorage.setItem('lastConfigIndex', currentConfigIndex.toString());
                } else {
                    localStorage.removeItem('lastConfigIndex');
                }
                
                
                // טעינת המוצר הנכון לפי ID או שם
                if (params['productId']) {
                    // בדיקה אם יש configIndex ב-URL
                    const configIndex = params['configIndex'] !== undefined ? parseInt(params['configIndex']) : undefined;
                    this.getProductById(params['productId'], configIndex);
                } else {
                this.getProductByName(this.selectedProductName);
                }
                
                // לוג אחרון לבדיקת isEditMode לאחר הטעינה
                setTimeout(() => {
                    // הגרלת change detection שוב
                    this.cdr.detectChanges();
                }, 1000);
            } else {
                // אם אין פרמטר מוצר, נטען את המוצר האחרון או ברירת מחדל
                const lastProduct = localStorage.getItem('lastSelectedProduct');
                if (lastProduct) {
                    this.debugLog('טעינת מוצר אחרון:', lastProduct);
                    this.selectedProductName = lastProduct;
                    this.isTable = this.selectedProductName === 'table';
                    this.isPlanter = this.selectedProductName === 'planter';
                    this.isBox = this.selectedProductName === 'box';
                    this.getProductByName(this.selectedProductName);
                } else {
        this.getProductById('68a186bb0717136a1a9245de', 0); // טעינה עם configIndex=0 לקבלת קונפיגורציות שמורות
                }
            }
        });
    }
    // Check if user is authenticated
    private checkUserAuthentication() {
        const token = localStorage.getItem('token');
        if (token) {
            this.authToken = token;
            this.isUserAuthenticated = true;
        } else {
            this.isUserAuthenticated = false;
        }
    }
    
    
    // משתנה לשמירת הפרמטרים המקוריים של הדגם (ללא הגדרות שמורות)
    private originalProductParams: any[] = [];
    // Clear user configuration when switching products
    private clearUserConfiguration() {
        
        // ניקוי כל ההגדרות הקשורות למוצר הקודם
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (
                key &&
                (key.startsWith('beamConfig_') ||
                    key.startsWith('userConfig_') ||
                    key.startsWith('beam_'))
            ) {
                keysToRemove.push(key);
            }
        }
        
        
        keysToRemove.forEach((key) => {
            localStorage.removeItem(key);
        });
        
        // מחיקת קונפיגורציה כללית
        localStorage.removeItem('beam-configuration');
        
        
        // איפוס הפרמטרים לערכי ברירת המחדל
        this.resetParamsToDefaults();
    }
    
    getProductById(id: string, configIndex?: number) {
        
        this.http.get(`/api/products/${id}`).subscribe({
            next: (data) => {
                this.product = data;
                const prod: any = data;
                
                // 🎯 לוג חיפוש פרמטר leg בנתונים שהתקבלו מהבקאנד
                const legParam = prod.params?.find((p: any) => p.name === 'leg');
                if (legParam) {
                    console.log(`CHECK_LEG - getProductById: Found leg param in backend data`);
                    console.log(`CHECK_LEG - leg param from backend:`, JSON.stringify(legParam, null, 2));
                    console.log(`CHECK_LEG - leg beamsConfigurations:`, JSON.stringify(legParam.beamsConfigurations));
                    console.log(`CHECK_LEG - configIndex used:`, configIndex);
                    if (legParam.beamsConfigurations && configIndex !== undefined) {
                        console.log(`CHECK_LEG - leg beamsConfiguration at index ${configIndex}:`, legParam.beamsConfigurations[configIndex]);
                    }
                } else {
                    console.log(`CHECK_LEG - getProductById: NO leg param found in backend data!`);
                }
                
                // 🎯 CRITICAL: שמירת הפרמטרים המקוריים לפני עדכון הקונפיגורציות
                console.log('SAVE_PRO - Saving ORIGINAL params BEFORE applying configurations');
                this.originalProductParams = this.deepCopyParams(prod.params || []);
                console.log('SAVE_PRO - Original params saved:', JSON.stringify(this.originalProductParams.map(p => ({
                    name: p.name,
                    default: p.default,
                    isArray: Array.isArray(p.default)
                })), null, 2));

                // איפוס משתני הלוגים כדי לראות נתונים מעודכנים
                this.displayNameLogged = false;
                this.paramChangedLogged = false;
                
                // אם זה תת-מוצר (יש configIndex), נעדכן את הפרמטרים לפי ה-configuration
                if (configIndex !== undefined && prod.configurations && prod.configurations[configIndex]) {
                    console.log(`SAVE_PRO - Applying configuration #${configIndex}: ${prod.configurations[configIndex].translatedName}`);
                    prod.params = this.updateParamsWithConfiguration(prod.params, configIndex, prod);
                    prod.translatedName = prod.configurations[configIndex].translatedName;
                    prod.configurationName = prod.configurations[configIndex].name;
                    prod.configurationIndex = configIndex;
                }
                
                    // יצירת deep copy של הפרמטרים כדי למנוע שינוי של המקור
                    const paramsCopy = this.deepCopyParams(prod.params || []);
                    console.log('SAVE_PRO - Created paramsCopy with loaded configurations:', JSON.stringify(paramsCopy.map(p => ({
                        name: p.name,
                        default: p.default,
                        isArray: Array.isArray(p.default),
                        selectedBeamIndex: p.selectedBeamIndex,
                        pendingBeamConfig: p._pendingBeamConfig
                    })), null, 2));
                    
                    // CHECK_SHELF_BEAM: לוג מפורט על shelfs אחרי updateParamsWithConfiguration
                    const shelfsAfterUpdate = paramsCopy.find(p => p.name === 'shelfs');
                    if (shelfsAfterUpdate) {
                        console.log(`CHECK_SHELF_BEAM - After updateParamsWithConfiguration, shelfs state:`, JSON.stringify({
                            selectedBeamIndex: shelfsAfterUpdate.selectedBeamIndex,
                            selectedTypeIndex: shelfsAfterUpdate.selectedTypeIndex,
                            _pendingBeamConfig: shelfsAfterUpdate._pendingBeamConfig,
                            hasBeams: !!shelfsAfterUpdate.beams,
                            beamsLength: shelfsAfterUpdate.beams?.length || 0
                        }, null, 2));
                    }
                
                this.params = paramsCopy.map((param) => {
                    console.log(`SAVE_PRO - Processing param in paramsCopy.map: ${param.name}, type: ${param.type}, selectedBeamIndex: ${param.selectedBeamIndex}, hasPendingBeamConfig: ${!!param._pendingBeamConfig}`);
                    
                    // Set default selected beam and type for shelfs and beamSingle
                    if (
                        param.name === 'shelfs' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Processing shelfs param`);
                        console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Shelfs param check START:`, JSON.stringify({
                            selectedBeamIndex: param.selectedBeamIndex,
                            selectedTypeIndex: param.selectedTypeIndex,
                            hasPendingBeamConfig: !!param._pendingBeamConfig,
                            pendingBeamConfig: param._pendingBeamConfig || 'NONE',
                            beamsLength: param.beams?.length || 0,
                            configIndex: configIndex
                        }, null, 2));
                        
                        // 🎯 תמיד לבדוק _pendingBeamConfig אם הוא קיים, אפילו אם יש selectedBeamIndex
                        // כי הוא מכיל את הערך הנכון מהקונפיגורציה
                        if (param._pendingBeamConfig) {
                            console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Processing _pendingBeamConfig for shelfs: ${param._pendingBeamConfig}`);
                            const [width, height] = param._pendingBeamConfig.split('-').map(Number);
                            
                            // חיפוש הקורה המתאימה ברשימה
                            let foundBeamIndex = -1;
                            let foundTypeIndex = -1;
                            
                            console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Searching for shelfs beam: ${width}-${height} in ${param.beams?.length || 0} beams`);
                            
                            for (let beamIdx = 0; beamIdx < param.beams.length; beamIdx++) {
                                const beam = param.beams[beamIdx];
                                if (!beam) continue;
                                
                                // לוג רק אם זה התאמה או בקשות אחרונות כדי לא להציף
                                const matches = beam.width === width && beam.height === height;
                                if (matches || beamIdx === param.beams.length - 1) {
                                    console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Checking shelfs beam ${beamIdx}:`, JSON.stringify({
                                        width: beam.width,
                                        height: beam.height,
                                        name: beam.name,
                                        translatedName: beam.translatedName,
                                        matches: matches,
                                        lookingFor: `${width}-${height}`
                                    }, null, 2));
                                }
                                
                                if (matches) {
                                    foundBeamIndex = beamIdx;
                                    foundTypeIndex = 0; // ברירת מחדל לסוג העץ הראשון
                                    console.log(`CHECK_SHELF_BEAM - paramsCopy.map: ✅ Found matching shelfs beam: beam=${beamIdx}, type=${foundTypeIndex} (${width}-${height})`);
                                    break;
                                }
                            }
                            
                            if (foundBeamIndex !== -1) {
                                // גם אם יש selectedBeamIndex קיים, עדכן אותו עם הערך הנכון
                                const oldIndex = param.selectedBeamIndex;
                                param.selectedBeamIndex = foundBeamIndex;
                                param.selectedTypeIndex = foundTypeIndex;
                                console.log(`CHECK_SHELF_BEAM - paramsCopy.map: ✅ Override: Set shelfs from index ${oldIndex} to beam index ${foundBeamIndex}, type index ${foundTypeIndex}`);
                                console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Final state after override:`, JSON.stringify({
                                    selectedBeamIndex: param.selectedBeamIndex,
                                    selectedTypeIndex: param.selectedTypeIndex,
                                    beamConfig: `${width}-${height}`
                                }, null, 2));
                                // ניקוי _pendingBeamConfig כי מצאנו את הקורה
                                delete param._pendingBeamConfig;
                            } else {
                                console.log(`CHECK_SHELF_BEAM - paramsCopy.map: ❌ Could not find shelfs beam ${param._pendingBeamConfig} (looking for ${width}-${height}), will use ${param.selectedBeamIndex !== undefined && param.selectedBeamIndex !== null ? `existing index ${param.selectedBeamIndex}` : 'default'}`);
                                // אם לא מצאנו את הקורה, נשאיר את _pendingBeamConfig למקרה שיש עוד ניסיון
                            }
                        }
                        
                        // 🎯 רק אם לא כבר נקבע מהקונפיגורציה או מ-_pendingBeamConfig!
                        // חשוב: 0 הוא ערך תקין, אז צריך לבדוק רק undefined ו-null
                        console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Final check for shelfs:`, JSON.stringify({
                            selectedBeamIndex: param.selectedBeamIndex,
                            selectedBeamIndexType: typeof param.selectedBeamIndex,
                            isUndefined: param.selectedBeamIndex === undefined,
                            isNull: param.selectedBeamIndex === null,
                            selectedTypeIndex: param.selectedTypeIndex
                        }, null, 2));
                        if (param.selectedBeamIndex === undefined || param.selectedBeamIndex === null) {
                            this.debugLog('Setting default beam for shelfs parameter');
                            const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                            param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                    : null;
                            console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Set default beam index ${defaultBeamIndex} for shelfs`);
                            this.debugLog('Shelfs parameter set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                        } else {
                            console.log(`CHECK_SHELF_BEAM - paramsCopy.map: Shelfs parameter already has selectedBeamIndex: ${param.selectedBeamIndex}, selectedTypeIndex: ${param.selectedTypeIndex}`);
                            this.debugLog('Shelfs parameter already has selectedBeamIndex from configuration:', param.selectedBeamIndex, 'selectedTypeIndex:', param.selectedTypeIndex);
                        }
                        // CHACK_TEXTURE - Log texture loading information
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beamSingle parameter:', param.name);
                        // 🎯 אם יש _pendingBeamConfig, נטפל בו כדי למצוא את האינדקס הנכון
                        if (param._pendingBeamConfig) {
                            console.log(`SAVE_PRO - Processing _pendingBeamConfig for ${param.name}: ${param._pendingBeamConfig}`);
                            const [width, height] = param._pendingBeamConfig.split('-').map(Number);
                            
                            // 🎯 לוג מיוחד עבור leg parameter
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - Searching for beam: width=${width}, height=${height}`);
                            }
                            
                            // חיפוש הקורה המתאימה ברשימה
                            let foundBeamIndex = -1;
                            let foundTypeIndex = -1;
                            
                            for (let beamIdx = 0; beamIdx < param.beams.length; beamIdx++) {
                                const beam = param.beams[beamIdx];
                                console.log(`SAVE_PRO - Checking beam ${beamIdx}:`, JSON.stringify({
                                    width: beam.width,
                                    height: beam.height,
                                    name: beam.name,
                                    translatedName: beam.translatedName
                                }, null, 2));
                                
                                // 🎯 לוג מיוחד עבור leg parameter
                                if (param.name === 'leg') {
                                    console.log(`CHECK_LEG - Beam ${beamIdx} details:`, JSON.stringify({
                                        width: beam.width,
                                        height: beam.height,
                                        name: beam.name,
                                        translatedName: beam.translatedName,
                                        matchesWidth: beam.width === width,
                                        matchesHeight: beam.height === height,
                                        fullMatch: beam.width === width && beam.height === height
                                    }));
                                }
                                
                                // 🎯 תיקון: גובה הקורה נמצא ב-beam.height, לא ב-beam.types[].height
                                if (beam.width === width && beam.height === height) {
                                    foundBeamIndex = beamIdx;
                                    foundTypeIndex = 0; // ברירת מחדל לסוג העץ הראשון
                                    console.log(`SAVE_PRO - Found matching beam for ${param.name}: beam=${beamIdx}, type=${foundTypeIndex} (${width}-${height})`);
                                    
                                    // 🎯 לוג מיוחד עבור leg parameter
                                    if (param.name === 'leg') {
                                        console.log(`CHECK_LEG - FOUND MATCH! beam=${beamIdx}, type=${foundTypeIndex}`);
                                        console.log(`CHECK_LEG - Found beam details:`, JSON.stringify({
                                            beamIndex: beamIdx,
                                            typeIndex: foundTypeIndex,
                                            beamWidth: beam.width,
                                            beamHeight: beam.height,
                                            beamTranslatedName: beam.translatedName,
                                            expectedWidth: width,
                                            expectedHeight: height,
                                            matches: `${beam.width}-${beam.height}` === `${width}-${height}`
                                        }));
                                    }
                                    break;
                                }
                                if (foundBeamIndex !== -1) break;
                            }
                            
                            if (foundBeamIndex !== -1) {
                                param.selectedBeamIndex = foundBeamIndex;
                                param.selectedTypeIndex = foundTypeIndex;
                                console.log(`SAVE_PRO - Set ${param.name} to beam index ${foundBeamIndex}, type index ${foundTypeIndex}`);
                            } else {
                                console.log(`SAVE_PRO - Could not find beam ${param._pendingBeamConfig} for ${param.name}, using default`);
                                const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                                param.selectedBeamIndex = defaultBeamIndex;
                                param.selectedTypeIndex = 0;
                            }
                            
                            // 🎯 לוג מיוחד עבור leg parameter - תוצאות סופיות
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - FINAL RESULT for leg: foundBeamIndex=${foundBeamIndex}, foundTypeIndex=${foundTypeIndex}`);
                                console.log(`CHECK_LEG - leg final selectedBeamIndex:`, param.selectedBeamIndex);
                                console.log(`CHECK_LEG - leg final selectedTypeIndex:`, param.selectedTypeIndex);
                                if (foundBeamIndex !== -1) {
                                    console.log(`CHECK_LEG - Selected beam details:`, JSON.stringify({
                                        beamIndex: foundBeamIndex,
                                        typeIndex: foundTypeIndex,
                                        beam: param.beams[foundBeamIndex],
                                        selectedType: param.beams[foundBeamIndex]?.types?.[foundTypeIndex]
                                    }));
                                }
                            }
                            
                            // ניקוי ה-_pendingBeamConfig
                            delete param._pendingBeamConfig;
                        }
                        // Only set default if selectedBeamIndex is not already set (same as shelfs)
                        else if (param.selectedBeamIndex === undefined || param.selectedBeamIndex === null) {
                            const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                            
                            // 🎯 לוג מיוחד עבור leg parameter - זה הקוד שדורס!
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - PROBLEM! Overriding selectedBeamIndex from ${param.selectedBeamIndex} to ${defaultBeamIndex}`);
                            }
                            
                            param.selectedBeamIndex = defaultBeamIndex;
                            param.selectedTypeIndex =
                                Array.isArray(param.beams[defaultBeamIndex].types) &&
                                param.beams[defaultBeamIndex].types.length
                                    ? 0
                                    : null;
                            this.debugLog('BeamSingle parameter', param.name, 'set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                        } else {
                            // 🎯 לוג מיוחד עבור leg parameter
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - Good! NOT overriding. selectedBeamIndex is:`, param.selectedBeamIndex);
                            }
                            this.debugLog('BeamSingle parameter', param.name, 'already has selectedBeamIndex:', param.selectedBeamIndex);
                        }
                    }
                    // טיפול בפרמטר beamArray עם setAmount עבור מוצר קורות
                    if (
                        param.name === 'beams' &&
                        param.setAmount === true &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beams parameter with setAmount');
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? this.findDefaultTypeIndex(param.beams[defaultBeamIndex].types, param.defaultType)
                                : 0;
                        this.debugLog('Beams parameter with setAmount set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                
                        // המרה של ברירת המחדל למבנה עם setAmount
                        if (Array.isArray(param.default)) {
                            param.default = param.default.map((value: any) => {
                                if (typeof value === 'object' && value.length !== undefined) {
                                    // כבר במבנה הנכון
                                    return value;
                                } else {
                                    // המרה ממספר לאובייקט עם כמות 1
                                    return { length: value, amount: 1 };
                                }
                            });
                        }
                        this.debugLog('Beams parameter default array converted for setAmount:', param.default);
                    }
                    return param;
                });
                
                // 🎯 תיקון כללי: שמירת והשחזור של כל פרמטרים עם beamsConfigurations לפני ואחרי initParamsFromProduct
                // פרמטרים שעלולים להיפגע: shelfs (cabinet), plata (table/futon), beam (planter/box), leg (כל הרהיטים)
                const beamParamsToFix = ['shelfs', 'plata', 'beam', 'leg'];
                const savedBeamParams: Map<string, { savedSelectedBeamIndex: number | undefined, savedSelectedTypeIndex: number | null | undefined }> = new Map();
                
                // שמירת הערכים הנכונים לפני initParamsFromProduct
                beamParamsToFix.forEach(paramName => {
                    const paramBeforeInit = this.params.find(p => p.name === paramName);
                    if (!paramBeforeInit || !paramBeforeInit.beams || paramBeforeInit.beams.length === 0) {
                        return; // דילוג אם הפרמטר לא קיים או אין לו קורות
                    }
                    
                    let savedSelectedBeamIndex: number | undefined = undefined;
                    let savedSelectedTypeIndex: number | null | undefined = undefined;
                    
                    // שמירת הערך הנכון מהקונפיגורציה לפני initParamsFromProduct
                    if (configIndex !== undefined && prod.configurations && prod.configurations[configIndex]) {
                        if (paramBeforeInit.beamsConfigurations && paramBeforeInit.beamsConfigurations[configIndex]) {
                            const correctBeamConfig = paramBeforeInit.beamsConfigurations[configIndex]; // e.g., "50-50"
                            const [width, height] = correctBeamConfig.split('-').map(num => parseInt(num, 10));
                            const correctBeamIndex = paramBeforeInit.beams?.findIndex((beam: any) => 
                                beam && beam.width === width && beam.height === height
                            );
                            if (correctBeamIndex !== -1) {
                                savedSelectedBeamIndex = correctBeamIndex;
                                savedSelectedTypeIndex = 0;
                            }
                        }
                    }
                    
                    // אם לא מצאנו מהקונפיגורציה, נשמור את הערך הנוכחי (אם הוא קיים)
                    if (savedSelectedBeamIndex === undefined && paramBeforeInit.selectedBeamIndex !== undefined && paramBeforeInit.selectedBeamIndex !== null) {
                        savedSelectedBeamIndex = paramBeforeInit.selectedBeamIndex;
                        savedSelectedTypeIndex = paramBeforeInit.selectedTypeIndex;
                    }
                    
                    if (savedSelectedBeamIndex !== undefined) {
                        savedBeamParams.set(paramName, { savedSelectedBeamIndex, savedSelectedTypeIndex });
                        console.log(`CHECK_SHELF_BEAM - Before initParamsFromProduct [${paramName}]:`, JSON.stringify({
                            selectedBeamIndex: paramBeforeInit.selectedBeamIndex,
                            selectedTypeIndex: paramBeforeInit.selectedTypeIndex,
                            savedSelectedBeamIndex: savedSelectedBeamIndex,
                            savedSelectedTypeIndex: savedSelectedTypeIndex,
                            configIndex: configIndex
                        }, null, 2));
                    }
                });
                
                this.initParamsFromProduct();
                
                // 🎯 שחזור הערכים הנכונים אחרי initParamsFromProduct
                savedBeamParams.forEach((savedValues, paramName) => {
                    const paramAfterInit = this.params.find(p => p.name === paramName);
                    if (!paramAfterInit) {
                        return;
                    }
                    
                    console.log(`CHECK_SHELF_BEAM - After initParamsFromProduct (before restore) [${paramName}]:`, JSON.stringify({
                        selectedBeamIndex: paramAfterInit.selectedBeamIndex,
                        selectedTypeIndex: paramAfterInit.selectedTypeIndex,
                        savedSelectedBeamIndex: savedValues.savedSelectedBeamIndex,
                        configIndex: configIndex
                    }, null, 2));
                    
                    // שחזור הערך הנכון אם הוא נדרס
                    if (savedValues.savedSelectedBeamIndex !== undefined) {
                        if (paramAfterInit.selectedBeamIndex !== savedValues.savedSelectedBeamIndex) {
                            console.log(`CHECK_SHELF_BEAM - ✅ FIX: Restoring ${paramName} selectedBeamIndex from ${paramAfterInit.selectedBeamIndex} to ${savedValues.savedSelectedBeamIndex}`);
                            console.log(`CHECK_SHELF_BEAM - Restore fix details [${paramName}]:`, JSON.stringify({
                                oldIndex: paramAfterInit.selectedBeamIndex,
                                newIndex: savedValues.savedSelectedBeamIndex,
                                configIndex: configIndex
                            }, null, 2));
                            paramAfterInit.selectedBeamIndex = savedValues.savedSelectedBeamIndex;
                            paramAfterInit.selectedTypeIndex = savedValues.savedSelectedTypeIndex !== undefined ? savedValues.savedSelectedTypeIndex : 0;
                        } else {
                            console.log(`CHECK_SHELF_BEAM - ✅ No fix needed: ${paramName} selectedBeamIndex already correct (${savedValues.savedSelectedBeamIndex})`);
                        }
                    }
                    
                    // בדיקה סופית אחרי השחזור
                    const paramFinal = this.params.find(p => p.name === paramName);
                    console.log(`CHECK_SHELF_BEAM - After restore fix [${paramName}]:`, JSON.stringify({
                        selectedBeamIndex: paramFinal?.selectedBeamIndex,
                        selectedTypeIndex: paramFinal?.selectedTypeIndex,
                        configIndex: configIndex
                    }, null, 2));
                });
                
                // איפוס משתני הלוגים כדי לראות נתונים מעודכנים
                this.displayNameLogged = false;
                this.paramChangedLogged = false;
                
                // שמירת הפרמטרים המקוריים של הדגם (אחרי init) עם כל הערכים
                this.originalProductParams = this.deepCopyParams(this.params || []);
                
                // בדיקת מגבלות המוצר
                this.checkProductRestrictions(prod);
                
                this.debugLog('Product loaded:', data);
                this.debugLog('פרמטרים נטענו:', this.params);
                this.debugLog('זה שולחן?', this.isTable);
                this.debugLog('זה עדנית?', this.isPlanter);
                this.debugLog('האם יש התרעת מידות?', this.hasDimensionsAlert);
                // בדיקת פרמטרים ספציפיים
                const heightParam = this.params.find(
                    (p) => p.name === 'height'
                );
                const plataParam = this.params.find((p) => p.name === 'plata');
                this.debugLog('פרמטר height:', heightParam);
                this.debugLog('פרמטר plata:', plataParam);
                // Load saved configuration after product is loaded (only if same sub-product)
                const lastProductId = localStorage.getItem('lastSelectedProductId');
                const lastConfigIndex = localStorage.getItem('lastConfigIndex');
                const currentProductId = this.product?._id || this.selectedProductName;
                const currentConfigIndex = configIndex !== undefined ? configIndex.toString() : null;
                
                
                // יצירת מזהה ייחודי שכולל גם את ה-configIndex
                const lastFullId = lastConfigIndex !== null ? `${lastProductId}_config${lastConfigIndex}` : lastProductId;
                const currentFullId = currentConfigIndex !== null ? `${currentProductId}_config${currentConfigIndex}` : currentProductId;
                
                this.debugLog('CHACK-BEAM-MINI: [threejs-box] Checking if same sub-product:', { lastFullId, currentFullId });
                
                // Clear potentially incorrect localStorage values before loading configuration
                this.clearIncorrectLocalStorageValues();
                
                // Load saved configuration BEFORE updateBeams to ensure correct values are used for texture loading
                if (lastFullId === currentFullId) {
                    this.debugLog('CHACK-BEAM-MINI: [threejs-box] Same sub-product, loading saved configuration');
                this.loadConfiguration();
                } else {
                    this.debugLog('CHACK-BEAM-MINI: [threejs-box] Different sub-product, not loading configuration');
                }
                
                // 🎯 תיקון זמני לleg parameter לפני עדכון הbeams
                this.fixLegParameterIfNeeded();
                
                this.updateBeams(true); // טעינת מוצר - עם אנימציה
            },
            error: (err) => {
                console.error('Failed to load product:', err);
            },
        });
    }
    // טעינת מוצר לפי שם
    getProductByName(name: string) {
        this.http.get(`/api/products/name/${name}`).subscribe({
            next: (data) => {
                this.product = data;
                const prod: any = data;
                
                // שמירת הפרמטרים המקוריים של הדגם (לפני כל שינוי)
                this.originalProductParams = this.deepCopyParams(prod.params || []);
                
                // איפוס משתני הלוגים כדי לראות נתונים מעודכנים
                this.displayNameLogged = false;
                this.paramChangedLogged = false;
                
                // יצירת deep copy של הפרמטרים כדי למנוע שינוי של המקור
                const paramsCopy = this.deepCopyParams(prod.params || []);
                
                this.params = paramsCopy.map((param) => {
                    // Set default selected beam and type for shelfs and beamSingle
                    if (
                        param.name === 'shelfs' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        // 🎯 FIX: רק אם לא כבר נקבע מהקונפיגורציה!
                        if (param.selectedBeamIndex === undefined || param.selectedBeamIndex === null) {
                            this.debugLog('Setting default beam for shelfs parameter');
                            const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                            param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                    : null;
                            this.debugLog('Shelfs parameter set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                        } else {
                            this.debugLog('Shelfs parameter already has selectedBeamIndex from configuration:', param.selectedBeamIndex, 'selectedTypeIndex:', param.selectedTypeIndex);
                        }
                        // CHACK_TEXTURE - Log texture loading information
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beamSingle parameter:', param.name);
                        // 🎯 אם יש _pendingBeamConfig, נטפל בו כדי למצוא את האינדקס הנכון
                        if (param._pendingBeamConfig) {
                            console.log(`SAVE_PRO - Processing _pendingBeamConfig for ${param.name}: ${param._pendingBeamConfig}`);
                            const [width, height] = param._pendingBeamConfig.split('-').map(Number);
                            
                            // 🎯 לוג מיוחד עבור leg parameter
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - Searching for beam: width=${width}, height=${height}`);
                            }
                            
                            // חיפוש הקורה המתאימה ברשימה
                            let foundBeamIndex = -1;
                            let foundTypeIndex = -1;
                            
                            for (let beamIdx = 0; beamIdx < param.beams.length; beamIdx++) {
                                const beam = param.beams[beamIdx];
                                console.log(`SAVE_PRO - Checking beam ${beamIdx}:`, JSON.stringify({
                                    width: beam.width,
                                    height: beam.height,
                                    name: beam.name,
                                    translatedName: beam.translatedName
                                }, null, 2));
                                
                                // 🎯 לוג מיוחד עבור leg parameter
                                if (param.name === 'leg') {
                                    console.log(`CHECK_LEG - Beam ${beamIdx} details:`, JSON.stringify({
                                        width: beam.width,
                                        height: beam.height,
                                        name: beam.name,
                                        translatedName: beam.translatedName,
                                        matchesWidth: beam.width === width,
                                        matchesHeight: beam.height === height,
                                        fullMatch: beam.width === width && beam.height === height
                                    }));
                                }
                                
                                // 🎯 תיקון: גובה הקורה נמצא ב-beam.height, לא ב-beam.types[].height
                                if (beam.width === width && beam.height === height) {
                                    foundBeamIndex = beamIdx;
                                    foundTypeIndex = 0; // ברירת מחדל לסוג העץ הראשון
                                    console.log(`SAVE_PRO - Found matching beam for ${param.name}: beam=${beamIdx}, type=${foundTypeIndex} (${width}-${height})`);
                                    
                                    // 🎯 לוג מיוחד עבור leg parameter
                                    if (param.name === 'leg') {
                                        console.log(`CHECK_LEG - FOUND MATCH! beam=${beamIdx}, type=${foundTypeIndex}`);
                                        console.log(`CHECK_LEG - Found beam details:`, JSON.stringify({
                                            beamIndex: beamIdx,
                                            typeIndex: foundTypeIndex,
                                            beamWidth: beam.width,
                                            beamHeight: beam.height,
                                            beamTranslatedName: beam.translatedName,
                                            expectedWidth: width,
                                            expectedHeight: height,
                                            matches: `${beam.width}-${beam.height}` === `${width}-${height}`
                                        }));
                                    }
                                    break;
                                }
                                if (foundBeamIndex !== -1) break;
                            }
                            
                            if (foundBeamIndex !== -1) {
                                param.selectedBeamIndex = foundBeamIndex;
                                param.selectedTypeIndex = foundTypeIndex;
                                console.log(`SAVE_PRO - Set ${param.name} to beam index ${foundBeamIndex}, type index ${foundTypeIndex}`);
                            } else {
                                console.log(`SAVE_PRO - Could not find beam ${param._pendingBeamConfig} for ${param.name}, using default`);
                                const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                                param.selectedBeamIndex = defaultBeamIndex;
                                param.selectedTypeIndex = 0;
                            }
                            
                            // 🎯 לוג מיוחד עבור leg parameter - תוצאות סופיות
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - FINAL RESULT for leg: foundBeamIndex=${foundBeamIndex}, foundTypeIndex=${foundTypeIndex}`);
                                console.log(`CHECK_LEG - leg final selectedBeamIndex:`, param.selectedBeamIndex);
                                console.log(`CHECK_LEG - leg final selectedTypeIndex:`, param.selectedTypeIndex);
                                if (foundBeamIndex !== -1) {
                                    console.log(`CHECK_LEG - Selected beam details:`, JSON.stringify({
                                        beamIndex: foundBeamIndex,
                                        typeIndex: foundTypeIndex,
                                        beam: param.beams[foundBeamIndex],
                                        selectedType: param.beams[foundBeamIndex]?.types?.[foundTypeIndex]
                                    }));
                                }
                            }
                            
                            // ניקוי ה-_pendingBeamConfig
                            delete param._pendingBeamConfig;
                        }
                        // Only set default if selectedBeamIndex is not already set (same as shelfs)
                        else if (param.selectedBeamIndex === undefined || param.selectedBeamIndex === null) {
                            const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                            
                            // 🎯 לוג מיוחד עבור leg parameter - זה הקוד שדורס!
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - PROBLEM! Overriding selectedBeamIndex from ${param.selectedBeamIndex} to ${defaultBeamIndex}`);
                            }
                            
                            param.selectedBeamIndex = defaultBeamIndex;
                            param.selectedTypeIndex =
                                Array.isArray(param.beams[defaultBeamIndex].types) &&
                                param.beams[defaultBeamIndex].types.length
                                    ? 0
                                    : null;
                            this.debugLog('BeamSingle parameter', param.name, 'set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                        } else {
                            // 🎯 לוג מיוחד עבור leg parameter
                            if (param.name === 'leg') {
                                console.log(`CHECK_LEG - Good! NOT overriding. selectedBeamIndex is:`, param.selectedBeamIndex);
                            }
                            this.debugLog('BeamSingle parameter', param.name, 'already has selectedBeamIndex:', param.selectedBeamIndex);
                        }
                    }
                    // טיפול בפרמטר beamArray עם setAmount עבור מוצר קורות
                    if (
                        param.name === 'beams' &&
                        param.setAmount === true &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beams parameter with setAmount');
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? this.findDefaultTypeIndex(param.beams[defaultBeamIndex].types, param.defaultType)
                                : 0;
                        this.debugLog('Beams parameter with setAmount set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                
                        // המרה של ברירת המחדל למבנה עם setAmount
                        if (Array.isArray(param.default)) {
                            param.default = param.default.map((value: any) => {
                                if (typeof value === 'object' && value.length !== undefined) {
                                    // כבר במבנה הנכון
                                    return value;
                                } else {
                                    // המרה ממספר לאובייקט עם כמות 1
                                    return { length: value, amount: 1 };
                                }
                            });
                        }
                        this.debugLog('Beams parameter default array converted for setAmount:', param.default);
                    }
                    return param;
                });
                this.initParamsFromProduct();
                
                // איפוס משתני הלוגים כדי לראות נתונים מעודכנים
                this.displayNameLogged = false;
                this.paramChangedLogged = false;
                
                // שמירת הפרמטרים המקוריים של הדגם (אחרי init) עם כל הערכים
                this.originalProductParams = this.deepCopyParams(this.params || []);
                
                // בדיקת מגבלות המוצר
                this.checkProductRestrictions(prod);
                
                this.debugLog('Product loaded by name:', data);
                this.debugLog('פרמטרים נטענו:', this.params);
                this.debugLog('זה שולחן?', this.isTable);
                this.debugLog('זה עדנית?', this.isPlanter);
                this.debugLog('האם יש התרעת מידות?', this.hasDimensionsAlert);
                // בדיקת פרמטרים ספציפיים
                const heightParam = this.params.find(
                    (p) => p.name === 'height'
                );
                const plataParam = this.params.find((p) => p.name === 'plata');
                this.debugLog('פרמטר height:', heightParam);
                this.debugLog('פרמטר plata:', plataParam);
                // Clear potentially incorrect localStorage values before loading configuration
                this.clearIncorrectLocalStorageValues();
                
                // Load saved configuration BEFORE updateBeams to ensure correct values are used for texture loading
                const lastProductId = localStorage.getItem('lastSelectedProductId');
                const currentProductId = this.product?._id || this.selectedProductName;
                if (lastProductId === currentProductId) {
                this.loadConfiguration();
                }
                
                // 🎯 תיקון זמני לleg parameter לפני עדכון הbeams
                this.fixLegParameterIfNeeded();
                
                this.updateBeams(true); // טעינת מוצר - עם אנימציה
            },
            error: (err) => {
                console.error('Failed to load product by name:', err);
                // אם לא נמצא מוצר לפי שם, ננסה לטעון מוצר ברירת מחדל
                this.getProductById('68a186bb0717136a1a9245de');
            },
        });
    }
    // Helper: get param by name
    getParam(name: string) {
        return this.params.find((p) => p.name === name);
    }
    // Validate parameter value and show message if needed
    validateParameterValue(param: any, value: number): number {
        let validatedValue = value;
        let message = '';
        
        // Debug log for futon parameters
        if (this.isFuton && (param.name === 'width' || param.name === 'depth')) {
            this.debugLog(`DEBUG FUTON VALIDATION - ${param.name}:`, {
                value: value,
                min: param.min,
                max: param.max,
                param: param
            });
        }
        
        if (value < param.min) {
            validatedValue = param.min;
            message = `מידה מינימלית - ${param.min} ס"מ`;
        } else if (value > param.max) {
            validatedValue = param.max;
            message = `מידה מקסימלית - ${param.max} ס"מ`;
        }
        if (message) {
            // הצגת הודעה ב-SnackBar
            this.snackBar.open(message, 'סגור', {
                duration: 3000,
                horizontalPosition: 'center',
                verticalPosition: 'bottom',
                panelClass: ['custom-snackbar'],
            });
        }
        return validatedValue;
    }
    // Update parameter value with validation
    updateParameterValue(param: any, value: number) {
        const validatedValue = this.validateParameterValue(param, value);
        param.default = validatedValue;
        this.updateBeams();
    }
    // Update shelf parameter value with validation (for array values)
    updateShelfParameterValue(param: any, value: number, index: number) {
        const validatedValue = this.validateParameterValue(param, value);
        param.default[index] = validatedValue;
        this.updateBeams();
    }
    // Shelves logic based on params
    get shelves(): Shelf[] {
        if (this.isTable) {
            // עבור שולחן, נחזיר מדף אחד עם גובה 0 (הגובה נקבע בפרמטר height)
            return [{ gap: 0 }];
        } else {
            // עבור ארון, נשתמש בפרמטר shelfs
        const shelfsParam = this.getParam('shelfs');
        if (shelfsParam && Array.isArray(shelfsParam.default)) {
            // Model: bottom shelf is first (no reverse)
            return shelfsParam.default.map((gap: number) => ({ gap }));
        }
        return [];
        }
    }
    addShelf() {
        const shelfsParam = this.getParam('shelfs');
        if (shelfsParam && Array.isArray(shelfsParam.default)) {
            shelfsParam.default.push(50);
            this.updateBeams();
        }
    }
    removeShelf(idx: number) {
        const shelfsParam = this.getParam('shelfs');
        if (shelfsParam && Array.isArray(shelfsParam.default) && idx !== 0) {
            shelfsParam.default.splice(idx, 1);
            this.updateBeams();
        }
    }
    
    updateShelfGap(idx: number, value: number) {
        const shelfsParam = this.getParam('shelfs');
        if (shelfsParam && Array.isArray(shelfsParam.default)) {
            if (idx === 0) {
                const minGap = this.frameHeight + this.beamHeight;
                shelfsParam.default[0] = Math.max(value, minGap);
            } else {
                shelfsParam.default[idx] = value;
            }
            this.updateBeams();
        }
    }
    
    // פונקציה להוספת קורה עם אורך וכמות עבור setAmount
    addBeamWithAmount(param: any) {
        if (param && param.setAmount && Array.isArray(param.default)) {
            param.default.push({
                length: param.min,
                amount: 1
            });
            this.updateBeams();
        }
    }
    
    // פונקציה להמרת מבנה נתונים לזהה עם setAmount
    convertDefaultArrayForSetAmount(param: any) {
        if (param && param.setAmount && Array.isArray(param.default)) {
            param.default = param.default.map((value: any) => {
                if (typeof value === 'object' && value.length !== undefined) {
                    return value; // כבר במבנה הנכון
                } else {
                    return { length: value, amount: 1 }; // המרה ממספר לאובייקט
                }
            });
        }
    }
    
    // פונקציה להקטנת כמות
    decreaseAmount(param: any, index: number) {
        const idx = param.default.length - 1 - index;
        if (param.default[idx].amount > 1) {
            param.default[idx].amount--;
            this.updateBeams();
        }
    }
    
    // פונקציה להגדלת כמות
    increaseAmount(param: any, index: number) {
        const idx = param.default.length - 1 - index;
        param.default[idx].amount++;
        this.updateBeams();
    }
    // Numeric params
    get surfaceWidth(): number {
        const p = this.getParam('width');
        return p ? p.default : 100;
    }
    set surfaceWidth(val: number) {
        const p = this.getParam('width');
        if (p) {
            p.default = val;
            this.updateBeams();
    }
    }
    get surfaceLength(): number {
        const p = this.getParam('depth');
        return p ? p.default : 100;
    }
    set surfaceLength(val: number) {
        const p = this.getParam('depth');
        if (p) {
            p.default = val;
            this.updateBeams();
    }
    }
    get minGap(): number {
        const p = this.getParam('gap');
        return p ? p.default : 1;
    }
    set minGap(val: number) {
        const p = this.getParam('gap');
        if (p) {
            p.default = val;
            this.updateBeams();
    }
    }
    // Beams for shelf/leg
    get shelfBeams() {
        const p = this.getParam('shelfs');
        return p && p.beams ? p.beams : [];
    }
    get legBeams() {
        const p = this.getParam('leg');
        return p && p.beams ? p.beams : [];
    }
    // Frame beams (example: can be set in params if needed)
    frameWidth: number = 5;
    beamWidth: number = 10;
    frameHeight: number = 5;
    beamHeight: number = 2;
    private beamMeshes: THREE.Mesh[] = [];
    private screwGroups: THREE.Group[] = []; // מערך לשמירת הברגים
    private coordinateAxes: THREE.Group[] = []; // מערך לשמירת החצים
    public showCoordinateAxes: boolean = false; // משתנה לשליטה בהצגת החצים
    @ViewChild('rendererContainer', { static: true })
    rendererContainer!: ElementRef;
    width = 2;
    height = 2;
    depth = 2;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private boxMesh!: THREE.Mesh;
    private onResizeBound = this.onResize.bind(this);
    private woodTexture!: THREE.Texture;
    private textureLoader = new THREE.TextureLoader();
    // Initialize other params if needed
    initParamsFromProduct() {
        // Set default selected beam and type for leg parameter
        const legParam = this.getParam('leg');
        if (
            legParam &&
            Array.isArray(legParam.beams) &&
            legParam.beams.length
        ) {
            this.debugLog('Setting default beam for leg parameter');
            const defaultBeamIndex = this.findDefaultBeamIndex(legParam.beams, legParam.defaultType);
            legParam.selectedBeamIndex = legParam.selectedBeamIndex || defaultBeamIndex;
            legParam.selectedTypeIndex =
                legParam.selectedTypeIndex ||
                (Array.isArray(legParam.beams[defaultBeamIndex].types) &&
                legParam.beams[defaultBeamIndex].types.length
                    ? 0
                    : null);
            this.debugLog('Leg parameter set to beam index:', legParam.selectedBeamIndex, 'type index:', legParam.selectedTypeIndex);
        }
        // Example: set frameWidth/frameHeight if present in params
        // You can extend this to other params as needed
        // וידוא שהערכים מתאפסים לברירת המחדל כשעוברים למוצר חדש
        this.resetParamsToDefaults();
    }
    // Reset all parameters to their default values
    private resetParamsToDefaults() {
        this.debugLog(
            'Resetting parameters to defaults. Current params:',
            this.params
        );
        this.params.forEach((param) => {
            this.debugLog(
                'Resetting param:',
                param.name,
                'current default:',
                param.default
            );
            // איפוס ערכי ברירת מחדל
            if (param.default !== undefined) {
                param.default = param.default; // שמירה על הערך המקורי
            }
            // איפוס בחירות קורות
            if (param.type === 'beamSingle' || param.name === 'shelfs') {
                if (Array.isArray(param.beams) && param.beams.length) {
                    this.debugLog('Resetting beam selection for parameter:', param.name);
                    const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                    param.selectedBeamIndex = defaultBeamIndex;
                    param.selectedTypeIndex =
                        Array.isArray(param.beams[defaultBeamIndex].types) &&
                        param.beams[defaultBeamIndex].types.length
                            ? 0
                            : null;
                    this.debugLog(
                        'Reset beam selection for:',
                        param.name,
                        'to beam', defaultBeamIndex, ', type 0'
                    );
                }
            }
        });
        this.debugLog('Parameters reset to defaults for new product');
    }
    // Get wood texture based on beam type
    private getWoodTexture(beamType: string): THREE.Texture {
        let texturePath = 'assets/textures/pine.jpg'; // default
        if (beamType) {
            texturePath = 'assets/textures/' + beamType + '.jpg';
        } else {
            texturePath = 'assets/textures/pine.jpg';
        }
        return this.textureLoader.load(texturePath);
    }
    
    // Get wood material with optional transparency
    private getWoodMaterial(beamType: string): THREE.MeshStandardMaterial {
        const texture = this.getWoodTexture(beamType);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
        });
        
        // אם במצב שקוף, הפוך את הקורות לשקופות כמעט לחלוטין (לא במוצר קורות)
        if (this.isTransparentMode && !this.isBelams) {
            material.transparent = true;
            material.opacity = 0.1; // 10% שקיפות
        }
        
        return material;
    }
    
    // Add wireframe edges to a mesh (for transparent mode)
    private addWireframeToBeam(mesh: THREE.Mesh) {
        if (this.isTransparentMode && !this.isBelams) {
            const edges = new THREE.EdgesGeometry(mesh.geometry);
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x4a3520, // חום כהה
                linewidth: 1,
                transparent: true,
                opacity: 0.3 // 50% שקיפות
            });
            const wireframe = new THREE.LineSegments(edges, lineMaterial);
            mesh.add(wireframe);
        }
    }
    // Save current configuration (user-specific or localStorage)
    private saveConfiguration() {
        const config = {
            params: this.params.map((param) => ({
                name: param.name,
                default: param.default,
                selectedBeamIndex: param.selectedBeamIndex,
                selectedTypeIndex: param.selectedTypeIndex,
            })),
            timestamp: new Date().toISOString(),
        };
        // Always save to localStorage to avoid server issues
            this.saveConfigurationToLocalStorage(config);
        
        // Server saving disabled to avoid CORS and authentication errors
        // TODO: Re-enable when backend is properly configured
    }
    // Save configuration to server (for authenticated users)
    private saveConfigurationToServer(config: any) {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
        });
        this.http
            .post(
                '/api/user/beam-configuration',
                { configuration: config },
                { headers }
            )
            .subscribe({
                next: (response) => {
                    this.debugLog('Configuration saved to server:', response);
                },
                error: (error) => {
                    console.error(
                        'Error saving to server, falling back to localStorage:',
                        error
                    );
                    this.saveConfigurationToLocalStorage(config);
                },
            });
    }
    // Save configuration to localStorage (fallback)
    private saveConfigurationToLocalStorage(config: any) {
        localStorage.setItem('beam-configuration', JSON.stringify(config));
    }
    // Load saved configuration (always use localStorage for now)
    private loadConfiguration() {
        
        // Always use localStorage to avoid authentication issues
            this.loadConfigurationFromLocalStorage();
        
        // Server configuration loading disabled to avoid CORS and authentication errors
        // TODO: Re-enable when backend is properly configured
    }
    
    // Load configuration from server (for authenticated users)
    private loadConfigurationFromServer() {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${this.authToken}`,
        });
        this.http.get('/api/user/beam-configuration', { headers }).subscribe({
                next: (response: any) => {
                if (
                    response.configuration &&
                    Object.keys(response.configuration).length > 0
                ) {
                        this.applyConfiguration(response.configuration);
                    } else {
                        // No server config, try localStorage
                        this.loadConfigurationFromLocalStorage();
                    }
                },
                error: (error) => {
                console.error(
                    'Error loading from server, falling back to localStorage:',
                    error
                );
                    this.loadConfigurationFromLocalStorage();
            },
            });
    }
    
    // Load configuration from server silently (background, non-blocking)
    private loadConfigurationFromServerSilently() {
        const headers = new HttpHeaders({
            Authorization: `Bearer ${this.authToken}`,
        });
        this.http.get('/api/user/beam-configuration', { headers }).subscribe({
                next: (response: any) => {
                if (
                    response.configuration &&
                    Object.keys(response.configuration).length > 0
                ) {
                        // Only apply server config if it's different from localStorage
                        const localConfig = localStorage.getItem('beam-configuration');
                        if (!localConfig || JSON.stringify(response.configuration) !== localConfig) {
                            this.applyConfiguration(response.configuration);
                        }
                    }
                },
                error: (error) => {
                    // Silently ignore server errors - localStorage is already loaded
                }
            });
    }
    
    // Load configuration from localStorage (fallback)
    private loadConfigurationFromLocalStorage() {
        
        const savedConfig = localStorage.getItem('beam-configuration');
        
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                
                this.applyConfiguration(config);
            } catch (error) {
                console.error('EDIT_PRODUCT - Error loading configuration from localStorage:', error);
            }
        } else {
        }
    }
    
    // Clear potentially incorrect localStorage values
    private clearIncorrectLocalStorageValues() {
        // Clear selectedTypeIndex for shelfs parameter to prevent incorrect texture loading
        const shelfsTypeKey = `selectedTypeIndex_${this.product?.name}_shelfs`;
        const savedShelfsType = localStorage.getItem(shelfsTypeKey);
        
        
        // If the saved value is 0 (pine) but we want oak, clear it to force fresh selection
        if (savedShelfsType === '0') {
            localStorage.removeItem(shelfsTypeKey);
        }
    }

    // Apply configuration to params
    private applyConfiguration(config: any) {
        
        if (config.params) {
            
            config.params.forEach((savedParam) => {
                
                const param = this.params.find(
                    (p) => p.name === savedParam.name
                );
                if (param) {
                    
                    param.default = savedParam.default;
                    param.selectedBeamIndex = savedParam.selectedBeamIndex;
                    param.selectedTypeIndex = savedParam.selectedTypeIndex;
                    
                    
                    // CHACK_TEXTURE - Log when localStorage data is applied to inputs
                    if (param.name === 'shelfs' || param.type === 'beamSingle') {
                    }
                }
            });
            
            // CHACK_TEXTURE - Log after applyConfiguration to see what happens after localStorage
            const shelfsParamAfter = this.params.find(p => p.name === 'shelfs');
            if (shelfsParamAfter) {
            }
    }

        // כיבוי loading אחרי הטעינה הראשונית
        this.isLoading = false;
    }
    ngAfterViewInit() {
        this.initThree();
        this.onResize();
        window.addEventListener('resize', this.onResizeBound);
        this.rendererContainer.nativeElement.addEventListener(
            'wheel',
            (event: WheelEvent) => {
            event.preventDefault();
            // סגירת חלונית חישוב המחיר בזום
            this.isPriceManuOpen = false;
            const delta = event.deltaY;
            const zoomAmount = delta * 0.1; // פי 2 יותר מהיר (0.05 -> 0.1)
            const currentDistance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
            let newDistance = currentDistance + zoomAmount;
            if (newDistance < 1) newDistance = 1;
            const direction = this.camera.position.clone().normalize();
            this.camera.position.copy(direction.multiplyScalar(newDistance));
            },
            { passive: false }
        );
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        this.rendererContainer.nativeElement.addEventListener(
            'mousedown',
            (event: MouseEvent) => {
            // סגירת חלונית חישוב המחיר בלחיצת עכבר
            this.isPriceManuOpen = false;
            isDragging = true;
            lastX = event.clientX;
            lastY = event.clientY;
            }
        );
        window.addEventListener('mousemove', (event: MouseEvent) => {
            if (!isDragging) return;
            // בדיקה אם זה pan (גלגל עכבר או כפתור ימני)
            const isCurrentlyPanning = event.buttons === 4 || event.buttons === 2; // גלגל עכבר = 4, כפתור ימני = 2
            const dx = event.clientX - lastX;
            const dy = event.clientY - lastY;
            lastX = event.clientX;
            lastY = event.clientY;
            if (isCurrentlyPanning) {
                // Pan - הזזת המצלמה כמו בקובץ ה-mini
                const panSpeed = 0.2;
                const panX = dx * panSpeed;
                const panY = -dy * panSpeed;
                const cam = this.camera;
                const pan = new THREE.Vector3();
                pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), panX);
                pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), panY);
                cam.position.add(pan);
                // הזזת הסצנה במקום המצלמה
                this.scene.position.add(pan);
            } else {
                const angleY = dx * 0.01; // תיקון כיוון הסיבוב
                const angleX = dy * 0.01; // תיקון כיוון הסיבוב
                
                // חישוב מרכז קוביית ה-wireframe
                const dimensions = this.getProductDimensionsRaw();
                const wireframeCenter = new THREE.Vector3(0, dimensions.height / 2, 0);
                
                // סיבוב סביב מרכז ה-wireframe במקום (0,0,0)
                const offset = this.camera.position.clone().sub(wireframeCenter);
                const spherical = new THREE.Spherical().setFromVector3(offset);
                spherical.theta -= angleY;
                spherical.phi -= angleX;
                spherical.phi = Math.max(
                    0.01,
                    Math.min(Math.PI - 0.01, spherical.phi)
                );
                this.camera.position.copy(wireframeCenter.clone().add(new THREE.Vector3().setFromSpherical(spherical)));
            }
        });
        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
        // Mobile touch support
        let lastTouchDist = 0;
        let lastTouchAngle = 0;
        let lastTouchX = 0;
        let lastTouchY = 0;
        let lastTouchCenterX = 0; // מרכז 2 אצבעות - X
        let lastTouchCenterY = 0; // מרכז 2 אצבעות - Y
        let isTouchRotating = false;
        let isTouchZooming = false;
        let isTouchPanning = false;
        this.rendererContainer.nativeElement.addEventListener(
            'touchstart',
            (event: TouchEvent) => {
            // סגירת חלונית חישוב המחיר במגע
            this.isPriceManuOpen = false;
            if (event.touches.length === 1) {
                isTouchRotating = true;
                lastTouchX = event.touches[0].clientX;
                lastTouchY = event.touches[0].clientY;
            } else if (event.touches.length === 2) {
                isTouchZooming = true;
                isTouchPanning = true; // הפעלת pan עם 2 אצבעות
                    const dx =
                        event.touches[0].clientX - event.touches[1].clientX;
                    const dy =
                        event.touches[0].clientY - event.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx * dx + dy * dy);
                lastTouchAngle = Math.atan2(dy, dx);
                // שמירת מרכז 2 האצבעות
                lastTouchCenterX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                lastTouchCenterY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            }
            },
            { passive: false }
        );
        this.rendererContainer.nativeElement.addEventListener(
            'touchmove',
            (event: TouchEvent) => {
            event.preventDefault();
            if (isTouchRotating && event.touches.length === 1) {
                const touch = event.touches[0];
                const dx = touch.clientX - lastTouchX;
                const dy = touch.clientY - lastTouchY;
                lastTouchX = touch.clientX;
                lastTouchY = touch.clientY;
                const angleY = dx * 0.01;
                const angleX = dy * 0.01;
                const offset = this.camera.position.clone();
                const spherical = new THREE.Spherical().setFromVector3(offset);
                spherical.theta -= angleY;
                spherical.phi -= angleX;
                    spherical.phi = Math.max(
                        0.01,
                        Math.min(Math.PI - 0.01, spherical.phi)
                    );
                this.camera.position.setFromSpherical(spherical);
            } else if (isTouchZooming && event.touches.length === 2) {
                    const dx =
                        event.touches[0].clientX - event.touches[1].clientX;
                    const dy =
                        event.touches[0].clientY - event.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // Pan עם 2 אצבעות (כמו במובייל רגיל)
                if (isTouchPanning) {
                    const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
                    const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
                    const deltaCenterX = centerX - lastTouchCenterX;
                    const deltaCenterY = centerY - lastTouchCenterY;
                    
                    // Pan התמונה (הזזת הסצנה)
                    const cam = this.camera;
                    const pan = new THREE.Vector3();
                    pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), -deltaCenterX * 0.2);
                    pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), deltaCenterY * 0.2);
                    this.scene.position.add(pan);
                    
                    lastTouchCenterX = centerX;
                    lastTouchCenterY = centerY;
                }
                
                // Pinch zoom
                const deltaDist = dist - lastTouchDist;
                const direction = this.camera.position.clone().normalize();
                const distance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
                const zoomAmount = -deltaDist * 0.02 * (distance / 100);
                let newDistance = distance + zoomAmount;
                if (newDistance < 1) newDistance = 1;
                this.camera.position.copy(direction.multiplyScalar(newDistance));
                lastTouchDist = dist;
                // Two-finger rotate (optional)
                const deltaAngle = angle - lastTouchAngle;
                if (Math.abs(deltaAngle) > 0.01) {
                    const offset = this.camera.position.clone();
                    const spherical = new THREE.Spherical().setFromVector3(offset);
                    spherical.theta -= deltaAngle;
                    this.camera.position.setFromSpherical(spherical);
                    lastTouchAngle = angle;
                }
            }
            },
            { passive: false }
        );
        this.rendererContainer.nativeElement.addEventListener(
            'touchend',
            (event: TouchEvent) => {
            isTouchRotating = false;
            isTouchZooming = false;
            isTouchPanning = false;
            }
        );
        // Start animation loop
        this.animate();
    }
    ngOnDestroy() {
        // מחיקת הגדרות מוצר מ-localStorage כשעוזבים את העמוד
        this.clearProductSettingsFromStorage();
        
        window.removeEventListener('resize', this.onResizeBound);
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
            
            // מחיקת כל המפתחות שנמצאו
            keysToRemove.forEach(key => {
                localStorage.removeItem(key);
            });
            
        } catch (error) {
            console.error('❌ Error clearing product settings from localStorage:', error);
        }
    }
    initThree() {
        this.scene = new THREE.Scene();
        // Create a subtle gray gradient background
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext('2d')!;
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, '#F5F5F5'); // Light gray
        gradient.addColorStop(1, '#E0E0E0'); // Slightly darker gray
        context.fillStyle = gradient;
        context.fillRect(0, 0, 256, 256);
        const texture = new THREE.CanvasTexture(canvas);
        this.scene.background = texture;
        // Add infinite floor plane with subtle grid
        const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
        const floorMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xf0f0f0, // Much whiter floor
            transparent: true,
            opacity: 0.5, // 50% שקיפות
            roughness: 0.1, // חלקות נמוכה לרפלקציה
            metalness: 0.0, // לא מתכתי
            reflectivity: 0.25, // 25% רפלקציה
            clearcoat: 0.1, // שכבה שקופה דקה
            clearcoatRoughness: 0.1,
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        floor.position.y = -0.1; // Slightly below ground level
        floor.receiveShadow = true;
        this.scene.add(floor);
        // Floor without grid lines for clean look
        const container = this.rendererContainer.nativeElement as HTMLElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(
            40,
            width / height,
            0.1,
            30000
        );
        // Set camera at default position
        this.camera.position.set(0, 200, 400);
        this.camera.lookAt(0, 0, 0);
        // PAN למטה של 200 פיקסלים - הזזת הסצנה
        // get total model height
        const dimensions = this.getProductDimensionsRaw();
        // this.scene.position.y = -120; // הוסר מכאן - יוגדר רק עבור beams
        
        // מרכוז המצלמה על קוביית ה-wireframe - רק אחרי שהמוצר נטען
        // this.centerCameraOnWireframe(); // הוסר מכאן
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.8; // Increased for higher contrast
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.renderer.domElement.style.display = 'block';
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.top = '0';
        container.style.position = 'relative';
        container.appendChild(this.renderer.domElement);
        // Load wood texture
        const loader = new THREE.TextureLoader();
        this.woodTexture = loader.load('assets/textures/pine.jpg');
        // Enhanced lighting setup for better visibility and atmosphere
        // Main directional light (45 degrees from right side) - increased intensity for contrast
        const mainLight = new THREE.DirectionalLight(0xffffff, 1.6);
        const rightAngle = Math.PI / 4; // 45 degrees
        const rightDistance = 200;
        mainLight.position.set(
            Math.cos(rightAngle) * rightDistance, 
            150, 
            Math.sin(rightAngle) * rightDistance
        );
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 500;
        mainLight.shadow.camera.left = -200;
        mainLight.shadow.camera.right = 200;
        mainLight.shadow.camera.top = 200;
        mainLight.shadow.camera.bottom = -200;
        this.scene.add(mainLight);
        // Secondary directional light (30 degrees from left side, very weak)
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.1);
        const leftAngle = Math.PI / 6; // 30 degrees
        const leftDistance = 200;
        fillLight.position.set(
            -Math.cos(leftAngle) * leftDistance, 
            100, 
            Math.sin(leftAngle) * leftDistance
        );
        this.scene.add(fillLight);
        // Ambient light for overall brightness - reduced for more contrast
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);
        // Hemisphere light for atmospheric gradient
        const hemisphereLight = new THREE.HemisphereLight(
            0xf8f8f8,
            0xd0d0d0,
            0.6
        );
        this.scene.add(hemisphereLight);
        // Point light for accent
        const pointLight = new THREE.PointLight(0xffffff, 0.5, 200);
        pointLight.position.set(0, 100, 0);
        this.scene.add(pointLight);
        
        // החצים יוצגו רק לפי בקשה מהמשתמש
        // this.addCoordinateAxes();
        
        this.beamMeshes = [];
    }
    private onResize() {
        this.onResizeWithoutReset();
        
        // איפוס קוביית הניווט במובייל בשינוי גודל
        this.showNavigationCube = false;
    }
    
    private onResizeWithoutReset() {
        const container = this.rendererContainer?.nativeElement as HTMLElement;
        if (!container || !this.camera || !this.renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
        
        // במובייל, להסיר את הקוביה אם היא מוצגת
        const isMobile = window.innerWidth <= 576;
        if (isMobile && this.showWireframe) {
            this.removeWireframeCube();
        } else if (!isMobile && this.showWireframe) {
            this.addWireframeCube();
        }
    }
    updateBeams(isInitialLoad: boolean = false) {
        
        // 🎯 איפוס משתני לוגים חד פעמיים
        this.futonLegBeamLogged = false;
        
        // CHACH_ALLERT - Log when updateBeams is called
        
        // CHACK_TEXTURE - Log parameter state at start of updateBeams
        const shelfsParamStart = this.params.find(p => p.name === 'shelfs');
        if (shelfsParamStart) {
        }
        
        // איפוס מחיר להצגת "מחשב מחיר..."
        this.calculatedPrice = 0;
        
        // הפעלת loading
        this.isLoading = true;
        this.isModelLoading = true;
        
        // Save current configuration to localStorage
        this.saveConfiguration();
        
        // איפוס המשתנים הבוליאניים לבדיקת קורות מוסתרות
        this.hasHiddenBeams = false;
        this.hiddenBeamsCount = 0;
        this.hasNoMiddleBeams = false;
        this.hasShortenedBeamsRemoved = false;
        
        // חישוב מחיר יבוצע ברקע אחרי הרינדור
        
        // ניקוי קורות
        this.beamMeshes.forEach((mesh) => {
            this.scene.remove(mesh);
            // אם זה Group (ברגים), צריך לטפל בכל הילדים
            if (mesh instanceof THREE.Group) {
                mesh.children.forEach((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        (child.material as THREE.Material).dispose();
                    }
                });
            } else {
                // אם זה Mesh רגיל (קורות)
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            }
        });
        this.beamMeshes = [];
        
        // ניקוי ברגים
        this.screwGroups.forEach((screwGroup) => {
            this.scene.remove(screwGroup);
            screwGroup.children.forEach((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
        });
        this.screwGroups = [];
        
        // Defensive checks
        if (!this.isTable && !this.isPlanter && !this.isBox && !this.isBelams && !this.isFuton && (!this.shelves || !this.shelves.length)) {
            console.warn('No shelves found, cannot render model.');
            return;
        }
        
        // טיפול במוצר קורות לפי מידה (beams)
        if (this.isBelams) {
            this.updateBeamsModel();
            // הגדרת מיקום הסצנה כמו בשאר המוצרים
            this.scene.position.y = -120;
            // אתחול המצלמה עם אנימציה - רק בטעינה ראשונית
            if (isInitialLoad) {
                this.centerCameraOnBeams();
            }
            return;
        }
        if (this.isTable && !this.getParam('height')) {
            console.warn(
                'No height parameter found for table, cannot render model.'
            );
            return;
        }
        if ((this.isPlanter || this.isBox) && !this.getParam('height')) {
            console.warn(
                'No height parameter found for planter/box, cannot render model.'
            );
            return;
        }
        if (!this.isPlanter && !this.isBox && (!this.surfaceWidth || !this.surfaceLength)) {
            console.warn(
                'surfaceWidth or surfaceLength missing, cannot render model.'
            );
            return;
        }
        // Get shelf beam and type from params (for cabinet) or plata beam (for table) or beam for planter
        let shelfsParam = null;
        if (this.isTable) {
            // עבור שולחן, נשתמש בפרמטר plata במקום shelfs - אבל מ-this.params (המעודכנים)
            shelfsParam = this.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
        } else if (this.isFuton) {
            // עבור בסיס מיטה, נשתמש בפרמטר plata (דומה לשולחן) - אבל מ-this.params (המעודכנים)
            shelfsParam = this.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
        } else if (this.isPlanter || this.isBox) {
            // עבור עדנית/קופסא, נשתמש בפרמטר beam
            this.debugLog('מחפש פרמטר beam לעדנית...');
            this.debugLog('פרמטרים זמינים:', this.product?.params?.map(p => ({name: p.name, type: p.type})));
            
            // Find the parameter by reference, not by creating a new object - אבל מ-this.params (המעודכנים)
            const beamParamIndex = this.params?.findIndex(
                (p: any) => p.type === 'beamSingle' && p.name === 'beam'
            );
            shelfsParam = beamParamIndex !== undefined && beamParamIndex >= 0 ? 
                this.params[beamParamIndex] : null;
            
            this.debugLog('shelfsParam נמצא:', shelfsParam);
            
            
            // Add detailed log to check if this is the same parameter object - מ-this.params (המעודכנים)
            
            // CRITICAL FIX: Force refresh the parameter object to get the latest selectedBeamIndex
            if (shelfsParam && beamParamIndex !== undefined && beamParamIndex >= 0) {
                // Get the latest parameter object from the array - מ-this.params (המעודכנים)
                const latestParam = this.params[beamParamIndex];
                if (latestParam && latestParam.selectedBeamIndex !== undefined) {
                    shelfsParam.selectedBeamIndex = latestParam.selectedBeamIndex;
                    shelfsParam.selectedTypeIndex = latestParam.selectedTypeIndex;
                }
            }
        } else {
            // עבור ארון, נשתמש בפרמטר shelfs - אבל מ-this.params (המעודכנים) ולא מ-this.product.params
            const shelfsParamIndex = this.params?.findIndex(
                (p: any) => p.type === 'beamArray' && p.name === 'shelfs'
            );
            shelfsParam = shelfsParamIndex !== undefined && shelfsParamIndex >= 0 ? 
                this.params[shelfsParamIndex] : null;
        }
        
        // Only initialize selectedBeamIndex if it's truly undefined (not just 0)
        
        if (shelfsParam && shelfsParam.selectedBeamIndex === undefined) {
            // Try to load from localStorage first
            const storageKey = `selectedBeamIndex_${this.product?.name}_${shelfsParam.name}`;
            const savedIndex = localStorage.getItem(storageKey);
            if (savedIndex !== null) {
                shelfsParam.selectedBeamIndex = parseInt(savedIndex, 10);
            } else {
                shelfsParam.selectedBeamIndex = 0;
            }
        } else if (shelfsParam && shelfsParam.selectedBeamIndex !== undefined) {
        } else {
        }
        
        // CHACK_TEXTURE - Debug: Check if shelfsParam is the same object as in this.params
        const paramsShelfsParam = this.params.find(p => p.name === 'shelfs');
        
        // FIX: Use the correct object from this.params instead of shelfsParam
        const correctShelfsParam = paramsShelfsParam || shelfsParam;
        
        // Check for saved type index in localStorage ONLY if not already set
        if (correctShelfsParam && (correctShelfsParam.selectedTypeIndex === undefined || correctShelfsParam.selectedTypeIndex === null)) {
            const typeStorageKey = `selectedTypeIndex_${this.product?.name}_${shelfsParam.name}`;
            const savedTypeIndex = localStorage.getItem(typeStorageKey);
            
            // CHACK_TEXTURE - Log when selectedTypeIndex is set from localStorage in updateBeams
            
            if (savedTypeIndex !== null) {
                correctShelfsParam.selectedTypeIndex = parseInt(savedTypeIndex, 10);
            } else if (correctShelfsParam.selectedTypeIndex === undefined || correctShelfsParam.selectedTypeIndex === null) {
                // Only set default if it's truly undefined/null, don't override existing values
                correctShelfsParam.selectedTypeIndex = 0;
            } else {
            }
        } else if (correctShelfsParam) {
            // CHACK_TEXTURE - Log when selectedTypeIndex is already set correctly
        }
        
        let shelfBeam = null;
        let shelfType = null;
        if (
            correctShelfsParam &&
            Array.isArray(correctShelfsParam.beams) &&
            correctShelfsParam.beams.length
        ) {
            shelfBeam = correctShelfsParam.beams[correctShelfsParam.selectedBeamIndex];
            shelfType =
                shelfBeam.types && shelfBeam.types.length
                    ? shelfBeam.types[correctShelfsParam.selectedTypeIndex]
                    : null;
            
            // CHACK_TEXTURE - Log actual texture loading for shelfs
        }
        // Get wood texture for shelf beams
        const shelfWoodTexture = this.getWoodTexture(
            shelfType ? shelfType.name : ''
        );
        // Get wood texture for frame beams (קורות חיזוק)
        let frameParam = null;
        if (this.isTable) {
            // עבור שולחן, קורות החיזוק הן קורות הרגליים
            frameParam = this.params.find(
                (p) => p.type === 'beamSingle' && p.name === 'leg'
            );
        } else if (this.isFuton) {
            // עבור בסיס מיטה, קורות החיזוק הן קורות הרגליים (דומה לשולחן)
            frameParam = this.params.find(
                (p) => p.type === 'beamSingle' && p.name === 'leg'
            );
        } else {
            // עבור ארון, קורות החיזוק הן פרמטר beamSingle שאינו shelfs
            frameParam = this.params.find(
                (p) => p.type === 'beamSingle' && p.name !== 'shelfs'
            );
        }
        let frameType = null;
        if (
            frameParam &&
            Array.isArray(frameParam.beams) &&
            frameParam.beams.length
        ) {
            const frameBeam =
                frameParam.beams[frameParam.selectedBeamIndex || 0];
            frameType =
                frameBeam.types && frameBeam.types.length
                    ? frameBeam.types[frameParam.selectedTypeIndex || 0]
                    : null;
        }
        const frameWoodTexture = this.getWoodTexture(
            frameType ? frameType.name : ''
        );
        // Always convert beam width/height from mm to cm
        let beamWidth = shelfBeam ? shelfBeam.width / 10 : this.beamWidth;
        let beamHeight = shelfBeam ? shelfBeam.height / 10 : this.beamHeight;
        // עדכון הערכים הגלובליים של הקומפוננטה
        this.beamWidth = beamWidth;
        this.beamHeight = beamHeight;
        // For each shelf, render its beams at its calculated height
        let currentY = 0;
        const totalShelves = this.isTable ? 1 : this.isPlanter ? 1 : this.shelves.length;
        // Get frame beam dimensions for shelf beam shortening
        let frameParamForShortening = null;
        if (this.isTable) {
            // עבור שולחן, קורות החיזוק הן קורות הרגליים
            frameParamForShortening = this.params.find(
                (p) => p.type === 'beamSingle' && p.name === 'leg'
            );
        } else if (this.isFuton) {
            // עבור בסיס מיטה, קורות החיזוק הן קורות הרגליים (דומה לשולחן)
            frameParamForShortening = this.params.find(
                (p) => p.type === 'beamSingle' && p.name === 'leg'
            );
        } else if (this.isPlanter || this.isBox) {
            // עבור עדנית, אין קורות חיזוק - נשתמש באותו פרמטר beam
            frameParamForShortening = this.params.find(
                (p) => p.type === 'beamSingle' && p.name === 'beam'
            );
        } else {
            // עבור ארון, קורות החיזוק הן פרמטר beamSingle שאינו shelfs
            frameParamForShortening = this.params.find(
                (p) => p.type === 'beamSingle' && p.name !== 'shelfs'
            );
        }
        let frameBeamWidth = this.frameWidth;
        let frameBeamHeight = this.frameHeight;
        if (
            frameParamForShortening &&
            Array.isArray(frameParamForShortening.beams) &&
            frameParamForShortening.beams.length
        ) {
            const frameBeam =
                frameParamForShortening.beams[
                    frameParamForShortening.selectedBeamIndex || 0
                ];
            if (frameBeam) {
                // החלפה: height של הפרמטר הופך ל-width של הקורה (לשימוש בקיצור)
                frameBeamWidth = frameBeam.height / 10; // המרה ממ"מ לס"מ
                frameBeamHeight = frameBeam.width / 10; // width של הפרמטר הופך ל-height של הקורה
            }
        }
        // עדכון הערכים הגלובליים של הקומפוננטה
        this.frameWidth = frameBeamWidth;
        this.frameHeight = frameBeamHeight;
        // עבור שולחן, נציג מדף אחד בלבד בגובה שנקבע בפרמטר height
        if (this.isTable) {
            const heightParam = this.getParam('height');
            const baseTableHeight = heightParam ? heightParam.default : 80; // גובה ברירת מחדל
            // הפחתת גובה קורות הפלטה כדי שהפרמטר "גובה משטח" ייצג את הגובה הסופי של החלק העליון
            const plataParam = this.getParam('plata');
            let plataBeamHeight = this.beamHeight; // ברירת מחדל
            if (
                plataParam &&
                Array.isArray(plataParam.beams) &&
                plataParam.beams.length
            ) {
                const plataBeam =
                    plataParam.beams[plataParam.selectedBeamIndex || 0];
                if (plataBeam) {
                    plataBeamHeight = plataBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            const tableHeight = baseTableHeight - plataBeamHeight; // הפחתת גובה קורות הפלטה
            
            // לוגים לבדיקת מיקומי השולחן
            
            // Surface beams (קורת משטח) - מדף אחד בלבד
            // שימוש במידות הנכונות של הפלטה שנבחרה
            // רוחב הפלטה = width של הקורה, עובי הפלטה = height של הקורה
            const plataBeam = plataParam && plataParam.beams && plataParam.beams.length ? 
                plataParam.beams[plataParam.selectedBeamIndex || 0] : null;
            const plataBeamWidth = plataBeam ? plataBeam.width / 10 : beamWidth;
            const plataBeamDepth = plataBeam ? plataBeam.height / 10 : beamHeight;
            
            const surfaceBeams = this.createSurfaceBeams(
                this.surfaceWidth,
                this.surfaceLength,
                plataBeamWidth,
                plataBeamDepth,
                this.minGap
            );
            for (let i = 0; i < surfaceBeams.length; i++) {
                const beam = { ...surfaceBeams[i] };
                const geometry = new THREE.BoxGeometry(
                    beam.width,
                    beam.height,
                    beam.depth
                );
                const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                mesh.position.set(beam.x, tableHeight + beam.height / 2, 0);
                
                // לוגים לבדיקת מיקום הפלטה
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
                // הוספת ברגים לפלטה של השולחן
                this.addScrewsToShelfBeam(
                    beam,
                    tableHeight,
                    beam.height,
                    frameBeamWidth,
                    'top'
                );
            }
            // Get leg beam dimensions for frame beams positioning
            const tableLegParam = this.getParam('leg');
            let legWidth = frameBeamWidth;
            let legDepth = frameBeamWidth;
            if (
                tableLegParam &&
                Array.isArray(tableLegParam.beams) &&
                tableLegParam.beams.length
            ) {
                const legBeam =
                    tableLegParam.beams[tableLegParam.selectedBeamIndex || 0];
                if (legBeam) {
                    legWidth = legBeam.width / 10; // המרה ממ"מ לס"מ
                    legDepth = (legBeam.depth || legBeam.height) / 10; // המרה ממ"מ לס"מ - fallback ל-height אם depth לא קיים
                }
            }
            // בדיקת תקינות הערכים
            if (isNaN(legWidth) || legWidth <= 0) {
                console.warn(
                    'Invalid legWidth, using frameBeamWidth:',
                    legWidth
                );
                legWidth = frameBeamWidth;
            }
            // CHACK_is-reinforcement-beams-outside - A (VALUES USED)
            try {
                console.log('CHACK_is-reinforcement-beams-outside - A_USED', JSON.stringify({
                    product: this.product?.translatedName || this.product?.name,
                    stage: 'A_USED_TABLE',
                    a_legProfileWidthCm_used: legWidth,
                    b_legProfileHeightCm_used: (tableLegParam?.beams?.[tableLegParam.selectedBeamIndex || 0]?.height || 0) / 10,
                    fallbackDepthUsedAsHeight: !tableLegParam?.beams?.[tableLegParam.selectedBeamIndex || 0]?.height && !!tableLegParam?.beams?.[tableLegParam.selectedBeamIndex || 0]?.depth
                }, null, 2));
            } catch {}
            if (isNaN(legDepth) || legDepth <= 0) {
                console.warn(
                    'Invalid legDepth, using frameBeamWidth:',
                    legDepth
                );
                legDepth = frameBeamWidth;
            }
            // Frame beams (קורת חיזוק) - מדף אחד בלבד
            const frameBeams = this.createFrameBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                legWidth, // רוחב הרגל האמיתי - חזרה למצב התקין
                legDepth // עומק הרגל האמיתי - חזרה למצב התקין
            );
            for (const beam of frameBeams) {
                const geometry = new THREE.BoxGeometry(
                    beam.width,
                    beam.height,
                    beam.depth
                );
                const material = this.getWoodMaterial(frameType ? frameType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                mesh.position.set(
                    beam.x,
                    tableHeight - beam.height / 2,
                    beam.z
                );
                
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // קורות חיזוק נוספות (extraBeam) - עבור שולחן בלבד
            const extraBeamParam = this.getParam('extraBeam');
            if (extraBeamParam && extraBeamParam.default > 0) {
                let extraBeamDistance = extraBeamParam.default;
                
                // בדיקה שהמידה לא תהיה גדולה מ-C פחות (A + B + B) - מגבלה קפדנית יותר
                const productDimensions = this.getProductDimensionsRaw();
                const maxAllowedDistance = productDimensions.height - (plataBeamHeight + legWidth + legWidth);
                
                if (extraBeamDistance > maxAllowedDistance) {
                    extraBeamDistance = maxAllowedDistance;
                }
                
                // CHACK_TABLE_GAP - לוג לבדיקת נתונים לקורות חיזוק נוספות
                
                // יצירת קורות חיזוק נוספות באותו מיקום אבל יותר נמוך
                const extraFrameBeams = this.createFrameBeams(
                    this.surfaceWidth,
                    this.surfaceLength,
                    frameBeamWidth,
                    frameBeamHeight,
                    legWidth, // legWidth - כמו בקורות המקוריות התקינות
                    legDepth // legDepth - כמו בקורות המקוריות התקינות
                );
                // המרחק הכולל = הנתון החדש + רוחב קורות החיזוק
                const totalDistance = extraBeamDistance + frameBeamHeight;
                for (const beam of extraFrameBeams) {
                    const geometry = new THREE.BoxGeometry(
                        beam.width,
                        beam.height,
                        beam.depth
                    );
                    const material = this.getWoodMaterial(frameType ? frameType.name : '');
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                    // מיקום יותר נמוך במידת totalDistance (הנתון החדש + רוחב קורות החיזוק)
                    mesh.position.set(
                        beam.x,
                        tableHeight - beam.height / 2 - totalDistance,
                        beam.z
                    );
                    this.scene.add(mesh);
                    this.beamMeshes.push(mesh);
                }
            }
            
            // רגליים (legs) - עבור שולחן
            // Get leg beam and type from params
            const legParam = this.getParam('leg');
            let legBeam = null;
            let legType = null;
            if (
                legParam &&
                Array.isArray(legParam.beams) &&
                legParam.beams.length
            ) {
                legBeam = legParam.beams[legParam.selectedBeamIndex || 0];
                legType =
                    legBeam.types && legBeam.types.length
                        ? legBeam.types[legParam.selectedTypeIndex || 0]
                        : null;
            }
            // Get wood texture for leg beams
            const legWoodTexture = this.getWoodTexture(
                legType ? legType.name : ''
            );
            // עבור שולחן, הגובה הכולל הוא גובה השולחן
            const tableHeightParam = this.getParam('height');
            const totalY = tableHeightParam ? tableHeightParam.default : 80;
            
            // קבלת עובי קורת הפלטה כדי לחשב את המיקום הנכון של הרגליים
            let shelfBeamHeight = this.beamHeight;
            const shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
            if (
                shelfsParam &&
                Array.isArray(shelfsParam.beams) &&
                shelfsParam.beams.length
            ) {
                const shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    shelfBeamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            const legs = this.createLegBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                totalY,
                plataBeamHeight
            );
            for (const leg of legs) {
                const geometry = new THREE.BoxGeometry(
                    leg.width,
                    leg.height,
                    leg.depth
                );
                const material = this.getWoodMaterial(legType ? legType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                // הרגליים צריכות להיות ממוקמות כך שהחלק התחתון שלהן יהיה בריצפה (Y=0)
                // והחלק העליון שלהן יהיה בגובה tableHeight
                // התחתון של הרגליים: legY - leg.height / 2 = 0
                // לכן: legY = leg.height / 2
                const legY = leg.height / 2;
                
                mesh.position.set(leg.x, legY, leg.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // הוספת ברגים לרגליים (קורות חיזוק עליונות)
            // DUBBLE_LEG_SCREWS - Log for table leg screws
            const legParamTable = this.getParam('leg');
            const legWidthTable = legParamTable?.beams?.[legParamTable.selectedBeamIndex || 0]?.width || 0;
            const dubbleThreshold = this.product?.restrictions?.find((r: any) => r.name === 'dubble-leg-screws-threshold')?.val;
            
            this.addScrewsToLegs(
                1, // שולחן = 1 מדף
                legs,
                frameBeamHeight,
                0
            );
            
            // הוספת ברגים לקורות החיזוק התחתונות
            // קורות החיזוק התחתונות (extraBeam) ממוקמות ב:
            // y = tableHeight - beam.height/2 - totalDistance (שורה 1360)
            // totalDistance = extraBeamDistance + frameBeamHeight (שורה 1344)
            const frameParamForLowerScrews = this.getParam('leg');
            let calculatedFrameBeamHeightForLower = frameBeamHeight;
            if (frameParamForLowerScrews && frameParamForLowerScrews.beams && frameParamForLowerScrews.beams.length > 0) {
                const frameBeam = frameParamForLowerScrews.beams[frameParamForLowerScrews.selectedBeamIndex || 0];
                if (frameBeam) {
                    calculatedFrameBeamHeightForLower = frameBeam.width / 10;
                }
            }
            
            // חישוב מיקום קורת החיזוק התחתונה בדיוק כמו בשורה 1360
            // משתמש ב-tableHeight שכבר מוגדר למעלה (שורה 1236)
            let extraBeamDistance = extraBeamParam && extraBeamParam.default > 0 ? extraBeamParam.default : 0;
            
            // בדיקה שהמידה לא תהיה גדולה מ-C פחות (A + B + B) - מגבלה קפדנית יותר עבור הברגים
            const productDimensionsForScrews = this.getProductDimensionsRaw();
            const maxAllowedDistanceForScrews = productDimensionsForScrews.height - (plataBeamHeight + legWidth + legWidth);
            
            if (extraBeamDistance > maxAllowedDistanceForScrews) {
                extraBeamDistance = maxAllowedDistanceForScrews;
            }
            
            const totalDistanceForLower = extraBeamDistance + calculatedFrameBeamHeightForLower;
            const lowerFrameY = tableHeight - calculatedFrameBeamHeightForLower / 2 - totalDistanceForLower;
            
            // CHACK_TABLE_GAP - לוג לבדיקת נתונים לברגים של קורות חיזוק נוספות
            
            this.debugLog('Adding lower frame screws - tableHeight:', tableHeight, 'extraBeamDistance:', extraBeamDistance, 'totalDistance:', totalDistanceForLower, 'lowerFrameY:', lowerFrameY, 'frameBeamHeight:', calculatedFrameBeamHeightForLower);
            this.addScrewsToLowerFrameBeams(legs, lowerFrameY, frameBeamHeight);
            
            // לא לחזור כאן - לתת לפונקציה להמשיך לסיום הרגיל
        }
        
        if (this.isFuton) {
            // עבור בסיס מיטה - דומה לשולחן אבל עם גובה שונה
            console.log('CHECK_FUTON_LEG - updateBeams: isFuton=true, קורא ל-createFutonBeams');
            this.createFutonBeams();
            
        } else {
            console.log('CHECK_FUTON_LEG - updateBeams: isFuton=false, לא יוצר מיטה', JSON.stringify({
                isTable: this.isTable,
                isPlanter: this.isPlanter,
                isBox: this.isBox,
                isBelams: this.isBelams,
                isFuton: this.isFuton,
                productName: this.product?.name
            }, null, 2));
        }
        
        if (this.isPlanter || this.isBox) {
            
            // עבור עדנית, נציג רצפה של קורות
            const heightParam = this.getParam('height');
            const depthParam = this.getParam('depth');
            const widthParam = this.getParam('width');
            
            const planterHeight = heightParam ? heightParam.default : 50;
            const planterDepth = widthParam ? widthParam.default : 50;  // depth input -> planterDepth
            const planterWidth = depthParam ? depthParam.default : 40;  // width input -> planterWidth
            
            
            this.debugLog('יצירת עדנית - גובה:', planterHeight, 'עומק:', planterDepth, 'רוחב:', planterWidth);
            this.debugLog('מידות קורה - רוחב:', beamWidth, 'עומק:', beamHeight);
            
            // חישוב כמות הקורות בעומק (41/5 = 8 קורות)
            const beamsInDepth = Math.floor(planterWidth / beamWidth);
            this.debugLog('כמות קורות בעומק:', beamsInDepth);
            
            // חישוב רווחים ויזואליים
            const visualGap = 0.1; // רווח של 0.1 ס"מ בין קורות
            const totalGaps = beamsInDepth - 1; // כמות הרווחים
            const totalGapWidth = totalGaps * visualGap; // רוחב כולל של כל הרווחים
            const availableWidth = planterWidth - totalGapWidth; // רוחב זמין לקורות
            const adjustedBeamWidth = availableWidth / beamsInDepth; // רוחב קורה מותאם
            
            this.debugLog('רווח ויזואלי:', visualGap, 'רוחב קורה מותאם:', adjustedBeamWidth);
            
            // יצירת רצפת הקורות
            
            for (let i = 0; i < beamsInDepth; i++) {
                
                const geometry = new THREE.BoxGeometry(
                    planterDepth, // אורך הקורה = עומק העדנית (70)
                    beamHeight,    // גובה הקורה = גובה הקורה (2.5)
                    adjustedBeamWidth    // רוחב קורה מותאם עם רווחים
                );
                
                
                const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                
                // מיקום הקורה - ממורכז במרכז X, מתחיל מ-0 ב-Z, גובה הקורה/2
                // כל קורה + רווח אחריה
                const zPosition = (i * (adjustedBeamWidth + visualGap)) - (planterWidth / 2) + (adjustedBeamWidth / 2);
                mesh.position.set(0, beamHeight / 2, zPosition);
                
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
                
                // הוספת ברגים לקורת רצפה
                this.addScrewsToPlanterFloorBeam(0, beamHeight / 2, zPosition, planterDepth, beamHeight, adjustedBeamWidth, i + 1);
                
                this.debugLog(`קורה ${i + 1} - מיקום Z:`, zPosition, 'רוחב:', adjustedBeamWidth, 'אורך:', planterDepth, 'גובה:', beamHeight);
            }
            
            this.debugLog('רצפת עדנית נוצרה בהצלחה');
            
            // יצירת קירות לפני המכסה כדי לחשב את הגובה האמיתי
            const beamsInHeight = Math.floor(planterHeight / beamWidth); // כמות קורות לפי הגובה שהמשתמש הזין
            const actualWallHeight = beamsInHeight * beamWidth; // גובה אמיתי = כמות קורות * רוחב קורה
            
            // יצירת מכסה (רק אם הפרמטר isCover מופעל)
            const isCoverParam = this.getParam('isCover');
            const shouldCreateCover = this.isBox && isCoverParam && isCoverParam.default === true;
            
            if (shouldCreateCover) {
                this.debugLog('יצירת מכסה לקופסא...');
                // קבלת ערך פתיחת המכסה
                const openCoverParam = this.getParam('openCover');
                const coverOpenOffset = openCoverParam && openCoverParam.default === true ? 50 : 0;
                
                // גובה המכסה = beamHeight (עובי רצפה) + (beamsInHeight × beamWidth) + חצי beamHeight של המכסה
                const coverY = beamHeight + (beamsInHeight * beamWidth) + beamHeight / 2 + coverOpenOffset;
                
                for (let i = 0; i < beamsInDepth; i++) {
                    const geometry = new THREE.BoxGeometry(
                        planterDepth, // אורך הקורה = עומק הקופסא
                        beamHeight,    // גובה הקורה = גובה הקורה
                        adjustedBeamWidth    // רוחב קורה מותאם עם רווחים
                    );
                    const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this.addWireframeToBeam(mesh);
                    
                    // מיקום הקורה - זהה לרצפה אבל בגובה המכסה
                    const zPosition = (i * (adjustedBeamWidth + visualGap)) - (planterWidth / 2) + (adjustedBeamWidth / 2);
                    mesh.position.set(0, coverY, zPosition);
                    
                    this.scene.add(mesh);
                    this.beamMeshes.push(mesh);
                    
                    // הוספת ברגים לקורת מכסה
                    const screwY = coverY - beamHeight / 2 - beamHeight; // נמוך יותר ב-beamHeight
                    const isFirstBeam = i === 0;
                    const isLastBeam = i === beamsInDepth - 1;
                    
                    // חישוב אורך קורת התמיכה (זהה לחישוב למטה)
                    const supportBeamLengthForScrews = planterWidth - (4 * beamHeight) - 0.4;
                    
                    // 2 קורות תמיכה
                    for (let supportIndex = 0; supportIndex < 2; supportIndex++) {
                        const xPositionForScrew = supportIndex === 0 
                            ? -planterDepth / 2 + adjustedBeamWidth / 2 + beamHeight + 0.2
                            : planterDepth / 2 - adjustedBeamWidth / 2 - beamHeight - 0.2;
                        
                        const screwGeometry = this.createScrewGeometry(this.calculateScrewLength('planter_floor', beamHeight));
                        
                        // 2 טורים בציר X (לאורך קורת המכסה) - offset של רבע מרוחב הקורה
                        const xOffsetFromCenter = adjustedBeamWidth / 4; // רבע מרוחב הקורה
                        
                        for (let rowIndex = 0; rowIndex < 2; rowIndex++) {
                            const xOffset = rowIndex === 0 ? -xOffsetFromCenter : xOffsetFromCenter;
                            const xPositionWithOffset = xPositionForScrew + xOffset;
                            
                            // בקורות קצה (ראשונה/אחרונה) - רק בורג פנימי אחד בכל טור
                            if (isFirstBeam) {
                                // קורה ראשונה - רק בורג ימני (פנימי) בכל טור
                                const screw = screwGeometry.clone();
                                screw.rotation.z = Math.PI;
                                screw.position.set(xPositionWithOffset, screwY, zPosition + adjustedBeamWidth / 4);
                                this.scene.add(screw);
                                this.beamMeshes.push(screw);
                            } else if (isLastBeam) {
                                // קורה אחרונה - רק בורג שמאלי (פנימי) בכל טור
                                const screw = screwGeometry.clone();
                                screw.rotation.z = Math.PI;
                                screw.position.set(xPositionWithOffset, screwY, zPosition - adjustedBeamWidth / 4);
                                this.scene.add(screw);
                                this.beamMeshes.push(screw);
                        } else {
                                // קורות אמצעיות - 2 ברגים בכל טור (שמאל וימין)
                                const screw1 = screwGeometry.clone();
                                screw1.rotation.z = Math.PI;
                                screw1.position.set(xPositionWithOffset, screwY, zPosition - adjustedBeamWidth / 4);
                                this.scene.add(screw1);
                                this.beamMeshes.push(screw1);
                                
                                const screw2 = screwGeometry.clone();
                                screw2.rotation.z = Math.PI;
                                screw2.position.set(xPositionWithOffset, screwY, zPosition + adjustedBeamWidth / 4);
                                this.scene.add(screw2);
                                this.beamMeshes.push(screw2);
                            }
                        }
                    }
                    
                    this.debugLog(`קורת מכסה ${i + 1} - מיקום Y:`, coverY, 'Z:', zPosition);
                }
                
                this.debugLog('מכסה קופסא נוצר בהצלחה');
                
                // הוספת קורות תמיכה למכסה (בציר X, מתחת למכסה)
                this.debugLog('יצירת קורות תמיכה למכסה...');
                const supportBeamY = coverY - beamHeight - 0.05; // מתחת למכסה בגובה של קורה + רווח קטן
                const supportBeamLength = planterWidth - (4 * beamHeight) - 0.6; // קיצור נוסף של 0.3 ס"מ מכל צד (0.2 + 0.1)
                
                // שתי קורות תמיכה - אחת מכל צד
                for (let i = 0; i < 2; i++) {
                    const geometry = new THREE.BoxGeometry(
                        adjustedBeamWidth,    // רוחב קורה (בציר X)
                        beamHeight,           // גובה הקורה
                        supportBeamLength     // אורך הקורה (בציר Z) - מקוצר עם רווח נוסף
                    );
                    const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this.addWireframeToBeam(mesh);
                    
                    // מיקום - אחת בקצה שמאלי ואחת בקצה ימני (ציר X), מקורבות למרכז ב-1 מ"מ (0.1 ס"מ)
                    const xPosition = i === 0 
                        ? -planterDepth / 2 + adjustedBeamWidth / 2 + beamHeight + 0.2 + 0.1  // קורה שמאלית: +0.1 ס"מ ימינה
                        : planterDepth / 2 - adjustedBeamWidth / 2 - beamHeight - 0.2 - 0.1;  // קורה ימנית: -0.1 ס"מ שמאלה
                    mesh.position.set(xPosition, supportBeamY, 0);
                    
                    this.scene.add(mesh);
                    this.beamMeshes.push(mesh);
                    
                    this.debugLog(`קורת תמיכה למכסה ${i + 1} - X:`, xPosition, 'Y:', supportBeamY);
                }
                
                this.debugLog('קורות תמיכה למכסה נוצרו בהצלחה');
            }
            
            // הוספת ברגים לקירות השמאליים והימניים בתחתית הרצפה
            this.addScrewsToSideWallsAtFloor(planterDepth, planterWidth, beamHeight, widthParam.default);
            
            // יצירת הקירות - החישוב כבר נעשה למעלה
            
            if (beamsInHeight > 0) {
                // חישוב רווחים ויזואליים לקירות
                const wallVisualGap = 0.1; // רווח של 0.1 ס"מ בין קורות
                const wallTotalGaps = beamsInHeight - 1; // כמות הרווחים
                const wallTotalGapHeight = wallTotalGaps * wallVisualGap; // גובה כולל של כל הרווחים
                const availableHeight = actualWallHeight - wallTotalGapHeight; // גובה זמין לקורות
                const adjustedBeamHeight = availableHeight / beamsInHeight; // גובה קורה מותאם
                
                
                for (let wallIndex = 0; wallIndex < 4; wallIndex++) {
                    let wallX = 0, wallZ = 0;
                    let wallLength = 0;
                    let wallName = '';
                    
                    // חישוב מיקום ואורך הקירות
                    if (wallIndex === 0) {
                        // קיר שמאלי (ציר Z שלילי)
                        wallZ = -planterWidth / 2 + beamHeight / 2;
                        wallLength = widthParam.default - (2 * beamHeight); // קיצור משני הצדדים
                        wallName = 'שמאלי';
                    } else if (wallIndex === 1) {
                        // קיר ימני (ציר Z חיובי)
                        wallZ = planterWidth / 2 - beamHeight / 2;
                        wallLength = widthParam.default - (2 * beamHeight); // קיצור משני הצדדים
                        wallName = 'ימני';
                    } else if (wallIndex === 2) {
                        // קיר קדמי (ציר X שלילי)
                        wallX = -planterDepth / 2 + beamHeight / 2;
                        wallLength = planterWidth; // אורך מלא עד הקצוות
                        wallName = 'קדמי';
                    } else if (wallIndex === 3) {
                        // קיר אחורי (ציר X חיובי)
                        wallX = planterDepth / 2 - beamHeight / 2;
                        wallLength = planterWidth; // אורך מלא עד הקצוות
                        wallName = 'אחורי';
                    }
                    
                    
                    for (let i = 0; i < beamsInHeight; i++) {
                        // העלאת הקורות התחתונות ב-0.1 ס"מ ליצירת רווח ויזואלי מהרצפה
                        const isBottomBeam = i === 0; // הקורה הראשונה (התחתונה) בכל קיר
                        
                        // סיבוב הקירות הקדמיים והאחוריים ב-90 מעלות סביב ציר Y
                        const isFrontBackWall = wallIndex === 2 || wallIndex === 3;
                        
                        
                        const geometry = new THREE.BoxGeometry(
                            wallLength, // אורך הקורה לפי סוג הקיר
                            adjustedBeamHeight, // גובה קורה מותאם עם רווחים
                            beamHeight // עומק הקורה = גובה הקורה
                        );
                        
                        
                        const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                        const mesh = new THREE.Mesh(geometry, material);
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                        
                        // סיבוב הקירות הקדמיים והאחוריים ב-90 מעלות סביב ציר Y
                        if (isFrontBackWall) {
                            mesh.rotation.y = Math.PI / 2; // 90 מעלות סביב ציר Y
                        }
                        
                        // מיקום הקורה - ממורכז במרכז X, גובה מתחיל מ-beamHeight, מיקום Z לפי הקיר
                        // הקורה התחתונה מוגבהת ב-0.1 ס"מ מהרצפה
                        const baseYPosition = (i * (adjustedBeamHeight + wallVisualGap)) + beamHeight + (adjustedBeamHeight / 2);
                        const yPosition = isBottomBeam ? baseYPosition + 0.1 : baseYPosition;
                        mesh.position.set(wallX, yPosition, wallZ);
                        
                        this.scene.add(mesh);
                        this.beamMeshes.push(mesh);
                        
                        // הוספת ברגים לקורה - רק לקירות הקדמיים והאחוריים
                        if (isFrontBackWall) {
                            this.addScrewsToPlanterWallBeam(wallX, yPosition, wallZ, wallLength, adjustedBeamHeight, beamHeight, isFrontBackWall, wallName, i + 1, beamWidth);
                        }
                        
                        this.debugLog(`קיר ${wallName} קורה ${i + 1} - מיקום X:`, wallX, 'מיקום Y:', yPosition, 'מיקום Z:', wallZ, 'אורך:', wallLength, 'גובה:', adjustedBeamHeight, 'עומק:', beamHeight, isBottomBeam ? '(קורה תחתונה מוגבהת)' : '');
                    }
                }
                
                this.debugLog('קירות עדנית נוצרו בהצלחה');
            }
            
            // יצירת קורות חיזוק פנימיות
            this.createPlanterInternalSupportBeams(planterDepth, planterWidth, actualWallHeight, beamHeight, beamWidth, shelfType ? shelfType.name : '');
            
            // לא לחזור כאן - לתת לפונקציה להמשיך לסיום הרגיל
        }
        
        if (!this.isTable && !this.isFuton && !this.isPlanter && !this.isBox) {
            // הגדרת משתנים נכונים עבור ארון - לפני כל הבלוקים
            let frameBeamHeightCorrect = frameBeamHeight;
            let beamHeightCorrect = beamHeight;
            
            // קריאת גובה קורת החיזוק מהפרמטרים
            const frameParam = this.getParam('frame');
            if (frameParam && Array.isArray(frameParam.beams) && frameParam.beams.length) {
                const frameBeam = frameParam.beams[frameParam.selectedBeamIndex || 0];
                if (frameBeam) {
                    frameBeamHeightCorrect = frameBeam.width / 10; // המרה ממ"מ לס"מ
                }
            }
            
            // קריאת גובה קורת המדף מהפרמטרים
            const shelfsParam = this.getParam('shelfs');
            if (shelfsParam && Array.isArray(shelfsParam.beams) && shelfsParam.beams.length) {
                const shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    beamHeightCorrect = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            // רגליים (legs) - עבור ארון
            const legParam = this.getParam('leg');
            let legBeam = null;
            let legType = null;
            if (
                legParam &&
                Array.isArray(legParam.beams) &&
                legParam.beams.length
            ) {
                legBeam = legParam.beams[legParam.selectedBeamIndex || 0];
                legType =
                    legBeam.types && legBeam.types.length
                        ? legBeam.types[legParam.selectedTypeIndex || 0]
                        : null;
            }
            const legWoodTexture = this.getWoodTexture(
                legType ? legType.name : ''
            );
            // עבור ארון, הרגליים צריכות להגיע עד לנקודה התחתונה של המדף העליון
            // כלומר: totalY פחות עובי המדף העליון
            const shelfBeamHeight = beamHeight; // זה כבר מחושב למעלה
            
            
            let legHeight = 0; // הגדרה ראשונית
            
            
            // חישוב גובה כולל לארון לפי הנוסחה: S + ((J + K) * N)
            const S = this.shelves.reduce((sum, shelf) => sum + shelf.gap, 0);
            const J = frameBeamHeightCorrect;
            const K = beamHeightCorrect;
            const N = this.shelves.length;
            const totalY = S + ((J + K) * N);
            // הרגליים צריכות להגיע עד לנקודה התחתונה של המדף העליון
            legHeight = totalY - beamHeightCorrect;
            
            
            this.logCabinet('CHACK_CABINET - Cabinet leg height calculation:', {
                S: S,
                J: J,
                K: K,
                N: N,
                totalY: totalY,
                shelfBeamHeight: beamHeightCorrect,
                legHeight: legHeight,
                calculation: `S + ((J + K) * N) = ${S} + ((${J} + ${K}) * ${N}) = ${S} + (${J + K} * ${N}) = ${S} + ${(J + K) * N} = ${totalY}, legHeight = ${totalY} - ${beamHeightCorrect} = ${legHeight}`,
                frameBeamHeightCorrect: frameBeamHeightCorrect,
                beamHeightCorrect: beamHeightCorrect
            });
            
            
            const legs = this.createLegBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                legHeight
            );
            for (const leg of legs) {
                
                const geometry = new THREE.BoxGeometry(
                    leg.width,
                    legHeight,
                    leg.depth
                );
                const material = this.getWoodMaterial(legType ? legType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                mesh.position.set(leg.x, legHeight / 2, leg.z);
                // If outside reinforcement flag is true, move cabinet legs toward Z=0 by b (leg profile height in cm)
                const outsideParamCabLegs = this.getParam('is-reinforcement-beams-outside');
                if (outsideParamCabLegs && outsideParamCabLegs.default === true) {
                    const legProfileHeightCm = (legBeam && typeof legBeam.height === 'number') ? (legBeam.height / 10) : 0;
                    if (legProfileHeightCm > 0) {
                        const dirZ = mesh.position.z >= 0 ? 1 : -1;
                        mesh.position.z = mesh.position.z - dirZ * legProfileHeightCm;
                    }
                }
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // הוספת ברגים לרגליים עבור ארון
            // DUBBLE_LEG_SCREWS - Log for cabinet leg screws
            const legParamCabinet = this.getParam('leg');
            const legWidthCabinet = legParamCabinet?.beams?.[legParamCabinet.selectedBeamIndex || 0]?.width || 0;
            const dubbleThresholdCabinet = this.product?.restrictions?.find((r: any) => r.name === 'dubble-leg-screws-threshold')?.val;
            
            // When outside=true: skip Y-facing screws (screwIndex=1), keep Z-facing screws (screwIndex=0)
            const outsideForCabinetScrews = this.getParam('is-reinforcement-beams-outside');
            const isOutsideEnabled = !!(outsideForCabinetScrews && outsideForCabinetScrews.default === true);
            this.addScrewsToLegs(totalShelves, legs, frameBeamHeightCorrect, 0, isOutsideEnabled);
        }
        
        // עבור ארון - הקוד המקורי
        if (!this.isTable && !this.isPlanter && !this.isBox) {
            this.startTimer('CABINET - Total Rendering');
            
            this.logCabinet('CHACK_CABINET - Cabinet rendering check:', {
                isTable: this.isTable,
                isPlanter: this.isPlanter,
                isBox: this.isBox,
                shelvesLength: this.shelves.length
            });
            
            // הגדרת משתנים נכונים עבור ארון
            let frameBeamHeightCorrect = frameBeamHeight;
            let beamHeightCorrect = beamHeight;
            
            // קריאת גובה קורת החיזוק מהפרמטרים
            const frameParam = this.getParam('frame');
            if (frameParam && Array.isArray(frameParam.beams) && frameParam.beams.length) {
                const frameBeam = frameParam.beams[frameParam.selectedBeamIndex || 0];
                if (frameBeam) {
                    frameBeamHeightCorrect = frameBeam.width / 10; // המרה ממ"מ לס"מ
                }
            }
            
            // קריאת גובה קורת המדף מהפרמטרים
            const shelfsParam = this.getParam('shelfs');
            if (shelfsParam && Array.isArray(shelfsParam.beams) && shelfsParam.beams.length) {
                const shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    beamHeightCorrect = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            // הגדרת currentY עבור ארון - מתחיל מ-0 ומתעדכן עם כל מדף
            let currentY = 0;
            
            this.logCabinet('CHACK_CABINET - Starting cabinet rendering:', {
                shelvesCount: this.shelves.length,
                initialCurrentY: currentY
            });
            
            // עבור ארון - הקוד המקורי
            for (
                let shelfIndex = 0;
                shelfIndex < this.shelves.length;
                shelfIndex++
            ) {
            this.startTimer(`CABINET - Shelf ${shelfIndex + 1}`);
            const shelf = this.shelves[shelfIndex];
            
            this.logCabinet(`CHACK_CABINET - Before shelf ${shelfIndex + 1}:`, {
                currentY: currentY,
                shelfGap: shelf.gap
            });
            
            currentY += shelf.gap;
            
            this.logCabinet(`CHACK_CABINET - After adding gap for shelf ${shelfIndex + 1}:`, {
                currentY: currentY
            });
                // Get leg beam dimensions for frame beams positioning
                const legParam = this.getParam('leg');
                let legWidth = frameBeamWidth;
                let legDepth = frameBeamWidth;
                if (
                    legParam &&
                    Array.isArray(legParam.beams) &&
                    legParam.beams.length
                ) {
                    const legBeam =
                        legParam.beams[legParam.selectedBeamIndex || 0];
                    if (legBeam) {
                        legWidth = legBeam.width / 10; // המרה ממ"מ לס"מ
                        legDepth = legBeam.height / 10; // המרה ממ"מ לס"מ
                    }
                }

            // Surface beams (קורת משטח)
            this.startTimer(`CABINET - Create Surface Beams for Shelf ${shelfIndex + 1}`);
            // קבלת מידות המדף הנכונות
            const shelfsParam = this.getParam('shelfs');
            let shelfBeam = null;
            let shelfBeamWidth = beamWidth;
            let shelfBeamHeight = beamHeight;
            if (
                shelfsParam &&
                Array.isArray(shelfsParam.beams) &&
                shelfsParam.beams.length
            ) {
                shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    shelfBeamWidth = shelfBeam.width / 10; // המרה ממ"מ לס"מ
                    shelfBeamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            // CHECK_SHORTEN_BEAM_is-reinforcement-beams-outside - Shelf context (once per shelf)
            try {
                const outsideParamCabCtx = this.getParam('is-reinforcement-beams-outside');
                const isOutsideCabCtx = !!(outsideParamCabCtx && outsideParamCabCtx.default === true);
                console.log('CHECK_SHORTEN_BEAM_is-reinforcement-beams-outside', JSON.stringify({
                    shelfIndex: shelfIndex + 1,
                    isOutside: isOutsideCabCtx,
                    legWidthCm: legWidth,
                    legHeightCm: legDepth,
                    frameBeamWidthCm: frameBeamWidth,
                    shelfBeamWidthCm: shelfBeamWidth,
                    shelfBeamHeightCm: shelfBeamHeight
                }, null, 2));
                // Also provide CHECK_SHELF_BEAM info
                console.log('CHECK_SHELF_BEAM', JSON.stringify({
                    shelfIndex: shelfIndex + 1,
                    shelfsSelectedBeam: {
                        name: shelfBeam?.name,
                        translatedName: shelfBeam?.translatedName,
                        widthMm: shelfBeam?.width,
                        heightMm: shelfBeam?.height
                    },
                    legSelectedBeam: {
                        widthMm: (this.getParam('leg')?.beams?.[this.getParam('leg')?.selectedBeamIndex || 0]?.width) || null,
                        heightMm: (this.getParam('leg')?.beams?.[this.getParam('leg')?.selectedBeamIndex || 0]?.height) || null
                    }
                }, null, 2));
            } catch {}
            const surfaceBeams = this.createSurfaceBeams(
                this.surfaceWidth,
                this.surfaceLength,
                shelfBeamWidth,
                shelfBeamHeight,
                this.minGap
            );
            this.endTimer(`CABINET - Create Surface Beams for Shelf ${shelfIndex + 1}`);

                // חישוב רווח בין קורות
                const totalBeamWidth = surfaceBeams.length * shelfBeamWidth;
                const remainingSpace = this.surfaceWidth - totalBeamWidth;
                const gapsCount = surfaceBeams.length - 1;
                const gapBetweenBeams =
                    gapsCount > 0 ? remainingSpace / gapsCount : 0;

                // בדיקת נתוני הקורות לפני יצירת המדפים
                this.debugLog(
                    '=== בדיקת נתוני קורות לפני יצירת מדף',
                    shelfIndex + 1,
                    '==='
                );

                // 1. בדיקת רוחב וגובה של קורת מדף בודדת
                this.debugLog('1. קורת מדף בודדת:');
                this.debugLog('   - רוחב:', shelfBeamWidth, 'ס"מ');
                this.debugLog('   - גובה:', shelfBeamHeight, 'ס"מ');

                // 2. בדיקת הרווח בין הקורות במדף
                this.debugLog('2. רווח בין הקורות במדף:');
                this.debugLog('   - אורך כולל:', this.surfaceWidth, 'ס"מ');
                this.debugLog('   - אורך כולל קורות:', totalBeamWidth, 'ס"מ');
                this.debugLog('   - מקום פנוי:', remainingSpace, 'ס"מ');
                this.debugLog('   - כמות רווחים:', gapsCount);
                this.debugLog(
                    '   - רווח בין קורות:',
                    gapBetweenBeams.toFixed(2),
                    'ס"מ'
                );

                // 3. בדיקת רוחב וגובה של קורת הרגל
                this.debugLog('3. קורת רגל:');
                this.debugLog('   - רוחב:', legWidth, 'ס"מ');
                this.debugLog('   - גובה:', legDepth, 'ס"מ');

                // 4. בדיקת חסימת קורות על ידי רגליים - לוגיקה חדשה
                this.debugLog('4. בדיקת חסימת קורות:');
                const beamAndGapWidth = shelfBeamWidth + gapBetweenBeams; // A + B
                const isTopShelf = shelfIndex === totalShelves - 1;
                const shouldHideBeams = beamAndGapWidth < legWidth && !isTopShelf; // A + B < C

                let beamsToHidePerSide = 0; // כמה קורות למחוק מכל צד
                
                if (shouldHideBeams) {
                    // חישוב כמה כפולות של A+B נכנסות ב-C
                    const howManyFit = Math.floor(legWidth / beamAndGapWidth);
                    
                    // כמה קורות צריך למחוק מכל צד
                    // אם נכנסות 2 כפולות, נמחוק 2 קורות מכל צד
                    // אם נכנסות 3 כפולות, נמחוק 3 קורות מכל צד
                    beamsToHidePerSide = Math.max(0, howManyFit);
                    
                    // הגבלה: לא למחוק יותר קורות ממה שיש באמצע
                    const middleBeamsCount = surfaceBeams.length - 2; // קורות באמצע (לא הקורות בקצוות)
                    beamsToHidePerSide = Math.min(beamsToHidePerSide, Math.floor(middleBeamsCount / 2));
                    
                    // עדכון המשתנה הגלובלי
                    this.hasHiddenBeams = true;
                    this.hiddenBeamsCount += beamsToHidePerSide * 2; // 2 צדדים
                    
                    // בדיקה נוספת לארון: האם קורות המדף צרות מדי מחצי מקורת הרגל
                    if (!this.isTable && !this.isFuton) { // רק לארון
                        const halfLegWidth = legWidth / 2; // חצי מקורת הרגל
                        const shouldRemoveShortenedBeams = shelfBeamWidth < halfLegWidth;
                        
                        
                        if (shouldRemoveShortenedBeams) {
                            // הקורות המקוצרות צרות מדי - צריך להסיר אותן לחלוטין
                            this.hasShortenedBeamsRemoved = true;
                            this.hiddenBeamsCount += 1; // הוספת קורה מקוצרת אחת לכל מדף
                        }
                    }
                    
                    // CHACH_ALLERT - Log new logic
                    
                    // CHECH_MULTI_REMOVE_AL - Log for alert calculation
                    
                    // בדיקת מקרה קיצון: אם נשארות רק הקורות בקצוות
                    if (beamsToHidePerSide * 2 >= middleBeamsCount) {
                        this.hasNoMiddleBeams = true;
                        this.debugLog('   - מקרה קיצון: נשארות רק הקורות בקצוות (אין קורות באמצע)');
                        
                        // CHACH_ALLERT - Log critical case
                    }
                }

                this.debugLog(
                    '   - רוחב קורה + רווח:',
                    beamAndGapWidth.toFixed(2),
                    'ס"מ'
                );
                this.debugLog('   - רוחב רגל:', legWidth, 'ס"מ');
                this.debugLog('   - האם מדף עליון:', isTopShelf);
                this.debugLog('   - האם להסתיר קורות:', shouldHideBeams);
                if (shouldHideBeams) {
                    this.debugLog(
                        '   - קורות שיוסתרו: הקורה השנייה מההתחלה והקורה השנייה מהסוף'
                    );
                }

                this.debugLog('==========================================');

            this.startTimer(`CABINET - Render ${surfaceBeams.length} Beams for Shelf ${shelfIndex + 1}`);
            for (let i = 0; i < surfaceBeams.length; i++) {
                let beam = { ...surfaceBeams[i] };
                // Only shorten first and last beam in the length (depth) direction for non-top shelves
                // Top shelf (last shelf) gets full-length beams
                const isTopShelf = shelfIndex === totalShelves - 1;

                    // בדיקה אם להסתיר קורות בגלל חסימת רגליים
                    const beamAndGapWidth = shelfBeamWidth + gapBetweenBeams;
                    const shouldHideBeams =
                        beamAndGapWidth < legWidth && !isTopShelf;
                    
                    // חישוב כמה קורות למחוק מכל צד (לוגיקה חדשה)
                    let beamsToHidePerSide = 0;
                    let howManyFit = 0;
                    if (shouldHideBeams) {
                        howManyFit = Math.floor(legWidth / beamAndGapWidth);
                        beamsToHidePerSide = Math.max(0, howManyFit);
                        const middleBeamsCount = surfaceBeams.length - 2;
                        beamsToHidePerSide = Math.min(beamsToHidePerSide, Math.floor(middleBeamsCount / 2));
                    }
                    
                    // בדיקה אם הקורה הנוכחית צריכה להיות מוסתרת
                    let shouldSkipThisBeam = shouldHideBeams && (
                        (i >= 1 && i < 1 + beamsToHidePerSide) || // קורות מהצד השמאלי
                        (i >= surfaceBeams.length - 1 - beamsToHidePerSide && i < surfaceBeams.length - 1) // קורות מהצד הימני
                    );
                    
                    // בדיקה נוספת לארון: האם הקורה המקוצרת צרה מדי
                    if (!this.isTable && !this.isFuton && !isTopShelf) { // רק לארון ולא המדף העליון
                        const halfLegWidth = legWidth / 2;
                        const shouldRemoveShortenedBeam = shelfBeamWidth < halfLegWidth && (i === 0 || i === surfaceBeams.length - 1);
                        
                        
                        if (shouldRemoveShortenedBeam) {
                            // הקורה המקוצרת צרה מדי - הסר אותה
                            shouldSkipThisBeam = true;
                        }
                    }

                    // CHECH_MULTI_REMOVE_3D - Log for 3D model beam removal
                    if (shouldHideBeams) {
                    }

                    if (shouldSkipThisBeam) {
                        this.debugLog(
                            `   - מדלג על קורה ${i + 1} (חסומה על ידי רגל)`
                        );
                        continue; // מדלג על יצירת הקורה הזאת
                    }

                    if (
                        !isTopShelf &&
                        (i === 0 || i === surfaceBeams.length - 1)
                    ) {
                    const outsideParamCabShelves = this.getParam('is-reinforcement-beams-outside');
                    const isOutsideCabShelves = !!(outsideParamCabShelves && outsideParamCabShelves.default === true);
                    // Default: shorten by 2 * frameBeamWidth; Outside=true: shorten by (2 * frameBeamWidth) + (2 * legDepth)
                    const before = beam.depth;
                    if (isOutsideCabShelves) {
                        beam.depth = Math.max(0.1, beam.depth - ((2 * frameBeamWidth) + (2 * legDepth)));
                    } else {
                        beam.depth = beam.depth - 2 * frameBeamWidth;
                    }
                    try {
                        console.log('CHECK_SHORTEN_BEAM_is-reinforcement-beams-outside', JSON.stringify({
                            kind: 'SHELF_END_SHORTEN',
                            shelfIndex: shelfIndex + 1,
                            endIndex: i,
                            beforeDepth: before,
                            afterDepth: beam.depth,
                            defaultShortenCm: 2 * frameBeamWidth,
                            extraShortenOutsideCm: isOutsideCabShelves ? 2 * legDepth : 0,
                            totalShortenCm: (before - beam.depth)
                        }, null, 2));
                    } catch {}
                }
                    const geometry = new THREE.BoxGeometry(
                        beam.width,
                        beamHeightCorrect,
                        beam.depth
                    );
                    const material = this.getWoodMaterial(shelfType ? shelfType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                    mesh.position.set(
                        beam.x,
                        currentY + frameBeamHeightCorrect + beamHeightCorrect / 2,
                        0
                    );
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
                // הוספת ברגים לקורת המדף
                    let isShortenedBeam =
                        !isTopShelf &&
                        (i === 0 || i === surfaceBeams.length - 1)
                            ? 'not-top'
                            : 'top';
                    if (isShortenedBeam !== 'top') {
                    if (i === 0) {
                            isShortenedBeam = 'start';
                    } else {
                            isShortenedBeam = 'end';
                        }
                    }
                    this.addScrewsToShelfBeam(
                        beam,
                        currentY + frameBeamHeightCorrect,
                        beamHeightCorrect,
                        frameBeamWidth,
                        isShortenedBeam
                    );
                }
            this.endTimer(`CABINET - Render ${surfaceBeams.length} Beams for Shelf ${shelfIndex + 1}`);
            
            // Frame beams (קורת חיזוק)
            // CHACK_is-reinforcement-beams-outside - A (VALUES USED for CABINET)
            if (!this.reinforcementLogPrinted) {
                try {
                    console.log('CHACK_is-reinforcement-beams-outside - A_USED', JSON.stringify({
                        product: this.product?.translatedName || this.product?.name,
                        stage: 'A_USED_CABINET',
                        a_legProfileWidthCm_used: legWidth,
                        b_legProfileHeightCm_used: legDepth
                    }, null, 2));
                } catch {}
                this.reinforcementLogPrinted = true;
            }
            this.startTimer(`CABINET - Create and Render Frame Beams for Shelf ${shelfIndex + 1}`);
            const frameBeams = this.createFrameBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                legWidth,
                legDepth
            );
            for (const beam of frameBeams) {
                    // When is-reinforcement-beams-outside is true (cabinet only):
                    // - X-spanning pair: extend width by 2a (a = legWidth)
                    // - Z-spanning pair: shorten depth by b (b = legDepth)
                    const outsideParamCabAdj = this.getParam('is-reinforcement-beams-outside');
                    const isOutsideCabAdj = !!(outsideParamCabAdj && outsideParamCabAdj.default === true);
                    let widthToUseCab = beam.width;
                    let depthToUseCab = beam.depth;
                    if (isOutsideCabAdj) {
                        const tol = (2 * frameBeamHeight) + 0.001;
                        const isXSpan = Math.abs(beam.width - this.surfaceWidth) <= tol;
                        const isZSpan = Math.abs(beam.depth - this.surfaceLength) <= tol;
                        // a = legWidth, b = legDepth (from earlier cabinet calculations)
                        const a_extend = legWidth;
                        const b_shorten = legDepth;
                        if (isXSpan && a_extend > 0) {
                            widthToUseCab = beam.width + (2 * a_extend);
                        }
                        if (isZSpan && b_shorten > 0) {
                            // Shorten on both ends: total reduction = 2 * b
                            depthToUseCab = Math.max(0.1, beam.depth - (2 * b_shorten));
                        }
                    }
                    const geometry = new THREE.BoxGeometry(
                        widthToUseCab,
                        frameBeamHeightCorrect,
                        depthToUseCab
                    );
                    const material = this.getWoodMaterial(frameType ? frameType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
                const frameY = currentY + frameBeamHeightCorrect / 2;
                mesh.position.set(beam.x, frameY, beam.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            this.endTimer(`CABINET - Create and Render Frame Beams for Shelf ${shelfIndex + 1}`);
            
            // Add the height of the shelf itself for the next shelf
            currentY += frameBeamHeightCorrect + beamHeightCorrect;
            this.endTimer(`CABINET - Shelf ${shelfIndex + 1}`);
        }
        this.endTimer('CABINET - Total Rendering');
            
        }
        
        // לא מעדכן מיקום מצלמה/zoom אחרי עדכון אלמנטים
        // Ensure scene rotation is maintained after updates
        this.scene.rotation.y = Math.PI / 6; // 30 degrees rotation
        // Add wireframe cube showing product dimensions (only if enabled)
        if (this.showWireframe) {
        this.addWireframeCube();
        }
        
        // אתחול המצלמה אחרי שהמודל נטען - רק בטעינה ראשונית
        if (isInitialLoad) {
            this.startTimer('Camera Initialization');
            if (this.isBelams) {
                // הגדרת מיקום הסצנה עבור beams - זהה לשאר המוצרים
                this.scene.position.y = -120;
                this.centerCameraOnBeams();
            } else {
                // הגדרת מיקום הסצנה עבור שאר המוצרים
                this.scene.position.y = -120;
                this.centerCameraOnWireframe();
            }
            this.endTimer('Camera Initialization');
        }
        
        this.endTimer('TOTAL_UPDATE_BEAMS');
        
        // חישוב מחיר ברקע אחרי הרינדור
        setTimeout(() => {
            this.calculatePricing();
        }, 0);
        
    }
    
    
    // Add wireframe cube showing product dimensions with shortened lines and corner spheres
    private addWireframeCube() {
        
        // Remove existing wireframe cube if it exists
        const existingWireframe =
            this.scene.getObjectByName('productWireframe');
        if (existingWireframe) {
            this.scene.remove(existingWireframe);
        } else {
        }
        
        // Get product dimensions
        const dimensions = this.getProductDimensionsRaw();
        const { length, width, height } = dimensions;
        
        
        // Create custom wireframe group
        const wireframeGroup = new THREE.Group();
        const wireframeMaterial = new THREE.LineBasicMaterial({
            color: 0x0066cc, // Blue color
            linewidth: 2,
        });
        // Create cube material for corner cubes
        const cubeMaterial = new THREE.MeshStandardMaterial({
            color: 0x0066cc, // Same blue color
        });
        // Shortening distance from corners (1.2 cm)
        const shortenDistance = 1.2;
        // Calculate half dimensions
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfLength = length / 2;
        // Define all 8 corner positions
        const corners = [
            // Bottom corners
            new THREE.Vector3(-halfWidth, -halfHeight, halfLength), // front-left-bottom
            new THREE.Vector3(halfWidth, -halfHeight, halfLength), // front-right-bottom
            new THREE.Vector3(-halfWidth, -halfHeight, -halfLength), // back-left-bottom
            new THREE.Vector3(halfWidth, -halfHeight, -halfLength), // back-right-bottom
            // Top corners
            new THREE.Vector3(-halfWidth, halfHeight, halfLength), // front-left-top
            new THREE.Vector3(halfWidth, halfHeight, halfLength), // front-right-top
            new THREE.Vector3(-halfWidth, halfHeight, -halfLength), // back-left-top
            new THREE.Vector3(halfWidth, halfHeight, -halfLength), // back-right-top
        ];
        // Add corner cubes
        corners.forEach((corner) => {
            const cubeGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); // 0.8x0.8x0.8 cube - larger
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            cube.position.copy(corner);
            wireframeGroup.add(cube);
        });
        // Helper function to shorten line from both ends
        const createShortenedLine = (
            start: THREE.Vector3,
            end: THREE.Vector3
        ) => {
            const direction = new THREE.Vector3()
                .subVectors(end, start)
                .normalize();
            const shortenedStart = start
                .clone()
                .add(direction.clone().multiplyScalar(shortenDistance));
            const shortenedEnd = end
                .clone()
                .sub(direction.clone().multiplyScalar(shortenDistance));
            const geometry = new THREE.BufferGeometry().setFromPoints([
                shortenedStart,
                shortenedEnd,
            ]);
            const line = new THREE.Line(geometry, wireframeMaterial);
            return line;
        };
        // Bottom face edges (4 edges)
        const bottomEdges = [
            [corners[0], corners[1]], // front edge
            [corners[2], corners[3]], // back edge
            [corners[2], corners[0]], // left edge
            [corners[1], corners[3]], // right edge
        ];
        // Top face edges (4 edges)
        const topEdges = [
            [corners[4], corners[5]], // front edge
            [corners[6], corners[7]], // back edge
            [corners[6], corners[4]], // left edge
            [corners[5], corners[7]], // right edge
        ];
        // Vertical edges (4 edges)
        const verticalEdges = [
            [corners[0], corners[4]], // front-left
            [corners[1], corners[5]], // front-right
            [corners[2], corners[6]], // back-left
            [corners[3], corners[7]], // back-right
        ];
        // Create shortened line segments
        const allEdges = [...bottomEdges, ...topEdges, ...verticalEdges];
        allEdges.forEach(([start, end]) => {
            const line = createShortenedLine(start, end);
            wireframeGroup.add(line);
        });
        // Add dimension text labels
        this.addDimensionTexts(wireframeGroup, length, width, height);
        // Position the wireframe at the center of the product
        wireframeGroup.position.set(0, height / 2, 0);
        wireframeGroup.name = 'productWireframe';
        // Add to scene
        this.scene.add(wireframeGroup);
    }
    // Add dimension text labels to wireframe
    private addDimensionTexts(
        wireframeGroup: THREE.Group,
        length: number,
        width: number,
        height: number
    ) {
        // Calculate positions for dimension labels
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        const halfLength = length / 2;
        // Define all 8 corner positions
        const corners = [
            // Bottom corners
            new THREE.Vector3(-halfWidth, -halfHeight, halfLength), // front-left-bottom
            new THREE.Vector3(halfWidth, -halfHeight, halfLength), // front-right-bottom
            new THREE.Vector3(-halfWidth, -halfHeight, -halfLength), // back-left-bottom
            new THREE.Vector3(halfWidth, -halfHeight, -halfLength), // back-right-bottom
            // Top corners
            new THREE.Vector3(-halfWidth, halfHeight, halfLength), // front-left-top
            new THREE.Vector3(halfWidth, halfHeight, halfLength), // front-right-top
            new THREE.Vector3(-halfWidth, halfHeight, -halfLength), // back-left-top
            new THREE.Vector3(halfWidth, halfHeight, -halfLength), // back-right-top
        ];
        // Helper function to create text sprite
        const createTextSprite = (number: number, position: THREE.Vector3) => {
            // Calculate font size based on product dimensions
            const maxDimension = Math.max(length, width, height);
            let fontSize = 48; // Default font size

            // If the largest dimension is less than 100cm, reduce font size proportionally
            if (maxDimension < 100) {
                // Scale font size proportionally to the largest dimension
                // Minimum font size of 24px, maximum of 48px
                fontSize = Math.max(
                    24,
                    Math.min(48, (maxDimension / 100) * 48)
                );
            }

            this.debugLog(
                `Wireframe font size: ${fontSize}px for max dimension: ${maxDimension}cm (L:${length}, W:${width}, H:${height})`
            );

            // Create canvas for text rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 512;
            canvas.height = 128;
            // Clear canvas with transparent background
            context.clearRect(0, 0, canvas.width, canvas.height);
            // Draw number with calculated font size
            context.font = `${fontSize}px Arial`;
            context.fillStyle = '#002266'; // Even darker blue
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            const numberText =
                number % 1 === 0 ? number.toString() : number.toFixed(1); // מספרים עגולים בלי .0, לא עגולים עם נקודה עשרונית
            // Draw only the number
            context.fillText(numberText, canvas.width / 2, canvas.height / 2);
            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            // Create sprite material with billboard behavior
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true,
                alphaTest: 0.1,
                color: 0xffffff, // White color to preserve original texture colors
            });
            // Create sprite with billboard behavior (always faces camera)
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.copy(position);
            sprite.scale.set(50, 12, 1); // Much larger scale
            // Make sprite always face the camera
            sprite.material.rotation = 0;
            return sprite;
        };
        // Helper function to get middle point of two corners
        const getMiddlePoint = (
            corner1: THREE.Vector3,
            corner2: THREE.Vector3
        ) => {
            return new THREE.Vector3()
                .addVectors(corner1, corner2)
                .multiplyScalar(0.5);
        };
        // Helper function to get outward direction for text positioning
        const getOutwardDirection = (
            corner1: THREE.Vector3,
            corner2: THREE.Vector3
        ) => {
            const direction = new THREE.Vector3()
                .subVectors(corner2, corner1)
                .normalize();
            const middle = getMiddlePoint(corner1, corner2);
            // Determine outward direction based on edge position
            if (Math.abs(direction.x) > 0.9) {
                // Vertical edges (width)
                return new THREE.Vector3(0, 0, middle.z > 0 ? 1 : -1);
            } else if (Math.abs(direction.z) > 0.9) {
                // Horizontal edges (length)
                return new THREE.Vector3(0, middle.y > 0 ? 1 : -1, 0);
            } else {
                // Height edges
                return new THREE.Vector3(middle.x > 0 ? 1 : -1, 0, 0);
            }
        };
        // Add dimension labels for all 12 edges
        const edges = [
            // Bottom face (4 edges)
            { start: corners[0], end: corners[1], value: width }, // front (X direction = width)
            { start: corners[2], end: corners[3], value: width }, // back (X direction = width)
            { start: corners[2], end: corners[0], value: length }, // left (Z direction = length)
            { start: corners[1], end: corners[3], value: length }, // right (Z direction = length)
            // Top face (4 edges)
            { start: corners[4], end: corners[5], value: width }, // front (X direction = width)
            { start: corners[6], end: corners[7], value: width }, // back (X direction = width)
            { start: corners[6], end: corners[4], value: length }, // left (Z direction = length)
            { start: corners[5], end: corners[7], value: length }, // right (Z direction = length)
            // Vertical edges (4 edges)
            { start: corners[0], end: corners[4], value: height }, // front-left
            { start: corners[1], end: corners[5], value: height }, // front-right
            { start: corners[2], end: corners[6], value: height }, // back-left
            { start: corners[3], end: corners[7], value: height }, // back-right
        ];
        edges.forEach((edge) => {
            const middle = getMiddlePoint(edge.start, edge.end);
            // Calculate rotation to align text with edge direction
            const direction = new THREE.Vector3()
                .subVectors(edge.end, edge.start)
                .normalize();
            // Adjust position - move outward by 3cm for all edges
            let textPosition = middle.clone();
            if (Math.abs(direction.z) > 0.9) {
                // Front/back edges (length) - move outward in X direction by 3cm
                if (textPosition.x > 0) {
                    textPosition.x += 3; // Move right
                } else {
                    textPosition.x -= 3; // Move left
                }
                // Move up by 1.5cm only for bottom edges (Y < 0)
                if (textPosition.y < 0) {
                    textPosition.y += 1.5; // Move up (only bottom edges)
                }
                textPosition = createTextSprite(edge.value, textPosition);
                textPosition.rotation.z = 0;
            } else if (Math.abs(direction.x) > 0.9) {
                // Left/right edges (width) - move outward in Z direction by 3cm
                if (textPosition.z > 0) {
                    textPosition.z += 3; // Move forward
                } else {
                    textPosition.z -= 3; // Move backward
                }
                // Move up by 1.5cm only for bottom edges (Y < 0)
                if (textPosition.y < 0) {
                    textPosition.y += 1.5; // Move up (only bottom edges)
                }
                textPosition = createTextSprite(edge.value, textPosition);
                textPosition.rotation.z = Math.PI / 2;
            } else {
                // Vertical edges (height) - move outward by 3cm
                // Move outward in X and Z directions by 3cm
                if (textPosition.x > 0) {
                    textPosition.x += 3; // Move right
                } else {
                    textPosition.x -= 3; // Move left
                }
                if (textPosition.z > 0) {
                    textPosition.z += 3; // Move forward
                } else {
                    textPosition.z -= 3; // Move backward
                }
                textPosition = createTextSprite(edge.value, textPosition);
                textPosition.rotation.z = 0;
            }
            wireframeGroup.add(textPosition);
        });
        this.debugLog('Added dimension texts for all 12 edges');
        
        // Add the wireframe group to the scene
        wireframeGroup.name = 'productWireframe';
        this.scene.add(wireframeGroup);
        
        
        // CHACH_ALLERT - Log final alert states
    }
    // Update model when any parameter changes (alias for updateBeams)
    updateModel() {
        // Validate all parameters before updating
        this.params.forEach((param) => {
            if (param.type !== 'beamSingle' && param.type !== 'beamArray') {
                // For numeric parameters, validate the value
                if (typeof param.default === 'number') {
                    const validatedValue = this.validateParameterValue(
                        param,
                        param.default
                    );
                    if (validatedValue !== param.default) {
                        param.default = validatedValue;
                    }
                }
            }
        });
        this.updateBeams();
    }
    // פונקציה לחישוב חומרים (קורות) לחישוב מחיר
    async calculatePricing() {
        
        // איפוס המחיר למצב "מחשב..." (0 מציג את הספינר)
        this.calculatedPrice = 0;
        
        // איפוס המחירים הדינמיים כשעושים חישוב מחדש מלא (רק אם לא נשמרו מקוריים)
        if (this.originalBeamsPrice === 0) {
            this.dynamicBeamsPrice = 0;
        }
        if (this.originalCuttingPrice === 0) {
            this.dynamicCuttingPrice = 0;
        }
        if (this.originalScrewsPrice === 0) {
            this.dynamicScrewsPrice = 0;
        }
        this.hasBeamsChanged = false;
        this.hasScrewsChanged = false;
        
        await this.calculateBeamsData();
        
        // עבור מוצר קורות - אין ברגים, אבל עדיין צריך לקרוא ל-calculateForgingData
        if (this.isBelams) {
            this.ForgingDataForPricing = []; // אין ברגים במוצר קורות
            this.debugLog('מוצר קורות - אין ברגים לחישוב מחיר');
            
            // חישוב מחיר עבור מוצר קורות
            this.calculatedPrice = await this.pricingService.calculatePrice(
                this.BeamsDataForPricing,
                this.ForgingDataForPricing
            );
            this.cuttingPlan = await this.pricingService.getCuttingPlan(
                this.BeamsDataForPricing,
                this.ForgingDataForPricing
            );
            this.screwsPackagingPlan = this.pricingService.getScrewsPackagingPlan(
                this.ForgingDataForPricing
            );
            this.debugLog('=== FINAL CALCULATED PRICE FOR BEAMS ===', this.calculatedPrice);
            this.debugLog('=== CUTTING PLAN FOR BEAMS ===', this.cuttingPlan);
            this.debugLog('=== SCREWS PACKAGING PLAN ===', this.screwsPackagingPlan);
        }
        
        // שמירת מצב מקורי של הקורות בסוף החישוב הראשוני
        this.saveOriginalBeamsState();
    }
    // חישוב נתוני הקורות לחישוב מחיר
    async calculateBeamsData() {
        this.startTimer('CABINET - Calculate Beams Data');
        this.BeamsDataForPricing = [];
        
        
        this.debugLog('🔍 START - calculateBeamsData:', {
            isBelams: this.isBelams,
            isPlanter: this.isPlanter,
            isBox: this.isBox,
            isTable: this.isTable,
            isFuton: this.isFuton
        });
        
        // טיפול מיוחד במוצר קורות לפי מידה
        if (this.isBelams) {
            await this.calculateBelamsData();
            return;
        }
        
        // איסוף כל הקורות מהמודל התלת מימדי
        const allBeams: any[] = [];
        // קבלת נתוני הקורות מהפרמטרים הנכונים
        const shelfParam = this.isTable || this.isFuton
            ? this.getParam('plata')
            : (this.isPlanter || this.isBox)
            ? this.getParam('beam')
            : this.getParam('shelfs');
        const frameParam = this.getParam('frame');
        const legParam = this.getParam('leg');
        const extraParam = this.getParam('extraBeam');
        
        
        this.debugLog('🔍 PARAMS - Found parameters:', {
            shelfParam: shelfParam,
            frameParam: frameParam,
            legParam: legParam,
            extraParam: extraParam,
            surfaceWidth: this.surfaceWidth,
            surfaceLength: this.surfaceLength,
            condition1: this.surfaceWidth && this.surfaceLength && shelfParam,
            condition2: (this.isPlanter || this.isBox) && shelfParam,
            finalCondition: (this.surfaceWidth && this.surfaceLength && shelfParam) || ((this.isPlanter || this.isBox) && shelfParam)
        });
        
        if ((this.surfaceWidth && this.surfaceLength && shelfParam) || ((this.isPlanter || this.isBox) && shelfParam)) {
            const selectedBeam =
                shelfParam.beams?.[shelfParam.selectedBeamIndex || 0];
            const selectedType =
                selectedBeam?.types?.[shelfParam.selectedTypeIndex || 0];
            if (selectedBeam && selectedType) {
                    this.debugLog('🔍 ENTERED - selectedBeam && selectedType block');
                    let beamWidth = selectedBeam.width / 10 || this.beamWidth; // המרה ממ"מ לס"מ (width של הקורה)
                    const beamHeight = selectedBeam.height / 10 || this.beamHeight; // height של הקורה
                    
                    
                    this.debugLog('🔍 DEBUG - Beam dimensions calculation:', {
                        selectedType: selectedType,
                        selectedBeam: selectedBeam,
                        originalWidth: selectedType.width,
                        originalHeight: selectedType.height,
                        selectedBeamWidth: selectedBeam.width,
                        selectedBeamHeight: selectedBeam.height,
                        calculatedBeamWidth: beamWidth,
                        calculatedBeamHeight: beamHeight,
                        isPlanter: this.isPlanter,
                        isBox: this.isBox,
                        isTable: this.isTable,
                        isFuton: this.isFuton,
                        isBelams: this.isBelams
                    });
                    
                    this.debugLog('🔍 AFTER DEBUG - Continuing execution');
                    
                // עבור ארון, נשתמש ברוחב הנכון של הקורה מהפרמטרים
                // אין צורך לשנות את beamWidth - הוא כבר נכון!
                    
                    this.debugLog('🔍 CHECKPOINT 1 - After armoire check:', {
                        isPlanter: this.isPlanter,
                        isBox: this.isBox,
                        isTable: this.isTable,
                        isFuton: this.isFuton,
                        condition: this.isPlanter || this.isBox
                    });
                    
                    if (this.isPlanter || this.isBox) {
                        // עבור עדנית/קופסא - לוג פשוט עם הנתונים הגולמיים
                        const depthParam = this.getParam('depth');
                        const widthParam = this.getParam('width');
                        const heightParam = this.getParam('height');
                    
                        const planterDepth = widthParam ? widthParam.default : 50;
                        const planterWidth = depthParam ? depthParam.default : 40;
                        const planterHeight = heightParam ? heightParam.default : 50;
                        
                        
                        // חישוב כמות הקורות ברצפה ובקיר
                        const beamsInDepth = Math.floor(planterWidth / beamWidth); // כמות קורות ברצפה
                        const beamsInHeight = Math.floor(planterHeight / beamWidth); // כמות קורות בקיר (W)
                        
                        
                        // חישוב אורכי הקורות
                        // length1: קורות הרצפה - אורך מלא של planterDepth
                        const length1 = planterDepth;
                        
                        // length2: קירות ארוכים (שמאלי וימני) - planterDepth מקוצר ב-beamHeight משני הצדדים
                        // בתלת-מימד: wallLength = widthParam.default - (2 * beamHeight)
                        // widthParam.default = planterDepth, אז: length2 = planterDepth - (2 * beamHeight)
                        const length2 = planterDepth - (beamHeight * 2);
                        
                        // length3: קירות קצרים (קדמי ואחורי) - אורך מלא של planterWidth
                        const length3 = planterWidth;
                        
                        // length4: קורות חיזוק אנכיות - תמיד H - 2X
                        // H = planterHeight (גובה כולל), X = beamHeight (גובה הקורה)
                        // תמיד: H - 2X (ללא קשר למכסה)
                        const length4 = planterHeight - (beamHeight * 2);
                        
                        
                        
                        this.debugLog('DEBUG-DEBUG-DEBUG: Planter/Box Raw Data:', {
                            // מידות המוצר הגולמיות
                            planterDepth: planterDepth,
                            planterWidth: planterWidth,
                            planterHeight: planterHeight,
                            
                            // מידות הקורה הגולמיות
                            beamWidth: beamWidth,
                            beamHeight: beamHeight,
                            
                            // חישובי כמות קורות
                            beamsInDepth: beamsInDepth, // כמות קורות ברצפה
                            beamsInHeight: beamsInHeight // כמות קורות בקיר (W)
                        });
                        
                        // הוספת קורות אורך 1 (רצפה)
                        
                        for (let i = 0; i < beamsInDepth; i++) {
                            allBeams.push({
                                type: selectedType,
                                length: length1,
                                width: beamHeight,
                                height: beamWidth,
                                name: `Planter Floor Beam ${i + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName,
                            });
                        }
                        
                        // הוספת קורות אורך 2 (קירות ארוכים) - כמות: beamsInHeight * 2
                        
                        for (let i = 0; i < beamsInHeight * 2; i++) {
                            allBeams.push({
                                type: selectedType,
                                length: length2,
                                width: beamHeight,
                                height: beamWidth,
                                name: `Planter Long Wall Beam ${i + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName,
                            });
                        }
                        
                        // הוספת קורות אורך 3 (קירות קצרים) - כמות: beamsInHeight * 2
                        
                        for (let i = 0; i < beamsInHeight * 2; i++) {
                            allBeams.push({
                                type: selectedType,
                                length: length3,
                                width: beamHeight,
                                height: beamWidth,
                                name: `Planter Short Wall Beam ${i + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName,
                            });
                        }
                        
                        // הוספת קורות אורך 4 (קורות חיזוק) - כמות: 4 (4 בפינות)
                        
                        for (let i = 0; i < 4; i++) {
                            allBeams.push({
                                type: selectedType,
                                length: length4,
                                width: beamHeight,
                                height: beamWidth,
                                name: `Planter Support Beam ${i + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName,
                            });
                        }
                        
                        // הוספת קורות מכסה לקופסא בלבד - רק אם הפרמטר isCover מופעל
                        const isCoverParam = this.getParam('isCover');
                        const shouldAddCover = this.isBox && isCoverParam && isCoverParam.default === true;
                        
                        
                        if (shouldAddCover) {
                            this.debugLog('מוסיף קורות מכסה לחישוב מחיר');
                            
                            // קורות רצפת המכסה - כפילות של קורות הרצפה
                            
                            for (let i = 0; i < beamsInDepth; i++) {
                                allBeams.push({
                                    type: selectedType,
                                    length: length1, // אותו אורך כמו קורות הרצפה
                                    width: beamHeight,
                                    height: beamWidth,
                                    name: `Box Cover Floor Beam ${i + 1}`,
                                    beamName: selectedBeam.name,
                                    beamTranslatedName: selectedBeam.translatedName,
                                    beamWoodType: selectedType.translatedName,
                                });
                            }
                            
                            // קורות חיזוק המכסה - 2 קורות (מקוצרות ב-0.6 ס"מ = 6 מ"מ נוספים)
                            const coverSupportLength = planterWidth - (beamHeight * 4) - 0.6;
                            
                            
                            for (let i = 0; i < 2; i++) {
                                allBeams.push({
                                    type: selectedType,
                                    length: coverSupportLength,
                                    width: beamHeight,
                                    height: beamWidth,
                                    name: `Box Cover Support Beam ${i + 1}`,
                                    beamName: selectedBeam.name,
                                    beamTranslatedName: selectedBeam.translatedName,
                                    beamWoodType: selectedType.translatedName,
                                });
                            }
                        } else if (this.isBox) {
                            this.debugLog('לא מוסיף קורות מכסה - המכסה מבוטל');
                        }
                } else if (this.isFuton) {
                    // עבור בסיס מיטה - חישוב קורות הפלטה (בדיוק כמו בתלת-מימד)
                    const widthParam = this.getParam('width');
                    const depthParam = this.getParam('depth');
                    const futonWidth = depthParam ? depthParam.default : 200;  // החלפה: width = depth
                    const futonDepth = widthParam ? widthParam.default : 120;   // החלפה: depth = width
                    
                    // עבור מיטה: צריך להשתמש בממדים הנכונים (ללא היפוך)
                    // selectedBeam.width = 40mm -> 4 ס"מ (זה הרוחב של הקורה)
                    // selectedBeam.height = 15mm -> 1.5 ס"מ (זה הגובה של הקורה)
                    const futonBeamWidth = selectedBeam.width / 10;   // רוחב הקורה (4 ס"מ)
                    const futonBeamHeight = selectedBeam.height / 10; // גובה הקורה (1.5 ס"מ)
                    
                    // שימוש באותה פונקציה כמו בתלת-מימד
                    const surfaceBeams = this.createSurfaceBeams(
                        futonWidth,
                        futonDepth,
                        futonBeamWidth,  // רוחב נכון!
                        futonBeamHeight, // גובה נכון!
                        this.minGap
                    );
                    
                    // הוספת קורות הפלטה לחישוב המחיר
                    surfaceBeams.forEach((beam) => {
                        allBeams.push({
                            type: selectedType,
                            length: beam.depth, // אורך הקורה מהחישוב
                            width: beam.width,
                            height: beam.height,
                            name: 'Futon Platform Beam',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    });
                    
                    this.debugLog('קורות פלטת מיטה נוספו לחישוב מחיר:', {
                        beamsCount: surfaceBeams.length,
                        beamLength: surfaceBeams[0]?.depth,
                        futonWidth,
                        futonDepth,
                        futonBeamWidth,
                        futonBeamHeight,
                        minGap: this.minGap,
                        beamName: selectedBeam.name,
                        woodType: selectedType.translatedName,
                        calculation: `floor((${futonWidth} + ${this.minGap}) / (${futonBeamWidth} + ${this.minGap})) = floor(${futonWidth + this.minGap} / ${futonBeamWidth + this.minGap}) = ${Math.floor((futonWidth + this.minGap) / (futonBeamWidth + this.minGap))}`
                    });
                } else {
                // חישוב קורות המשטח
                const surfaceBeams = this.createSurfaceBeams(
                    this.surfaceWidth,
                    this.surfaceLength,
                    beamWidth,
                    beamHeight,
                    this.minGap
                );
                if (this.isTable) {
                    // עבור שולחן - מדף אחד בלבד
                    surfaceBeams.forEach((beam) => {
                        allBeams.push({
                            type: selectedType,
                            length: beam.depth, // אורך הקורה
                            width: beam.width,
                            height: beam.height,
                            name: 'Table Surface Beam',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    });
                } else {
                    // עבור ארון - קורות לכל מדף עם קיצור
                    const totalShelves = this.shelves.length;
                    this.debugLog('🔍 CABINET CALCULATION:', {
                        totalShelves: totalShelves,
                        surfaceWidth: this.surfaceWidth,
                        surfaceLength: this.surfaceLength,
                        beamWidth: beamWidth,
                        beamHeight: beamHeight
                    });
                    
                    // מציאת קורת הרגל/החיזוק לחישוב הקיצור
                    const legParam = this.getParam('leg');
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamWidth = legBeamSelected?.width / 10 || 0; // רוחב קורת הרגל
                    const legBeamHeight = legBeamSelected?.height / 10 || 0; // גובה קורת הרגל
                    
                    
                    this.debugLog('🔍 LEG BEAM:', {
                        legBeamWidth: legBeamWidth,
                        legBeamName: legBeamSelected?.name
                    });
                    
                    // יצירת קורות מדף נפרדות לארון
                    // חישוב כמות קורות במדף: floor((surfaceWidth + minGap) / (beamWidth + minGap))
                    // צריך להשתמש בbeamWidth הנכון של קורת המדף, לא של קורת הרגל!
                    const shelfBeamWidth = beamWidth; // זה כבר מחושב נכון מהפרמטרים
                    const beamsInShelf = Math.floor((this.surfaceWidth + this.minGap) / (shelfBeamWidth + this.minGap));
                    
                    
                    // יצירת קורות המדף
                    const cabinetShelfBeams = [];
                    for (let i = 0; i < beamsInShelf; i++) {
                        cabinetShelfBeams.push({
                            width: beamWidth,
                            height: beamHeight,
                            depth: this.surfaceLength, // אורך המדף
                            x: 0, // ייקבע מאוחר יותר
                            y: 0, // ייקבע מאוחר יותר
                            z: 0  // ייקבע מאוחר יותר
                        });
                    }
                    
                    this.shelves.forEach((shelf, index) => {
                        const isTopShelf = index === totalShelves - 1; // המדף העליון
                        this.debugLog(`🔍 SHELF ${index + 1} (${isTopShelf ? 'TOP' : 'NORMAL'}):`);

                        cabinetShelfBeams.forEach((beam, beamIndex) => {
                            let beamLength = beam.depth; // אורך מלא (50 ס"מ)
                            let isShortened = false;

                            // קיצור קורות בקצוות (רק במדפים שאינם עליונים)
                            if (!isTopShelf) {
                                // קורות בקצוות (ראשונה ואחרונה) מקוצרות
                                if (beamIndex === 0 || beamIndex === cabinetShelfBeams.length - 1) {
                                    const outsideParamCabForPricingShelves = this.getParam('is-reinforcement-beams-outside');
                                    const isOutsideCabForPricingShelves = !!(outsideParamCabForPricingShelves && outsideParamCabForPricingShelves.default === true);
                                    const defaultShorten = (legBeamHeight * 2);
                                    const extraShorten = isOutsideCabForPricingShelves ? (2 * (this.frameWidth)) : 0; // 2 * frameBeamWidth
                                    beamLength = Math.max(0.1, beamLength - (defaultShorten + extraShorten));
                                    isShortened = true;
                                }
                            }

                            this.debugLog(`  Beam ${beamIndex + 1}: ${beamLength}cm ${isShortened ? '(SHORTENED)' : '(FULL)'}`);
                            
                            allBeams.push({
                                type: selectedType,
                                length: beamLength,
                                width: beam.width,
                                height: beam.height,
                                name: `Shelf ${index + 1} Beam ${beamIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                        });
                    });
                    
                    // סיכום החישוב
                    const beamLengths = allBeams
                        .filter(beam => beam.name.includes('Shelf'))
                        .map(beam => beam.length);
                    const lengthCounts = beamLengths.reduce((acc, length) => {
                        acc[length] = (acc[length] || 0) + 1;
                        return acc;
                    }, {} as {[key: number]: number});
                    
                    this.debugLog('🔍 FINAL CABINET BEAM COUNT:', lengthCounts);
                    }
                }
            }
        }
        // קורות חיזוק (frame beams)
        if (this.surfaceWidth && this.surfaceLength) {
            let frameParamForCalculation = null;
            if (this.isTable) {
                // עבור שולחן, קורות החיזוק הן קורות הרגליים
                frameParamForCalculation = this.params.find(
                    (p) => p.type === 'beamSingle' && p.name === 'leg'
                );
            } else if (this.isFuton) {
                // עבור בסיס מיטה, קורות החיזוק הן קורות הרגליים (דומה לשולחן)
                frameParamForCalculation = this.params.find(
                    (p) => p.type === 'beamSingle' && p.name === 'leg'
                );
            } else {
                // עבור ארון, קורות החיזוק הן פרמטר beamSingle שאינו shelfs
                frameParamForCalculation = this.params.find(
                    (p) => p.type === 'beamSingle' && p.name !== 'shelfs'
                );
            }
            if (
                frameParamForCalculation &&
                Array.isArray(frameParamForCalculation.beams) &&
                frameParamForCalculation.beams.length
            ) {
                const selectedBeam =
                    frameParamForCalculation.beams[
                        frameParamForCalculation.selectedBeamIndex || 0
                    ];
                const selectedType =
                    selectedBeam?.types?.[
                        frameParamForCalculation.selectedTypeIndex || 0
                    ];
                if (selectedBeam && selectedType) {
                    const frameWidth =
                        selectedType.height / 10 || this.frameWidth; // המרה ממ"מ לס"מ
                    const frameHeight =
                        selectedType.width / 10 || this.frameHeight;
                    // חישוב קיצור קורות החיזוק - פעמיים רוחב קורות הרגל
                    // מציאת קורת הרגל לחישוב הקיצור
                    const legParam = this.getParam('leg');
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamHeight = legBeamSelected?.height / 10 || 0;
                    const legBeamWidth = legBeamSelected?.width / 10 || 0;
                    const shorteningAmount = legBeamHeight * 2; // פעמיים גובה קורת הרגל - לקורות לכיוון האורך
                    const shorteningAmountEx = legBeamWidth * 2; // פעמיים רוחב קורת הרגל - לקורות לכיוון הרוחב
                    
                    if (this.isTable) {
                        // עבור שולחן - 4 קורות חיזוק מקוצרות
                        // קורות רוחב מקוצרות
                        allBeams.push({
                            type: selectedType,
                            length: this.surfaceWidth - shorteningAmountEx,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Width 1',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        allBeams.push({
                            type: selectedType,
                            length: this.surfaceWidth - shorteningAmountEx,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Width 2',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        // קורות אורך מקוצרות (מקבילות לקורות המדפים)
                        // אורך כולל פחות פעמיים גובה קורות הרגליים
                        const lengthBeamLength =
                            this.surfaceLength - shorteningAmount;
                        allBeams.push({
                            type: selectedType,
                            length: lengthBeamLength,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Length 1',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        allBeams.push({
                            type: selectedType,
                            length: lengthBeamLength,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Length 2',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    } else if (this.isFuton) {
                        // עבור בסיס מיטה - אין קורות חיזוק, רק פלטה ורגליים
                        this.debugLog('Futon: No frame beams needed - only platform and legs');
                    } else {
                        
                        this.debugLog(
                            'DEBUG - shorteningAmount:',
                            shorteningAmount
                        );
                        // עבור ארון - קורות חיזוק מקוצרות לכל מדף
                        const outsideParamCabForPricing = this.getParam('is-reinforcement-beams-outside');
                        const isOutsideCabForPricing = !!(outsideParamCabForPricing && outsideParamCabForPricing.default === true);
                        this.shelves.forEach((shelf, shelfIndex) => {
                            // 4 קורות חיזוק מקוצרות לכל מדף (2 לרוחב, 2 לאורך)
                            // קורות רוחב מקוצרות
                            const widthLengthForPricing = isOutsideCabForPricing
                                ? this.surfaceWidth
                                : this.surfaceWidth - shorteningAmountEx;
                            allBeams.push({
                                type: selectedType,
                                length: widthLengthForPricing,
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Width 1 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            allBeams.push({
                                type: selectedType,
                                length: widthLengthForPricing,
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Width 2 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            // קורות אורך מקוצרות (מקבילות לקורות המדפים)
                            // אם outside=true: נדרש קיצור נוסף של b מכל צד => סה"כ 4*b
                            const lengthLengthForPricing = isOutsideCabForPricing
                                ? this.surfaceLength - (4 * legBeamHeight)
                                : this.surfaceLength - shorteningAmount;
                            allBeams.push({
                                type: selectedType,
                                length: Math.max(0.1, lengthLengthForPricing),
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Length 1 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            allBeams.push({
                                type: selectedType,
                                length: Math.max(0.1, lengthLengthForPricing),
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Length 2 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                        });
                    }
                }
            }
        }
        // קורות רגליים (leg beams) - לשולחן ולארון
        if (legParam) {
            const selectedBeam =
                legParam.beams?.[legParam.selectedBeamIndex || 0];
            const selectedType =
                selectedBeam?.types?.[legParam.selectedTypeIndex || 0];
            // חיפוש פרמטר גובה - נסה כמה אפשרויות
            let heightParam = this.getParam('height');
            if (!heightParam) {
                heightParam = this.params.find(
                    (p) =>
                        p.type === 'height' ||
                        p.name?.toLowerCase().includes('height') ||
                        p.name?.toLowerCase().includes('גובה')
                );
            }
            // חישוב גובה הרגליים - פשוט וברור
            const dimensions = this.getProductDimensionsRaw();
            const totalHeight = dimensions.height; // הגובה הכולל של המוצר
            // חישוב גובה קורות הפלטה/המדפים
            let shelfBeamHeight = 0;
            if (this.isTable) {
                // עבור שולחן - גובה קורות הפלטה
                const shelfParam = this.product?.params?.find(
                    (p: any) => p.type === 'beamSingle' && p.name === 'plata'
                );
                const shelfBeamSelected =
                    shelfParam?.beams?.[shelfParam.selectedBeamIndex || 0];
                shelfBeamHeight = shelfBeamSelected?.height / 10 || 0;
            } else if (this.isFuton) {
                // עבור בסיס מיטה - גובה קורות הפלטה (דומה לשולחן)
                const shelfParam = this.product?.params?.find(
                    (p: any) => p.type === 'beamSingle' && p.name === 'plata'
                );
                const shelfBeamSelected =
                    shelfParam?.beams?.[shelfParam.selectedBeamIndex || 0];
                shelfBeamHeight = shelfBeamSelected?.height / 10 || 0;
            } else {
                // עבור ארון - רק גובה קורת המדף עצמה
                const shelfParam = this.getParam('shelfs');
                const shelfBeamSelected =
                    shelfParam?.beams?.[shelfParam.selectedBeamIndex || 0];
                shelfBeamHeight = shelfBeamSelected?.height / 10 || 0;
            }
            // גובה הרגל = גובה כולל פחות גובה קורות הפלטה/המדפים
            const legHeight = totalHeight - shelfBeamHeight;
            this.debugLog(
                'DEBUG - legHeight calculation:',
                totalHeight,
                '-',
                shelfBeamHeight,
                '=',
                legHeight
            );
            this.debugLog(
                'DEBUG - legHeight type:',
                typeof legHeight,
                'value:',
                legHeight
            );
            if (selectedBeam && selectedType) {
                const legWidth = selectedType.width / 10 || 5; // המרה ממ"מ לס"מ
                const legHeightDimension = selectedType.height / 10 || 5;
                
                if (this.isFuton) {
                    // עבור בסיס מיטה - כמות רגליים לפי extraBeam
                    const extraBeamParam = this.getParam('extraBeam');
                    const legCount = extraBeamParam && extraBeamParam.default > 0 ? extraBeamParam.default : 0;
                    
                    // קבלת מידות המיטה
                    const widthParam = this.getParam('width');
                    const depthParam = this.getParam('depth');
                    const futonWidth = depthParam ? depthParam.default : 200;  // החלפה: width = depth
                    const futonDepth = widthParam ? widthParam.default : 120;   // החלפה: depth = width
                    
                    for (let i = 0; i < legCount; i++) {
                        allBeams.push({
                            type: selectedType,
                            length: futonWidth, // אורך הרגל = רוחב המיטה
                            width: legWidth,
                            height: legHeightDimension, // גובה הקורה עצמה
                            name: `Futon Leg ${i + 1}`,
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    }
                } else {
                    // עבור שולחן או ארון - 4 רגליים
                const numLegs = 4;
                for (let i = 0; i < numLegs; i++) {
                    allBeams.push({
                        type: selectedType,
                        length: legHeight, // גובה הרגל המחושב (totalHeight - shelfBeamHeight)
                        width: legWidth,
                        height: legHeightDimension, // גובה הקורה עצמה
                        name: this.isTable
                            ? `Table Leg ${i + 1}`
                            : `Cabinet Leg ${i + 1}`,
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                    });
                    }
                }
            }
        } else {
            this.debugLog('Leg beams not processed - no legParam found');
        }
        // קיבוץ קורות לפי סוג עץ ושם קורה - איחוד קורות זהות
        this.debugLog('=== STARTING beamTypesMap PROCESSING ===');
        this.debugLog('Total beams in allBeams:', allBeams.length);
        allBeams.forEach((beam, index) => {
            this.debugLog(`Beam ${index + 1}:`, {
                name: beam.name,
                beamName: beam.beamName,
                length: beam.length,
                type: beam.type?.name,
            });
        });
        const beamTypesMap = new Map();
        allBeams.forEach((beam) => {
            // שימוש בשם העץ + beamName כמפתח מורכב לאיחוד קורות זהות
            const typeName = beam.type?.name || 'unknown';
            const beamName = beam.beamName || 'undefined';
            const typeKey = `${typeName}_${beamName}`;
            this.debugLog(
                `Processing beam for beamTypesMap: typeKey=${typeKey}, beamName=${beam.beamName}, name=${beam.name}`
            );
            if (!beamTypesMap.has(typeKey)) {
                this.debugLog(
                    `Creating new entry in beamTypesMap for ${typeKey} with beamName=${beam.beamName}`
                );
                beamTypesMap.set(typeKey, {
                    type: beam.type,
                    beamName: beam.beamName, // שמירת beamName
                    beamTranslatedName: beam.beamTranslatedName, // שמירת השם המתורגם של הקורה
                    beamWoodType: beam.beamWoodType, // סוג העץ
                    sizes: [],
                });
            }
            // הוספת אורך הקורה כמות פעמים לפי כמות היחידות
            for (let i = 0; i < this.quantity; i++) {
            beamTypesMap.get(typeKey).sizes.push(beam.length);
            }
        });
        // המרה למערך הסופי
        beamTypesMap.forEach((beamData, typeKey) => {
            this.BeamsDataForPricing.push({
                type: beamData.type,
                beamName: beamData.beamName, // הוספת beamName
                beamTranslatedName: beamData.beamTranslatedName, // הוספת השם המתורגם של הקורה
                beamWoodType: beamData.beamWoodType, // הוספת סוג העץ
                sizes: beamData.sizes,
            });
        });
        // חישוב totalSizes לכל קורה - ספירת כמות מכל אורך
        this.BeamsDataForPricing.forEach((beamData, index) => {
            const sizeCounts = new Map<number, number>();
            // ספירת כל האורכים (ללא עיגול)
            beamData.sizes.forEach((size) => {
                sizeCounts.set(size, (sizeCounts.get(size) || 0) + 1);
            });
            // המרה למערך של אובייקטים עם אורך וכמות
            const totalSizes = Array.from(sizeCounts.entries())
                .map(([length, count]) => ({
                length: length,
                    count: count,
                }))
                .sort((a, b) => a.length - b.length); // מיון לפי אורך
            // הוספת השדה החדש
            beamData.totalSizes = totalSizes;
            this.debugLog(
                `Beam ${index + 1} (${beamData.beamName}) totalSizes:`,
                totalSizes
            );
        });
        // הצגת התוצאה הסופית של כל הקורות
        this.debugLog('=== FINAL BEAMS DATA FOR PRICING ===');
        this.debugLog('Total beam types:', this.BeamsDataForPricing.length);
        this.BeamsDataForPricing.forEach((beamData, index) => {
            this.debugLog(`Beam Type ${index + 1}:`, {
                typeId: beamData.type?._id || beamData.type?.id,
                typeName: beamData.type?.name || 'Unknown',
                beamName: beamData.beamName || 'Unknown',
                width: beamData.type?.width || 0,
                height: beamData.type?.height || 0,
                material: beamData.type?.material || 'Unknown',
                sizes: beamData.sizes,
                totalSizes: beamData.totalSizes, // הוספת totalSizes לפלט
                totalLength: beamData.sizes.reduce(
                    (sum, size) => sum + size,
                    0
                ),
                count: beamData.sizes.length,
            });
        });
        // הצגת התוצאה הסופית של הקורות
        this.debugLog('=== FINAL BEAMS DATA FOR PRICING ===');
        this.debugLog('Total beam types:', this.BeamsDataForPricing.length);
        this.BeamsDataForPricing.forEach((beamData, index) => {
            this.debugLog(`Beam Type ${index + 1}:`, {
                type: beamData.type,
                beamName: beamData.beamName,
                beamTranslatedName: beamData.beamTranslatedName,
                material: beamData.material,
                totalSizes: beamData.totalSizes,
                totalLength: beamData.totalLength,
                count: beamData.count,
            });
        });
        
        this.debugLog('*** === END BEAMS DATA ===', this.BeamsDataForPricing);
        // חישוב ברגים
        await this.calculateForgingData();

        // כיבוי loading
        this.isLoading = false;
        this.isModelLoading = false;
    }
    // פונקציה לעגול אורך בורג לחצי הקרוב למעלה
    private roundScrewLength(length: number): number {
        return Math.ceil(length * 2) / 2; // עיגול לחצי הקרוב למעלה
    }
    
    // פונקציה מרכזית לחישוב אורך בורג לפי סוג הבורג והמידות
    private calculateScrewLength(screwType: string, dimension1: number, dimension2?: number): number {
        let rawLength = 0;
        
        switch (screwType) {
            case 'shelf': // ברגי מדפים/פלטה - תלוי בגובה הקורה
                rawLength = dimension1 + 2; // dimension1 = beamHeight
                break;
                
            case 'futon': // ברגי פלטת מיטה - height של קורת הפלטה + 3
                rawLength = dimension1 + 3; // dimension1 = beamHeight
                break;
                
            case 'leg_width': // ברגי רגליים מבוססי רוחב - צריך 2 מידות!
                // נבחר את המידה הגדולה יותר מבין dimension1 ו-dimension2
                if (dimension2 !== undefined) {
                    const maxDimension = Math.max(dimension1, dimension2);
                    rawLength = maxDimension + 3; // המידה הגדולה + 3 ס"מ
                    this.debugLog(`🔧 Leg screw (width): dim1=${dimension1}, dim2=${dimension2}, max=${maxDimension}, length=${rawLength}`);
                } else {
                    // fallback למקרה שלא הועבר dimension2
                    rawLength = dimension1 + 3;
                    this.debugLog(`🔧 Leg screw (width) FALLBACK: dim1=${dimension1}, length=${rawLength}`);
                }
                break;
                
            case 'leg_height': // ברגי רגליים מבוססי גובה - צריך 2 מידות!
                // נבחר את המידה הגדולה יותר מבין dimension1 ו-dimension2
                if (dimension2 !== undefined) {
                    const maxDimension = Math.max(dimension1, dimension2);
                    rawLength = maxDimension + 3; // המידה הגדולה + 3 ס"מ
                    this.debugLog(`🔧 Leg screw (height): dim1=${dimension1}, dim2=${dimension2}, max=${maxDimension}, length=${rawLength}`);
                } else {
                    // fallback למקרה שלא הועבר dimension2
                    rawLength = dimension1 + 3;
                    this.debugLog(`🔧 Leg screw (height) FALLBACK: dim1=${dimension1}, length=${rawLength}`);
                }
                break;
                
            case 'planter_wall': // ברגי קירות עדנית
                rawLength = dimension1 + 2; // dimension1 = beamHeight (עומק קורת הקיר)
                break;
                
            case 'planter_floor': // ברגי רצפת עדנית
                rawLength = dimension1 + 2; // dimension1 = beamHeight
                break;
                
            case 'planter_side_wall': // ברגי קירות צדדיים עדנית
                rawLength = dimension1 + 2; // dimension1 = beamHeight
                break;
                
            default:
                // ברירת מחדל - dimension1 + 2
                rawLength = dimension1 + 2;
                break;
        }
        
        // עיגול לחצי הקרוב למעלה
        return this.roundScrewLength(rawLength);
    }
    // פונקציה לחישוב ברגי המדפים/פלטה
    private calculateShelfForgingData(): any[] {
        this.debugLog('=== CALCULATING SHELF FORGING DATA ===');
        const shelfForgingData: any[] = [];
        // חישוב ברגי מדפים/פלטה
        if (this.isTable) {
            // עבור שולחן - ברגי פלטה
            const plataParam = this.params.find((p) => p.name === 'plata');
            if (plataParam && plataParam.selectedBeamIndex !== undefined) {
                const selectedBeam =
                    plataParam.beams[plataParam.selectedBeamIndex];
                const selectedType =
                    selectedBeam?.types?.[plataParam.selectedTypeIndex || 0];
                if (selectedBeam && selectedType) {
                    // חישוב כמות ברגים לפי כמות הקורות בפועל
                    // כל קורה צריכה 4 ברגים
                    const beamWidth = selectedBeam.width / 10;
                    const beamHeight = selectedBeam.height / 10;
                    const minGap = 1; // רווח מינימלי
                    const surfaceBeams = this.createSurfaceBeams(
                        this.surfaceWidth,
                        this.surfaceLength,
                        beamWidth,
                        beamHeight,
                        minGap
                    );
                    const totalBeams = surfaceBeams.length; // כמות הקורות בפועל

                    // חישוב כמות ברגים לפי רוחב הקורה
                    let screwsPerBeam = 4; // ברירת מחדל - 4 ברגים לקורה רחבה
                    if (beamWidth <= 4) {
                        screwsPerBeam = 2; // 2 ברגים לקורה צרה (רוחב <= 4)
                    }

                    const totalScrews = totalBeams * screwsPerBeam;
                    shelfForgingData.push({
                        type: 'Shelf Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: this.calculateScrewLength('shelf', beamHeight),
                        description: 'ברגי פלטה',
                    });
                    this.debugLog(
                        `Table shelf screws: ${totalScrews} screws for ${totalBeams} beams (${screwsPerBeam} screws per beam)`
                    );
                }
            }
        } else if (this.isFuton) {
            // עבור מיטה (futon) - ברגי פלטה לרגליים
            const plataParam = this.params.find((p) => p.name === 'plata');
            if (plataParam && plataParam.selectedBeamIndex !== undefined) {
                const selectedBeam = plataParam.beams[plataParam.selectedBeamIndex];
                const selectedType = selectedBeam?.types?.[plataParam.selectedTypeIndex || 0];
                if (selectedBeam && selectedType) {
                    // חישוב קורות הפלטה - צריך להשתמש בממדים הנכונים!
                    const futonBeamWidth = selectedBeam.width / 10;   // רוחב נכון
                    const futonBeamHeight = selectedBeam.height / 10; // גובה נכון
                    const widthParam = this.getParam('width');
                    const depthParam = this.getParam('depth');
                    const futonWidth = depthParam ? depthParam.default : 200;  // החלפה: width = depth
                    const futonDepth = widthParam ? widthParam.default : 120;   // החלפה: depth = width
                    
                    const surfaceBeams = this.createSurfaceBeams(
                        futonWidth,
                        futonDepth,
                        futonBeamWidth,  // רוחב נכון!
                        futonBeamHeight, // גובה נכון!
                        this.minGap      // minGap נכון מהפרמטר
                    );
                    const totalBeams = surfaceBeams.length;
                    
                    // חישוב כמות הרגליים - לפי הפרמטר extraBeam
                    const extraBeamParam = this.getParam('extraBeam');
                    const legCount = extraBeamParam ? extraBeamParam.default : 3; // ברירת מחדל 3
                    
                    // 2 ברגים לכל מפגש של קורת פלטה עם רגל
                    const screwsPerBeamPerLeg = 2;
                    const totalScrews = totalBeams * legCount * screwsPerBeamPerLeg;
                    
                    // אורך הבורג = height של קורת הפלטה + 3
                    const screwLength = this.calculateScrewLength('futon', futonBeamHeight);
                    
                    shelfForgingData.push({
                        type: 'Futon Platform Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: screwLength,
                        description: 'ברגי פלטת מיטה',
                    });
                    
                    this.debugLog(
                        `Futon platform screws: ${totalScrews} screws for ${totalBeams} beams × ${legCount} legs (${screwsPerBeamPerLeg} screws per beam-leg intersection, ${screwLength}cm length)`,
                        `Calculation: ${totalBeams} × ${legCount} × ${screwsPerBeamPerLeg} = ${totalScrews}`
                    );
                }
            }
        } else {
            // עבור ארון - ברגי מדפים
            const shelfParam = this.params.find((p) => p.name === 'shelfs');
            if (shelfParam && shelfParam.selectedBeamIndex !== undefined) {
                const selectedBeam =
                    shelfParam.beams[shelfParam.selectedBeamIndex];
                const selectedType =
                    selectedBeam?.types?.[shelfParam.selectedTypeIndex || 0];
                if (selectedBeam && selectedType) {
                    // חישוב כמות ברגים לפי כמות הקורות בפועל
                    // כל קורה צריכה 4 ברגים
                    const beamWidth = selectedBeam.width / 10;
                    const beamHeight = selectedBeam.height / 10;
                    const minGap = 1; // רווח מינימלי
                    const surfaceBeams = this.createSurfaceBeams(
                        this.surfaceWidth,
                        this.surfaceLength,
                        beamWidth,
                        beamHeight,
                        minGap
                    );
                    const totalShelves = this.shelves.length;

                    // חישוב קורות מוסתרות (לוגיקה חדשה)
                    let totalHiddenBeams = 0;
                    const legParam = this.params.find((p) => p.name === 'leg');
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamWidth = legBeamSelected?.width / 10 || 0;

                    this.shelves.forEach((shelf, index) => {
                        const isTopShelf = index === totalShelves - 1;

                        // חישוב רווח בין קורות (כמו ב-3D model)
                        const totalBeamWidth = surfaceBeams.length * beamWidth;
                        const remainingSpace =
                            this.surfaceWidth - totalBeamWidth;
                        const gapsCount = surfaceBeams.length - 1;
                        const gapBetweenBeams =
                            gapsCount > 0 ? remainingSpace / gapsCount : 0;

                        // בדיקה אם להסתיר קורות (לוגיקה חדשה)
                        const beamAndGapWidth = beamWidth + gapBetweenBeams;
                        const shouldHideBeams =
                            beamAndGapWidth < legBeamWidth && !isTopShelf;

                        if (shouldHideBeams) {
                            // חישוב כמה קורות למחוק מכל צד (לוגיקה חדשה)
                            const howManyFit = Math.floor(legBeamWidth / beamAndGapWidth);
                            let beamsToHidePerSide = Math.max(0, howManyFit);
                            const middleBeamsCount = surfaceBeams.length - 2;
                            beamsToHidePerSide = Math.min(beamsToHidePerSide, Math.floor(middleBeamsCount / 2));
                            
                            totalHiddenBeams += beamsToHidePerSide * 2; // 2 צדדים
                        }
                        
                        // בדיקה נוספת לארון: האם הקורות המקוצרות צרות מדי
                        if (!this.isTable && !this.isFuton && !isTopShelf) { // רק לארון ולא המדף העליון
                            const halfLegWidth = legBeamWidth / 2;
                            const shouldRemoveShortenedBeams = beamWidth < halfLegWidth;
                            
                            
                            if (shouldRemoveShortenedBeams) {
                                totalHiddenBeams += 1; // הוספת קורה מקוצרת אחת לכל מדף
                            }
                        }
                    });

                    const totalBeams =
                        surfaceBeams.length * totalShelves - totalHiddenBeams; // כמות הקורות בפועל פחות הקורות המוסתרות

                    // CHACH_ALLERT - Log pricing calculation

                    // חישוב כמות ברגים לפי רוחב הקורה
                    let screwsPerBeam = 4; // ברירת מחדל - 4 ברגים לקורה רחבה
                    if (beamWidth <= 4) {
                        screwsPerBeam = 2; // 2 ברגים לקורה צרה (רוחב <= 4)
                    }

                    const totalScrews = totalBeams * screwsPerBeam;
                    shelfForgingData.push({
                        type: 'Shelf Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: this.calculateScrewLength('shelf', beamHeight),
                        description: 'ברגי מדפים',
                    });
                    this.debugLog(
                        `Cabinet shelf screws: ${totalScrews} screws for ${totalShelves} shelves (${totalHiddenBeams} hidden beams, ${screwsPerBeam} screws per beam)`
                    );
                }
            }
        }
        return shelfForgingData;
    }
    // פונקציה לחישוב ברגי הרגליים
    private calculateLegForgingData(): any[] {
        this.debugLog('=== CALCULATING LEG FORGING DATA ===');
        const legForgingData: any[] = [];
        // חישוב ברגי רגליים
        const legParam = this.params.find((p) => p.name === 'leg');
        if (legParam && legParam.selectedBeamIndex !== undefined) {
            const selectedBeam = legParam.beams[legParam.selectedBeamIndex];
            const selectedType =
                selectedBeam?.types?.[legParam.selectedTypeIndex || 0];
            if (selectedBeam && selectedType) {
                const beamWidth = selectedBeam.width / 10;
                const beamHeight = selectedBeam.height / 10;
                // חישוב כמות ברגים לפי סוג המוצר
                let totalScrews = 0;
                if (this.isTable) {
                    // שולחן: תמיד 4 רגליים עם 4 ברגים כל אחת
                    totalScrews = 4 * 4; // 16 ברגים
                } else {
                    // ארון: כמות המדפים כפול 8 ברגים לכל קומה
                    const totalShelves = this.shelves.length;
                    totalScrews = totalShelves * 8; // 8 ברגים לכל מדף
                }
                
                // DUBBLE_LEG_SCREWS - Check if we need to multiply screws
                const dubbleThreshold = this.product?.restrictions?.find((r: any) => r.name === 'dubble-leg-screws-threshold')?.val;
                const frameBeamHeight = beamWidth; // frameBeamHeight is the same as beamWidth for legs
                const shouldDuplicateScrews = dubbleThreshold && frameBeamHeight > dubbleThreshold;
                
                if (shouldDuplicateScrews) {
                    totalScrews = totalScrews * 2; // Double the screws (UP + DOWN instead of original)
                }
                // חלוקה לשתי קבוצות שוות - חצי לכל קבוצה
                const halfScrews = Math.floor(totalScrews / 2);
                const remainingScrews = totalScrews - halfScrews; // לטפל במקרה של מספר אי-זוגי
                // קבוצה ראשונה: ברגים לפי רוחב קורת הרגל
                // מעביר גם beamWidth וגם beamHeight כדי לבחור את המקסימום
                const widthScrewLength = this.calculateScrewLength('leg_width', beamWidth, beamHeight);
                legForgingData.push({
                    type: 'Leg Screws (Width)',
                    beamName: selectedBeam.name,
                    beamTranslatedName: selectedBeam.translatedName,
                    material: selectedType.translatedName,
                    count: halfScrews,
                    length: widthScrewLength,
                    description: 'ברגי רגליים (לפי רוחב)',
                });
                // קבוצה שנייה: ברגים לפי גובה קורת הרגל
                // מעביר גם beamHeight וגם beamWidth כדי לבחור את המקסימום
                const heightScrewLength = this.calculateScrewLength('leg_height', beamHeight, beamWidth);
                legForgingData.push({
                    type: 'Leg Screws (Height)',
                    beamName: selectedBeam.name,
                    beamTranslatedName: selectedBeam.translatedName,
                    material: selectedType.translatedName,
                    count: remainingScrews,
                    length: heightScrewLength,
                    description: 'ברגי רגליים (לפי גובה)',
                });
                this.debugLog(
                    `Leg screws: ${halfScrews} width-based (${widthScrewLength}cm) + ${remainingScrews} height-based (${heightScrewLength}cm)`
                );
            }
        }
        return legForgingData;
    }
    
    // פונקציה לחישוב ברגי קירות העדנית
    private calculatePlanterWallForgingData(): any[] {
        this.debugLog('=== CALCULATING PLANTER WALL FORGING DATA ===');
        const planterWallForgingData: any[] = [];
        
        if (this.isPlanter || this.isBox) {
            const beamParam = this.getParam('beam');
            if (beamParam && beamParam.selectedBeamIndex !== undefined) {
                const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex];
                const selectedType = selectedBeam?.types?.[beamParam.selectedTypeIndex || 0];
                
                if (selectedBeam && selectedType) {
                    const beamWidth = selectedBeam.width / 10; // המרה ממ"מ לס"מ
                    const beamHeight = selectedBeam.height / 10; // המרה ממ"מ לס"מ
                    
                    // חישוב כמות הקורות בקירות
                    const heightParam = this.getParam('height');
                    const planterHeight = heightParam ? heightParam.default : 50;
                    const beamsInHeight = Math.floor(planterHeight / beamWidth);
                    
                    // 2 קירות (קדמי ואחורי), כל קיר עם beamsInHeight קורות
                    const totalWallBeams = 2 * beamsInHeight;
                    
                    // 4 ברגים לכל קורה
                    const screwsPerBeam = 4;
                    const totalScrews = totalWallBeams * screwsPerBeam;
                    
                    planterWallForgingData.push({
                        type: 'Planter Wall Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: this.calculateScrewLength('planter_wall', beamHeight),
                        description: 'ברגי קירות עדנית',
                    });
                    
                    this.debugLog(
                        `Planter wall screws: ${totalScrews} screws for ${totalWallBeams} beams (${screwsPerBeam} screws per beam)`
                    );
                }
            }
        }
        
        return planterWallForgingData;
    }
    
    // פונקציה לחישוב ברגי רצפת העדנית
    private calculatePlanterFloorForgingData(): any[] {
        this.debugLog('=== CALCULATING PLANTER FLOOR FORGING DATA ===');
        const planterFloorForgingData: any[] = [];
        
        if (this.isPlanter || this.isBox) {
            const beamParam = this.getParam('beam');
            if (beamParam && beamParam.selectedBeamIndex !== undefined) {
                const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex];
                const selectedType = selectedBeam?.types?.[beamParam.selectedTypeIndex || 0];
                
                if (selectedBeam && selectedType) {
                    const beamWidth = selectedBeam.width / 10; // המרה ממ"מ לס"מ
                    const beamHeight = selectedBeam.height / 10; // המרה ממ"מ לס"מ
                    
                    // חישוב כמות הקורות ברצפה
                    const widthParam = this.getParam('width');
                    const planterWidth = widthParam ? widthParam.default : 50;
                    const beamsInDepth = Math.floor(planterWidth / beamWidth);
                    
                    // 4 ברגים לכל קורת רצפה
                    const screwsPerBeam = 4;
                    const totalScrews = beamsInDepth * screwsPerBeam;
                    
                    planterFloorForgingData.push({
                        type: 'Planter Floor Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: this.calculateScrewLength('planter_floor', beamHeight),
                        description: 'ברגי רצפת עדנית',
                    });
                    
                    this.debugLog(
                        `Planter floor screws: ${totalScrews} screws for ${beamsInDepth} beams (${screwsPerBeam} screws per beam)`
                    );
                    
                    // הוספת ברגי מכסה (רק אם יש מכסה)
                    const isCoverParam = this.getParam('isCover');
                    if (this.isBox && isCoverParam && isCoverParam.default === true) {
                        // עכשיו יש 2 טורים בכל קורת תמיכה (בציר Z)
                        // קורות אמצעיות: 8 ברגים (2 קורות תמיכה × 2 טורים × 2 ברגים)
                        // קורות קצה: 4 ברגים (2 קורות תמיכה × 2 טורים × 1 בורג)
                        const middleBeams = beamsInDepth - 2; // קורות אמצעיות
                        const edgeBeams = 2; // קורה ראשונה ואחרונה
                        const coverTotalScrews = (middleBeams * 8) + (edgeBeams * 4);
                        
                        planterFloorForgingData.push({
                            type: 'Box Cover Screws',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            material: selectedType.translatedName,
                            count: coverTotalScrews,
                            length: this.calculateScrewLength('planter_floor', beamHeight),
                            description: 'ברגי מכסה קופסא',
                        });
                        
                        this.debugLog(
                            `Box cover screws: ${coverTotalScrews} screws for ${beamsInDepth} beams (${screwsPerBeam} screws per beam)`
                        );
                    }
                }
            }
        }
        
        return planterFloorForgingData;
    }
    
    // פונקציה לחישוב ברגי קירות צדדיים עדנית
    private calculatePlanterSideWallForgingData(): any[] {
        this.debugLog('=== CALCULATING PLANTER SIDE WALL FORGING DATA ===');
        const planterSideWallForgingData: any[] = [];
        
        if (this.isPlanter || this.isBox) {
            const beamParam = this.getParam('beam');
            if (beamParam && beamParam.selectedBeamIndex !== undefined) {
                const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex];
                const selectedType = selectedBeam?.types?.[beamParam.selectedTypeIndex || 0];
                
                if (selectedBeam && selectedType) {
                    const beamHeight = selectedBeam.height / 10; // המרה ממ"מ לס"מ
                    
                    // חישוב כמות הברגים לפי המרחק
                    const depthParam = this.getParam('depth');
                    const planterDepth = depthParam ? depthParam.default : 40;
                    const divisions = Math.ceil(planterDepth / 30); // חלוקה ב-30 ועגול למעלה
                    const screwCount = Math.max(divisions, 3); // מינימום 3 ברגים
                    
                    // 2 קירות צדדיים (ללא הקיצוניים)
                    const actualScrewCount = Math.max(screwCount - 2, 1); // הסרת הקיצוניים, מינימום 1
                    const totalScrews = actualScrewCount * 2;
                    
                    planterSideWallForgingData.push({
                        type: 'Planter Side Wall Screws',
                        beamName: selectedBeam.name,
                        beamTranslatedName: selectedBeam.translatedName,
                        material: selectedType.translatedName,
                        count: totalScrews,
                        length: this.calculateScrewLength('planter_side_wall', beamHeight),
                        description: 'ברגי קירות צדדיים עדנית',
                    });
                    
                    this.debugLog(
                        `Planter side wall screws: ${totalScrews} screws for 2 side walls (${actualScrewCount} screws per wall, excluding edge screws)`
                    );
                }
            }
        }
        
        return planterSideWallForgingData;
    }
    
    // פונקציה להוספת ברגים לקורת קיר עדנית
    private addScrewsToPlanterWallBeam(
        wallX: number, 
        wallY: number, 
        wallZ: number, 
        wallLength: number, 
        beamHeight: number, 
        beamDepth: number, 
        isFrontBackWall: boolean, 
        wallName: string, 
        beamNumber: number,
        beamWidth?: number
    ) {
        // חישוב אורך הבורג לפי סוג הבורג והמידות
        const calculatedScrewLength = this.calculateScrewLength('planter_wall', beamDepth);
        
        // 4 ברגים לכל קורה - בקצוות הקורה, ניצבים אליה ב-4 הפינות
        // ראש הבורג במפלס החיצוני של תיבת ה-wireframe
        const screwOffset = beamDepth / 2 + 0.1; // חצי עומק הקורה + קצת חוץ
        const innerOffset = beamDepth / 2; // הזזה פנימית לכיוון האמצע
        
        // קיר קדמי: ברגים בצד החיצוני (X שלילי)
        // קיר אחורי: ברגים בצד החיצוני (X חיובי)
        const isFrontWall = wallName === 'קדמי';
        const outerOffset = isFrontWall ? -screwOffset : screwOffset;
        
        const screwPositions = [
            // בורג ראשון - פינה שמאלית עליונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : innerOffset),
                y: wallY + beamHeight / 2 - innerOffset, // הזזה פנימית למעלה
                z: wallZ - wallLength / 2 + (isFrontBackWall ? innerOffset : -screwOffset)
            },
            // בורג שני - פינה ימנית עליונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : -innerOffset),
                y: wallY + beamHeight / 2 - innerOffset, // הזזה פנימית למעלה
                z: wallZ + wallLength / 2 + (isFrontBackWall ? -innerOffset : screwOffset)
            },
            // בורג שלישי - פינה שמאלית תחתונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : innerOffset),
                y: wallY - beamHeight / 2 + innerOffset, // הזזה פנימית למטה
                z: wallZ - wallLength / 2 + (isFrontBackWall ? innerOffset : -screwOffset)
            },
            // בורג רביעי - פינה ימנית תחתונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : -innerOffset),
                y: wallY - beamHeight / 2 + innerOffset, // הזזה פנימית למטה
                z: wallZ + wallLength / 2 + (isFrontBackWall ? -innerOffset : screwOffset)
            }
        ];
        
        // שורה חיצונית של ברגים
        screwPositions.forEach((pos, screwIndex) => {
            const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(pos.x, pos.y, pos.z);
            
            // ברגים ניצבים לקורה - כיוון הפוך לכל קיר
            // קיר קדמי (wallIndex === 2): כיוון הפוך (180 מעלות)
            // קיר אחורי (wallIndex === 3): כיוון רגיל
            const isFrontWall = wallName === 'קדמי';
            screwGroup.rotation.y = isFrontWall ? Math.PI : 0;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            this.debugLog(
                `קיר ${wallName} קורה ${beamNumber} בורג ${screwIndex + 1} (שורה חיצונית): x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}, rotation=${isFrontWall ? '180°' : '0°'}`
            );
        });
        
        // שורה פנימית של ברגים - מוזזת פנימה בציר Z לפי beamDepth
        const innerScrewPositions = [
            // בורג ראשון - פינה שמאלית עליונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : innerOffset),
                y: wallY + beamHeight / 2 - innerOffset, // הזזה פנימית למעלה
                z: wallZ - wallLength / 2 + (isFrontBackWall ? innerOffset + beamDepth : -screwOffset)
            },
            // בורג שני - פינה ימנית עליונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : -innerOffset),
                y: wallY + beamHeight / 2 - innerOffset, // הזזה פנימית למעלה
                z: wallZ + wallLength / 2 + (isFrontBackWall ? -innerOffset - beamDepth : screwOffset)
            },
            // בורג שלישי - פינה שמאלית תחתונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : innerOffset),
                y: wallY - beamHeight / 2 + innerOffset, // הזזה פנימית למטה
                z: wallZ - wallLength / 2 + (isFrontBackWall ? innerOffset + beamDepth : -screwOffset)
            },
            // בורג רביעי - פינה ימנית תחתונה
            {
                x: wallX + (isFrontBackWall ? outerOffset : -innerOffset),
                y: wallY - beamHeight / 2 + innerOffset, // הזזה פנימית למטה
                z: wallZ + wallLength / 2 + (isFrontBackWall ? -innerOffset - beamDepth : screwOffset)
            }
        ];
        
        innerScrewPositions.forEach((pos, screwIndex) => {
            const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(pos.x, pos.y, pos.z);
            
            // ברגים ניצבים לקורה - כיוון הפוך לכל קיר
            const isFrontWall = wallName === 'קדמי';
            screwGroup.rotation.y = isFrontWall ? Math.PI : 0;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            this.debugLog(
                `קיר ${wallName} קורה ${beamNumber} בורג ${screwIndex + 1} (שורה פנימית): x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}, rotation=${isFrontWall ? '180°' : '0°'}`
            );
        });
        
        // שורה שלישית של ברגים - מסובבת ב-90 מעלות כלפי פנים
        // הברגים צריכים להצביע למרכז הקורות החיזוק האנכיות
        // הקורות האנכיות: רוחב = beamDepth, עומק = beamHeight
        // מיקום הקורה האנכית: הקצה הפנימי של הקיר + חצי רוחב הקורה האנכית
        const headHeight = 0.2; // גובה ראש הבורג - 2 מ"מ
        
        // חישוב המרחק של מרכז הקורה האנכית מ-wallX
        // קורות החיזוק האנכיות ממוקמות ב: x = ±(planterDepth/2 - beamDepth - beamWidth/2)
        // כאן beamDepth בפונקציית הברגים = beamHeight של המערכת
        // wallX של קיר קדמי = -planterDepth/2 + beamDepth/2
        // מרכז הקורה האנכית = -planterDepth/2 + beamDepth + beamWidth/2
        // אז המרחק מ-wallX למרכז הקורה:
        // (-planterDepth/2 + beamDepth + beamWidth/2) - (-planterDepth/2 + beamDepth/2)
        // = beamDepth + beamWidth/2 - beamDepth/2 = beamDepth/2 + beamWidth/2
        const supportBeamWidth = beamWidth || beamDepth; // רוחב הקורה האנכית בציר X
        const supportBeamOffsetFromWall = beamDepth / 2 + supportBeamWidth / 2;
        
        const thirdRowScrewPositions = [
            // בורג ראשון - פינה שמאלית עליונה (פונה ל-Z שלילי)
            {
                x: wallX + (isFrontWall ? supportBeamOffsetFromWall : -supportBeamOffsetFromWall),
                y: wallY + beamHeight / 2 - innerOffset,
                z: wallZ - wallLength / 2 + innerOffset - (beamDepth / 2) - headHeight
            },
            // בורג שני - פינה ימנית עליונה (פונה ל-Z חיובי)
            {
                x: wallX + (isFrontWall ? supportBeamOffsetFromWall : -supportBeamOffsetFromWall),
                y: wallY + beamHeight / 2 - innerOffset,
                z: wallZ + wallLength / 2 - innerOffset + (beamDepth / 2) + headHeight
            },
            // בורג שלישי - פינה שמאלית תחתונה (פונה ל-Z שלילי)
            {
                x: wallX + (isFrontWall ? supportBeamOffsetFromWall : -supportBeamOffsetFromWall),
                y: wallY - beamHeight / 2 + innerOffset,
                z: wallZ - wallLength / 2 + innerOffset - (beamDepth / 2) - headHeight
            },
            // בורג רביעי - פינה ימנית תחתונה (פונה ל-Z חיובי)
            {
                x: wallX + (isFrontWall ? supportBeamOffsetFromWall : -supportBeamOffsetFromWall),
                y: wallY - beamHeight / 2 + innerOffset,
                z: wallZ + wallLength / 2 - innerOffset + (beamDepth / 2) + headHeight
            }
        ];
        
        thirdRowScrewPositions.forEach((pos, screwIndex) => {
            const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(pos.x, pos.y, pos.z);
            
            // הברגים צריכים להיות כמו ברגי הקיר הרגילים, אבל מסובבים ב-90 מעלות
            // ברגים שמאליים (אינדקס 0 ו-2) צריכים להיכנס מכיוון +Z
            // ברגים ימניים (אינדקס 1 ו-3) צריכים להיכנס מכיוון -Z
            const isLeft = screwIndex === 0 || screwIndex === 2;
            
            // לוגיקה פשוטה: ברגים שמאליים = +90°, ברגים ימניים = -90°
            let rotation = isLeft ? Math.PI / 2 : -Math.PI / 2;
            
            // אם זה קיר קדמי, נוסיף 180 מעלות לסיבוב הבסיסי
            if (isFrontWall) {
                rotation += Math.PI;
            }
            
            // תיקון נוסף: אם הבורג בצד החיובי של ציר העומק (X > 0), נהפוך אותו ב-180 מעלות
            // זה יתקן צד אחד שלם של האדנית (2 פינות סמוכות לאורך ציר העומק)
            if (pos.x > 0) {
                rotation += Math.PI;
            }
            
            // הפיכת כל הברגים ב-180 מעלות
            rotation += Math.PI;
            
            screwGroup.rotation.y = rotation;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            const rotationDeg = (rotation * 180 / Math.PI).toFixed(0);
            this.debugLog(
                `קיר ${wallName} קורה ${beamNumber} בורג ${screwIndex + 1} (שורה שלישית): x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}, rotationY=${rotationDeg}°, isLeft=${isLeft}, isFrontWall=${isFrontWall}, posX>0=${pos.x > 0}`
            );
        });
    }
    
    // פונקציה להוספת ברגים לקורת רצפת עדנית
    private addScrewsToPlanterFloorBeam(
        floorX: number, 
        floorY: number, 
        floorZ: number, 
        floorLength: number, 
        beamHeight: number, 
        beamWidth: number, 
        beamNumber: number
    ) {
        // חישוב אורך הבורג לפי סוג הבורג והמידות
        const calculatedScrewLength = this.calculateScrewLength('planter_floor', beamHeight);
        
        // 4 ברגים לכל קורת רצפה - בקצוות הקורה, ניצבים כלפי מעלה
        const screwOffset = beamHeight / 2 + 0.1; // חצי גובה הקורה + קצת חוץ
        const innerOffset = beamHeight / 2; // הזזה פנימית לכיוון האמצע
        
        const screwPositions = [
            // בורג ראשון - פינה שמאלית קדמית
            {
                x: floorX - floorLength / 2 + innerOffset,
                y: floorY - screwOffset, // מתחת לרצפה
                z: floorZ - beamWidth / 2 + innerOffset
            },
            // בורג שני - פינה ימנית קדמית
            {
                x: floorX + floorLength / 2 - innerOffset,
                y: floorY - screwOffset, // מתחת לרצפה
                z: floorZ - beamWidth / 2 + innerOffset
            },
            // בורג שלישי - פינה שמאלית אחורית
            {
                x: floorX - floorLength / 2 + innerOffset,
                y: floorY - screwOffset, // מתחת לרצפה
                z: floorZ + beamWidth / 2 - innerOffset
            },
            // בורג רביעי - פינה ימנית אחורית
            {
                x: floorX + floorLength / 2 - innerOffset,
                y: floorY - screwOffset, // מתחת לרצפה
                z: floorZ + beamWidth / 2 - innerOffset
            }
        ];
        
        screwPositions.forEach((pos, screwIndex) => {
            const screwGroup = this.createScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(pos.x, pos.y, pos.z);
            
            // ברגים ניצבים כלפי מעלה
            screwGroup.rotation.x = Math.PI; // סיבוב 180 מעלות כדי שהבורג יפנה כלפי מעלה
            screwGroup.rotation.y = 0;
            screwGroup.rotation.z = 0;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            this.debugLog(
                `רצפה קורה ${beamNumber} בורג ${screwIndex + 1}: x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}`
            );
        });
    }
    
    // פונקציה להוספת ברגים לקירות השמאליים והימניים בתחתית הרצפה
    private addScrewsToSideWallsAtFloor(
        planterDepth: number, 
        planterWidth: number, 
        beamHeight: number, 
        widthInput: number
    ) {
        // חישוב אורך הבורג לפי סוג הבורג והמידות
        const calculatedScrewLength = this.calculateScrewLength('planter_side_wall', beamHeight);
        
        // חישוב המרחק בין שתי שורות הברגים הקיימות
        const distanceBetweenScrewRows = planterDepth; // המרחק בין הקירות הקדמיים והאחוריים
        const divisions = Math.ceil(distanceBetweenScrewRows / 30); // חלוקה ב-30 ועגול למעלה
        const screwCount = Math.max(divisions, 3); // מינימום 3 ברגים
        
        // הזזה בחצי מעומק הקורה
        const screwOffset = beamHeight / 2;
        
        // ברגים לקיר השמאלי (ללא הקיצוניים)
        for (let i = 1; i < screwCount - 1; i++) {
            const xPosition = -planterDepth / 2 + (i * planterDepth / (screwCount - 1));
            const screwGroup = this.createScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(xPosition, beamHeight / 2 - screwOffset, -planterWidth / 2 + beamHeight / 2);
            screwGroup.rotation.x = Math.PI; // ברגים כלפי מעלה
            screwGroup.rotation.y = Math.PI / 2; // ברגים אופקיים
            screwGroup.rotation.z = 0;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            this.debugLog(`קיר שמאלי בורג ${i}: x=${xPosition.toFixed(1)}, y=${(beamHeight / 2 - screwOffset).toFixed(1)}, z=${(-planterWidth / 2 + beamHeight / 2).toFixed(1)}`);
        }
        
        // ברגים לקיר הימני (ללא הקיצוניים)
        for (let i = 1; i < screwCount - 1; i++) {
            const xPosition = -planterDepth / 2 + (i * planterDepth / (screwCount - 1));
            const screwGroup = this.createScrewGeometry(calculatedScrewLength);
            screwGroup.position.set(xPosition, beamHeight / 2 - screwOffset, planterWidth / 2 - beamHeight / 2);
            screwGroup.rotation.x = Math.PI; // ברגים כלפי מעלה
            screwGroup.rotation.y = Math.PI / 2; // ברגים אופקיים
            screwGroup.rotation.z = 0;
            
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
            
            this.debugLog(`קיר ימני בורג ${i}: x=${xPosition.toFixed(1)}, y=${(beamHeight / 2 - screwOffset).toFixed(1)}, z=${(planterWidth / 2 - beamHeight / 2).toFixed(1)}`);
        }
        
        const actualScrewCount = Math.max(screwCount - 2, 1); // הסרת הקיצוניים, מינימום 1
        this.debugLog(`נוספו ${actualScrewCount} ברגים לכל קיר צדדי (סה"כ ${actualScrewCount * 2} ברגים, ללא הקיצוניים)`);
    }
    
    // פונקציה ליצירת קורות חיזוק פנימיות לעדנית
    private createPlanterInternalSupportBeams(
        planterDepth: number, 
        planterWidth: number, 
        actualWallHeight: number, 
        beamHeight: number, 
        beamWidth: number,
        woodType: string = ''
    ) {
        this.debugLog('=== יצירת קורות חיזוק פנימיות לעדנית ===');
        
        // 4 קורות חיזוק בפינות הפנימיות
        // מיקום הקורה כך שהקצה שלה יושב בדיוק על הקצה הפנימי של קיר הקדמי/אחורי
        // קיר קדמי נמצא ב: x = -planterDepth/2 + beamHeight/2
        // הקצה הפנימי שלו: x = -planterDepth/2 + beamHeight
        // מרכז הקורה האנכית צריך להיות ב: הקצה הפנימי של הקיר + beamWidth/2
        const supportBeamPositions = [
            // פינה שמאלית קדמית - צמודה לקצה הפנימי של הקיר הקדמי
            { x: -planterDepth / 2 + beamHeight + beamWidth / 2, z: -planterWidth / 2 + beamHeight + beamHeight / 2 },
            // פינה ימנית קדמית - צמודה לקצה הפנימי של הקיר הקדמי
            { x: planterDepth / 2 - beamHeight - beamWidth / 2, z: -planterWidth / 2 + beamHeight + beamHeight / 2 },
            // פינה שמאלית אחורית - צמודה לקצה הפנימי של הקיר האחורי
            { x: -planterDepth / 2 + beamHeight + beamWidth / 2, z: planterWidth / 2 - beamHeight - beamHeight / 2 },
            // פינה ימנית אחורית - צמודה לקצה הפנימי של הקיר האחורי
            { x: planterDepth / 2 - beamHeight - beamWidth / 2, z: planterWidth / 2 - beamHeight - beamHeight / 2 }
        ];
        
        supportBeamPositions.forEach((pos, index) => {
            // גובה הקורה מתחיל במפלס העליון של הרצפה
            const startY = beamHeight; // מפלס עליון של הרצפה
            const endY = startY + actualWallHeight; // שיא גובה העדנית
            
            const geometry = new THREE.BoxGeometry(
                beamWidth, // רוחב הקורה
                actualWallHeight, // גובה הקורה = גובה הקירות
                beamHeight // עומק הקורה
            );
            
            // שימוש בטקסטורה של קורות העדנית
            // העדנית משתמשת באותו סוג עץ לכל הקורות
            const material = this.getWoodMaterial(woodType);
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.addWireframeToBeam(mesh); // הוספת wireframe במצב שקוף
            
            // מיקום הקורה - ממורכז בגובה
            const centerY = startY + actualWallHeight / 2;
            mesh.position.set(pos.x, centerY, pos.z);
            
            this.scene.add(mesh);
            this.beamMeshes.push(mesh);
            
            this.debugLog(`קורת חיזוק פנימית ${index + 1}: x=${pos.x.toFixed(1)}, y=${centerY.toFixed(1)}, z=${pos.z.toFixed(1)}, גובה=${actualWallHeight.toFixed(1)}`);
        });
        
        this.debugLog('קורות חיזוק פנימיות נוצרו בהצלחה');
    }
    
    // פונקציה ראשית לחישוב כל הברגים
    private async calculateForgingData(): Promise<void> {
        this.startTimer('CABINET - Calculate Forging Data');
        this.debugLog('=== CALCULATING FORGING DATA ===');
        // איפוס המערך
        this.ForgingDataForPricing = [];
        
        this.startTimer('CABINET - Calculate Shelf Screws');
        // חישוב ברגי מדפים/פלטה
        const shelfForgingData = this.calculateShelfForgingData();
        this.endTimer('CABINET - Calculate Shelf Screws');
        this.ForgingDataForPricing.push(...shelfForgingData);
        
        this.startTimer('CABINET - Calculate Leg Screws');
        // חישוב ברגי רגליים
        const legForgingData = this.calculateLegForgingData();
        this.endTimer('CABINET - Calculate Leg Screws');
        this.ForgingDataForPricing.push(...legForgingData);
        // חישוב ברגי קירות עדנית
        const planterWallForgingData = this.calculatePlanterWallForgingData();
        this.ForgingDataForPricing.push(...planterWallForgingData);
        // חישוב ברגי רצפת עדנית
        const planterFloorForgingData = this.calculatePlanterFloorForgingData();
        this.ForgingDataForPricing.push(...planterFloorForgingData);
        // חישוב ברגי קירות צדדיים עדנית
        const planterSideWallForgingData = this.calculatePlanterSideWallForgingData();
        this.ForgingDataForPricing.push(...planterSideWallForgingData);
        
        // הכפלת כמות הברגים לפי כמות היחידות
        this.ForgingDataForPricing.forEach((forgingData) => {
            forgingData.count = forgingData.count * this.quantity;
        });
        
        // הצגת התוצאה הסופית
        this.debugLog('=== FINAL FORGING DATA FOR PRICING ===');
        this.debugLog('Total forging types:', this.ForgingDataForPricing.length);
        this.ForgingDataForPricing.forEach((forgingData, index) => {
            this.debugLog(`Forging Type ${index + 1}:`, {
                type: forgingData.type,
                beamName: forgingData.beamName,
                beamTranslatedName: forgingData.beamTranslatedName,
                material: forgingData.material,
                count: forgingData.count,
                length: forgingData.length,
                description: forgingData.description,
            });
        });
        this.debugLog('*** === END FORGING DATA ===', this.ForgingDataForPricing);
        // חישוב מחיר כולל ותוכנית חיתוך
        this.calculatedPrice = await this.pricingService.calculatePrice(
            this.BeamsDataForPricing,
            this.ForgingDataForPricing
        );
        this.cuttingPlan = await this.pricingService.getCuttingPlan(
            this.BeamsDataForPricing,
            this.ForgingDataForPricing
        );
        this.screwsPackagingPlan = this.pricingService.getScrewsPackagingPlan(
            this.ForgingDataForPricing
        );
        this.debugLog('=== FINAL CALCULATED PRICE ===', this.calculatedPrice);
        this.debugLog('=== SCREWS PACKAGING PLAN ===', this.screwsPackagingPlan);
        this.debugLog('=== CUTTING PLAN ===', this.cuttingPlan);
        
        // חישוב סכום הקורות הבודדות
        let totalBeamPrices = 0;
        this.cuttingPlan.forEach((beam, index) => {
            this.debugLog(`Beam ${index + 1}: ${beam.beamPrice}₪ (${beam.beamType} ${beam.beamLength}cm)`);
            totalBeamPrices += beam.beamPrice;
        });
        this.debugLog('=== TOTAL OF INDIVIDUAL BEAM PRICES ===', totalBeamPrices);
        
        // חישוב מחיר הברגים
        let totalForgingPrices = 0;
        this.ForgingDataForPricing.forEach((forging, index) => {
            const pricePerUnit = this.pricingService.findPriceForLength(forging.type, forging.length);
            const forgingPrice = pricePerUnit * forging.count;
            this.debugLog(`Forging ${index + 1}: ${forgingPrice}₪ (${forging.type} ${forging.length}cm x ${forging.count} @ ${pricePerUnit}₪ each)`);
            totalForgingPrices += forgingPrice;
        });
        this.debugLog('=== TOTAL FORGING PRICES ===', totalForgingPrices);
        
        const totalExpectedPrice = totalBeamPrices + totalForgingPrices;
        this.debugLog('=== EXPECTED TOTAL (BEAMS + FORGING) ===', totalExpectedPrice);
        this.debugLog('=== ACTUAL CALCULATED PRICE ===', this.calculatedPrice);
        this.debugLog('=== DIFFERENCE ===', this.calculatedPrice - totalExpectedPrice);
        
        this.endTimer('CABINET - Calculate Forging Data');
        
    }
    // פונקציה לקבוצת חתיכות לפי גודל
    getCutGroups(cuts: number[]): { length: number; count: number }[] {
        const groups: { [key: number]: number } = {};
        // ספירת כל גודל
        cuts.forEach((cut) => {
            groups[cut] = (groups[cut] || 0) + 1;
        });
        // המרה למערך ומיון בסדר יורד
        return Object.keys(groups)
            .map((length) => ({
                length: parseFloat(length), // שימוש ב-parseFloat במקום parseInt כדי לשמור על עשרוניות
                count: groups[parseFloat(length)],
            }))
            .sort((a, b) => b.length - a.length);
        
        this.endTimer('CABINET - Calculate Beams Data');
    }
    animate() {
        requestAnimationFrame(() => this.animate());
        this.camera.lookAt(0, 0, 0);
        this.renderer.render(this.scene, this.camera);
    }
    // קורות משטח
    private createSurfaceBeams(
        totalWidth: number,
        totalLength: number,
        beamWidth: number,
        beamHeight: number,
        minGap: number
    ): { x: number; width: number; height: number; depth: number }[] {
        const n = Math.floor((totalWidth + minGap) / (beamWidth + minGap));
        const actualGap = n > 1 ? (totalWidth - n * beamWidth) / (n - 1) : 0;
        const beams = [];
        for (let i = 0; i < n; i++) {
            const x =
                -totalWidth / 2 + i * (beamWidth + actualGap) + beamWidth / 2;
            beams.push({
                x,
                width: beamWidth,
                height: beamHeight,
                depth: totalLength,
            });
        }
        return beams;
    }

    // קורות מדף לארון - בדיוק 6 קורות
    private createCabinetShelfBeams(
        totalLength: number,
        beamWidth: number,
        beamHeight: number
    ): { width: number; height: number; depth: number }[] {
        // תמיד 6 קורות למדף בארון
        const beams = [];
        for (let i = 0; i < 6; i++) {
            beams.push({
                width: beamWidth,
                height: beamHeight,
                depth: totalLength, // אורך הקורה = אורך המדף
            });
        }
        this.debugLog('🔍 CABINET SHELF BEAMS:', {
            count: beams.length,
            length: totalLength,
            beamWidth: beamWidth,
            beamHeight: beamHeight
        });
        return beams;
    }
    // קורות חיזוק
    private createFrameBeams(
        totalWidth: number,
        totalLength: number,
        frameWidth: number,
        frameHeight: number,
        legWidth: number,
        legDepth: number
    ): {
        x: number;
        y: number;
        z: number;
        width: number;
        height: number;
        depth: number;
    }[] {
        // השתמש במידות שמועברות כפרמטרים (כבר מחושבות נכון)
        let frameBeamWidth = frameWidth;
        let frameBeamHeight = frameHeight;
        // בדיקת תקינות כל הפרמטרים
        if (isNaN(totalWidth) || totalWidth <= 0) {
            console.error('Invalid totalWidth:', totalWidth);
            return [];
        }
        if (isNaN(totalLength) || totalLength <= 0) {
            console.error('Invalid totalLength:', totalLength);
            return [];
        }
        if (isNaN(frameBeamWidth) || frameBeamWidth <= 0) {
            console.error('Invalid frameBeamWidth:', frameBeamWidth);
            return [];
        }
        if (isNaN(frameBeamHeight) || frameBeamHeight <= 0) {
            console.error('Invalid frameBeamHeight:', frameBeamHeight);
            return [];
        }
        if (isNaN(legWidth) || legWidth <= 0) {
            console.error('Invalid legWidth:', legWidth);
            return [];
        }
        if (isNaN(legDepth) || legDepth <= 0) {
            console.error('Invalid legDepth:', legDepth);
            return [];
        }
        const beams = [];
        // X axis beams (front/back) - קורות אופקיות קדמיות ואחוריות
        for (const z of [
            -totalLength / 2 + legDepth / 2, // קדמית - צמודה לקצה לפי מידות הרגליים
            totalLength / 2 - legDepth / 2, // אחורית - צמודה לקצה לפי מידות הרגליים
        ]) {
            // עבור שולחן: קיצור לפי גובה קורות החיזוק
            // עבור ארון: קיצור לפי רוחב הרגליים (legWidth)
            const beamWidth = this.isTable
                ? totalWidth - 2 * frameBeamHeight
                : totalWidth - 2 * legWidth;
            beams.push({
                x: 0, // ממורכזות במרכז
                y: 0,
                z: z, // מיקום זהה לארון
                width: beamWidth, // עבור שולחן: קיצור לפי גובה קורות החיזוק, עבור ארון: קיצור לפי רוחב הרגליים
                height: frameBeamHeight, // גובה מקורות החיזוק
                depth: frameBeamWidth, // עומק מקורות החיזוק
            });
        }
        // Z axis beams (left/right) - קורות אופקיות שמאליות וימניות
        for (const x of [
            -totalWidth / 2 + legWidth / 2, // שמאלית - צמודה לקצה לפי מידות הרגליים
            totalWidth / 2 - legWidth / 2, // ימנית - צמודה לקצה לפי מידות הרגליים
        ]) {
            const originalX = x;
            const adjustedX = x; // עבור שולחן וארון - מיקום זהה
            beams.push({
                x: adjustedX, // עבור שולחן, שתי הקורות ממורכזות למרכז הרגל
                y: 0,
                z: 0,
                width: frameBeamWidth, // רוחב מקורות החיזוק
                height: frameBeamHeight, // גובה מקורות החיזוק
                depth: totalLength - 2 * legDepth, // עומק זהה לארון
            });
        }
        return beams;
    }

    // מרכוז המצלמה על קוביית ה-wireframe בפתיחה הראשונית
    private centerCameraOnWireframe() {
        // קבועים
        const ROTATION_ANGLE = 30; // 30 מעלות סיבוב כלפי מטה (קבוע)
        
        // חישוב מיקום אופטימלי לפי מידות המוצר
        const dimensions = this.getProductDimensionsRaw();
        const optimalPosition = this.calculateOptimalCameraPosition(dimensions);
        
        
        // מיקום המצלמה במיקום האופטימלי
        this.camera.position.set(optimalPosition.x, optimalPosition.y, optimalPosition.z);
        
        // מרכוז על מרכז העולם (0,0,0)
        this.camera.lookAt(0, 0, 0);

        // סיבוב המצלמה 30 מעלות כלפי מטה (קבוע)
        const offset = this.camera.position.clone();
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.phi += ROTATION_ANGLE * Math.PI / 180; // 30 מעלות כלפי מטה
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
        
        // הדפסת מידות המוצר אחרי שזוית המצלמה נקבעת
      
        
        // ללא זום אאוט - המצלמה תישאר במרחק המקורי
        // הזום אין ב-performAutoZoomIn() יטפל בזה
        
        // pan למעלה במצב הפתיחה
        this.applyCameraPan();
        
        // הדפסת מידות וזימון אנימציה
        this.finalizeCamera();
        
        this.debugLog('מצלמה מורכזת על מרכז העולם:', {
            rotationAngle: ROTATION_ANGLE,
            cameraPosition: this.camera.position,
            lookAt: new THREE.Vector3(0, 0, 0)
        });
    }

    // פונקציה שבודקת גובה המסך ועושה pan למעלה בחצי מגובה המסך
    private panUpHalfScreen() {
        const screenHeight = window.innerHeight;
        const panAmount = screenHeight / 2; // חצי מגובה המסך
        
        // חישוב כיוון ה-pan למעלה
        const cam = this.camera;
        const pan = new THREE.Vector3();
        pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), panAmount * 0.2);
        
        // הזזת המצלמה והסצנה
        cam.position.add(pan);
        this.scene.position.add(pan);
        
        this.debugLog('PAN UP HALF SCREEN:', {
            screenHeight,
            panAmount,
            panVector: pan,
            cameraPosition: this.camera.position.clone(),
            scenePosition: this.scene.position.clone()
        });
    }
    
    // חישוב מיקום המצלמה האופטימלי לפי מידות המוצר
    private calculateOptimalCameraPosition(dimensions: { width: number; length: number; height: number }): { x: number; y: number; z: number } {
        const { width, length, height } = dimensions;
        
        // דוגמאות מהקוד (מתוקן):
        // 300W 50D 230H → camera(200, 600, 700)
        // 220W 43D 45H → camera(100, 400, 450) - מוצר קטן ונמוך!
        // 600W 70D 180H → camera(70, 250, 550) - מוצר רחב!
        
        // ניתוח מעמיק של הדפוסים:
        // X: ככל שהמוצר רחב יותר, צריך להיות קרוב יותר לצד (X קטן) כדי לראות את כל הרוחב
        // Y: ככל שהמוצר גבוה יותר, צריך להיות גבוה יותר, אבל עם offset בסיסי
        // Z: המרחק הכללי - מוצרים קטנים צריכים להיות יחסית קרובים
        
        // **חישוב X: יחס הפוך לרוחב**
        // הרעיון: המצלמה צריכה להיות בצד כך שתראה את כל הרוחב
        // ניתוח: X ≈ k / (width + offset)
        // 220W → X=100: 100 = k/(220+c) → k = 100*(220+c)
        // 300W → X=200: 200 = k/(300+c) → k = 200*(300+c)
        // 600W → X=70: 70 = k/(600+c) → k = 70*(600+c)
        // פתרון: c≈50, k≈50000
        const x = Math.max(50, 50000 / (width * 2.5 + 50));
        // בדיקה: 220→50000/600≈83, 300→50000/800≈63, 600→50000/1550≈32 (לא מדויק אבל כיוון נכון)
        
        // ננסה power function: X = a * width^b
        // log(X) = log(a) + b*log(width)
        // (220,100): log(100) = log(a) + b*log(220) → 2 = log(a) + b*2.34
        // (600,70): log(70) = log(a) + b*log(600) → 1.85 = log(a) + b*2.78
        // b = (1.85-2)/(2.78-2.34) = -0.15/0.44 = -0.34
        // log(a) = 2 - (-0.34)*2.34 = 2.8 → a = 630
        const xPower = 630 * Math.pow(width, -0.34);
        // 220 → 630*220^-0.34 ≈ 630*0.158 ≈ 99 ✓
        // 300 → 630*300^-0.34 ≈ 630*0.135 ≈ 85 (צריך 200, לא טוב)
        
        // ננסה משהו פשוט יותר: X = base - width/factor
        const xSimple = 250 - width * 0.3;
        // 220 → 250-66 = 184 (צריך 100)
        // 300 → 250-90 = 160 (צריך 200)
        // לא עובד
        
        // הפתרון: נשתמש בשילוב של שני גורמים
        const xFinal = 50 + 30000 / (width + 100);
        // 220 → 50 + 30000/320 = 50 + 93.75 = 143 (קרוב יותר ל-100)
        // 300 → 50 + 30000/400 = 50 + 75 = 125 (רחוק מ-200)
        // 600 → 50 + 30000/700 = 50 + 42.86 = 93 (קרוב ל-70)
        
        // **חישוב Y: תלוי בגובה + offset**
        // הרעיון: המצלמה צריכה להיות גבוהה מספיק כדי לראות את המוצר מלמעלה
        // מוצרים נמוכים: Y גבוה יחסית (כדי לראות מלמעלה)
        // מוצרים גבוהים: Y גבוה מאוד (כדי לראות את הכל)
        // 45H → 400Y: Y/H = 8.9
        // 180H → 250Y: Y/H = 1.4
        // 230H → 600Y: Y/H = 2.6
        // נראה שיש שיא אי שם באמצע (180H הכי נמוך)
        const yBase = height < 150 ? height * 3.5 + 150 : height * 2.5 + 50;
        // 45 → 157.5+150 = 307.5 (צריך 400)
        // 180 → 450+50 = 500 (צריך 250)
        // 230 → 575+50 = 625 (קרוב ל-600) ✓
        
        // תיקון: הורדת Y באופן אחיד לכל המוצרים
        const yFinal = height < 150 ? height * 1.5 + 150 : height * 2 + 50;
        // 45 → 67.5+150 = 217.5 (נמוך הרבה יותר!)
        // 180 → 360+50 = 410
        // 230 → 460+50 = 510 (נמוך יותר מ-600)
        
        // **חישוב Z: המרחק הכללי**
        // הרעיון: מוצרים גדולים צריכים מרחק קטן יחסית, מוצרים קטנים צריכים מרחק גדול יחסית
        const maxDim = Math.max(width, height);
        // 220 → 450: Z/max = 2.05
        // 230 → 700: Z/max = 3.04
        // 300 → 700: Z/max = 2.33
        // 600 → 550: Z/max = 0.92
        const zFinal = maxDim < 300 ? maxDim * 2.5 + 50 : maxDim * 1.2 + 340;
        // 220 → 550+50 = 600 (צריך 450)
        // 230 → 575+50 = 625 (קרוב ל-700) ✓
        // 300 → 360+340 = 700 ✓
        // 600 → 720+340 = 1060 (רחוק מ-550)
        
        // תיקון: מוצרים קטנים צריכים Z קטן יותר (קרוב יותר!)
        const zCorrected = maxDim < 300 ? maxDim * 1.8 + 50 : (maxDim < 400 ? maxDim * 2 + 100 : maxDim * 0.85 + 40);
        // 220 → 396+50 = 446 (קרוב ל-450) ✓ וקרוב יותר!
        // 230 → 414+50 = 464 (קרוב ל-700 אבל עדיין רחוק...)
        // 300 → 600+100 = 700 ✓
        // 600 → 510+40 = 550 ✓
        
        return { x: xFinal, y: yFinal, z: zCorrected };
    }
    
    // פונקציה משותפת לזימון אנימציה
    private finalizeCamera() {
        // המתנה של שנייה כדי שהמודל יסיים לעלות, ואז זום אין אוטומטי
        setTimeout(() => {
            this.performAutoZoomIn();
        }, 1000);
    }
    
    // פונקציה משותפת ל-pan למעלה
    private applyCameraPan() {
        const screenHeight = window.innerHeight;
        const panAmount = screenHeight / 2; // חצי מגובה המסך
        const cam = this.camera;
        const pan = new THREE.Vector3();
        pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), panAmount * 0.2); // חיובי = למעלה
        cam.position.add(pan);
        this.scene.position.add(pan);
    }
    
    // מרכוז המצלמה עבור מוצר beams עם מידות קבועות
    private centerCameraOnBeams() {
        // קבועים עבור beams - מידות קבועות של 50x50x50 ס"מ
        const ROTATION_ANGLE = 30; // 30 מעלות סיבוב כלפי מטה (קבוע)
        const BEAMS_BOX_SIZE = 50; // מידות קבועות של 50x50x50 ס"מ
        
        // חישוב מרחק על בסיס המידות הקבועות
        const maxDimension = BEAMS_BOX_SIZE; // 50 ס"מ
        const FIXED_DISTANCE = maxDimension * 2; // מרחק פי 2 מהמידה הגדולה
        
        // מיקום המצלמה במרחק קבוע מהמרכז
        this.camera.position.set(0, FIXED_DISTANCE, maxDimension * 4);
        
        // מרכוז על מרכז העולם (0,0,0)
        this.camera.lookAt(0, 0, 0);

        // סיבוב המצלמה 30 מעלות כלפי מטה (קבוע)
        const offset = this.camera.position.clone();
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.phi += ROTATION_ANGLE * Math.PI / 180; // 30 מעלות כלפי מטה
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
        
        // הדפסת מידות המוצר אחרי שזוית המצלמה נקבעת
        const dimensions = this.getProductDimensionsRaw();
        
        // pan למעלה במצב הפתיחה - זהה לחלוטין לרגיל
        this.applyCameraPan();
        
        // הדפסת מידות וזימון אנימציה
        this.finalizeCamera();
        
        this.debugLog('מצלמה מורכזת על beams עם מידות קבועות 50x50x50:', {
            rotationAngle: ROTATION_ANGLE,
            beamsBoxSize: BEAMS_BOX_SIZE,
            fixedDistance: FIXED_DISTANCE,
            cameraPosition: this.camera.position.clone(),
            scenePosition: this.scene.position.clone()
        });
    }
    
    // פונקציה לביצוע זום אין אוטומטי עם ease-in-out + rotate + pan
    private performAutoZoomIn() {
        const startTime = Date.now();
        const startPosition = this.camera.position.clone();
        const startScenePosition = this.scene.position.clone();
        const currentDistance = startPosition.distanceTo(new THREE.Vector3(0, 0, 0));
        
        // בדיקת 3 מידות המוצר וזום דינמי
        const dimensions = this.getProductDimensionsRaw();
        const rawMaxDimension = Math.max(dimensions.width, dimensions.length, dimensions.height);
        const maxDimension = Math.max(rawMaxDimension, 80); // מינימום 80 ס"מ למוצרים קטנים
        const zoomRatio = maxDimension / 200; // המידה הגדולה ביותר מחולקת ב-200
        
        // ככל שהיחס יותר קטן, הזום אין יהיה גדול יותר
        // היחס הקטן ביותר יהיה בערך 0.1 (עבור מוצר קטן), הגדול ביותר 3+ (עבור מוצר גדול)
        const baseZoomAmount = -150; // זום בסיסי
        const dynamicZoomMultiplier = Math.max(0.3, 1 / zoomRatio); // מינימום 0.3, מקסימום ללא הגבלה
        let zoomAmount = (baseZoomAmount * dynamicZoomMultiplier) / 1.7; // זום דינמי מופחת פי 1.7
        
        // התאמות זום לפי גובה המוצר
        const productHeight = dimensions.height;
        
        // עבור מוצרים קטנים (מידה מקסימלית < 80) - הפחתת זום אין
        if (rawMaxDimension < 80) {
            const smallRatio = (80 - rawMaxDimension) / 80; // ככל שיותר קטן, יותר הפחתה
            const smallProductZoomReduction = smallRatio * 240; // עד +240 (פחות זום אין = יותר רחוק) - פי 6
            zoomAmount += smallProductZoomReduction;
        }
        
        // עבור מוצרים נמוכים (גובה < 70) - הפחתת זום אין נוספת
        if (productHeight < 70) {
            const shortRatio = (70 - productHeight) / 70; // ככל שיותר נמוך, יותר הפחתה
            const shortProductZoomReduction = shortRatio * 100; // עד +100 (פחות זום אין = יותר רחוק) - פי 2
            zoomAmount += shortProductZoomReduction;
        }
        
        // עבור מוצרים גבוהים (מעל 180 ס"מ) - זום אין נוסף
        if (productHeight > 180) {
            // ב-280 ס"מ נוסיף זום אין משמעותי, פרופורציונלי לגובה
            const heightRatio = Math.min((productHeight - 180) / 100, 1); // 0 ב-180, 1 ב-280+
            const tallProductZoomBonus = heightRatio * -100; // עד -100 זום אין נוסף
            zoomAmount += tallProductZoomBonus;
        }
        
        
        const targetDistance = currentDistance + zoomAmount;
        
        // פרמטרים של rotate + pan משופרים
        const rotatePixels = 12.5; // 25% מ-50 (rotate מופחת)
        const panPixels = 20; // 25% מ-80 (pan מופחת)
        const rotateAngle = rotatePixels * 0.015; // rotate מופחת ל-25%
        const panAmount = panPixels * 0.075; // pan מופחת ל-25%
        
        // חישוב pan נוסף למוצרים נמוכים (גובה < 200) - למעלה
        let heightBasedPanAmount = productHeight < 200 
            ? ((200 - productHeight) / 200) * 25 // מקסימום 25 פיקסלים למעלה למוצרים נמוכים
            : 0;
        
        // חישוב pan נוסף למוצרים גבוהים (גובה > 180) - למטה
        if (productHeight > 180) {
            const tallHeightRatio = Math.min((productHeight - 180) / 100, 1); // 0 ב-180, 1 ב-280+
            const tallProductPanDown = tallHeightRatio * -40; // עד -40 פיקסלים למטה ב-280 ס"מ
            heightBasedPanAmount += tallProductPanDown;
        }
            
        // חישוב rotate נוסף - 10 מעלות למטה בסיסי לכל המוצרים
        let heightBasedRotateAmount = -10 * Math.PI / 180; // 10 מעלות למטה ברדיאנים לכל המוצרים
        
        // עבור מוצרים נמוכים (מתחת ל-150 ס"מ) - rotate נוסף כלפי מעלה (תצוגה מלמעלה)
        if (productHeight < 150) {
            // ב-50 ס"מ: 10 מעלות נוספות, ב-100 ס"מ: 5 מעלות, ב-150: 0 מעלות
            const shortHeightRatio = (150 - productHeight) / 100; // 1 ב-50, 0.5 ב-100, 0 ב-150
            const shortProductRotateBonus = shortHeightRatio * -10 * Math.PI / 180; // עד -10 מעלות מלמעלה
            heightBasedRotateAmount += shortProductRotateBonus;
        }
        
        // עבור מוצרים גבוהים (מעל 180 ס"מ) - rotate נוסף כלפי מעלה (תצוגה מלמעלה)
        if (productHeight > 180) {
            // ב-280 ס"מ נסובב הרבה יותר למעלה - 50 מעלות נוספות (סה"כ 40 מעלות למעלה!)
            const tallHeightRatio = Math.min((productHeight - 180) / 100, 1); // 0 ב-180, 1 ב-280+
            const tallProductRotateBonus = tallHeightRatio * -50 * Math.PI / 180; // עד -50 מעלות = הרבה יותר מלמעלה!
            heightBasedRotateAmount += tallProductRotateBonus;
        }
        
        // סיבוב azimuthal (ימין-שמאל) - 22.5 מעלות ימינה בסיסי
        let azimuthalRotateAmount = 22.5 * Math.PI / 180; // 22.5 מעלות ימינה ברדיאנים
        
        // עבור מוצרים גבוהים (מעל 150 ס"מ) - הפחתת סיבוב azimuthal
        if (productHeight > 150) {
            // ככל שהמוצר יותר גבוה, נפחית את הסיבוב
            const tallHeightRatio = Math.min((productHeight - 150) / 150, 1); // 0 ב-150, 1 ב-300+
            const tallProductAzimuthalReduction = tallHeightRatio * -15 * Math.PI / 180; // עד -15 מעלות הפחתה
            azimuthalRotateAmount += tallProductAzimuthalReduction;
        }
        
        // עבור מוצרים רחבים/ארוכים - סיבוב azimuthal נוסף
        const totalHorizontalSize = dimensions.width + dimensions.length;
        if (totalHorizontalSize > 0) {
            // ב-200 ס"מ (סכום רוחב+אורך) נוסיף 10 מעלות
            const wideAzimuthalBonus = (totalHorizontalSize / 200) * 10 * Math.PI / 180;
            azimuthalRotateAmount += wideAzimuthalBonus;
        }
        
        // חישוב pan אופקי (שמאלה) כדי למרכז את האלמנט אחרי הסיבוב
        // מבוסס על המידה הכי גדולה מה-3 (כדי לא להגזים באלמנטים רחבים)
        const maxDimensionForPan = Math.max(dimensions.width, dimensions.length, dimensions.height);
        let horizontalPanPixels = (maxDimensionForPan / 8) * 30;
        
        // עבור מוצרים עם רוחב או אורך גדולים - תיקון PAN ימינה
        const maxHorizontalDimension = Math.max(dimensions.width, dimensions.length);
        if (maxHorizontalDimension > dimensions.height) {
            // ככל שהרוחב/אורך יותר גדולים מהגובה, צריך יותר pan ימינה (שלילי)
            const horizontalDominance = (maxHorizontalDimension - dimensions.height) / maxHorizontalDimension;
            const widePanCorrection = horizontalDominance * maxHorizontalDimension * 5; // תיקון ימינה פי 2.5 (2 × 2.5)
            horizontalPanPixels -= widePanCorrection; // פחות שמאלה = יותר ימינה
        }
        
        // עבור מוצרים רחבים/ארוכים (רוחב+אורך מעל 70) אבל לא גבוהים (מתחת ל-300) - PAN שמאלה
        let wideProductLeftPan = 0;
        if (totalHorizontalSize > 70 && dimensions.height < 300) {
            // ככל שהמוצר יותר רחב/ארוך - יותר שמאלה
            const widthBonus = Math.min((totalHorizontalSize - 70) / 100, 1); // 0 ב-70, 1 ב-170+
            
            // ככל שהמוצר יותר גבוה - פחות שמאלה (עד 300 גובה = 0 אפקט)
            const heightReduction = Math.min(dimensions.height / 300, 1); // 0 ב-0, 1 ב-300+
            
            // חישוב האפקט הסופי
            const intensityFactor = 1.0; // פקטור עוצמה לדיוק (הופחת פי 5)
            wideProductLeftPan = widthBonus * (1 - heightReduction) * 500 * intensityFactor;
            horizontalPanPixels += wideProductLeftPan; // יותר שמאלה
        }
        
        // עבור מוצרים גבוהים (מעל 180 ס"מ) - PAN ימינה נוסף
        let tallProductRightPan = 0;
        if (productHeight > 180) {
            const tallHeightRatio = Math.min((productHeight - 180) / 100, 1); // 0 ב-180, 1 ב-280+
            const tallPanRightCorrection = tallHeightRatio * productHeight * 3.2; // pan ימינה פרופורציונלי לגובה (פי 4)
            horizontalPanPixels -= tallPanRightCorrection; // פחות שמאלה = יותר ימינה
            // נוסיף עוד pan ימינה נפרד שיופעל בנפרד
            tallProductRightPan = tallHeightRatio * 150; // עד 150 פיקסלים ימינה נוספים
        }
        
        const horizontalPanAmount = horizontalPanPixels * 0.075; // אותו מקדם כמו pan רגיל
        
        
        // חישוב מרכז קוביית ה-wireframe לסיבוב - תמיד מרכז העולם
        const wireframeCenter = new THREE.Vector3(0, 0, 0);
        
        // שמירת מיקום התחלתי של הסיבוב
        const startOffset = startPosition.clone().sub(wireframeCenter);
        const startSpherical = new THREE.Spherical().setFromVector3(startOffset);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 500, 1); // משך של חצי שנייה

            // Ease in out function
            const easeProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // 1. Zoom - זום אין מתקדם
            let newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, easeProgress);
            if (newDistance < 1) newDistance = 1; // הגנה מפני מרחק קטן מדי
            
            // 2. Rotate - סיבוב מתקדם (גרירה של 12.5 פיקסלים למעלה עם לחצן שמאלי + rotate נוסף למוצרים נמוכים)
            const currentRotateAngle = THREE.MathUtils.lerp(0, rotateAngle, easeProgress);
            const currentHeightBasedRotate = THREE.MathUtils.lerp(0, heightBasedRotateAmount, easeProgress);
            const totalCurrentRotate = currentRotateAngle + currentHeightBasedRotate;
            
            // סיבוב azimuthal (ימין-שמאל) - מתחיל ב-20% ונמשך עד הסוף (יותר זמן)
            const azimuthalProgress = Math.max(0, (progress - 0.2) / 0.8); // מתחיל ב-20%, מסתיים ב-100%
            const currentAzimuthalRotate = THREE.MathUtils.lerp(0, azimuthalRotateAmount, azimuthalProgress);
            
            const currentSpherical = startSpherical.clone();
            currentSpherical.phi += totalCurrentRotate; // סיבוב למעלה (הפוך) + rotate נוסף למוצרים נמוכים
            currentSpherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, currentSpherical.phi));
            currentSpherical.theta += currentAzimuthalRotate; // סיבוב ימין-שמאל
            currentSpherical.radius = newDistance; // עדכון המרחק
            
            // עדכון מיקום המצלמה
            const newOffset = new THREE.Vector3().setFromSpherical(currentSpherical);
            this.camera.position.copy(wireframeCenter.clone().add(newOffset));
            
            // 3. Pan - הזזה מתקדמת (גרירה של 60 פיקסלים למטה עם גלגלת + pan נוסף למוצרים נמוכים)
            const currentPanAmount = THREE.MathUtils.lerp(0, panAmount, easeProgress);
            const currentHeightBasedPan = THREE.MathUtils.lerp(0, heightBasedPanAmount, easeProgress);
            const totalCurrentPan = currentPanAmount + currentHeightBasedPan;
            
            // Pan אופקי - מתחיל עם הסיבוב האזימוטלי
            const currentHorizontalPan = THREE.MathUtils.lerp(0, horizontalPanAmount, azimuthalProgress);
            
            // עבור מוצרים גבוהים - pan ימינה נוסף (ערך קבוע ונפרד!)
            let tallProductRightPanCurrent = 0;
            if (productHeight > 180) {
                const tallHeightRatio = Math.min((productHeight - 180) / 100, 1);
                const tallRightPanAmount = tallHeightRatio * 30; // עד 30 יחידות ימינה
                tallProductRightPanCurrent = THREE.MathUtils.lerp(0, tallRightPanAmount, azimuthalProgress);
            }
            
            const cam = this.camera;
            const pan = new THREE.Vector3();
            pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), totalCurrentPan); // חיובי = למעלה (אנכי)
            pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), -currentHorizontalPan); // שלילי = שמאלה
            pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), tallProductRightPanCurrent); // חיובי = ימינה למוצרים גבוהים
            
            this.scene.position.copy(startScenePosition.clone().add(pan));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }
    
    // ממקם את המצלמה כך שכל המדפים והרגליים ייכנסו בפריים
    private frameAllShelves() {
        let totalY = 0;
        for (const shelf of this.shelves) {
            totalY += shelf.gap + this.frameHeight + this.beamHeight;
        }
        const height = totalY;
        const width = this.surfaceWidth;
        const depth = this.surfaceLength;
        // Simple camera positioning
        this.camera.position.set(width * 0.7, height * 0.8, depth * 1.2);
        this.camera.lookAt(0, 0, 0);
    }
    // יצירת קורות רגליים
    private createLegBeams(
        totalWidth: number,
        totalLength: number,
        frameWidth: number,
        frameHeight: number,
        topHeight: number,
        shelfBeamHeightParam: number = 0
    ): {
        x: number;
        y: number;
        z: number;
        width: number;
        height: number;
        depth: number;
    }[] {
        // קבלת מידות קורות הרגליים מהפרמטרים
        const legParam = this.getParam('leg');
        let legWidth = frameWidth;
        let legHeight = topHeight;
        let legDepth = frameWidth;
        if (
            legParam &&
            Array.isArray(legParam.beams) &&
            legParam.beams.length
        ) {
            const legBeam = legParam.beams[legParam.selectedBeamIndex || 0];
            if (legBeam) {
                legWidth = legBeam.width / 10; // המרה ממ"מ לס"מ
                legDepth = legBeam.height / 10; // המרה ממ"מ לס"מ
            }
        }
        // קבלת עובי קורות המדפים כדי לקצר את הרגליים
        // אם shelfBeamHeightParam מועבר, נשתמש בו (לארון)
        // אחרת נחשב אותו (לשולחן)
        let shelfBeamHeight = shelfBeamHeightParam || this.beamHeight;
        
        if (shelfBeamHeightParam === 0) {
            // עבור שולחן, נחשב את shelfBeamHeight
        let shelfsParam = null;
        if (this.isTable) {
            // עבור שולחן, נשתמש בפרמטר plata במקום shelfs
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
        } else {
            // עבור ארון, נשתמש בפרמטר shelfs
            shelfsParam = this.getParam('shelfs');
        }
            
        if (
            shelfsParam &&
            Array.isArray(shelfsParam.beams) &&
            shelfsParam.beams.length
        ) {
            const shelfBeam =
                shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
            if (shelfBeam) {
                this.debugLog(
                    'DEBUG - shelfBeam.height (raw):',
                    shelfBeam.height
                );
                this.debugLog(
                    'DEBUG - shelfBeam.height / 10:',
                    shelfBeam.height / 10
                );
                shelfBeamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                this.debugLog(
                    'DEBUG - shelfBeamHeight (final):',
                    shelfBeamHeight
                );
            }
        }
        }
        // עבור שולחן, הרגליים צריכות להיות בגובה המלא של השולחן פחות עובי הפלטה
        // המיקום שלהן ייקבע בקוד הראשי בהתבסס על גובה הפלטה
        this.debugLog('DEBUG - topHeight:', topHeight);
        this.debugLog('DEBUG - shelfBeamHeightParam:', shelfBeamHeightParam);
        legHeight = topHeight - shelfBeamHeight; // הרגל צריכה להיות בגובה המלא של השולחן פחות עובי הפלטה
        this.debugLog(
            'DEBUG - legHeight calculation:',
            topHeight - shelfBeamHeight,
            '(table height minus plata beam height)'
        );
        
        // לוגים לארון בלבד
        if (!this.isTable) {
            this.logCabinet('CHACK_CABINET - createLegBeams calculation:', {
                topHeight: topHeight,
                shelfBeamHeightParam: shelfBeamHeightParam,
                shelfBeamHeight: shelfBeamHeight,
                legHeight: legHeight,
                calculation: `${topHeight} - ${shelfBeamHeight} = ${legHeight}`
            });
        }
        // 4 פינות - מיקום צמוד לקצה בהתאם לעובי הרגל בפועל
        const xVals = [
            -totalWidth / 2 + legWidth / 2, // פינה שמאלית - צמודה לקצה
            totalWidth / 2 - legWidth / 2, // פינה ימנית - צמודה לקצה
        ];
        const zVals = [
            -totalLength / 2 + legDepth / 2, // פינה אחורית - צמודה לקצה
            totalLength / 2 - legDepth / 2, // פינה קדמית - צמודה לקצה
        ];
        const legs = [];
        for (const x of xVals) {
            for (const z of zVals) {
                legs.push({
                    x,
                    y: 0,
                    z,
                    width: legWidth,
                    height: legHeight,
                    depth: legDepth,
                });
            }
        }
        return legs;
    }
    // הוספת ברגים לקורות החיזוק התחתונות של שולחן (8 ברגים - 2 לכל רגל)
    private addScrewsToLowerFrameBeams(
        legPositions: any[],
        frameY: number,
        frameBeamHeight: number
    ) {
        this.debugLog('=== Adding screws to lower frame beams for table ===');
        this.debugLog('frameY (screw height):', frameY);
        this.debugLog('Number of legs:', legPositions.length);
        
        // קבלת מידות הרגל לחישוב אורך הבורג
        const legParam = this.getParam('leg');
        let legBeamWidth = frameBeamHeight;
        let legBeamHeight = frameBeamHeight;
        if (legParam && legParam.beams && legParam.beams.length > 0) {
            const selectedBeam = legParam.beams[legParam.selectedBeamIndex || 0];
            // המידות נמצאות ישירות ב-selectedBeam, לא ב-types
            if (selectedBeam) {
                legBeamWidth = selectedBeam.width / 10;
                legBeamHeight = selectedBeam.height / 10;
                this.debugLog(`📏 Lower frame - Leg beam dimensions: width=${legBeamWidth}, height=${legBeamHeight}`);
            }
        }
        
        // DUBBLE_LEG_SCREWS - Check if we need to duplicate screws for lower frame beams
        const dubbleThreshold = this.product?.restrictions?.find((r: any) => r.name === 'dubble-leg-screws-threshold')?.val;
        const shouldDuplicateScrews = dubbleThreshold && frameBeamHeight > dubbleThreshold;
        
        legPositions.forEach((leg, legIndex) => {
            const isEven = legIndex % 2 === 0;
            
            // 2 ברגים לכל רגל - אחד מכל צד חיצוני סמוך
            const screwPositions = [
                // בורג קדמי/אחורי (בציר Z)
                {
                    x: leg.x, // מרכז רוחב הרגל
                    y: frameY, // מרכז קורת החיזוק התחתונה
                    z: isEven
                        ? leg.z - (leg.depth / 2 + this.headHeight)
                        : leg.z + (leg.depth / 2 + this.headHeight), // צד חיצוני של הרגל
                },
                // בורג ימני/שמאלי (בציר X)
                {
                    x: leg.x + (leg.width / 2 + this.headHeight) * (legIndex > 1 ? 1 : -1), // צד חיצוני של הרגל
                    y: frameY, // מרכז קורת החיזוק התחתונה
                    z: (isEven
                        ? leg.z - (leg.depth / 2 + this.headHeight)
                        : leg.z + (leg.depth / 2 + this.headHeight)) +
                    (isEven ? 1 : -1) * (leg.depth / 2 + this.headHeight),
                },
            ];
            
            screwPositions.forEach((pos, screwIndex) => {
                // בורג 0 = מבוסס height (depth), בורג 1 = מבוסס width
                const screwType = screwIndex === 0 ? 'leg_height' : 'leg_width';
                // מעביר גם את שתי המידות כדי לבחור את המקסימום + 3
                const calculatedScrewLength = this.calculateScrewLength(
                    screwType, 
                    screwIndex === 0 ? legBeamHeight : legBeamWidth,
                    screwIndex === 0 ? legBeamWidth : legBeamHeight
                );
                
                // DUBBLE_LEG_SCREWS - Create screws based on condition for lower frame beams
                if (shouldDuplicateScrews) {
                    // Screw moved up by 25% of frameBeamHeight
                    const upOffset = frameBeamHeight * 0.25;
                    const upScrewGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                    upScrewGroup.position.set(pos.x, pos.y + upOffset, pos.z);
                    if (screwIndex === 0) {
                        upScrewGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                    } else {
                        upScrewGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                    }
                    this.scene.add(upScrewGroup);
                    this.beamMeshes.push(upScrewGroup);
                    this.debugLog(
                        `Lower Frame - Leg ${legIndex + 1}, Screw ${screwIndex + 1} UP: x=${pos.x.toFixed(1)}, y=${(pos.y + upOffset).toFixed(1)}, z=${pos.z.toFixed(1)}`
                    );
                    
                    // Screw duplicated down by 25% of frameBeamHeight
                    const downOffset = frameBeamHeight * 0.25;
                    const downScrewGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                    downScrewGroup.position.set(pos.x, pos.y - downOffset, pos.z);
                    if (screwIndex === 0) {
                        downScrewGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                    } else {
                        downScrewGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                    }
                    this.scene.add(downScrewGroup);
                    this.beamMeshes.push(downScrewGroup);
                    this.debugLog(
                        `Lower Frame - Leg ${legIndex + 1}, Screw ${screwIndex + 1} DOWN: x=${pos.x.toFixed(1)}, y=${(pos.y - downOffset).toFixed(1)}, z=${pos.z.toFixed(1)}`
                    );
                } else {
                    // Create original screw only if not duplicating
                    const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                    
                    // הברגים אופקיים ומיושרים כמו ברגי הרגליים הרגילים
                    screwGroup.position.set(pos.x, pos.y, pos.z);
                    if (screwIndex === 0) {
                        screwGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                    } else {
                        screwGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                    }
                    
                    this.scene.add(screwGroup);
                    this.beamMeshes.push(screwGroup);
                    
                    this.debugLog(
                        `Lower Frame - Leg ${legIndex + 1}, Screw ${screwIndex + 1}: x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}`
                    );
                }
            });
        });
    }
    
    // הוספת ברגים לרגליים
    private addScrewsToLegs(
        totalShelves: number,
        legPositions: any[],
        frameBeamHeight: number,
        shelfY: number,
        skipYFacingScrews: boolean = false
    ) {
        this.debugLog(
            'Adding screws to legs:',
            this.isTable ? 'table' : this.shelves
        );
        // לכל מדף, נוסיף ברגים לרגליים
        for (let shelfIndex = 0; shelfIndex < totalShelves; shelfIndex++) {
            let currentShelfY;
            if (this.isTable) {
                // עבור שולחן, הברגים צריכים להיות בגובה הרגליים פחות חצי ממידת הרוחב של קורת החיזוק
                const legParam = this.getParam('leg');
                let legWidth = frameBeamHeight; // ברירת מחדל
                if (
                    legParam &&
                    Array.isArray(legParam.beams) &&
                    legParam.beams.length
                ) {
                    const legBeam =
                        legParam.beams[legParam.selectedBeamIndex || 0];
                    if (legBeam) {
                        legWidth = legBeam.width / 10; // המרה ממ"מ לס"מ
                    }
                }
                const plataParam = this.getParam('plata');
                let plataBeamHeight = this.beamHeight; // ברירת מחדל
                if (
                    plataParam &&
                    Array.isArray(plataParam.beams) &&
                    plataParam.beams.length
                ) {
                    const plataBeam =
                        plataParam.beams[plataParam.selectedBeamIndex || 0];
                    if (plataBeam) {
                        plataBeamHeight = plataBeam.height / 10; // המרה ממ"מ לס"מ
                    }
                }
                // חישוב tableHeight כמו בפונקציה הראשית
                const heightParam = this.getParam('height');
                const baseTableHeight = heightParam ? heightParam.default : 80; // גובה ברירת מחדל
                const tableHeight = baseTableHeight - plataBeamHeight; // הפחתת גובה קורות הפלטה
                // חישוב frameBeamHeight כמו בפונקציה הראשית
                const frameParam = this.getParam('leg'); // עבור שולחן, frameParam הוא leg
                let calculatedFrameBeamHeight = this.frameHeight; // ברירת מחדל
                if (
                    frameParam &&
                    Array.isArray(frameParam.beams) &&
                    frameParam.beams.length
                ) {
                    const frameBeam =
                        frameParam.beams[frameParam.selectedBeamIndex || 0];
                    if (frameBeam) {
                        calculatedFrameBeamHeight = frameBeam.width / 10; // המרה ממ"מ לס"מ
                    }
                }
                // גובה הרגליים בפועל (לא גובה השולחן)
                const actualLegHeight = legPositions[0]
                    ? legPositions[0].height
                    : 0;
                // אותו חישוב כמו הברגים התחתונים, רק בלי totalDistance
                currentShelfY = tableHeight - calculatedFrameBeamHeight / 2; // גובה מרכז קורות החיזוק העליונות
                this.debugLog(
                    '=====================',
                    actualLegHeight,
                    legWidth,
                    plataBeamHeight
                );
                this.debugLog('Table screw calculation:', {
                    actualLegHeight,
                    legWidth,
                    currentShelfY,
                });
                this.debugLog(
                    'Previous calculation would be:',
                    actualLegHeight - legWidth / 2,
                    'New calculation:',
                    currentShelfY
                );
                this.debugLog('Leg positions for calculation:', legPositions[0]);
                // הוספת גובה קורות הפלטה
            } else {
                // עבור ארון, חישוב נכון של הגובה
                // קריאת גובה קורת המדף מהפרמטרים
                let beamHeightCorrect = this.beamHeight; // ברירת מחדל
                const shelfsParam = this.getParam('shelfs');
                if (shelfsParam && Array.isArray(shelfsParam.beams) && shelfsParam.beams.length) {
                    const shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                    if (shelfBeam) {
                        beamHeightCorrect = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                    }
                }
                
                // חישוב הקפיצה בין שכבה לשכבה
                // הקפיצה = שלב המדף (shelfGap) + רוחב קורת הרגל (frameBeamHeight) + גובה קורת המדף (beamHeightCorrect)
                let cumulativeY = 0;
                for (let i = 0; i <= shelfIndex; i++) {
                    const shelf = this.shelves[i];
                    cumulativeY += shelf.gap;
                    if (i < shelfIndex) {
                        cumulativeY += frameBeamHeight + beamHeightCorrect;
                    }
                }
                
                // הברגים צריכים להיות במרכז קורת החיזוק
                currentShelfY = cumulativeY + frameBeamHeight / 2;
                
            }
            legPositions.forEach((leg, legIndex) => {
                const isEven = legIndex % 2 === 0;
                
                // חישוב אורכי ברגים - בורג ראשון מבוסס depth (height), בורג שני מבוסס width
                const legParam = this.getParam('leg');
                let legBeamWidth = frameBeamHeight;
                let legBeamHeight = frameBeamHeight;
                if (legParam && legParam.beams && legParam.beams.length > 0) {
                    const selectedBeam = legParam.beams[legParam.selectedBeamIndex || 0];
                    // המידות נמצאות ישירות ב-selectedBeam, לא ב-types
                    if (selectedBeam) {
                        legBeamWidth = selectedBeam.width / 10;
                        legBeamHeight = selectedBeam.height / 10;
                        this.debugLog(`📏 Leg beam dimensions: width=${legBeamWidth}, height=${legBeamHeight}`);
                    }
                }
                
                // 2 ברגים לכל רגל (אחד לכל קורת חיזוק - קדמית ואחורית)
                const screwPositions = [
                    // בורג לקורת חיזוק קדמית
                    {
                        x: leg.x, // מרכז רוחב הרגל
                        y: currentShelfY, // מרכז קורת החיזוק
                        z: isEven
                            ? leg.z - (leg.depth / 2 + this.headHeight)
                            : leg.z + (leg.depth / 2 + this.headHeight), // צד חיצוני של הרגל (קדמי)
                    },
                    {
                        x:
                            leg.x +
                            (leg.width / 2 + this.headHeight) *
                                (legIndex > 1 ? 1 : -1), // מרכז רוחב הרגל
                        y: currentShelfY, // מרכז קורת החיזוק
                        z:
                            (isEven
                                ? leg.z - (leg.depth / 2 + this.headHeight)
                                : leg.z + (leg.depth / 2 + this.headHeight)) +
                            (isEven ? 1 : -1) *
                                (leg.depth / 2 + this.headHeight), // צד חיצוני של הרגל (קדמי)
                    },
                ];
                // DUBBLE_LEG_SCREWS - Check if we need to duplicate screws
                const dubbleThreshold = this.product?.restrictions?.find((r: any) => r.name === 'dubble-leg-screws-threshold')?.val;
                const shouldDuplicateScrews = dubbleThreshold && frameBeamHeight > dubbleThreshold;
                
                screwPositions.forEach((pos, screwIndex) => {
                    // Skip Y-facing screws (screwIndex=1) if skipYFacingScrews is true
                    if (skipYFacingScrews && screwIndex === 1) {
                        console.log(`CHECK_REMOVE_LEG_SCREWS_OUTSIDE - Skipping Y-facing screw (screwIndex=${screwIndex}) for leg ${legIndex + 1}, shelf ${shelfIndex + 1}`);
                        return; // Skip this screw
                    }
                    
                    // בורג 0 = מבוסס height (depth), בורג 1 = מבוסס width
                    const screwType = screwIndex === 0 ? 'leg_height' : 'leg_width';
                    // מעביר גם את שתי המידות כדי לבחור את המקסימום + 3
                    const calculatedScrewLength = this.calculateScrewLength(
                        screwType,
                        screwIndex === 0 ? legBeamHeight : legBeamWidth,
                        screwIndex === 0 ? legBeamWidth : legBeamHeight
                    );
                    
                    // DUBBLE_LEG_SCREWS - Create screws based on condition
                    if (shouldDuplicateScrews) {
                        // Screw moved up by 25% of frameBeamHeight
                        const upOffset = frameBeamHeight * 0.25;
                        const upScrewGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                        upScrewGroup.position.set(pos.x, pos.y + upOffset, pos.z);
                        if (screwIndex === 0) {
                            upScrewGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                        } else {
                            upScrewGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                        }
                        this.scene.add(upScrewGroup);
                        this.beamMeshes.push(upScrewGroup);
                        this.debugLog(
                            `Leg ${legIndex + 1}, Shelf ${shelfIndex + 1}, Screw ${screwIndex + 1} UP: x=${pos.x.toFixed(1)}, y=${(pos.y + upOffset).toFixed(1)}, z=${pos.z.toFixed(1)}`
                        );
                        
                        // Screw duplicated down by 25% of frameBeamHeight
                        const downOffset = frameBeamHeight * 0.25;
                        const downScrewGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                        downScrewGroup.position.set(pos.x, pos.y - downOffset, pos.z);
                        if (screwIndex === 0) {
                            downScrewGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                        } else {
                            downScrewGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                        }
                        this.scene.add(downScrewGroup);
                        this.beamMeshes.push(downScrewGroup);
                        this.debugLog(
                            `Leg ${legIndex + 1}, Shelf ${shelfIndex + 1}, Screw ${screwIndex + 1} DOWN: x=${pos.x.toFixed(1)}, y=${(pos.y - downOffset).toFixed(1)}, z=${pos.z.toFixed(1)}`
                        );
                    } else {
                        // Create original screw only if not duplicating
                    const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                    screwGroup.position.set(pos.x, pos.y, pos.z);
                    if (screwIndex === 0) {
                            screwGroup.rotation.y = (Math.PI / 2) * (isEven ? 1 : -1);
                    } else {
                        screwGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                    }
                    this.scene.add(screwGroup);
                    this.beamMeshes.push(screwGroup);
                    this.debugLog(
                        `Leg ${legIndex + 1}, Shelf ${shelfIndex + 1}, Screw ${screwIndex + 1}: x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}`
                    );
                    }
                });
            });
        }
    }
    private getShelfHeight(shelfIndex: number): number {
        if (this.isTable) {
            // עבור שולחן, הגובה הוא גובה השולחן
            const heightParam = this.getParam('height');
            return heightParam ? heightParam.default : 80;
        } else {
            // עבור ארון, הגובה הוא סכום כל המדפים עד המדף הנוכחי (כמו בקוד יצירת המודל התלת-ממדי)
            let currentY = 0;
            for (let i = 0; i <= shelfIndex; i++) {
                currentY += this.shelves[i].gap;
                if (i < shelfIndex) {
                    // לא המדף הנוכחי - מוסיפים את הגובה של המדף הקודם
                    currentY += this.frameHeight + this.beamHeight;
                }
            }
            // עבור המדף הנוכחי, הברגים צריכים להיות במרכז קורת החיזוק
            // קורת החיזוק נמצאת בגובה: currentY + frameHeight/2
            const result = currentY + this.frameHeight / 2;
            
            this.logCabinet('CHACK_CABINET - getShelfHeight calculation:', {
                shelfIndex: shelfIndex,
                currentY: currentY,
                frameHeight: this.frameHeight,
                beamHeight: this.beamHeight,
                result: result,
                calculation: `${currentY} + ${this.frameHeight}/2 = ${result}`,
                shelfGap: this.shelves[shelfIndex]?.gap,
                expectedY: shelfIndex === 0 ? this.shelves[0].gap : 
                          shelfIndex === 1 ? this.shelves[0].gap + this.frameHeight + this.beamHeight + this.shelves[1].gap :
                          this.shelves[0].gap + this.frameHeight + this.beamHeight + this.shelves[1].gap + this.frameHeight + this.beamHeight + this.shelves[2].gap
            });
            
            return result;
        }
    }
    // פרמטרים של הבורג (מידות אמיתיות)
    screwLength: number = 4.0; // 40 מ"מ = 4 ס"מ
    screwRadius: number = 0.1; // 1 מ"מ = 0.1 ס"מ (רדיוס הבורג)
    headHeight: number = 0.2; // 2 מ"מ = 0.2 ס"מ (גובה הראש)
    headRadius: number = 0.3; // 3 מ"מ = 0.3 ס"מ (רדיוס הראש)
    
    // מניעת לוגים חוזרים
    private lastDimensionsLogTime: number = 0;
    private lastCabinetLogTime: number = 0;
    
    // פונקציה עזר ללוגים עם מניעת חזרות
    private logDimensions(message: string, data?: any): void {
        const now = Date.now();
        if (!this.lastDimensionsLogTime || now - this.lastDimensionsLogTime > 1000) {
            if (data) {
            } else {
            }
        }
    }
    
    // פונקציה עזר ללוגים של הארון עם מניעת חזרות
    private logCabinet(message: string, data?: any): void {
        const now = Date.now();
        if (!this.lastCabinetLogTime || now - this.lastCabinetLogTime > 2000) { // כל 2 שניות
            this.lastCabinetLogTime = now;
            if (data) {
            } else {
            }
        }
    }
    // חישוב מידות המוצר הגולמיות (ללא פורמטינג)
    getProductDimensionsRaw(): {
        length: number;
        width: number;
        height: number;
        beamCount: number;
        gapBetweenBeams: number;
        shelfCount: number;
        shelfHeights: number[];
        totalScrews: number;
    } {
        // מניעת לוגים חוזרים - רק אם זה לא נקרא לאחרונה
        const now = Date.now();
        if (!this.lastDimensionsLogTime || now - this.lastDimensionsLogTime > 1000) { // רק כל שנייה
            this.lastDimensionsLogTime = now;
        }
        
        this.logDimensions('CHACK_DIM CALCULATION - Starting getProductDimensionsRaw');
        this.logDimensions('CHACK_DIM CALCULATION - Product type flags:', {
            isBelams: this.isBelams,
            isTable: this.isTable,
            isPlanter: this.isPlanter,
            isBox: this.isBox,
            isFuton: this.isFuton,
            productName: this.product?.name || 'Unknown'
        });
        
        // טיפול במוצר קורות לפי מידה
        if (this.isBelams) {
            this.logDimensions('CHACK_DIM CALCULATION - Processing BELAMS product');
            const belamsDimensions = this.getBelamsDimensionsRaw();
            this.logDimensions('CHACK_DIM CALCULATION - BELAMS dimensions result:', belamsDimensions);
            return belamsDimensions;
        }

        // רוחב כולל
        let totalWidth = this.surfaceWidth;
        // חישוב אורך כולל (totalLength) לפי סוג המוצר הנוכחי
        // נבנה totalLength בדומה ללוגיקה בהמשך הפונקציה כדי להדפיס לוג מדויק
        let totalLengthForLog = this.surfaceLength;
        try {
            // אם קיימת פונקציה או נתונים מחושבים לאחר מכן, ננסה לשמר התאמה
            // כברירת מחדל משתמשים ב-surfaceLength שנגזר מהפרמטרים המעודכנים
            if ((this as any).__emitReinforcementLogs && (this as any).__emitReinforcementLogs.emitLogs) {
                (this as any).__emitReinforcementLogs.emitLogs(totalLengthForLog);
            }
        } catch {}
        
        // CHACK_is-reinforcement-beams-outside - לוגים נדרשים עבור קורות רגל וקורות חיזוק
        try {
            const productName = this.product?.name || '';
            const isCabinet = productName === 'cabinet';
            const isTable = productName === 'table';
            
            // נתוני קורת רגל (a,b)
            let legWidthCm = 0;
            let legHeightCm = 0;
            const legParam = this.getParam ? this.getParam('leg') : this.product?.params?.find((p: any) => p.name === 'leg');
            if (legParam && Array.isArray(legParam.beams) && legParam.beams.length) {
                // ודא שיש selectedBeamIndex תקף; אם אין, נבחר ברירת מחדל יציבה
                let legBeamIdx: number;
                if (typeof legParam.selectedBeamIndex === 'number') {
                    legBeamIdx = legParam.selectedBeamIndex;
                } else if (typeof (this as any).findDefaultBeamIndex === 'function') {
                    try {
                        legBeamIdx = (this as any).findDefaultBeamIndex(legParam.beams, legParam.defaultType);
                    } catch {
                        legBeamIdx = 0;
                    }
                } else {
                    legBeamIdx = 0;
                }
                // אם אין מימדים על הבחירה, חפש קורה ראשונה עם width/height
                let legBeam = legParam.beams[legBeamIdx];
                if (!legBeam || (!legBeam.width && !legBeam.height)) {
                    const found = legParam.beams.find((b: any) => (b?.width || 0) > 0 && (b?.height || 0) > 0);
                    if (found) {
                        legBeam = found;
                    }
                }
                if (legBeam) {
                    legWidthCm = (legBeam.width || 0) / 10;
                    legHeightCm = (legBeam.height || 0) / 10;
                }
            }
            
            // נחשב גם את האורך הכולל (c) לאחר שמתקבל totalLength בהמשך
            const emitLogs = (totalLen: number) => {
                if (this.reinforcementLogPrinted) { return; }
                const title = 'CHACK_is-reinforcement-beams-outside';
                const product = isCabinet ? 'ארון' : (isTable ? 'שולחן' : (this.product?.translatedName || productName));
                // A - קורות רגל
                console.log(`${title} - A`, JSON.stringify({
                    product,
                    stage: 'A',
                    a_legProfileWidthCm: legWidthCm,
                    b_legProfileHeightCm: legHeightCm
                }, null, 2));
                // B - קורות חיזוק לרוחב; c - אורך קורת חיזוק לאורך המשטח
                console.log(`${title} - B`, JSON.stringify({
                    product,
                    stage: 'B',
                    c_reinforcementAlongLength_cm: totalLen
                }, null, 2));
                this.reinforcementLogPrinted = true;
            };
            // נשמור לפונקציה מקומית לשימוש בהמשך כשנחשב totalLength
            (this as any).__emitReinforcementLogs = { emitLogs, legWidthCm, legHeightCm };
        } catch {}
        // אורך כולל
        let totalLength = this.surfaceLength;
        // גובה כולל
        let totalHeight = 0;
        
        this.logDimensions('CHACK_DIM CALCULATION - Initial dimensions:', {
            surfaceWidth: this.surfaceWidth,
            surfaceLength: this.surfaceLength,
            totalWidth: totalWidth,
            totalLength: totalLength
        });
        
        if (this.isTable) {
            this.logDimensions('CHACK_DIM CALCULATION - Processing TABLE product');
            // עבור שולחן - הגובה הוא פשוט הפרמטר "גובה משטח" (כי כבר הורדנו את גובה קורות הפלטה)
            const heightParam = this.getParam('height');
            totalHeight = heightParam ? heightParam.default : 80; // ברירת מחדל 80 ס"מ
            
            this.logDimensions('CHACK_DIM CALCULATION - TABLE height calculation:', {
                heightParam: heightParam,
                heightParamDefault: heightParam?.default,
                totalHeight: totalHeight
            });
        } else if (this.isPlanter || this.isBox) {
            this.logDimensions('CHACK_DIM CALCULATION - Processing PLANTER/BOX product');
            // עבור עדנית - מידות מהפרמטרים
            const heightParam = this.getParam('height');
            const depthParam = this.getParam('depth');
            const widthParam = this.getParam('width');
            
            this.logDimensions('CHACK_DIM CALCULATION - PLANTER/BOX parameters:', {
                heightParam: heightParam,
                depthParam: depthParam,
                widthParam: widthParam,
                heightParamDefault: heightParam?.default,
                depthParamDefault: depthParam?.default,
                widthParamDefault: widthParam?.default
            });
            
            // החלפה בין width ו-depth כמו בתצוגה התלת מימדית
            const planterDepth = widthParam ? widthParam.default : 50;  // depth input -> planterDepth
            const planterWidth = depthParam ? depthParam.default : 40;  // width input -> planterWidth
            const planterHeight = heightParam ? heightParam.default : 50;
            
            this.logDimensions('CHACK_DIM CALCULATION - PLANTER/BOX dimension mapping:', {
                planterDepth: planterDepth,
                planterWidth: planterWidth,
                planterHeight: planterHeight
            });
            
            // חישוב גובה אמיתי לפי כמות הקורות
            const beamParam = this.getParam('beam');
            let beamWidth = 10; // ברירת מחדל
            if (beamParam && beamParam.beams && beamParam.beams.length > 0) {
                const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex || 0];
                if (selectedBeam) {
                    beamWidth = selectedBeam.width / 10; // המרה ממ"מ לס"מ
                }
            }
            const beamsInHeight = Math.floor(planterHeight / beamWidth);
            const actualHeight = beamsInHeight * beamWidth; // גובה אמיתי = כמות קורות * רוחב קורה
            
            this.logDimensions('CHACK_DIM CALCULATION - PLANTER/BOX height calculation:', {
                beamParam: beamParam,
                beamWidth: beamWidth,
                planterHeight: planterHeight,
                beamsInHeight: beamsInHeight,
                actualHeight: actualHeight
            });
            
            // חישוב גובה הקורה לרצפה
            let beamHeight = 2.5; // ברירת מחדל
            if (beamParam && beamParam.beams && beamParam.beams.length > 0) {
                const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex || 0];
                if (selectedBeam) {
                    beamHeight = selectedBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            totalWidth = planterDepth;  // תיקון: planterDepth -> totalWidth
            totalLength = planterWidth; // תיקון: planterWidth -> totalLength
            
            // אם יש מכסה, הגובה הכולל צריך לכלול גם את עובי רצפת המכסה
            const isCoverParam = this.getParam('isCover');
            const hasCover = this.isBox && isCoverParam && isCoverParam.default === true;
            
            totalHeight = actualHeight + beamHeight + (hasCover ? beamHeight : 0); // גובה אמיתי + גובה הריצפה + גובה מכסה (אם יש)
        } else if (this.isFuton) {
            // עבור בסיס מיטה - דומה לשולחן
            const widthParam = this.getParam('width');
            const depthParam = this.getParam('depth');
            const legParam = this.getParam('leg');
            const extraBeamParam = this.getParam('extraBeam');
            
            totalWidth = depthParam ? depthParam.default : 200;  // החלפה: width = depth
            totalLength = widthParam ? widthParam.default : 120;  // החלפה: length = width
            
            // חישוב גובה - רוחב קורת הרגל + גובה קורת הפלטה
            let legBeamWidth = 5; // ברירת מחדל
            let legBeamHeight = 5; // ברירת מחדל
            let plataBeamHeight = 2.5; // ברירת מחדל
            
            if (legParam && legParam.beams && legParam.beams.length > 0) {
                const legBeam = legParam.beams[legParam.selectedBeamIndex || 0];
                if (legBeam) {
                    legBeamWidth = legBeam.width / 10; // המרה ממ"מ לס"מ
                    legBeamHeight = legBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            const plataParam = this.getParam('plata');
            if (plataParam && plataParam.beams && plataParam.beams.length > 0) {
                const plataBeam = plataParam.beams[plataParam.selectedBeamIndex || 0];
                if (plataBeam) {
                    plataBeamHeight = plataBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            
            // חישוב גובה כולל - גובה הרגליים + גובה הפלטה
            totalHeight = legBeamHeight + plataBeamHeight;
            
            this.logDimensions('CHACK_DIM CALCULATION - FUTON height calculation:', {
                legBeamWidth: legBeamWidth,
                legBeamHeight: legBeamHeight,
                plataBeamHeight: plataBeamHeight,
                totalHeight: totalHeight,
                calculation: `${legBeamHeight} + ${plataBeamHeight} = ${totalHeight}`
            });
        } else {
            this.logDimensions('CHACK_DIM CALCULATION - Processing CABINET product');
            // עבור ארון - חישוב זהה לחישוב הרגליים בפונקציה updateBeams
            // חישוב frameBeamHeight - זהה לחישוב בפונקציה updateBeams
            let frameBeamHeight = this.frameHeight;
            const frameParam = this.params.find(
                (p) => p.type === 'beamSingle' && p.name !== 'shelfs'
            );
            
            this.logDimensions('CHACK_DIM CALCULATION - CABINET frame calculation:', {
                frameHeight: this.frameHeight,
                frameParam: frameParam,
                frameBeamHeight: frameBeamHeight
            });
            if (
                frameParam &&
                Array.isArray(frameParam.beams) &&
                frameParam.beams.length
            ) {
                const frameBeam =
                    frameParam.beams[frameParam.selectedBeamIndex || 0];
                if (frameBeam) {
                    // החלפה: width של הפרמטר הופך ל-height של הקורה - זהה לחישוב בפונקציה updateBeams
                    frameBeamHeight = frameBeam.width / 10; // המרה ממ"מ לס"מ
                }
            }
            // חישוב beamHeight האמיתי מקורת המדף שנבחרה
            let beamHeight = this.beamHeight; // ברירת מחדל
            const shelfsParam = this.getParam('shelfs');
            if (
                shelfsParam &&
                Array.isArray(shelfsParam.beams) &&
                shelfsParam.beams.length
            ) {
                const shelfBeam =
                    shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    beamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            // חישוב totalY לפי הנוסחה: S + ((J + K) * N)
            // S = סכום כל ה-gaps
            // J = frameBeamHeight (גובה קורת החיזוק)
            // K = beamHeight (גובה קורת המדף)
            // N = כמות המדפים
            const S = this.shelves.reduce((sum, shelf) => sum + shelf.gap, 0);
            const J = frameBeamHeight;
            const K = beamHeight;
            const N = this.shelves.length;
            const totalY = S + ((J + K) * N);
            // חישוב shelfBeamHeight - זהה לחישוב בפונקציה createLegBeams
            let shelfBeamHeight = this.beamHeight;
            if (
                shelfsParam &&
                Array.isArray(shelfsParam.beams) &&
                shelfsParam.beams.length
            ) {
                const shelfBeam =
                    shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
                if (shelfBeam) {
                    shelfBeamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                }
            }
            // הגובה הכולל = totalY (כי totalY כבר מחושב נכון לפי הנוסחה: S + ((J + K) * N))
            totalHeight = totalY;
            
            this.logCabinet('CHACK_CABINET - getProductDimensionsRaw calculation:', {
                S: S,
                J: J,
                K: K,
                N: N,
                totalY: totalY,
                shelfBeamHeight: shelfBeamHeight,
                totalHeight: totalHeight,
                calculation: `S + ((J + K) * N) = ${S} + ((${J} + ${K}) * ${N}) = ${S} + (${J + K} * ${N}) = ${S} + ${(J + K) * N} = ${totalY}`,
                shelves: this.shelves.map(s => ({ gap: s.gap })),
                frameBeamHeight: frameBeamHeight,
                beamHeight: beamHeight
            });
            
            this.logDimensions('CHACK_DIM CALCULATION - CABINET final height calculation:', {
                totalY: totalY,
                shelfBeamHeight: shelfBeamHeight,
                totalHeight: totalHeight,
                calculation: `${totalY} + ${shelfBeamHeight} = ${totalHeight}`
            });
        }
        // חישוב כמות קורות המדף
        const beamWidth = this.beamWidth;
        const minGap = this.minGap;
        const beamCount = Math.floor(
            (totalWidth + minGap) / (beamWidth + minGap)
        );
        // חישוב רווח בין קורות המדף
        let gapBetweenBeams = 0;
        if (beamCount > 1) {
            // (רוחב כולל - כמות קורות × רוחב קורה) / (כמות קורות - 1)
            gapBetweenBeams =
                (totalWidth - beamCount * beamWidth) / (beamCount - 1);
        }
        // כמות המדפים
        const shelfCount = this.shelves.length;
        // גבהי המדפים (רשימה של מספרים)
        const shelfHeights: number[] = [];
        for (let i = 0; i < this.shelves.length; i++) {
            const shelfHeight = this.getShelfHeight(i);
            shelfHeights.push(shelfHeight);
        }
        // חישוב כמות ברגים כוללת
        let totalScrews = 0;
        // ברגים לקורות המדפים
        for (let i = 0; i < this.shelves.length; i++) {
            const isShortenedBeam =
                (i === 0 || i === this.shelves.length - 1) &&
                this.shelves.length > 1;
            const screwsPerBeam = isShortenedBeam ? 2 : 4; // 2 ברגים לקורות מקוצרות, 4 לקורות רגילות
            totalScrews += beamCount * screwsPerBeam;
        }
        // ברגים לרגליים (2 ברגים לכל רגל לכל מדף)
        const legScrews = this.shelves.length * 4 * 2; // 4 רגליים × 2 ברגים לכל מדף
        totalScrews += legScrews;
        const result = {
            length: totalLength,
            width: totalWidth,
            height: totalHeight,
            beamCount: beamCount,
            gapBetweenBeams: gapBetweenBeams,
            shelfCount: shelfCount,
            shelfHeights: shelfHeights,
            totalScrews: totalScrews,
        };
        
        this.logDimensions('CHACK_DIM CALCULATION - Final result:', {
            result: result,
            productName: this.product?.name || 'Unknown',
            productType: this.product?.model || 'Unknown'
        });
        
        return result;
    }
    // חישוב מידות המוצר הסופי (עם פורמטינג טקסטואלי)
    getProductDimensions(): {
        length: string;
        width: string;
        height: string;
        beamCount: string;
        gapBetweenBeams: string;
        shelfCount: string;
        shelfHeights: string;
        totalScrews: string;
    } {
        const rawDimensions = this.getProductDimensionsRaw();
        // גבהי המדפים (רשימה מופרדת בפסיקים, מלמעלה למטה)
        const shelfHeightsList: string[] = [];
        for (let i = 0; i < rawDimensions.shelfHeights.length; i++) {
            shelfHeightsList.push(
                `${this.formatNumber(rawDimensions.shelfHeights[i])} <small>ס"מ</small>`
            );
        }
        const shelfHeights = shelfHeightsList.join(', ');
        return {
            length: `${this.formatNumber(rawDimensions.length)} <small>ס"מ</small>`,
            width: `${this.formatNumber(rawDimensions.width)} <small>ס"מ</small>`,
            height: `${this.formatNumber(rawDimensions.height)} <small>ס"מ</small>`,
            beamCount: `${rawDimensions.beamCount} <small>קורות</small>`,
            gapBetweenBeams: `${this.formatNumber(rawDimensions.gapBetweenBeams)} <small>ס"מ</small>`,
            shelfCount: `${rawDimensions.shelfCount} <small>מדפים</small>`,
            shelfHeights: shelfHeights,
            totalScrews: `${rawDimensions.totalScrews} <small>ברגים</small>`,
        };
    }
    // פונקציה עזר להצגת מספרים ללא .0 אם הם שלמים
    private formatNumber(value: number): string {
        return value % 1 === 0 ? value.toString() : value.toFixed(1);
    }
    // פונקציה לקביעת יחידות לפי סוג הפרמטר
    getUnitForParameter(param: any): string {
        if (
            param.type === 'length' ||
            param.type === 'width' ||
            param.type === 'height'
        ) {
            return 'ס"מ';
        } else if (param.type === 'gap' || param.type === 'shelfHeight') {
            return 'ס"מ';
        } else if (param.type === 'beamCount') {
            return "יח'";
        } else if (param.type === 'shelfCount') {
            return "יח'";
        } else {
            return 'ס"מ';
        }
    }
    // יצירת גיאומטריית בורג אופקי (להרגליים)
    private createHorizontalScrewGeometry(screwLength?: number): THREE.Group {
        const screwGroup = new THREE.Group();
        // פרמטרים של הבורג (מידות אמיתיות)
        // אם לא סופק אורך, נשתמש באורך ברירת המחדל
        const actualScrewLength = screwLength || this.screwLength;
        // יצירת גוף הבורג (צינור צר) - אופקי
        const screwGeometry = new THREE.CylinderGeometry(
            this.screwRadius,
            this.screwRadius,
            actualScrewLength,
            8
        );
        const screwMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
        }); // אפור מתכתי
        const screwMesh = new THREE.Mesh(screwGeometry, screwMaterial);
        screwMesh.rotation.z = Math.PI / 2; // סיבוב לרוחב
        screwMesh.position.x = -actualScrewLength / 2; // מרכז את הבורג
        screwGroup.add(screwMesh);
        // יצירת ראש הבורג (גליל נפרד) - בחלק הקדמי של הבורג
        const headGeometry = new THREE.CylinderGeometry(
            this.headRadius,
            this.headRadius,
            this.headHeight,
            8
        );
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
        }); // כהה יותר
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        headMesh.rotation.z = Math.PI / 2; // סיבוב לרוחב
        headMesh.position.x = -this.headHeight / 2; // ראש בחלק הקדמי של הבורג
        screwGroup.add(headMesh);
        return screwGroup;
    }
    // יצירת גיאומטריית בורג
    private createScrewGeometry(screwLength?: number): THREE.Group {
        const screwGroup = new THREE.Group();
        // פרמטרים של הבורג (מידות אמיתיות)
        // אם לא סופק אורך, נשתמש באורך ברירת המחדל
        const actualScrewLength = screwLength || this.screwLength;
        // יצירת גוף הבורג (צינור צר)
        const screwGeometry = new THREE.CylinderGeometry(
            this.screwRadius,
            this.screwRadius,
            actualScrewLength,
            8
        );
        const screwMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
        }); // כמעט שחור
        const screwMesh = new THREE.Mesh(screwGeometry, screwMaterial);
        screwMesh.position.y = -actualScrewLength / 2; // מרכז את הבורג
        screwGroup.add(screwMesh);
        // יצירת ראש הבורג (גליל נפרד) - בחלק העליון של הבורג
        const headGeometry = new THREE.CylinderGeometry(
            this.headRadius,
            this.headRadius,
            this.headHeight,
            8
        );
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
        }); // צבע בהיר יותר לראש
        const headMesh = new THREE.Mesh(headGeometry, headMaterial);
        headMesh.position.y = this.headHeight / 2; // ראש בחלק העליון של הבורג
        screwGroup.add(headMesh);
        // ביטול החריצים - אין צורך בהם
        return screwGroup;
    }
    // הוספת ברגים לקורת מדף
    private addScrewsToShelfBeam(
        beam: any,
        shelfY: number,
        beamHeight: number,
        frameBeamWidth: number,
        isShortenedBeam: string = 'top'
    ) {
        // חישוב אורך הבורג לפי סוג הבורג והמידות
        const calculatedScrewLength = this.calculateScrewLength('shelf', beamHeight);
        
        // חישוב מיקומי הברגים
        // הזחה מהקצוות: מחצית ממידת ה-height של קורת החיזוק
        const edgeOffset = frameBeamWidth / 2;
        // הזחה כלפי פנים: רבע ממידת ה-width של קורת המדף
        const inwardOffset =
            beam.width / 4 > this.frameWidth / 2
                ? beam.width / 4
                : this.frameWidth / 2;
        // קורות המדפים נטענות ב-z=0 (במרכז)
        const beamZ = 0;
        // אם רוחב הקורה קטן או שווה ל-4, יצור בורג אחד במרכז של כל צד
        let screwPositions;
        if (beam.width <= 4) {
            screwPositions = [
                // בורג במרכז הצד הקדמי
                {
                    x: beam.x, // במרכז הרוחב
                    z: beamZ - beam.depth / 2 + edgeOffset, // במרכז הצד הקדמי
                },
                // בורג במרכז הצד האחורי
                {
                    x: beam.x, // במרכז הרוחב
                    z: beamZ + beam.depth / 2 - edgeOffset, // במרכז הצד האחורי
                },
            ];
        } else {
            // רוחב הקורה גדול מ-4 - יצור 4 ברגים בפינות (הלוגיקה הקיימת)
            screwPositions = [
            // פינה שמאלית קדמית
            {
                x: beam.x - beam.width / 2 + inwardOffset,
                    z: beamZ - beam.depth / 2 + edgeOffset,
            },
            // פינה ימנית קדמית
            {
                x: beam.x + beam.width / 2 - inwardOffset,
                    z: beamZ - beam.depth / 2 + edgeOffset,
            },
            // פינה שמאלית אחורית
            {
                x: beam.x - beam.width / 2 + inwardOffset,
                    z: beamZ + beam.depth / 2 - edgeOffset,
            },
            // פינה ימנית אחורית
            {
                x: beam.x + beam.width / 2 - inwardOffset,
                    z: beamZ + beam.depth / 2 - edgeOffset,
                },
            ];
        }
        // אם הקורה מקוצרת, השתמש בלוגיקה הישנה (4 ברגים בפינות)
        if (isShortenedBeam !== 'top') {
            // לקורות מקוצרות, תמיד השתמש בלוגיקה הישנה של 4 ברגים בפינות
            screwPositions = [
                // פינה שמאלית קדמית
                {
                    x: beam.x - beam.width / 2 + inwardOffset,
                    z: beamZ - beam.depth / 2 + edgeOffset,
                },
                // פינה ימנית קדמית
                {
                    x: beam.x + beam.width / 2 - inwardOffset,
                    z: beamZ - beam.depth / 2 + edgeOffset,
                },
                // פינה שמאלית אחורית
                {
                    x: beam.x - beam.width / 2 + inwardOffset,
                    z: beamZ + beam.depth / 2 - edgeOffset,
                },
                // פינה ימנית אחורית
                {
                    x: beam.x + beam.width / 2 - inwardOffset,
                    z: beamZ + beam.depth / 2 - edgeOffset,
                },
            ];
            // הסר את הברגים הראשון והשלישי (אינדקסים 0 ו-2)
            if (isShortenedBeam === 'start') {
                screwPositions = screwPositions.filter(
                    (pos, index) => index !== 1 && index !== 3
                );
            } else {
                screwPositions = screwPositions.filter(
                    (pos, index) => index !== 0 && index !== 2
                );
            }
            // רק לקורות רחבות (>4) נבצע את החישוב המתקדם של מיקומי הברגים
            const startPositions = screwPositions[0];
            const endPositions = screwPositions[1];

                // חישוב הפרמטרים לפי הלוגיקה החדשה
                const A = this.surfaceWidth / 2; // הרוחב הכולל של הארון חלקי 2
                const X = this.frameHeight; // frameBeamHeight
                const Y = frameBeamWidth; // המידה השנייה של קורת הרגל (לא frameBeamHeight)
                const Q = beam.width; // beam.width

                // חישוב Z ו-R ו-L
                const Z = (X - Y) / 2;
                const R = (Q - Z) / 2;
                const L = R + Z;

                // המרחק הסופי של הברגים מהמרכז
                let finalDistance;
                if (Q > X) {
                    // מקרה קצה: Q > X
                    finalDistance = A - X / 2;
                } else {
                    // מקרה רגיל: Q <= X
                    finalDistance = A - L;
                }

                // חישוב הרווח מהקצה השמאלי של הקורה לבורג השמאלי
                const leftEdgeX = beam.x - beam.width / 2;
                const rightEdgeX = beam.x + beam.width / 2;
                const leftScrewX = Math.min(startPositions.x, endPositions.x);
                const rightScrewX = Math.max(startPositions.x, endPositions.x);
                const leftGap = leftScrewX - leftEdgeX;
                const rightGap = rightEdgeX - rightScrewX;
            // create 2 new positions between start and end - 1/3 from start and 2/3 from end and the opposite
                // חישוב המיקומים החדשים של כל הברגים לפי המרחק הסופי מהמרכז
                const adjustedStartPositions = {
                    x: startPositions.x > 0 ? finalDistance : -finalDistance,
                    z: startPositions.z,
                };
                const adjustedEndPositions = {
                    x: endPositions.x > 0 ? finalDistance : -finalDistance,
                    z: endPositions.z,
                };

                this.debugLog(
                    'CHECKSCREWS adjustedStartPositions:',
                    adjustedStartPositions
                );
                this.debugLog(
                    'CHECKSCREWS adjustedEndPositions:',
                    adjustedEndPositions
                );

           const newPosition = [
                {
                        x:
                            adjustedStartPositions.x +
                            (adjustedEndPositions.x -
                                adjustedStartPositions.x) /
                                3,
                        z:
                            adjustedStartPositions.z +
                            (adjustedEndPositions.z -
                                adjustedStartPositions.z) /
                                3,
                    },
                    {
                        x:
                            adjustedStartPositions.x +
                            (2 *
                                (adjustedEndPositions.x -
                                    adjustedStartPositions.x)) /
                                3,
                        z:
                            adjustedStartPositions.z +
                            (2 *
                                (adjustedEndPositions.z -
                                    adjustedStartPositions.z)) /
                                3,
                    },
                ];
                // עדכון screwPositions עם כל הברגים המוזחים
                screwPositions = [
                    ...newPosition,
                    adjustedStartPositions,
                    adjustedEndPositions,
                ];
        }
        // יצירת ברגים
        screwPositions.forEach((pos, index) => {
            const screwGroup = this.createScrewGeometry(calculatedScrewLength);
            // הבורג צריך להיות כך שהראש שלו נוגע בקורה
            // הבורג לא מסובב, אז הראש נמצא ב-(screwLength/2 + headHeight/2) מהמרכז
            // כדי שהראש יהיה על הקורה, המרכז צריך להיות מתחת לקורה ב-(screwLength/2 + headHeight/2)
            // הורדה נוספת של 20 מ"מ כלפי מטה
            const headHeight = 0.2; // 2 מ"מ
            const screwLength = 4.0; // 40 מ"מ
            const screwY = shelfY + beamHeight; // הורדה של 20 מ"מ + 100 לראות את הברגים
            // מיקום הבורג: החלק התחתון של הראש על הקורה, מופנה כלפי מטה
            screwGroup.position.set(pos.x, screwY, pos.z);
            // הבורג כבר מופנה כלפי מטה - אין צורך בסיבוב
            // screwGroup.rotation.x = Math.PI;
            this.scene.add(screwGroup);
            this.beamMeshes.push(screwGroup);
        });
    }
    
    // פונקציות לניהול כמות יחידות
    increaseQuantity() {
        this.quantity++;
        this.calculatePricing(); // עדכון המחיר
    }
    
    decreaseQuantity() {
        if (this.quantity > 1) {
            this.quantity--;
            this.calculatePricing(); // עדכון המחיר
        }
    }
    
    onQuantityChange(event: any) {
        const value = parseInt(event.target.value);
        if (!isNaN(value) && value >= 1) {
            this.quantity = value;
        } else if (value < 1) {
            this.quantity = 1;
        }
        this.calculatePricing(); // עדכון המחיר
    }
    
    // פונקציות לניהול אופציות תמחור
    selectPricingOption(option: 'cut' | 'full' | 'plan') {
        this.debugLog('=== selectPricingOption נקרא ===');
        this.debugLog('option:', option);
        this.debugLog('selectedPricingOption לפני:', this.selectedPricingOption);
        
        this.selectedPricingOption = option;
        
        this.debugLog('selectedPricingOption אחרי:', this.selectedPricingOption);
        this.debugLog('=== selectPricingOption הסתיים ===');
    }
    
    // פונקציות לניהול הטוגלים החדשים
    toggleBeamsOption() {
        this.isBeamsEnabled = !this.isBeamsEnabled;
        if (!this.isBeamsEnabled) {
            this.isCuttingEnabled = false; // אם קורות כבויות, גם חיתוך כבוי
            this.showBeamsEditOptions = false; // סגירת איזור עריכת קורות
        } else {
            // אם מחזירים קורות, מפעילים גם חיתוך ומחזירים למצב המקורי
            this.isCuttingEnabled = true;
            this.resetBeamsToOriginalState();
        }
        // לא קוראים ל-calculatePricing() - רק משנים את המצב
    }
    
    toggleCuttingOption() {
        this.isCuttingEnabled = !this.isCuttingEnabled;
        // לא קוראים ל-calculatePricing() - רק משנים את המצב
    }
    
    toggleScrewsOption() {
        this.isScrewsEnabled = !this.isScrewsEnabled;
        if (!this.isScrewsEnabled) {
            this.showScrewsEditOptions = false; // סגירת איזור עריכת ברגים
        } else {
            // אם מחזירים ברגים, מחזירים למצב המקורי
            this.resetScrewsToOriginalState();
        }
        // לא קוראים ל-calculatePricing() - רק משנים את המצב
    }
    
    // החזרת קורות למצב המקורי
    private resetBeamsToOriginalState() {
        if (!this.originalBeamsData || !this.BeamsDataForPricing) {
            return;
        }
        
        
        // מחזיר את הכמויות למצב המקורי
        for (let i = 0; i < this.BeamsDataForPricing.length; i++) {
            const currentBeam = this.BeamsDataForPricing[i];
            const originalBeam = this.originalBeamsData[i];
            
            if (originalBeam && currentBeam) {
                // מחזיר את הכמויות המקוריות
                currentBeam.totalSizes = JSON.parse(JSON.stringify(originalBeam.totalSizes));
            }
        }
        
        // מחזיר את cuttingPlan למצב המקורי (ללא חישוב מחדש)
        // צריך לשחזר את cuttingPlan על בסיס הכמויות המקוריות
        this.restoreOriginalCuttingPlan();
        
        // עדכון סטטוס החיתוך - עכשיו שהוא חזר למקור, החיתוך אפשרי
        this.isCuttingPossible = true;
        
        // איפוס מחירים דינמיים
        this.dynamicBeamsPrice = this.originalBeamsPrice;
        this.hasBeamsChanged = false;
        
    }
    
    // שחזור cuttingPlan למצב המקורי (ללא חישוב מחדש)
    private restoreOriginalCuttingPlan() {
        if (!this.originalBeamsData || !this.BeamsDataForPricing) {
            return;
        }
        
        
        // ניקוי cuttingPlan הנוכחי
        this.cuttingPlan = [];
        
        // שחזור cuttingPlan על בסיס הכמויות המקוריות
        for (let i = 0; i < this.BeamsDataForPricing.length; i++) {
            const currentBeam = this.BeamsDataForPricing[i];
            const originalQuantity = this.originalBeamQuantities[i];
            
            if (originalQuantity > 0 && currentBeam) {
                // חישוב אורך הקורה המקורי
                const beamLength = this.getBeamLengthInMeters(currentBeam);
                const beamPrice = this.getBeamPrice(currentBeam);
                
                // הוספת הקורות ל-cuttingPlan
                for (let j = 0; j < originalQuantity; j++) {
                    this.cuttingPlan.push({
                        beamType: currentBeam.beamTranslatedName,
                        beamLength: beamLength,
                        beamPrice: beamPrice,
                        beamId: `${currentBeam.beamTranslatedName}_${j}`
                    });
                }
            }
        }
        
    }
    
    // החזרת ברגים למצב המקורי
    private resetScrewsToOriginalState() {
        if (!this.originalScrewsData || !this.screwsPackagingPlan) {
            return;
        }
        
        for (let i = 0; i < this.screwsPackagingPlan.length; i++) {
            const currentScrew = this.screwsPackagingPlan[i];
            const originalScrew = this.originalScrewsData[i];
            
            if (originalScrew && currentScrew) {
                // מחזיר את הכמויות המקוריות
                currentScrew.numPackages = originalScrew.numPackages;
            }
        }
        
        this.dynamicScrewsPrice = this.originalScrewsPrice;
        this.hasScrewsChanged = false;
    }
    
    // פונקציה לקבלת מחיר ברגים
    getScrewsPrice(): number {
        // אם יש מחיר דינמי (לא 0) - החזר אותו, אחרת חשב מהתכנית
        if (this.dynamicScrewsPrice !== 0) {
            return this.dynamicScrewsPrice;
        }
        if (!this.screwsPackagingPlan || this.screwsPackagingPlan.length === 0) {
            return 0;
        }
        return this.screwsPackagingPlan.reduce((total, screwPackage) => total + (screwPackage.totalPrice || 0), 0);
    }
    
    
    // קבלת שם האופציה הנבחרת
    getPricingOptionName(): string {
        // אם רק שרטוט
        if (!this.isBeamsEnabled && !this.isScrewsEnabled) {
            return 'שרטוט בלבד';
        }
        
        // אם קורות חתוכות וברגים
        if (this.isBeamsEnabled && this.isCuttingEnabled && this.isScrewsEnabled) {
            return 'קורות חתוכות וברגים';
        }
        
        // אם קורות לא חתוכות וברגים
        if (this.isBeamsEnabled && !this.isCuttingEnabled && this.isScrewsEnabled) {
            return 'קורות, הוראות וברגים';
        }
        
        // אם קורות חתוכות בלי ברגים
        if (this.isBeamsEnabled && this.isCuttingEnabled && !this.isScrewsEnabled) {
            return 'קורות חתוכות';
        }
        
        // אם קורות לא חתוכות בלי ברגים
        if (this.isBeamsEnabled && !this.isCuttingEnabled && !this.isScrewsEnabled) {
            return 'קורות והוראות';
        }
        
        // אם רק ברגים
        if (!this.isBeamsEnabled && this.isScrewsEnabled) {
            return 'הוראות וברגים';
        }
        
        return 'הוראות';
    }
    
    // פונקציה לטיפול בלחיצה על הוראות (מנדטוריות)
    onInstructionsClick(event: Event): void {
        event.stopPropagation();
        // הצגת הודעהאפבאר
        this.snackBar.open('לא ניתן לבטל הוראות חיתוך והרכבה', '', {
            duration: 3000,
            horizontalPosition: 'center',
            verticalPosition: 'top',
            panelClass: ['custom-snackbar']
        });
    }
    
    // קבלת שם קצר לאופציות הנבחרות למצב מצומצם
    getPricingOptionShortName(): string {
        // אם רק שרטוט
        if (!this.isBeamsEnabled && !this.isScrewsEnabled) {
            return 'שרטוט בלבד';
        }
        
        // אם קורות חתוכות וברגים
        if (this.isBeamsEnabled && this.isCuttingEnabled && this.isScrewsEnabled) {
            return 'קורות חתוכות וברגים';
        }
        
        // אם קורות לא חתוכות וברגים
        if (this.isBeamsEnabled && !this.isCuttingEnabled && this.isScrewsEnabled) {
            return 'קורות, הוראות וברגים';
        }
        
        // אם קורות חתוכות בלי ברגים
        if (this.isBeamsEnabled && this.isCuttingEnabled && !this.isScrewsEnabled) {
            return 'קורות חתוכות';
        }
        
        // אם קורות לא חתוכות בלי ברגים
        if (this.isBeamsEnabled && !this.isCuttingEnabled && !this.isScrewsEnabled) {
            return 'קורות והוראות';
        }
        
        // אם רק ברגים
        if (!this.isBeamsEnabled && this.isScrewsEnabled) {
            return 'הוראות וברגים';
        }
        
        return 'הוראות';
    }
    
    // קבלת מפתח תרגום לאופציות הנבחרות
    getPricingOptionShortLabel(): string {
        // עבור התפריט החדש, נחזיר מפתח קבוע
        return 'custom_pricing_selection';
    }

    
    // חישוב מחיר קורות (ללא חיתוך)
    getBeamsOnlyPrice(): number {
        // אם יש מחיר דינמי (לא 0) - החזר אותו, אחרת חשב מהתכנית
        if (this.dynamicBeamsPrice !== 0) {
            return this.dynamicBeamsPrice;
        }
        const price = this.cuttingPlan.reduce((sum, beam) => sum + beam.beamPrice, 0);
        return Math.round(price * 100) / 100;
    }
    
    // חישוב מחיר חיתוכים
    getCuttingPrice(): number {
        // אם יש מחיר דינמי (לא 0) - החזר אותו, אחרת חשב מהתכנית
        if (this.dynamicCuttingPrice !== 0) {
            return this.dynamicCuttingPrice;
        }
        const price = this.cuttingPlan.reduce((sum, beam) => sum + (beam.totalCuttingPrice || 0), 0);
        return Math.round(price * 100) / 100;
    }
    
    // קבלת מחיר החיתוך המקורי
    getOriginalCuttingPrice(): number {
        return this.originalCuttingPrice || 0;
    }
    
    // חישוב המחיר הסופי לפי הטוגלים החדשים
    getFinalPrice(): number {
        let finalPrice = 0;
        
        // הוראות חיתוך והרכבה - תמיד כלולות (חובה)
        finalPrice += this.drawingPrice;
        
        // קורות - רק אם מופעלות
        if (this.isBeamsEnabled) {
            finalPrice += this.getBeamsOnlyPrice();
            
            // חיתוך - רק אם מופעל
            if (this.isCuttingEnabled) {
                finalPrice += this.getCuttingPrice();
            }
        }
        
        // ברגים - רק אם מופעלים
        if (this.isScrewsEnabled) {
            finalPrice += this.getScrewsPrice();
        }
        
        return Math.round(finalPrice * 100) / 100;
    }
    
    // קבלת פירוט המחיר לפי הטוגלים החדשים
    getPriceBreakdown(): string {
        const parts: string[] = [];
        
        // הוראות חיתוך והרכבה - תמיד כלולות
        parts.push(`${this.drawingPrice}₪ שרטוט`);
        
        // קורות - רק אם מופעלות
        if (this.isBeamsEnabled) {
            const beamsPrice = this.getBeamsOnlyPrice();
            parts.push(`${beamsPrice}₪ קורות`);
            
            // חיתוך - רק אם מופעל
            if (this.isCuttingEnabled) {
                const cuttingPrice = this.getCuttingPrice();
                parts.push(`${cuttingPrice}₪ חיתוך`);
            }
        }
        
        // ברגים - רק אם מופעלים
        if (this.isScrewsEnabled) {
            const screwsPrice = this.getScrewsPrice();
            if (screwsPrice > 0) {
                parts.push(`${screwsPrice}₪ ברגים`);
            }
        }
        
        return parts.join(' + ');
    }

    // חישוב נתוני קורות לפי מידה למחיר
    private async calculateBelamsData() {
        this.debugLog('בחישוב נתוני קורות לפי מידה למחיר...');
        
        const beamsParam = this.getParam('beams');
        if (!beamsParam || !beamsParam.setAmount) {
            console.warn('לא נמצא פרמטר beams עם setAmount');
            return;
        }

        const beamsArray = beamsParam.default || [];
        
        // יצירת נתוני קורה למחיר - כל קורה עם המידה שהמשתמש הגדיר
        const selectedBeamIndex = beamsParam.selectedBeamIndex || 0;
        const beamInfo = beamsParam.beams[selectedBeamIndex];
        
        if (beamInfo) {
            const beamTypeIndex = beamsParam.selectedTypeIndex || (beamsParam.defaultType ? 
                this.findDefaultTypeIndex(beamInfo.types, beamsParam.defaultType) : 0);
            const beamType = beamInfo.types?.[beamTypeIndex];
            
            if (beamType) {
                // יצירת רשימת אורכים עם שכפול לפי כמות
                const beamLengths: number[] = [];
                
                beamsArray.forEach((beamData: any, index: number) => {
                    if (beamData && typeof beamData === 'object') {
                        const beamLengthCm = beamData.length;
                        const beamAmount = beamData.amount || 1;
                        
                        // שכפול האורך לפי הכמות
                        for (let i = 0; i < beamAmount; i++) {
                            beamLengths.push(beamLengthCm);
                        }
                        
                        this.debugLog(`קורה נוספה למחיר: ${beamLengthCm}ס"מ × ${beamAmount}יח`);
                    } else if (typeof beamData === 'number') {
                        // תאמיכה במבנה הישן של מספרים
                        const beamLengthCm = beamData;
                        beamLengths.push(beamLengthCm);
                        
                        this.debugLog(`קורה נוספה למחיר (מבנה ישן): ${beamLengthCm}ס"מ`);
                    }
                });
                
                // יצירת נתוני קורה למחיר - במבנה הנכון
                this.BeamsDataForPricing.push({
                    type: beamType,
                    beamName: beamInfo.name,
                    beamTranslatedName: beamInfo.translatedName || beamInfo.name,
                    beamWoodType: beamType.translatedName || beamType.name,
                    sizes: beamLengths // מערך של כל האורכים
                });
                
                this.debugLog(`נתוני קורות לחישוב מחיר:`, {
                    beamName: beamInfo.name,
                    woodType: beamType.translatedName || beamType.name,
                    sizes: beamLengths
                });
            }
        }

        this.debugLog(`נתוני קורות לחישוב מחיר נשלחו: ${this.BeamsDataForPricing.length} סוגי קורות`);
    }

    // תצוגת מידות הקורות עם כמות
    getBelamsWithQuantitiesText(): string {
        const beamsParam = this.getParam('beams');
        if (!beamsParam || !beamsParam.setAmount) {
            return '';
        }

        const beamsArray = beamsParam.default || [];
        
        // יצירת רשימת המידות שהמשתמש הגדיר (בסל"מ כמו מדף שולחן)
        const selectedBeamIndex = beamsParam.selectedBeamIndex || 0;
        const beamInfo = beamsParam.beams[selectedBeamIndex];
        
        if (beamInfo) {
            const beamTypeIndex = beamsParam.selectedTypeIndex || (beamsParam.defaultType ? 
                this.findDefaultTypeIndex(beamInfo.types, beamsParam.defaultType) : 0);
            const beamType = beamInfo.types?.[beamTypeIndex];
            const beamName = beamType?.name || beamInfo.translatedName || `קורה ${selectedBeamIndex}`;
            
            // הכנה של רשימת מידות וכמויות כמו במדפים
            const beamDimensions: string[] = [];
            beamsArray.forEach((beamData: any, index: number) => {
                if (beamData && typeof beamData === 'object') {
                    const beamLengthCm = beamData.length || beamData;
                    const beamAmount = beamData.amount || 1;
                    beamDimensions.push(`${beamLengthCm} ס"מ × ${beamAmount}יח`);
                } else if (typeof beamData === 'number') {
                    beamDimensions.push(`${beamData} ס"מ`);
                }
            });
            
            return `${beamDimensions.join(', ')}`;
        }

        return '';
    }

    // חיפוש קורה לפי שם הטיפוס
    private findBeamByName(beamTypeName: string, beamsParam: any): any {
        for (const beam of beamsParam.beams) {
            if (beam.types) {
                for (const type of beam.types) {
                    if (type.name === beamTypeName) {
                        return beam;
                    }
                }
            }
        }
        return null;
    }

    // טפול במידות מוצר קורות לפי מידה
    private getBelamsDimensionsRaw(): {
        length: number;
        width: number;
        height: number;
        beamCount: number;
        gapBetweenBeams: number;
        shelfCount: number;
        shelfHeights: number[];
        totalScrews: number;
    } {
        const beamsParam = this.getParam('beams');
        if (!beamsParam || !beamsParam.setAmount) {
            return {
                length: 0,
                width: 0,
                height: 0,
                beamCount: 0,
                gapBetweenBeams: 0,
                shelfCount: 0,
                shelfHeights: [],
                totalScrews: 0
            };
        }

        const beamsArray = beamsParam.default || [];
        
        // חישוב אורך כולל מהמידות שהמשתמש הגדיר (בסל"מ)
        const beamSpacing = 20;
        let totalLength = 0;
        
        // סיכום כל המידות והכמויות שהמשתמש הגדיר + רווחים
        beamsArray.forEach((beamData: any) => {
            if (beamData && typeof beamData === 'object') {
                const beamLengthCm = beamData.length || beamData;
                const beamAmount = beamData.amount || 1;
                totalLength += (beamLengthCm + beamSpacing) * beamAmount;
            } else if (typeof beamData === 'number') {
                totalLength += beamData + beamSpacing;
            }
        });
        
        // מציאת מידות הקורה הנבחרת (כי כל הקורות עם גובה ועומק זהים)
        let beamHeightCm = 0;
        let beamDepthCm = 0;
        
        const selectedBeamIndex = beamsParam.selectedBeamIndex || 0;
        const beamInfo = beamsParam.beams[selectedBeamIndex];
        
        if (beamInfo) {
            beamHeightCm = beamInfo.height / 10;
            beamDepthCm = (beamInfo.depth || beamInfo.width) / 10;
        }

        return {
            length: totalLength,
            width: beamDepthCm, // עומק הקורה הנבחרת
            height: beamHeightCm, // גובה הקורה הנבחרת 
            beamCount: beamsArray.length,
            gapBetweenBeams: beamSpacing,
            shelfCount: 0, // אין מדפים
            shelfHeights: [], // אין מדפים
            totalScrews: 0 // אין ברגים
        };
    }

    // Helper function to find default beam index based on defaultType
    findDefaultBeamIndex(beams: any[], defaultType?: any): number {
        if (!Array.isArray(beams) || beams.length === 0) {
            this.debugLog('CHACK-BEAM-MINI: [threejs-box] No beams array or empty array, using index 0');
            return 0;
        }
        
        this.debugLog('CHACK-BEAM-MINI: [threejs-box] Searching for default beam in beams array:', beams.length, 'beams');
        this.debugLog('CHACK-BEAM-MINI: [threejs-box] Looking for defaultType:', defaultType);
        
        // אם אין defaultType, חזרה לאינדקס 0
        if (!defaultType) {
            this.debugLog('CHACK-BEAM-MINI: [threejs-box] No defaultType provided, using index 0');
            return 0;
        }
        
        // חילוץ ה-ID מה-defaultType (יכול להיות string או object)
        const defaultTypeId = defaultType.$oid || defaultType._id || defaultType;
        this.debugLog('CHACK-BEAM-MINI: [threejs-box] Extracted defaultTypeId:', defaultTypeId);
        
        // חיפוש קורה שמתאימה ל-defaultType
        for (let i = 0; i < beams.length; i++) {
            const beam = beams[i];
            const beamId = beam._id || beam.$oid;
            
            this.debugLog(`CHACK-BEAM-MINI: [threejs-box] Beam ${i}: name="${beam.name}", id="${beamId}"`);
            
            if (beamId && defaultTypeId && beamId === defaultTypeId) {
                this.debugLog(`CHACK-BEAM-MINI: [threejs-box] ✅ Found matching beam at index ${i}: ${beamId}`);
                return i;
            }
        }
        
        // אם לא נמצאה התאמה, חזרה לאינדקס 0
        this.debugLog('CHACK-BEAM-MINI: [threejs-box] ❌ No matching beam found for defaultType, using index 0');
        return 0;
    }

    // טפול במודל קורות לפי מידה
    private updateBeamsModel() {
        this.debugLog('יצירת מודל קורות לפי מידה...');
        
        // קבלת פרמטר beamArray עם setAmount
        const beamsParam = this.getParam('beams');
        if (!beamsParam || !beamsParam.setAmount) {
            console.warn('לא נמצא פרמטר beams עם setAmount');
            return;
        }

        const beamsArray = beamsParam.default || [];
        if (!Array.isArray(beamsArray) || beamsArray.length === 0) {
            console.warn('מערך קורות ריק');
            return;
        }

        let currentZ = 0; // מיקום Z הנוכחי לקורות - מתחיל מ-0
        const beamSpacing = 10; // רווח של 10 ס"מ בין קורות

        // מעבר על כל קורה במערך - עם אורך וכמות עבור setAmount
        beamsArray.forEach((beamData: any) => {
            if (!beamData || typeof beamData !== 'object') {
                console.warn('נתוני קורה לא חוקיים:', beamData);
                return;
            }

            const beamLengthCm = beamData.length || beamData; // תמיכה בשני המבנים
            const beamAmount = beamData.amount || 1;
            
            // שימוש במידות ברירת המחלה של הקורה הנבחרת
            const selectedBeamIndex = beamsParam.selectedBeamIndex || 0;
            const beamInfo = beamsParam.beams[selectedBeamIndex];
            
            if (!beamInfo) {
                console.warn('קורה לא נמצאה באינדקס:', selectedBeamIndex);
                return;
            }

            // קבלת סוג הקורה (type)
            const beamTypeIndex = beamsParam.selectedTypeIndex || beamsParam.defaultType ? 
                this.findDefaultTypeIndex(beamInfo.types, beamsParam.defaultType) : 0;
            const beamType = beamInfo.types?.[beamTypeIndex];

            // מידות הקורה בפיקסלים מהמשתמש (בס"מ כמו מדף שולחן)
            const beamHeightCm = beamInfo.height / 10; // גובה קבוע מהקורה הנבחרת
            const beamDepthCm = (beamInfo.depth || beamInfo.width) / 10; // עומק קבוע מהקורה הנבחרת

            // יצירת קורות לפי הכמות הרצויה
            for (let i = 0; i < beamAmount; i++) {
                // יצירת גיאומטריה וחומר
                const geometry = new THREE.BoxGeometry(beamLengthCm, beamHeightCm, beamDepthCm);
                const material = this.getWoodMaterial(beamType?.name || '');

                // יצירת mesh
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // הוספת wireframe אם נדרש
                if (this.isTransparentMode) {
                    this.addWireframeToBeam(mesh);
                }

                // מיקום הקורה במרכז ה-Y כמו מוצרים אחרים
                // כל קורה מתחילה מנקודה קבועה ומתרחבת לאותו כיוון
                mesh.position.set(
                    50, // מוזז 50 ס"מ ימינה (כיוון החץ האדום)
                    0, // במרכז ה-Y כמו מוצרים אחרים
                    currentZ - 25 // רווח קבוע של 10 ס"מ בין הקורות על ציר Z, מוזז 25 ס"מ לכיוון הפוך לחץ הכחול
                );
                
                // כליפ הקורה כך שהקצה התחילי יהיה בנקודה הקבועה
                mesh.translateX(-beamLengthCm / 2); // מזיז את הקורה כך שהקצה התחילי יהיה בנקודה 0

                // הוספה לסצנה
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);

                // התקדמות למיקום הבא (עומק הקורה + רווח קבוע של 10 ס"מ)
                currentZ += beamDepthCm + beamSpacing;
            }

            this.debugLog(`קורה באורך ${beamLengthCm}ס"מ × ${beamAmount}יח: גובה ${beamHeightCm}ס"מ, עומק ${beamDepthCm}ס"מ`);
        });

        // עדכון מצב הטעינה - עם המתנה מלאכותית כדי לראות את ה-loader
        setTimeout(() => {
            this.isLoading = false;
            this.isModelLoading = false;
        }, 1000); // המתנה של שנייה כדי לראות את ה-loader

        this.debugLog(`נוצרו ${this.beamMeshes.length} קורות באוכליי שונים עם רווח של ${beamSpacing}ס"מ ביניהן`);
    }

    // חיפוש אינדקס הטיפוס בהתבסס על defaultType
    private findDefaultTypeIndex(types: any[], defaultType: any): number {
        if (!Array.isArray(types) || types.length === 0) {
            return 0;
        }
        
        if (!defaultType) {
            return 0;
        }
        
        // חילוץ ה-ID מה-defaultType (יכול להיות string או object)
        const defaultTypeId = defaultType.$oid || defaultType._id || defaultType;
        
        for (let i = 0; i < types.length; i++) {
            const type = types[i];
            const typeId = type._id || type.$oid;
            
            if (typeId && defaultTypeId && typeId === defaultTypeId) {
                return i;
            }
        }
        
        return 0;
    }
    
    // הוספת חצים לכיוונים במרכז המודל
    private addCoordinateAxes() {
        // הסרת חצים קיימים אם יש
        this.removeCoordinateAxes();
        
        const axesLength = 5; // אורך החצים בס"מ - קוצר ל-5 ס"מ
        
        // חץ X (כחול בהיר) - ימינה
        const xArrow = this.createArrow(axesLength, 0x0066ff, 'X');
        xArrow.position.set(0, 0, 0);
        this.scene.add(xArrow);
        this.coordinateAxes.push(xArrow);
        
        // חץ Y (כחול בינוני) - למעלה
        const yArrow = this.createArrow(axesLength, 0x4d94ff, 'Y');
        yArrow.position.set(0, 0, 0);
        yArrow.rotation.z = -Math.PI / 2; // סיבוב 90 מעלות סביב Z
        this.scene.add(yArrow);
        this.coordinateAxes.push(yArrow);
        
        // חץ Z (כחול כהה) - קדימה (לכיוון המצלמה)
        const zArrow = this.createArrow(axesLength, 0x003d99, 'Z');
        zArrow.position.set(0, 0, 0);
        zArrow.rotation.x = Math.PI / 2; // סיבוב 90 מעלות סביב X
        this.scene.add(zArrow);
        this.coordinateAxes.push(zArrow);

        // מיקום כל החצים לגובה: גובה המוצר + 10 ס"מ
        try {
            const dims = this.getProductDimensionsRaw();
            const yOffset = (dims?.height || 0) + 10;
            xArrow.position.y = yOffset;
            yArrow.position.y = yOffset;
            zArrow.position.y = yOffset;
        } catch {}
        
        this.debugLog('נוספו חצים לכיוונים במרכז המודל');
    }
    
    // הצגה/הסתרה של חצים לכיוונים
    toggleCoordinateAxes() {
        this.showCoordinateAxes = !this.showCoordinateAxes;
        
        if (this.showCoordinateAxes) {
            this.addCoordinateAxes();
        } else {
            this.removeCoordinateAxes();
        }
        
        this.debugLog('חצים לכיוונים:', this.showCoordinateAxes ? 'מוצגים' : 'מוסתרים');
    }
    
    // הסרת חצים מהסצנה
    private removeCoordinateAxes() {
        this.coordinateAxes.forEach(arrow => {
            this.scene.remove(arrow);
            // ניקוי זיכרון
            arrow.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    (child.material as THREE.Material).dispose();
                }
            });
        });
        this.coordinateAxes = [];
    }
    
    // יצירת חץ בודד
    private createArrow(length: number, color: number, label: string) {
        const group = new THREE.Group();
        
        // יצירת הגוף של החץ (צילינדר) - דק ועדין
        const shaftGeometry = new THREE.CylinderGeometry(0.2, 0.2, length - 1, 8); // קוטר קטן יותר (0.2 במקום 0.5)
        const shaftMaterial = new THREE.MeshBasicMaterial({ color: color });
        const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
        shaft.position.y = (length - 1) / 2; // מיקום הגוף - מתחיל מהמרכז
        group.add(shaft);
        
        // יצירת הראש של החץ (קונוס) - קטן ועדין
        const headGeometry = new THREE.ConeGeometry(0.3, 1, 8); // רדיוס קטן יותר (0.3) וגובה קטן יותר (1)
        const headMaterial = new THREE.MeshBasicMaterial({ color: color });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = length - 0.5; // מיקום הראש - מותאם לגובה החדש
        group.add(head);
        
        // הוספת טקסט לכיוון - רק אם יש label
        if (label && label.length > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 64;
            const ctx = canvas.getContext('2d')!;
            // ללא רקע - שקוף
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // טקסט בכחול (מותאם ל"כחול שלנו")
            ctx.fillStyle = '#1e90ff';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const textMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
            const textGeometry = new THREE.PlaneGeometry(8, 4);
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.y = length + 2.5; // מעט מעל ראש החץ
            // הצמדת הטקסט לפנים המצלמה (Billboard) כדי שתמיד יהיה נראה, כולל עבור ציר Z
            textMesh.onBeforeRender = function(_renderer: any, _scene: any, camera: THREE.Camera) {
                // מעתיקים את הסיבוב של המצלמה, כך שהטקסט תמיד פונה אליה
                // @ts-ignore
                this.quaternion.copy((camera as any).quaternion);
            } as any;
            group.add(textMesh);
        }
        
        return group;
    }
    
    // פונקציות לכפתורי עריכה
    toggleBeamsEditOptions() {
        this.showBeamsEditOptions = !this.showBeamsEditOptions;
        if (this.showBeamsEditOptions) {
            this.saveOriginalBeamsState();
        } else {
            // איפוס המחירים הדינמיים כשסוגרים את תפריט העריכה
            this.resetDynamicPrices();
        }
    }
    
    toggleScrewsEditOptions() {
        this.showScrewsEditOptions = !this.showScrewsEditOptions;
        if (this.showScrewsEditOptions) {
            this.saveOriginalScrewsState();
        } else {
            // איפוס המחירים הדינמיים כשסוגרים את תפריט העריכה
            this.resetDynamicPrices();
        }
    }
    
    // שמירת מצב הקורות לפני עריכה
    private saveOriginalBeamsState() {
        
        this.originalBeamsData = JSON.parse(JSON.stringify(this.BeamsDataForPricing || []));
        
        // שמירת הכמויות המקוריות של הקורות
        this.originalBeamQuantities = [];
        if (this.BeamsDataForPricing) {
            this.BeamsDataForPricing.forEach((beam, index) => {
                const quantity = this.getFullBeamsCount(beam);
                this.originalBeamQuantities[index] = quantity;
            });
        }
        
        // שמירת מצב הברגים המקורי גם כן
        this.originalScrewsData = JSON.parse(JSON.stringify(this.screwsPackagingPlan || []));
        
        // שמירת המחירים המקוריים
        this.originalBeamsPrice = this.getBeamsOnlyPrice();
        this.originalCuttingPrice = this.getCuttingPrice();
        this.originalScrewsPrice = this.getScrewsPrice();
        
        // אתחול המחירים הדינמיים עם הערכים הנוכחיים
        this.dynamicBeamsPrice = this.originalBeamsPrice;
        this.dynamicCuttingPrice = this.originalCuttingPrice;
        this.dynamicScrewsPrice = this.originalScrewsPrice;
        
        // איפוס סטטוס השינויים
        this.hasBeamsChanged = false;
        this.hasScrewsChanged = false;
        
        
        // הדפסת הכמויות המקוריות לכל קורה
        if (this.originalBeamsData) {
            this.originalBeamsData.forEach((beam, index) => {
                const originalQuantity = this.getFullBeamsCount(beam);
            });
        }
        
    }
    
    // שמירת מצב הברגים לפני עריכה
    private saveOriginalScrewsState() {
        this.originalScrewsData = JSON.parse(JSON.stringify(this.screwsPackagingPlan || []));
        
        // שמירת המחירים המקוריים
        this.originalBeamsPrice = this.getBeamsOnlyPrice();
        this.originalCuttingPrice = this.getCuttingPrice();
        this.originalScrewsPrice = this.getScrewsPrice();
        
        // אתחול המחירים הדינמיים עם הערכים הנוכחיים
        this.dynamicBeamsPrice = this.originalBeamsPrice;
        this.dynamicCuttingPrice = this.originalCuttingPrice;
        this.dynamicScrewsPrice = this.originalScrewsPrice;
        
        // איפוס סטטוס השינויים
        this.hasBeamsChanged = false;
        this.hasScrewsChanged = false;
        
    }
    
    // קבלת רשימת קורות לעריכה
    getBeamsForEdit(): any[] {
        return this.BeamsDataForPricing || [];
    }
    
    // קבלת הכמות הכוללת של קורה (סכום כל החתיכות)
    getTotalBeamQuantity(beam: any): number {
        if (!beam || !beam.totalSizes) return 0;
        return beam.totalSizes.reduce((sum: number, size: any) => sum + size.count, 0);
    }
    
    // משתנה לבדיקה שהלוגים כבר הופעלו
    private beamDebugLogged = false;

    // קבלת האורך של הקורה במטרים (מהקורה הראשונה ב-cuttingPlan)
    getBeamLengthInMeters(beam: any): number {
        if (!this.beamDebugLogged) {
            this.beamDebugLogged = true;
        }
        
        // חיפוש הקורה ב-cuttingPlan כדי לקבל את האורך הנכון
        const beamInPlan = this.cuttingPlan?.find(plan => 
            plan.beamType === beam.beamTranslatedName
        );
        
        if (!this.beamDebugLogged && beamInPlan) {
        }
        
        if (beamInPlan) {
            return beamInPlan.beamLength / 100; // המרה מס"מ למטרים
        }
        
        // אם לא נמצא, נחזיר 0
        return 0;
    }
    
    // קבלת המחיר הנכון של הקורה השלמה (קבוע ולא משתנה)
    getBeamPrice(beam: any): number {
        // נחפש ב-cuttingPlan את האורך של הקורה השלמה
        const beamInPlan = this.cuttingPlan?.find(plan => 
            plan.beamType === beam.beamTranslatedName
        );
        
        if (beamInPlan) {
            // נחפש את המחיר לפי האורך של הקורה השלמה
            const beamLengthData = beam.type?.length?.find((l: any) => l.length === beamInPlan.beamLength);
            if (beamLengthData) {
                return beamLengthData.price; // המחיר הקבוע של הקורה השלמה
            }
        }
        
        // אם לא נמצא ב-cuttingPlan, נחזיר את המחיר הגבוה ביותר (כנראה הקורה הארוכה ביותר)
        if (beam.type?.length && beam.type.length.length > 0) {
            const maxPriceBeam = beam.type.length.reduce((max: any, current: any) => 
                current.price > max.price ? current : max
            );
            return maxPriceBeam.price;
        }
        
        // אם לא נמצא, נחזיר 0
        return 0;
    }
    
    // קבלת מספר הקורות השלמות (מספר הקורות שצריך לקנות)
    getFullBeamsCount(beam: any): number {
        if (!beam) return 0;
        
        // ספירת כל הקורות השלמות מכל הסוג הזה ב-cuttingPlan
        const allBeamsOfThisType = this.cuttingPlan?.filter(plan => 
            plan.beamType === beam.beamTranslatedName
        ) || [];
        
        if (!this.beamDebugLogged && allBeamsOfThisType.length > 0) {
        }
        
        // החזרת מספר הקורות השלמות
        return allBeamsOfThisType.length;
    }
    
    // קבלת רשימת ברגים לעריכה (קופסאות ברגים)
    getScrewsForEdit(): any[] {
        return this.screwsPackagingPlan || [];
    }
    
    // יצירת קורה חדשה מהמידע של beam
    private createBeamFromBeamData(beam: any): any {
        // חיפוש הקורה המקורית ב-cuttingPlan כדי לקבל את המידע המלא
        const originalBeam = this.cuttingPlan?.find(plan => 
            plan.beamType === beam.beamTranslatedName
        );
        
        if (originalBeam) {
            return originalBeam;
        }
        
        // אם לא נמצאה, נצור קורה חדשה מהמידע הזמין
        if (beam.totalSizes && beam.totalSizes.length > 0) {
            const firstSize = beam.totalSizes[0];
            const beamLength = firstSize.length;
            
            // חיפוש מחיר לפי האורך
            const beamLengthData = beam.type?.length?.find((l: any) => l.length === beamLength);
            const beamPrice = beamLengthData?.price || 0;
            
            return {
                beamNumber: 1,
                beamLength: beamLength,
                beamPrice: beamPrice,
                cuts: Array(firstSize.count).fill(beamLength),
                remaining: 0,
                waste: 0,
                beamType: beam.beamTranslatedName,
                beamWoodType: beam.beamWoodType,
                pricePerCut: beam.type?.pricePerCut || 0,
                numberOfCuts: firstSize.count,
                totalCuttingPrice: (beam.type?.pricePerCut || 0) * firstSize.count
            };
        }
        
        return null;
    }
    
    // בדיקה אם כל הקורות על 0
    private checkAllBeamsZero(): boolean {
        if (!this.BeamsDataForPricing) return false;
        
        for (let i = 0; i < this.BeamsDataForPricing.length; i++) {
            const beam = this.BeamsDataForPricing[i];
            const quantity = this.getFullBeamsCount(beam);
            if (quantity > 0) {
                return false;
            }
        }
        return true;
    }
    
    // בדיקה אם כל הברגים על 0
    private checkAllScrewsZero(): boolean {
        if (!this.screwsPackagingPlan) return false;
        
        for (let i = 0; i < this.screwsPackagingPlan.length; i++) {
            const screw = this.screwsPackagingPlan[i];
            if (screw.numPackages > 0) {
                return false;
            }
        }
        return true;
    }
    
    // עדכון כמות קורה
    updateBeamQuantity(beamIndex: number, newQuantity: number) {
        
        if (!this.BeamsDataForPricing || beamIndex < 0 || beamIndex >= this.BeamsDataForPricing.length) {
            return;
        }
        
        // עדכון הכמות
        const beam = this.BeamsDataForPricing[beamIndex];
        const oldQuantity = this.getFullBeamsCount(beam);
        
            
            // חישוב ההפרש
            const difference = newQuantity - oldQuantity;
            
            if (difference !== 0) {
            // עדכון ה-cuttingPlan ישירות
            let allBeamsOfThisType = this.cuttingPlan?.filter(plan => 
                plan.beamType === beam.beamTranslatedName
            ) || [];
            
            if (difference > 0) {
                // הוספת קורות
                let templateBeam = allBeamsOfThisType[0];
                
                // אם אין קורות קיימות, נצור קורה חדשה מהמידע של beam
                if (!templateBeam) {
                    templateBeam = this.createBeamFromBeamData(beam);
                }
                
                if (templateBeam) {
                    for (let i = 0; i < difference; i++) {
                        const newBeam = JSON.parse(JSON.stringify(templateBeam));
                        newBeam.beamNumber = this.cuttingPlan.length + 1;
                        this.cuttingPlan.push(newBeam);
                    }
                    
                    // עדכון מחיר
                    const beamPrice = templateBeam.beamPrice;
                    const priceDifference = difference * beamPrice;
                    this.updatePriceLocally('beam', beam, priceDifference);
                }
                
                // אם הקורות לא היו מופעלות והוספנו קורה, נפעיל אותן
                if (!this.isBeamsEnabled && oldQuantity === 0) {
                    this.isBeamsEnabled = true;
                }
            } else {
                // הסרת קורות
                const beamsToRemove = Math.abs(difference);
                for (let i = 0; i < beamsToRemove && allBeamsOfThisType.length > 0; i++) {
                    const lastBeam = allBeamsOfThisType[allBeamsOfThisType.length - 1];
                    const index = this.cuttingPlan.indexOf(lastBeam);
                    if (index > -1) {
                        this.cuttingPlan.splice(index, 1);
                        allBeamsOfThisType.splice(allBeamsOfThisType.length - 1, 1);
                    }
                }
                
                // עדכון מחיר
                if (allBeamsOfThisType.length > 0) {
                    const beamPrice = allBeamsOfThisType[0].beamPrice;
                    const priceDifference = difference * beamPrice;
                    this.updatePriceLocally('beam', beam, priceDifference);
                } else {
                    // אם אין קורות מהסוג הזה, עדיין צריך לעדכן את המחיר
                    // נשתמש במחיר מהנתונים המקוריים
                    const originalBeam = this.originalBeamsData.find(b => b.beamTranslatedName === beam.beamTranslatedName);
                    if (originalBeam) {
                        // נמצא קורה דומה ב-cuttingPlan המקורי
                        const similarBeam = this.cuttingPlan.find(plan => plan.beamType === beam.beamTranslatedName);
                        if (similarBeam) {
                            const beamPrice = similarBeam.beamPrice;
                            const priceDifference = difference * beamPrice;
                            this.updatePriceLocally('beam', beam, priceDifference);
                        } else {
                            // אם לא נמצא, נשתמש במחיר מהנתונים המקוריים
                            // נחשב מחיר על בסיס המחיר המקורי
                            const originalPrice = this.originalBeamsPrice;
                            const pricePerBeam = originalPrice / this.originalBeamQuantities.reduce((sum, q) => sum + q, 0);
                            const priceDifference = difference * pricePerBeam;
                            this.updatePriceLocally('beam', beam, priceDifference);
                        }
                    }
                }
                
                // בדיקה אם זה היה המעבר מ-1 ל-0
                if (oldQuantity === 1 && newQuantity === 0) {
                    // בדיקה אם כל הקורות על 0
                    if (this.checkAllBeamsZero()) {
                        this.isBeamsEnabled = false;
                        this.showBeamsEditOptions = false; // סגירת איזור עריכת קורות
                    }
                }
            }
            
            // עדכון סטטוס החיתוך בכל שינוי כמות
            this.updateCuttingStatus();
        }
    }
    
    // עדכון כמות קופסאות ברגים
    updateScrewQuantity(screwIndex: number, newQuantity: number) {
        if (!this.screwsPackagingPlan || screwIndex < 0 || screwIndex >= this.screwsPackagingPlan.length) {
            return;
        }
        
        // חישוב ההפרש לפני העדכון
        const screw = this.screwsPackagingPlan[screwIndex];
        const oldQuantity = screw.numPackages;
        const difference = newQuantity - oldQuantity;
        
        // עדכון כמות הקופסאות
        screw.numPackages = Math.max(0, newQuantity);
        
        // עדכון מקומי של המחיר
        this.updatePriceLocally('screw', screw, difference);
        
        // בדיקה אם זה היה המעבר מ-1 ל-0
        if (oldQuantity === 1 && newQuantity === 0) {
            // בדיקה אם כל הברגים על 0
            if (this.checkAllScrewsZero()) {
                this.isScrewsEnabled = false;
                this.showScrewsEditOptions = false; // סגירת איזור עריכת ברגים
            }
        }
        
        // אם הברגים לא היו מופעלים והוספנו ברג, נפעיל אותם
        if (difference > 0 && !this.isScrewsEnabled && oldQuantity === 0) {
            this.isScrewsEnabled = true;
        }
    }
    
    // בדיקה אם הכמויות מספיקות לחיתוך
    private checkCuttingPossibility(): boolean {
        
        if (!this.originalBeamsData || !this.BeamsDataForPricing) {
            return true;
        }
        
        
        // בדיקה אם יש סוג קורה שהכמות הנוכחית שלו קטנה מהכמות המקורית הנדרשת
        for (let i = 0; i < this.BeamsDataForPricing.length; i++) {
            const currentBeam = this.BeamsDataForPricing[i];
            
            // הכמות הנוכחית של הקורות השלמות (מה שהמשתמש רואה באינפוט)
            const currentQuantity = this.getFullBeamsCount(currentBeam);
            // הכמות המקורית הנדרשת (מספר הקורות שהיו נדרשות לחיתוך)
            const originalQuantity = this.originalBeamQuantities[i] || 0;
            
            
            if (currentQuantity < originalQuantity) {
                return false; // לא ניתן לבצע חיתוך
            }
        }
        
        return true; // ניתן לבצע חיתוך
    }
    
    // עדכון סטטוס החיתוך
    private updateCuttingStatus() {
        const wasPossible = this.isCuttingPossible;
        this.isCuttingPossible = this.checkCuttingPossibility();
        
        
        // אם החיתוך לא אפשרי יותר, נבטל אותו
        if (!this.isCuttingPossible && this.isCuttingEnabled) {
            this.isCuttingEnabled = false;
            // לא משנים את המחיר - הוא נשאר קבוע!
        }
        
        // אם החיתוך הפך לאפשרי שוב, נפעיל אותו (רק אם קורות מופעלות)
        if (this.isCuttingPossible && !this.isCuttingEnabled && this.isBeamsEnabled) {
            this.isCuttingEnabled = true;
            // לא משנים את המחיר - הוא נשאר קבוע!
        }
    }
    
    // איפוס המחירים הדינמיים (רק כשעושים חישוב מחדש מלא)
    private resetDynamicPrices() {
        // רק אם לא פותחים תפריט עריכה חדש
        if (!this.showBeamsEditOptions && !this.showScrewsEditOptions) {
            this.dynamicBeamsPrice = 0;
            this.dynamicCuttingPrice = 0;
            this.dynamicScrewsPrice = 0;
            this.hasBeamsChanged = false;
            this.hasScrewsChanged = false;
        }
    }
    
    // פונקציות לקבלת המחירים המקוריים והחדשים
    getOriginalBeamsPrice(): number {
        return this.originalBeamsPrice;
    }
    
    
    getOriginalScrewsPrice(): number {
        return this.originalScrewsPrice;
    }
    
    getHasBeamsChanged(): boolean {
        return this.hasBeamsChanged;
    }
    
    getHasScrewsChanged(): boolean {
        return this.hasScrewsChanged;
    }
    
    // עדכון מקומי של המחיר על בסיס שינוי כמות
    private updatePriceLocally(type: 'beam' | 'screw', item: any, quantityDifference: number) {
        if (quantityDifference === 0) return;
        
        
        let pricePerUnit = 0;
        
        if (type === 'beam') {
            // עדכון המחיר הספציפי של קורות (רק עץ, לא חיתוך)
            const oldBeamsPrice = this.dynamicBeamsPrice;
            
            // quantityDifference כבר מכיל את ההפרש במחיר (לא בכמות)
            const beamsPriceDifference = quantityDifference;
            
            this.dynamicBeamsPrice = Math.round((Math.max(0, this.dynamicBeamsPrice + beamsPriceDifference)) * 100) / 100;
            
            // סימון שיש שינויים בקורות
            this.hasBeamsChanged = true;
            
            
        } else if (type === 'screw') {
            // מחיר לקופסת ברגים
            
            pricePerUnit = item.optimalPackage?.price || 0;
            
            // עדכון המחיר הספציפי של ברגים
            this.dynamicScrewsPrice = Math.round((Math.max(0, this.dynamicScrewsPrice + (quantityDifference * pricePerUnit))) * 100) / 100;
            
            // סימון שיש שינויים בברגים
            this.hasScrewsChanged = true;
            
        }
        
        // חישוב ההפרש במחיר
        const priceDifference = quantityDifference * pricePerUnit;
        
        // עדכון המחיר הכולל
        this.calculatedPrice = Math.round((Math.max(0, this.calculatedPrice + priceDifference)) * 100) / 100;
        
        // אילוץ Angular לעדכן את התצוגה
        this.cdr.detectChanges();
        
    }
    
    // פונקציה ליצירת קורות בסיס מיטה
    private createFutonBeams() {
        console.log('CHECK_FUTON_LEG - createFutonBeams נקראה!');
        this.debugLog('יצירת קורות בסיס מיטה...');
        
        // קבלת פרמטרים
        const widthParam = this.getParam('width');
        const depthParam = this.getParam('depth');
        const plataParam = this.getParam('plata');
        const legParam = this.getParam('leg');
        
        console.log('CHECK_FUTON_LEG - פרמטרים:', JSON.stringify({
            hasWidthParam: !!widthParam,
            hasDepthParam: !!depthParam,
            hasPlataParam: !!plataParam,
            hasLegParam: !!legParam
        }, null, 2));
        
        if (!widthParam || !depthParam || !plataParam || !legParam) {
            console.warn('CHECK_FUTON_LEG - חסרים פרמטרים לבסיס מיטה:', {
                widthParam: !!widthParam,
                depthParam: !!depthParam,
                plataParam: !!plataParam,
                legParam: !!legParam
            });
            return;
        }
        
        const futonWidth = depthParam.default;  // החלפה: width = depth
        const futonDepth = widthParam.default;   // החלפה: depth = width
        
        // קבלת מידות קורת הפלטה
        let plataBeam = null;
        let plataType = null;
        if (plataParam.beams && plataParam.beams.length > 0) {
            const plataBeamIndex = this.getBeamIndexByDefaultType(plataParam);
            plataBeam = plataParam.beams[plataBeamIndex];
            plataType = plataBeam.types && plataBeam.types.length 
                ? plataBeam.types[plataParam.selectedTypeIndex || 0] 
                : null;
        }
        
        // קבלת מידות קורת הרגל
        let legBeam = null;
        let legType = null;
        if (legParam.beams && legParam.beams.length > 0) {
            const legBeamIndex = this.getBeamIndexByDefaultType(legParam);
            legBeam = legParam.beams[legBeamIndex];
            legType = legBeam.types && legBeam.types.length 
                ? legBeam.types[legParam.selectedTypeIndex || 0] 
                : null;
        }
        
        if (!plataBeam || !legBeam) {
            console.warn('חסרות קורות לבסיס מיטה');
            return;
        }
        
        // המרת מידות ממ"מ לס"מ
        const plataBeamWidth = plataBeam.width / 10;
        const plataBeamHeight = plataBeam.height / 10;
        const legBeamWidth = legBeam.width / 10;
        const legBeamHeight = legBeam.height / 10;
        
        // חישוב גובה הפלטה - רוחב קורת הרגל מעל הקרקע
        const platformHeight = legBeamWidth;
        
        this.debugLog('מידות בסיס מיטה:', {
            width: futonWidth,
            depth: futonDepth,
            platformHeight: platformHeight,
            plataBeam: { width: plataBeamWidth, height: plataBeamHeight },
            legBeam: { width: legBeamWidth, height: legBeamHeight },
            minGap: this.minGap
        });
        
        // יצירת קורות הפלטה (דומה לשולחן)
        const surfaceBeams = this.createSurfaceBeams(
            futonWidth,
            futonDepth,
            plataBeamWidth,
            plataBeamHeight,
            this.minGap
        );
        
        this.debugLog('🔍 FUTON 3D: surfaceBeams.length =', surfaceBeams.length, 'with params:', {
            futonWidth,
            futonDepth,
            plataBeamWidth,
            plataBeamHeight,
            minGap: this.minGap
        });
        
        for (let i = 0; i < surfaceBeams.length; i++) {
            const beam = { ...surfaceBeams[i] };
            const geometry = new THREE.BoxGeometry(
                beam.width,
                beam.height,
                beam.depth
            );
            const material = this.getWoodMaterial(plataType ? plataType.name : '');
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.addWireframeToBeam(mesh);
            
            // מיקום הפלטה בגובה של רוחב קורת הרגל
            mesh.position.set(beam.x, platformHeight + beam.height / 2, 0);
            this.scene.add(mesh);
            this.beamMeshes.push(mesh);
            
            this.debugLog(`קורת פלטה ${i + 1} - X: ${beam.x}, Y: ${platformHeight + beam.height / 2}, Z: 0`);
        }
        
        this.debugLog('קורות הפלטה נוצרו בהצלחה');
        
        // יצירת קורות הרגליים
        const extraBeamParam = this.getParam('extraBeam');
        if (extraBeamParam && extraBeamParam.default > 0) {
            const legCount = extraBeamParam.default;
            this.debugLog(`יצירת ${legCount} קורות רגליים...`);
            
            // 🎯 לוג בדיקה - הגעה ליצירת קורות רגל
            console.log('CHECK_FUTON_LEG - מתחיל ליצור קורות רגל:', JSON.stringify({
                legCount: legCount,
                legBeamExists: !!legBeam,
                legBeamWidth: legBeamWidth,
                legBeamHeight: legBeamHeight,
                futonWidth: futonWidth,
                futonDepth: futonDepth
            }, null, 2));
            
            // חישוב רווחים - 5 ס"מ מכל קצה
            const totalLength = futonDepth;
            const availableLength = totalLength - 10; // 5 ס"מ מכל קצה
            const spacing = legCount > 1 ? availableLength / (legCount - 1) : 0;
            
            // מערך לשמירת מיקומי הרגליים (Z positions)
            const legPositions: number[] = [];
            
            this.debugLog('חישוב רווחי רגליים:', {
                totalLength,
                availableLength,
                legCount,
                spacing
            });
            
            // יצירת קורות הרגליים
            for (let i = 0; i < legCount; i++) {
                // 🎯 תיקון: החלפה בין width ו-height - הקורה צריכה להיות עומדת ולא שוכבת
                const geometry = new THREE.BoxGeometry(
                    futonWidth,    // אורך הקורה = רוחב המיטה (ציר X) - נשאר אותו דבר
                    legBeamWidth,  // גובה הקורה (ציר Y) - הוחלף מ-legBeamHeight ל-legBeamWidth
                    legBeamHeight // רוחב הקורה (ציר Z) - הוחלף מ-legBeamWidth ל-legBeamHeight
                );
                
                // 🎯 לוג חד פעמי ברגע שנוצרת קורת הרגל
                if (!this.futonLegBeamLogged && legBeam) {
                    console.log('CHECK_FUTON_LEG - קורת רגל נוצרת:', JSON.stringify({
                        legIndex: i + 1,
                        geometryDimensions: {
                            x: futonWidth,        // אורך הקורה (ציר X)
                            y: legBeamWidth,      // גובה הקורה (ציר Y) - תוקן!
                            z: legBeamHeight      // רוחב הקורה (ציר Z) - תוקן!
                        },
                        legBeamData: {
                            width: legBeam.width,      // רוחב במ"מ
                            height: legBeam.height,    // גובה במ"מ
                            widthCm: legBeamWidth,     // רוחב בס"מ
                            heightCm: legBeamHeight    // גובה בס"מ
                        },
                        legBeamName: legBeam.name,
                        legBeamTranslatedName: legBeam.translatedName,
                        fixNote: "תיקון: y=legBeamWidth (15), z=legBeamHeight (3.5) במקום ההפך"
                    }, null, 2));
                    this.futonLegBeamLogged = true;
                }
                
                const material = this.getWoodMaterial(legType ? legType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh);
                
                // חישוב מיקום Z - מתחיל ב-5 ס"מ מהקצה
                const zPosition = -totalLength / 2 + 5 + (i * spacing);
                
                // שמירת מיקום הרגל למערך
                legPositions.push(zPosition);
                
                // מיקום הרגל - צמודה למטה (Y=0) + חצי גובה הקורה (כעת legBeamWidth במקום legBeamHeight)
                mesh.position.set(0, legBeamWidth / 2, zPosition);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
                
                this.debugLog(`רגל ${i + 1} - X: 0, Y: ${legBeamHeight / 2}, Z: ${zPosition}, אורך: ${futonWidth}ס"מ`);
            }
            
            this.debugLog(`${legCount} קורות רגליים נוצרו בהצלחה`);
            
            // יצירת ברגים - 2 ברגים בכל מפגש של קורת פלטה עם רגל
            this.debugLog(`יצירת ברגים למיטה: ${surfaceBeams.length} קורות פלטה × ${legCount} רגליים × 2 ברגים = ${surfaceBeams.length * legCount * 2} ברגים`);
            
            // אורך הבורג = גובה קורת הפלטה + 3
            const screwLength = this.calculateScrewLength('futon', plataBeamHeight);
            
            // עבור כל קורת פלטה
            for (let beamIndex = 0; beamIndex < surfaceBeams.length; beamIndex++) {
                const beam = surfaceBeams[beamIndex];
                
                // עבור כל רגל
                for (let legIndex = 0; legIndex < legPositions.length; legIndex++) {
                    const legZ = legPositions[legIndex];
                    
                    // 2 ברגים לכל מפגש - מרווחים ב-25% מרוחב קורת הפלטה (ציר X)
                    const offset = plataBeamWidth * 0.25; // 25% מרוחב קורת הפלטה
                    const screwOffsets = [-offset, offset];
                    
                    for (let screwIndex = 0; screwIndex < 2; screwIndex++) {
                        const screwXOffset = screwOffsets[screwIndex];
                        
                        // יצירת הבורג
                        const screwGroup = this.createScrewGeometry(screwLength);
                        
                        // מיקום הבורג: X = מיקום הקורה ± offset, Y = מעל הפלטה, Z = על הרגל
                        const screwX = beam.x + screwXOffset;
                        const screwY = platformHeight + plataBeamHeight; // מעל קורת הפלטה
                        const screwZ = legZ;
                        
                        screwGroup.position.set(screwX, screwY, screwZ);
                        
                        // סיבוב הבורג כך שיכוון מלמעלה למטה (ציר Y)
                        // ברורג מצביע כלפי מטה אז אין צורך בסיבוב נוסף
                        
                        this.scene.add(screwGroup);
                        this.screwGroups.push(screwGroup); // שמירת הבורג למחיקה מאוחר יותר
                    }
                }
            }
            
            this.debugLog('ברגי מיטה נוצרו בהצלחה');
        } else {
            this.debugLog('לא נמצא פרמטר extraBeam או ערך 0 - לא נוצרות רגליים');
        }
    }

    /**
     * בדיקה האם פרמטרים בסיסיים של המוצר השתנו מהמוצר המקורי
     */
    private hasProductParametersChanged(): boolean {
        // לוג חד פעמי בלבד כדי למנוע לוגים אינסופיים
        if (!this.paramChangedLogged) {
            console.log('CHECK_IS_MODIFIED - hasProductParametersChanged called (first time only)');
            console.log('CHECK_IS_MODIFIED - originalProductParams:', JSON.stringify(this.originalProductParams?.map(p => ({ 
                name: p.name, 
                default: p.default, 
                isVisual: p.isVisual,
                selectedBeamIndex: p.selectedBeamIndex,
                selectedTypeIndex: p.selectedTypeIndex
            })) || []));
            console.log('CHECK_IS_MODIFIED - current params:', JSON.stringify(this.params?.map(p => ({ 
                name: p.name, 
                default: p.default, 
                isVisual: p.isVisual,
                selectedBeamIndex: p.selectedBeamIndex,
                selectedTypeIndex: p.selectedTypeIndex
            })) || []));
            
            // CHECK_SHELF_BEAM: לוג מפורט על shelfs ב-CHECK_IS_MODIFIED
            const originalShelfs = this.originalProductParams?.find(p => p.name === 'shelfs');
            const currentShelfs = this.params?.find(p => p.name === 'shelfs');
            if (originalShelfs || currentShelfs) {
                console.log(`CHECK_SHELF_BEAM - CHECK_IS_MODIFIED: shelfs comparison:`, JSON.stringify({
                    originalSelectedBeamIndex: originalShelfs?.selectedBeamIndex,
                    originalSelectedTypeIndex: originalShelfs?.selectedTypeIndex,
                    currentSelectedBeamIndex: currentShelfs?.selectedBeamIndex,
                    currentSelectedTypeIndex: currentShelfs?.selectedTypeIndex,
                    changed: originalShelfs?.selectedBeamIndex !== currentShelfs?.selectedBeamIndex
                }, null, 2));
            }
            
            this.paramChangedLogged = true;
        }
        
        if (!this.originalProductParams || this.originalProductParams.length === 0) {
            return false;
        }

        
        // לוג מפורט של כל פרמטר
        this.originalProductParams.forEach((originalParam: any, index: number) => {
            const currentParam = this.params[index];
        });

        // בדיקה אם הפרמטרים הבסיסיים השתנו
        for (const originalParam of this.originalProductParams) {
            const currentParam = this.params.find(p => p.name === originalParam.name);
            
            if (!currentParam) {
                continue;
            }

            // דילוג על פרמטרים ויזואליים בלבד (לא משפיעים על סטטוס "מקורי")
            if (originalParam.isVisual === true || currentParam.isVisual === true) {
                continue;
            }

            // בדיקת ערך פרמטר - עם טיפול מיוחד במערכים (beamArray)
            if (Array.isArray(originalParam.default) || Array.isArray(currentParam.default)) {
                // בדיקה מיוחדת עבור מערכים (כמו מדפים)
                const originalArray = Array.isArray(originalParam.default) ? originalParam.default : [];
                const currentArray = Array.isArray(currentParam.default) ? currentParam.default : [];
                
                // בדיקת אורך המערכים
                if (originalArray.length !== currentArray.length) {
                    return true;
                }
                
                // בדיקת תוכן המערכים
                for (let i = 0; i < originalArray.length; i++) {
                    if (originalArray[i] !== currentArray[i]) {
                        return true;
                    }
                }
            } else {
                // בדיקה רגילה עבור ערכים יחידים - עם טיפול ב-undefined
                let originalValue = originalParam.default;
                let currentValue = currentParam.default;
                
                // עבור ערכים מספריים - המרה לפלואט אם אפשר
                if (typeof originalValue === 'string') {
                    const parsedOriginal = parseFloat(originalValue);
                    if (!isNaN(parsedOriginal)) originalValue = parsedOriginal;
                }
                
                if (typeof currentValue === 'string') {
                    const parsedCurrent = parseFloat(currentValue);
                    if (!isNaN(parsedCurrent)) currentValue = parsedCurrent;
                }

                if (originalValue !== currentValue) {
                    return true;
                }
            }

            // בדיקת אינדקס קורה
            if (originalParam.selectedBeamIndex !== undefined || currentParam.selectedBeamIndex !== undefined) {
                const originalBeamIndex = originalParam.selectedBeamIndex || 0;
                const currentBeamIndex = currentParam.selectedBeamIndex || 0;
                
                // CHECK_SHELF_BEAM: לוג בבדיקת השינוי ב-selectedBeamIndex (רק פעם אחת כדי למנוע לולאה אינסופית)
                // הלוג זה כבר מוגבל בלוג הראשי, אז לא צריך לוג נוסף כאן - זה גורם ללולאה אינסופית
                
                if (originalBeamIndex !== currentBeamIndex) {
                    return true;
                }
            }

            // בדיקת אינדקס סוג קורה
            if (originalParam.selectedTypeIndex !== undefined || currentParam.selectedTypeIndex !== undefined) {
                const originalTypeIndex = originalParam.selectedTypeIndex || 0;
                const currentTypeIndex = currentParam.selectedTypeIndex || 0;
                
                if (originalTypeIndex !== currentTypeIndex) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * פונקציה לעדכון פרמטרים לפי דגם משנה (configuration)
     */
    private updateParamsWithConfiguration(params: any[], configIndex: number, product: any): any[] {
        console.log(`SAVE_PRO - Loading configurations for product: ${product.translatedName} (config #${configIndex})`);
        
        // 🎯 לוג מיוחד עבור leg parameter
        const legParam = params.find(p => p.name === 'leg');
        if (legParam) {
            console.log(`CHECK_LEG - updateParamsWithConfiguration: Processing leg param`);
            console.log(`CHECK_LEG - leg param before configuration update:`, JSON.stringify(legParam, null, 2));
        }
        
        // 🎯 CHECK_SHELF_BEAM: לוג מיוחד עבור shelfs parameter
        const shelfsParam = params.find(p => p.name === 'shelfs');
        if (shelfsParam) {
            console.log(`CHECK_SHELF_BEAM - updateParamsWithConfiguration: Processing shelfs param`);
            console.log(`CHECK_SHELF_BEAM - shelfs param before configuration update:`, JSON.stringify({
                name: shelfsParam.name,
                type: shelfsParam.type,
                configIndex: configIndex,
                beamsConfigurations: shelfsParam.beamsConfigurations,
                beamConfigAtIndex: shelfsParam.beamsConfigurations?.[configIndex] || 'NO_BEAM_CONFIG',
                selectedBeamIndex: shelfsParam.selectedBeamIndex,
                selectedTypeIndex: shelfsParam.selectedTypeIndex,
                hasBeams: !!shelfsParam.beams,
                beamsLength: shelfsParam.beams?.length || 0,
                beams: shelfsParam.beams?.map((b: any, idx: number) => ({
                    index: idx,
                    name: b?.name,
                    width: b?.width,
                    height: b?.height,
                    translatedName: b?.translatedName
                })) || []
            }, null, 2));
        }
        
        console.log(`SAVE_PRO - Input params before configuration update:`, JSON.stringify(params.map(p => ({
            name: p.name,
            hasConfigurations: !!p.configurations,
            configurationsLength: p.configurations?.length || 0,
            configAtIndex: p.configurations?.[configIndex] || 'NO_CONFIG',
            isArrayConfig: Array.isArray(p.configurations?.[configIndex]),
            // עוד פרטים עבור beamSingle:
            hasBeamsConfigurations: !!p.beamsConfigurations,
            beamsConfigurationsLength: p.beamsConfigurations?.length || 0,
            beamConfigAtIndex: p.beamsConfigurations?.[configIndex] || 'NO_BEAM_CONFIG',
            hasBeams: !!p.beams,
            beamsLength: p.beams?.length || 0
        })), null, 2));
        
        const result = params.map((param: any) => {
            const updatedParam = { ...param };
            
            // עדכון default לפי configurations - עבור beamArray ופרמטרים רגילים
            if (param.configurations && param.configurations[configIndex] !== undefined) {
                console.log(`SAVE_PRO - Loading saved value for ${param.name}:`, JSON.stringify({
                    from: param.default,
                    to: param.configurations[configIndex],
                    isArray: Array.isArray(param.configurations[configIndex])
                }, null, 2));
                updatedParam.default = param.configurations[configIndex];
            } else {
                console.log(`SAVE_PRO - No saved configuration for ${param.name} at index ${configIndex}`);
            }
            
            // עדכון beamsConfigurations - מציאת אינדקס הקורה הנכונה
            if (param.beamsConfigurations && param.beamsConfigurations[configIndex]) {
                const beamConfigStr = param.beamsConfigurations[configIndex]; // e.g., "50-25"
                console.log(`SAVE_PRO - Loading beam configuration for ${param.name}: ${beamConfigStr}`);
                
                // 🎯 לוג מיוחד עבור קורת הרגל
                if (param.name === 'leg') {
                    console.log(`CHECK_LEG - updateParamsWithConfiguration: Found beamsConfiguration for leg param`);
                    console.log(`CHECK_LEG - leg beamConfigStr: ${beamConfigStr}`);
                    console.log(`CHECK_LEG - leg beamsConfigurations array:`, JSON.stringify(param.beamsConfigurations));
                    console.log(`CHECK_LEG - leg configIndex: ${configIndex}`);
                    console.log(`CHECK_LEG - leg beams ObjectIds:`, JSON.stringify(param.beams));
                }
                
                console.log(`SAVE_PRO - Will set selectedBeamIndex/selectedTypeIndex based on: ${beamConfigStr}`);
                
                // 🎯 תיקון: קביעת selectedBeamIndex עבור beamArray (shelfs) כאן!
                if (param.name === 'shelfs' && param.beams && Array.isArray(param.beams) && param.beams.length > 0) {
                    console.log(`CHECK_SHELF_BEAM - updateParamsWithConfiguration: Starting shelfs beam search`);
                    console.log(`CHECK_SHELF_BEAM - Shelfs in updateParamsWithConfiguration: hasBeams=${!!param.beams}, beamsLength=${param.beams.length}, beamConfigStr=${beamConfigStr}`);
                    const [width, height] = beamConfigStr.split('-').map(num => parseInt(num, 10));
                    console.log(`CHECK_SHELF_BEAM - Searching for shelfs beam: ${width}-${height} in ${param.beams.length} beams`);
                    
                    // בדיקה אם beams הם אובייקטים עם width/height או ObjectIds
                    const firstBeam = param.beams[0];
                    const isPopulated = firstBeam && typeof firstBeam === 'object' && firstBeam !== null && 'width' in firstBeam;
                    
                    console.log(`SAVE_PRO - shelfs beams are ${isPopulated ? 'POPULATED (objects)' : 'NOT POPULATED (ObjectIds)'}, firstBeam type: ${typeof firstBeam}`);
                    if (firstBeam) {
                        console.log(`SAVE_PRO - shelfs firstBeam keys:`, Object.keys(firstBeam));
                    }
                    
                    if (isPopulated) {
                        // beams כבר populated - אפשר לחפש ישירות
                        console.log(`SAVE_PRO - Searching in populated beams for ${width}-${height}`);
                        const foundBeamIndex = param.beams.findIndex((beam: any) => {
                            if (!beam || typeof beam !== 'object') return false;
                            const matches = beam.width === width && beam.height === height;
                            if (matches) {
                                console.log(`SAVE_PRO - ✅ Found match at index ${param.beams.indexOf(beam)}: ${beam.name} (${beam.width}-${beam.height})`);
                            }
                            return matches;
                        });
                        
                    if (foundBeamIndex !== -1) {
                        updatedParam.selectedBeamIndex = foundBeamIndex;
                        updatedParam.selectedTypeIndex = 0; // ברירת מחדל
                            console.log(`CHECK_SHELF_BEAM - ✅ updateParamsWithConfiguration: Set shelfs selectedBeamIndex to ${foundBeamIndex} based on ${beamConfigStr}`);
                            console.log(`CHECK_SHELF_BEAM - Updated param state:`, JSON.stringify({
                                selectedBeamIndex: updatedParam.selectedBeamIndex,
                                selectedTypeIndex: updatedParam.selectedTypeIndex,
                                beamConfigStr: beamConfigStr,
                                configIndex: configIndex
                            }, null, 2));
                            // לא נשאיר _pendingBeamConfig כי מצאנו את הקורה
                            delete updatedParam._pendingBeamConfig;
                        } else {
                            console.log(`CHECK_SHELF_BEAM - ❌ updateParamsWithConfiguration: Could not find shelfs beam ${beamConfigStr} (${width}-${height}) in populated beams, will use _pendingBeamConfig`);
                            console.log(`CHECK_SHELF_BEAM - Available beams:`, JSON.stringify(param.beams.map((b: any) => `${b.name} (${b.width}-${b.height})`), null, 2));
                            updatedParam._pendingBeamConfig = beamConfigStr;
                        }
                    } else {
                        // beams לא populated - נשתמש ב-_pendingBeamConfig ונטפל בשלב הבא
                        console.log(`CHECK_SHELF_BEAM - updateParamsWithConfiguration: shelfs beams not populated, setting _pendingBeamConfig: ${beamConfigStr}`);
                        updatedParam._pendingBeamConfig = beamConfigStr;
                    }
                } else if (param.name === 'shelfs') {
                    // גם אם אין beams או shelfs לא מוגדר נכון, נשמור את beamConfigStr
                    console.log(`SAVE_PRO - Shelfs but no beams array or empty, setting _pendingBeamConfig: ${beamConfigStr}`);
                    updatedParam._pendingBeamConfig = beamConfigStr;
                }
                
                // עבור beamSingle - תמיד נשתמש ב-_pendingBeamConfig
                if (param.type === 'beamSingle') {
                updatedParam._pendingBeamConfig = beamConfigStr;
                }
            } else {
                console.log(`SAVE_PRO - Skipping beam configuration for ${param.name}:`, JSON.stringify({
                    hasBeamsConfigurations: !!param.beamsConfigurations,
                    hasConfigAtIndex: !!param.beamsConfigurations?.[configIndex],
                    hasBeams: !!param.beams,
                    beamsLength: param.beams?.length || 0
                }, null, 2));
                
                // 🎯 לוג מיוחד עבור קורת הרגל כשלא מוצאים beamsConfiguration
                if (param.name === 'leg') {
                    console.log(`CHECK_LEG - updateParamsWithConfiguration: NO beamsConfiguration found for leg`);
                    console.log(`CHECK_LEG - leg param full object:`, JSON.stringify(param, null, 2));
                }
            }
            
            return updatedParam;
        });
        
        console.log(`SAVE_PRO - Result after configuration update:`, JSON.stringify(result.map(p => ({
            name: p.name,
            default: p.default,
            isArray: Array.isArray(p.default)
        })), null, 2));
        
        // 🎯 לוג מיוחד עבור leg parameter - תוצאה סופית
        const legResultParam = result.find(p => p.name === 'leg');
        if (legResultParam) {
            console.log(`CHECK_LEG - updateParamsWithConfiguration: leg param AFTER configuration update`);
            console.log(`CHECK_LEG - leg param result:`, JSON.stringify(legResultParam, null, 2));
            console.log(`CHECK_LEG - leg _pendingBeamConfig:`, legResultParam._pendingBeamConfig);
        }
        
        return result;
    }

    /**
     * פונקציה ליצירת deep copy של פרמטרים
     */
    private deepCopyParams(params: any[]): any[] {
        return JSON.parse(JSON.stringify(params));
    }
    
    // 🎯 פונקציה לבדיקת leg parameter בזמן render של ה-UI
    logLegParam(param: any): string {
        if (param.name === 'leg') {
            console.log(`CHECK_LEG - UI RENDER: leg selectedBeamIndex = ${param.selectedBeamIndex}`);
            console.log(`CHECK_LEG - UI RENDER: leg beam name = ${param.beams[param.selectedBeamIndex]?.translatedName}`);
            console.log(`CHECK_LEG - UI RENDER: param object ID = ${param._id || 'NO_ID'}`);
            console.log(`CHECK_LEG - UI RENDER: has _pendingBeamConfig = ${!!param._pendingBeamConfig}`);
            
            // בדיקה אם יש mismatch בין הערכים
            if (param.selectedBeamIndex === 0 && param.beams[2]?.name === '50-25') {
                console.log(`CHECK_LEG - UI RENDER: MISMATCH DETECTED! Should be index 2 (${param.beams[2]?.translatedName}), but showing index 0 (${param.beams[0]?.translatedName})`);
            }
        }
        return ''; // החזרת מחרוזת ריקה כדי שלא יופיע כלום ב-UI
    }
    
    // 🎯 תיקון זמני לבעיית leg parameter
    private fixLegParameterIfNeeded(): void {
        if (this.params) {
            const legParam = this.params.find(p => p.name === 'leg');
            if (legParam) {
                console.log(`CHECK_LEG - TEMP FIX CHECK: Current leg selectedBeamIndex = ${legParam.selectedBeamIndex}`);
                if (legParam.selectedBeamIndex === 0 && legParam.beams && legParam.beams[2]?.name === '50-25') {
                    console.log(`CHECK_LEG - TEMP FIX: Correcting leg parameter from index 0 to index 2`);
                    legParam.selectedBeamIndex = 2;
                    legParam.selectedTypeIndex = 0;
                    console.log(`CHECK_LEG - TEMP FIX: Fixed! Now showing "${legParam.beams[2]?.translatedName}"`);
                } else {
                    console.log(`CHECK_LEG - TEMP FIX: No fix needed. selectedBeamIndex = ${legParam.selectedBeamIndex}`);
                }
            } else {
                console.log(`CHECK_LEG - TEMP FIX: No leg parameter found`);
            }
        } else {
            console.log(`CHECK_LEG - TEMP FIX: No params available`);
        }
    }

    /**
     * פונקציה עזר לבחירת קורה לפי defaultType
     */
    private getBeamIndexByDefaultType(param: any): number {
        let beamIndex = param.selectedBeamIndex || 0;
        
        // אם יש defaultType, מחפשים את הקורה המתאימה לפי ה-ID
        if (param.defaultType && !param.selectedBeamIndex && param.beams && param.beams.length > 0) {
            const defaultTypeId = param.defaultType.$oid || param.defaultType._id || param.defaultType;
            const foundIndex = param.beams.findIndex((b: any) => {
                const beamId = b._id || b.$oid;
                return beamId === defaultTypeId;
            });
            if (foundIndex !== -1) {
                beamIndex = foundIndex;
                this.debugLog(`CHACK-BEAM-MINI: 🎯 בחירת קורת ${param.name} לפי defaultType: ${defaultTypeId} -> index ${beamIndex}`);
            }
        }
        
        return beamIndex;
    }

    /**
     * עריכת מוצר - פתיחת דיאלוג מידע מוצר
     */
    editProduct(): void {
        console.log('SAVE_PRO - EditProduct dialog opening started');
        
        // 🎯 תיקון פרמטרים לפני פתיחת הדיאלוג
        this.fixLegParameterIfNeeded();
        console.log('SAVE_PRO - Applied parameter fixes before opening dialog');
        
        // בדיקת פרמטר leg אחרי התיקון
        const legParam = this.params?.find(p => p.name === 'leg');
        if (legParam) {
            console.log('SAVE_PRO - leg parameter after fix:', JSON.stringify({
                selectedBeamIndex: legParam.selectedBeamIndex,
                selectedTypeIndex: legParam.selectedTypeIndex,
                beamName: legParam.beams?.[legParam.selectedBeamIndex]?.translatedName,
                beamConfiguration: legParam.beams?.[legParam.selectedBeamIndex]?.name
            }, null, 2));
        }
        
        console.log('SAVE_PRO - Current product data:', JSON.stringify({
            productId: this.product?._id || this.product?.id || 'NO_ID',
            productName: this.product?.name || 'NO_NAME',
            productModel: this.product?.model || 'NO_MODEL',
            configurationIndex: this.product?.configurationIndex || 0,
            currentConfiguration: this.product?.configurations?.[this.product?.configurationIndex || 0] || null,
            paramsCount: this.params?.length || 0,
            hasBeamData: false, // beamsData not available in this component
            hasCalculatedData: !!this.calculatedPrice
        }, null, 2));

        // בדיקה אם יש מוצר זמין
        if (!this.product) {
            console.log('SAVE_PRO - ERROR: No product available for editing');
            alert('אין מוצר זמין לעריכה');
            return;
        }

        // בדיקה אם יש פרמטרים
        if (!this.params || this.params.length === 0) {
            console.log('SAVE_PRO - ERROR: No parameters available for editing');
            alert('אין פרמטרים זמינים לעריכה');
            return;
        }

        // הכנת נתוני המוצר עבור הדיאלוג
        const productDataForDialog = {
            product: { ...this.product },
            currentParams: [...this.params], // 🎯 זה אמור להכיל את השינויים הנוכחיים מה-UI
            currentConfiguration: this.product?.configurations?.[this.product?.configurationIndex || 0] || null,
            beamsData: null, // beamsData not available in this component
            calculatedPrice: this.calculatedPrice || 0,
            timestamp: new Date().toISOString()
        };
        
        // 🎯 לוג הפרמטרים שמועברים לדיאלוג
        console.log('SAVE_PRO - Parameters being passed to dialog:', JSON.stringify(
            this.params?.map(param => ({
                name: param.name,
                type: param.type,
                currentValue: param.default,
                selectedBeamIndex: param.selectedBeamIndex,
                selectedTypeIndex: param.selectedTypeIndex,
                beamName: param.beams?.[param.selectedBeamIndex]?.translatedName,
                beamConfig: param.beams?.[param.selectedBeamIndex]?.name
            })), null, 2));

        console.log('SAVE_PRO - Opening ProductEditInfo dialog with data:', JSON.stringify({
            productId: productDataForDialog.product._id || productDataForDialog.product.id,
            productName: productDataForDialog.product.name,
            paramsCount: productDataForDialog.currentParams.length,
            hasConfiguration: !!productDataForDialog.currentConfiguration,
            configurationName: productDataForDialog.currentConfiguration?.translatedName || productDataForDialog.currentConfiguration?.name,
            timestamp: productDataForDialog.timestamp
        }, null, 2));

        // פתיחת הדיאלוג
        this.dialogService.onOpenProductEditInfoDialog(productDataForDialog);
        
        console.log('SAVE_PRO - ProductEditInfo dialog opened successfully');
    }

}


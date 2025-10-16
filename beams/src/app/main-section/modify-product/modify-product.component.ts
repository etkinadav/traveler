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
        ])
    ]
})
export class ModifyProductComponent implements AfterViewInit, OnDestroy, OnInit {
    // Debug mode - set to true to enable console logs
    private enableDebugLogs = false;
    
    // Performance tracking
    private performanceTimers: Map<string, number> = new Map();
    
    // Debug helper function - only logs when enableDebugLogs is true
    private debugLog(...args: any[]): void {
        if (this.enableDebugLogs) {
            console.log(...args);
        }
    }
    
    // Performance timing helper - always enabled for critical performance tracking
    private startTimer(label: string): void {
        this.performanceTimers.set(label, performance.now());
        console.log(`DEBUG-THE-CABINET ⏱️ START: ${label}`);
    }
    
    private endTimer(label: string): void {
        const startTime = this.performanceTimers.get(label);
        if (startTime) {
            const duration = performance.now() - startTime;
            console.log(`DEBUG-THE-CABINET ⏱️ END: ${label} - Duration: ${duration.toFixed(2)}ms`);
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
    
    // עריכת מוצר
    editProduct() {
        // Edit product dialog removed
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
    
    
    // פונקציה להוספת המוצר לסל
    addProductToBasket() {
        try {
            // יצירת קונפיגורציה של המוצר (פורמט 1)
            const productConfiguration: ProductConfiguration = {
                productName: this.selectedProductName || 'Unknown Product',
                translatedProductName: this.selectedProductName || 'Unknown Product',
                inputConfigurations: this.params.map(param => ({
                    inputName: param.name,
                    value: param.value
                })),
                selectedCorners: this.params.map(param => ({
                    cornerType: param.name,
                    cornerData: param.selectedBeamIndex !== undefined ? param.beams[param.selectedBeamIndex] : null
                })),
                originalProductData: this.params
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
                    // האם המשתמש ערך את הכמויות
                    wasEdited: this.hasBeamsChanged || this.hasScrewsChanged,
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

            // הוספה לסל
            this.productBasketService.addToBasket(
                productConfiguration,
                cutList,
                organizedArrangement,
                pricingInfo
            );

            console.log('✅ Product added to basket successfully!');
            
            // פתיחת דיאלוג הסל
            this.openShoppingCart();
            
        } catch (error) {
            console.error('❌ Error adding product to basket:', error);
        }
    }
    
    /**
     * פתיחת דיאלוג סל המוצרים
     */
    openShoppingCart() {
        this.router.navigate(['/shopping-cart']);
    }
    
    // פונקציה לטיפול בלחיצה על כפתור "המשך"
    onContinueOrder() {
        // הוספת המוצר לסל ללא צורך בהתחברות
        console.log('🛒 Adding product to basket without authentication requirement');
        this.addProductToBasket();
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
        param.selectedBeamIndex = index;
        param.selectedTypeIndex = 0; // איפוס בחירת סוג העץ לסוג הראשון
        this.updateBeams();
        this.closeDropdown('beam', param);
    }

    selectType(index: number, param: any) {
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
                
                // יצירת מזהה ייחודי שכולל גם את ה-configIndex
                const lastFullId = lastConfigIndex !== null ? `${lastProductId}_config${lastConfigIndex}` : lastProductId;
                const currentFullId = currentConfigIndex !== undefined ? `${currentProductId}_config${currentConfigIndex}` : currentProductId;
                
                this.debugLog(
                    'CHACK-BEAM-MINI: Last full ID from localStorage:',
                    lastFullId,
                    'Current full ID:',
                    currentFullId
                );
                
                if (lastFullId && lastFullId !== currentFullId) {
                    this.debugLog(
                        'CHACK-BEAM-MINI: תת-מוצר שונה נבחר, מנקה ערכים:',
                        lastFullId,
                        '->',
                        currentFullId
                    );
                    this.clearUserConfiguration();
                } else {
                    this.debugLog(
                        'CHACK-BEAM-MINI: Same sub-product or first time, no need to clear configuration'
                    );
                }
                
                // שמירת המוצר והתת-מוצר הנוכחיים
                localStorage.setItem('lastSelectedProductId', currentProductId);
                if (currentConfigIndex !== undefined) {
                    localStorage.setItem('lastConfigIndex', currentConfigIndex.toString());
                } else {
                    localStorage.removeItem('lastConfigIndex');
                }
                
                this.debugLog(
                    'CHACK-BEAM-MINI: Saved to localStorage:',
                    { productId: currentProductId, configIndex: currentConfigIndex }
                );
                
                // טעינת המוצר הנכון לפי ID או שם
                if (params['productId']) {
                    // בדיקה אם יש configIndex ב-URL
                    const configIndex = params['configIndex'] !== undefined ? parseInt(params['configIndex']) : undefined;
                    this.getProductById(params['productId'], configIndex);
                } else {
                this.getProductByName(this.selectedProductName);
                }
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
        this.getProductById('68a186bb0717136a1a9245de');
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
    
    // פונקציה לעדכון פרמטרים לפי דגם משנה (configuration)
    private updateParamsWithConfiguration(params: any[], configIndex: number, product: any): any[] {
        this.debugLog(`CHACK-BEAM-MINI: [threejs-box] === עדכון פרמטרים למוצר: ${product.translatedName} (configuration #${configIndex}) ===`);
        
        return params.map((param: any) => {
            const updatedParam = { ...param };
            
            // עדכון default לפי configurations
            if (param.configurations && param.configurations[configIndex] !== undefined) {
                this.debugLog(`CHACK-BEAM-MINI: [threejs-box] 📝 עדכון default עבור ${param.name}: ${param.default} -> ${param.configurations[configIndex]}`);
                updatedParam.default = param.configurations[configIndex];
            }
            
            // עדכון beamsConfigurations - מציאת הקורה לפי name
            if (param.beamsConfigurations && param.beamsConfigurations[configIndex] && param.beams && param.beams.length > 0) {
                const beamName = param.beamsConfigurations[configIndex];
                
                this.debugLog(`CHACK-BEAM-MINI: [threejs-box] 🔍 מחפש קורה עבור פרמטר: ${param.name}`);
                this.debugLog(`CHACK-BEAM-MINI: [threejs-box]    📌 שם קורה מבוקש: "${beamName}"`);
                this.debugLog(`CHACK-BEAM-MINI: [threejs-box]    📌 defaultType לפני עדכון:`, param.defaultType);
                
                // חיפוש הקורה ברשימת beams
                let foundBeamId: string | null = null;
                
                for (const beamRef of param.beams) {
                    const beamId = beamRef.$oid || beamRef._id || beamRef;
                    
                    // בדיקה לפי name
                    if (beamRef.name === beamName) {
                        foundBeamId = beamId;
                        this.debugLog(`CHACK-BEAM-MINI: [threejs-box]    ✅ נמצאה קורה: ${beamRef.name} (ID: ${foundBeamId})`);
                        break;
                    }
                }
                
                if (foundBeamId) {
                    updatedParam.defaultType = { $oid: foundBeamId };
                    this.debugLog(`CHACK-BEAM-MINI: [threejs-box]    ✨ defaultType עודכן ל: { $oid: "${foundBeamId}" }`);
                } else {
                    this.debugLog(`CHACK-BEAM-MINI: [threejs-box]    ❌ לא נמצאה קורה מתאימה - נשאר עם default`);
                }
            }
            
            return updatedParam;
        });
    }
    
    // פונקציה עזר לבחירת קורה לפי defaultType
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
                
                // אם זה תת-מוצר (יש configIndex), נעדכן את הפרמטרים לפי ה-configuration
                if (configIndex !== undefined && prod.configurations && prod.configurations[configIndex]) {
                    this.debugLog(`CHACK-BEAM-MINI: טעינת תת-מוצר configuration #${configIndex}: ${prod.configurations[configIndex].translatedName}`);
                    prod.params = this.updateParamsWithConfiguration(prod.params, configIndex, prod);
                    prod.translatedName = prod.configurations[configIndex].translatedName;
                    prod.configurationName = prod.configurations[configIndex].name;
                    prod.configurationIndex = configIndex;
                }
                
                this.params = (prod.params || []).map((param) => {
                    // Set default selected beam and type for shelfs and beamSingle
                    if (
                        param.name === 'shelfs' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for shelfs parameter');
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                : null;
                        this.debugLog('Shelfs parameter set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beamSingle parameter:', param.name);
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                : null;
                        this.debugLog('BeamSingle parameter', param.name, 'set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
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
                
                if (lastFullId === currentFullId) {
                    this.debugLog('CHACK-BEAM-MINI: [threejs-box] Same sub-product, loading saved configuration');
                this.loadConfiguration();
                } else {
                    this.debugLog('CHACK-BEAM-MINI: [threejs-box] Different sub-product, not loading configuration');
                }
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
                this.params = (prod.params || []).map((param) => {
                    // Set default selected beam and type for shelfs and beamSingle
                    if (
                        param.name === 'shelfs' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for shelfs parameter');
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                : null;
                        this.debugLog('Shelfs parameter set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        this.debugLog('Setting default beam for beamSingle parameter:', param.name);
                        const defaultBeamIndex = this.findDefaultBeamIndex(param.beams, param.defaultType);
                        param.selectedBeamIndex = defaultBeamIndex;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[defaultBeamIndex].types) &&
                            param.beams[defaultBeamIndex].types.length
                                ? 0
                                : null;
                        this.debugLog('BeamSingle parameter', param.name, 'set to beam index:', defaultBeamIndex, 'type index:', param.selectedTypeIndex);
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
                // Load saved configuration after product is loaded (only if same product)
                const lastProductId = localStorage.getItem('lastSelectedProductId');
                const currentProductId = this.product?._id || this.selectedProductName;
                if (lastProductId === currentProductId) {
                this.loadConfiguration();
                }
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
                    console.log('Server configuration not available, using localStorage');
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
                console.error(
                    'Error loading configuration from localStorage:',
                    error
                );
            }
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
                }
            });
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
        window.removeEventListener('resize', this.onResizeBound);
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
        this.startTimer('TOTAL_UPDATE_BEAMS');
        
        // איפוס מחיר להצגת "מחשב מחיר..."
        this.calculatedPrice = 0;
        
        // הפעלת loading
        this.isLoading = true;
        this.isModelLoading = true;
        
        this.startTimer('Save Configuration');
        // Save current configuration to localStorage
        this.saveConfiguration();
        this.endTimer('Save Configuration');
        
        // איפוס המשתנים הבוליאניים לבדיקת קורות מוסתרות
        this.hasHiddenBeams = false;
        this.hiddenBeamsCount = 0;
        this.hasNoMiddleBeams = false;
        
        // חישוב מחיר יבוצע ברקע אחרי הרינדור
        
        this.startTimer('Clear Old Meshes');
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
        this.endTimer('Clear Old Meshes');
        
        // Defensive checks
        if (!this.isTable && !this.isPlanter && !this.isBox && !this.isBelams && !this.isFuton && (!this.shelves || !this.shelves.length)) {
            console.warn('No shelves found, cannot render model.');
            this.endTimer('TOTAL_UPDATE_BEAMS');
            return;
        }
        
        // טיפול במוצר קורות לפי מידה (beams)
        if (this.isBelams) {
            this.startTimer('Update Beams Model');
            this.updateBeamsModel();
            this.endTimer('Update Beams Model');
            // הגדרת מיקום הסצנה כמו בשאר המוצרים
            this.scene.position.y = -120;
            // אתחול המצלמה עם אנימציה - רק בטעינה ראשונית
            if (isInitialLoad) {
                this.centerCameraOnBeams();
            }
            this.endTimer('TOTAL_UPDATE_BEAMS');
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
            // עבור שולחן, נשתמש בפרמטר plata במקום shelfs
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
        } else if (this.isFuton) {
            // עבור בסיס מיטה, נשתמש בפרמטר plata (דומה לשולחן)
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'plata'
            );
        } else if (this.isPlanter || this.isBox) {
            // עבור עדנית, נשתמש בפרמטר beam
            this.debugLog('מחפש פרמטר beam לעדנית...');
            this.debugLog('פרמטרים זמינים:', this.product?.params?.map(p => ({name: p.name, type: p.type})));
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'beam'
            );
            this.debugLog('shelfsParam נמצא:', shelfsParam);
        } else {
            // עבור ארון, נשתמש בפרמטר shelfs
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamArray' && p.name === 'shelfs'
            );
        }
        let shelfBeam = null;
        let shelfType = null;
        if (
            shelfsParam &&
            Array.isArray(shelfsParam.beams) &&
            shelfsParam.beams.length
        ) {
            shelfBeam = shelfsParam.beams[shelfsParam.selectedBeamIndex || 0];
            shelfType =
                shelfBeam.types && shelfBeam.types.length
                    ? shelfBeam.types[shelfsParam.selectedTypeIndex || 0]
                    : null;
            this.debugLog('shelfBeam נמצא:', shelfBeam);
            this.debugLog('shelfType נמצא:', shelfType);
        } else {
            this.debugLog('shelfsParam לא תקין:', shelfsParam);
            this.debugLog('beams array:', shelfsParam?.beams);
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
            // Surface beams (קורת משטח) - מדף אחד בלבד
            const surfaceBeams = this.createSurfaceBeams(
                this.surfaceWidth,
                this.surfaceLength,
                beamWidth,
                beamHeight,
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
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
                // הוספת ברגים לקורת המדף
                this.addScrewsToShelfBeam(
                    beam,
                    tableHeight,
                    beamHeight,
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
                const extraBeamDistance = extraBeamParam.default;
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
            
            const legs = this.createLegBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                totalY
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
                mesh.position.set(leg.x, leg.height / 2, leg.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // הוספת ברגים לרגליים (קורות חיזוק עליונות)
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
            const extraBeamDistance = extraBeamParam && extraBeamParam.default > 0 ? extraBeamParam.default : 0;
            const totalDistanceForLower = extraBeamDistance + calculatedFrameBeamHeightForLower;
            const lowerFrameY = tableHeight - calculatedFrameBeamHeightForLower / 2 - totalDistanceForLower;
            
            this.debugLog('Adding lower frame screws - tableHeight:', tableHeight, 'extraBeamDistance:', extraBeamDistance, 'totalDistance:', totalDistanceForLower, 'lowerFrameY:', lowerFrameY, 'frameBeamHeight:', calculatedFrameBeamHeightForLower);
            this.addScrewsToLowerFrameBeams(legs, lowerFrameY, frameBeamHeight);
        } else if (this.isFuton) {
            // עבור בסיס מיטה - דומה לשולחן אבל עם גובה שונה
            this.createFutonBeams();
        } else if (this.isPlanter || this.isBox) {
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
            
            // העדנית תשתמש בפונקציה centerCameraOnWireframe() כמו שאר המוצרים
        } else {
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
            // עבור ארון, נוסיף את גובה קורות המדפים לגובה הרגליים
            const shelfBeamHeight = beamHeight; // זה כבר מחושב למעלה
            // חישוב גובה כולל לארון
            let totalY = 0;
            for (const shelf of this.shelves) {
                totalY += shelf.gap + frameBeamHeight + beamHeight;
            }
            const legs = this.createLegBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                totalY
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
                mesh.position.set(leg.x, leg.height / 2, leg.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // הוספת ברגים לרגליים עבור ארון
            this.addScrewsToLegs(totalShelves, legs, frameBeamHeight, 0);
        }
        
        // עבור ארון - הקוד המקורי
        if (!this.isTable && !this.isPlanter && !this.isBox) {
            this.startTimer('CABINET - Total Rendering');
            console.log(`DEBUG-THE-CABINET 📦 Starting cabinet rendering - ${this.shelves.length} shelves`);
            
            // עבור ארון - הקוד המקורי
            for (
                let shelfIndex = 0;
                shelfIndex < this.shelves.length;
                shelfIndex++
            ) {
            this.startTimer(`CABINET - Shelf ${shelfIndex + 1}`);
            const shelf = this.shelves[shelfIndex];
            currentY += shelf.gap;
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
            const surfaceBeams = this.createSurfaceBeams(
                this.surfaceWidth,
                this.surfaceLength,
                beamWidth,
                beamHeight,
                this.minGap
            );
            this.endTimer(`CABINET - Create Surface Beams for Shelf ${shelfIndex + 1}`);

                // חישוב רווח בין קורות
                const totalBeamWidth = surfaceBeams.length * beamWidth;
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
                this.debugLog('   - רוחב:', beamWidth, 'ס"מ');
                this.debugLog('   - גובה:', beamHeight, 'ס"מ');

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

                // 4. בדיקת חסימת קורות על ידי רגליים
                this.debugLog('4. בדיקת חסימת קורות:');
                const beamAndGapWidth = beamWidth + gapBetweenBeams;
                const isTopShelf = shelfIndex === totalShelves - 1;
                const shouldHideBeams =
                    beamAndGapWidth < legWidth && !isTopShelf;

                // עדכון המשתנה הבוליאני הגלובלי
                if (shouldHideBeams) {
                    this.hasHiddenBeams = true;
                    // חישוב כמות הקורות המוסתרות (2 קורות לכל מדף שאיננו עליון)
                    this.hiddenBeamsCount += 2;
                    
                    // בדיקת מקרה קיצון: אם נשארות רק שתי הקורות המקוצרות (ראשונה ואחרונה)
                    // כלומר, אם יש רק 4 קורות בסך הכל ו-2 מוסתרות, נשארות רק 2
                    if (surfaceBeams.length === 4 && this.hiddenBeamsCount >= 2) {
                        this.hasNoMiddleBeams = true;
                        this.debugLog('   - מקרה קיצון: נשארות רק שתי הקורות המקוצרות (אין קורות באמצע)');
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
                    const beamAndGapWidth = beamWidth + gapBetweenBeams;
                    const shouldHideBeams =
                        beamAndGapWidth < legWidth && !isTopShelf;
                    const shouldSkipThisBeam =
                        shouldHideBeams &&
                        (i === 1 || i === surfaceBeams.length - 2);

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
                    beam.depth = beam.depth - 2 * frameBeamWidth;
                }
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
                    mesh.position.set(
                        beam.x,
                        currentY + frameBeamHeight + beam.height / 2,
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
                        currentY + frameBeamHeight,
                        beamHeight,
                        frameBeamWidth,
                        isShortenedBeam
                    );
                }
            this.endTimer(`CABINET - Render ${surfaceBeams.length} Beams for Shelf ${shelfIndex + 1}`);
            
            // Frame beams (קורת חיזוק)
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
                const frameY = currentY + beam.height / 2;
                mesh.position.set(beam.x, frameY, beam.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            this.endTimer(`CABINET - Create and Render Frame Beams for Shelf ${shelfIndex + 1}`);
            
            // Add the height of the shelf itself for the next shelf
            currentY += frameBeamHeight + beamHeight;
            this.endTimer(`CABINET - Shelf ${shelfIndex + 1}`);
        }
        this.endTimer('CABINET - Total Rendering');
        // לא מעדכן מיקום מצלמה/zoom אחרי עדכון אלמנטים
        // רגליים (legs)
        if (this.isTable || this.shelves.length) {
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
            // Compute total height for legs and camera
            let totalY = 0;
            if (this.isTable) {
                // עבור שולחן, הגובה הכולל הוא גובה השולחן
                const heightParam = this.getParam('height');
                totalY = heightParam ? heightParam.default : 80;
            } else if (this.isPlanter || this.isBox) {
                // עבור עדנית, הגובה הכולל הוא גובה העדנית
                const heightParam = this.getParam('height');
                totalY = heightParam ? heightParam.default : 50;
            } else {
                // עבור ארון, הגובה הכולל הוא סכום כל המדפים
            for (const shelf of this.shelves) {
                    totalY += shelf.gap + frameBeamHeight + beamHeight;
                }
            }
            const legs = this.createLegBeams(
                this.surfaceWidth,
                this.surfaceLength,
                frameBeamWidth,
                frameBeamHeight,
                totalY
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
                mesh.position.set(leg.x, leg.height / 2, leg.z);
                this.scene.add(mesh);
                this.beamMeshes.push(mesh);
            }
            // הוספת ברגים לרגליים
                this.addScrewsToLegs(
                    this.isTable ? 1 : totalShelves,
                    legs,
                    frameBeamHeight,
                    0
                );
            // Focus camera at the vertical center of the structure
            // Camera will look at center by default
        }
        }
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
        console.log('DEBUG-THE-CABINET ✅ UpdateBeams completed');
        
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
        console.log('CUTTING_DEBUG - שומר מצב מקורי של קורות בסוף החישוב הראשוני');
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
        // קבלת נתוני הקורות מהפרמטרים
        const shelfParam = this.isTable || this.isFuton
            ? this.product?.params?.find(
                  (p: any) => p.type === 'beamSingle' && p.name === 'plata'
              )
            : (this.isPlanter || this.isBox)
            ? this.product?.params?.find(
                  (p: any) => p.type === 'beamSingle' && p.name === 'beam'
              )
            : this.product?.params?.find(
                  (p: any) => p.type === 'beamArray' && p.name === 'shelfs'
              );
        const frameParam = this.product?.params?.find(
            (p: any) => p.type === 'beamSingle' && p.name === 'frame'
        );
        const legParam = this.product?.params?.find(
            (p: any) => p.type === 'beamSingle' && p.name === 'leg'
        );
        const extraParam = this.product?.params?.find(
            (p: any) => p.type === 'beamSingle' && p.name === 'extraBeam'
        );
        
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
                    let beamWidth = selectedBeam.height / 10 || this.beamWidth; // המרה ממ"מ לס"מ (height של הקורה)
                    const beamHeight = selectedBeam.width / 10 || this.beamHeight; // width של הקורה
                    
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
                    
                // עבור ארון, אם הקורה רחבה מדי, נשתמש ברוחב קטן יותר
                    if (!this.isTable && !this.isPlanter && !this.isBox && beamWidth > 5) {
                        this.debugLog('🔍 ARMOIRE - Beam width adjustment for armoire');
                    beamWidth = 4; // רוחב קטן יותר עבור ארון
                }
                    
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
                        const beamsInDepth = Math.floor(planterWidth / beamHeight); // כמות קורות ברצפה
                        const beamsInHeight = Math.floor(planterHeight / beamHeight); // כמות קורות בקיר (W)
                        
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
                        
                        // חישוב אורכי הקורות
                        const length1 = planterDepth; // אורך 1: planterDepth
                        const length2 = planterDepth - (beamWidth * 2); // אורך 2: planterDepth פחות (beamWidth כפול 2)
                        const length3 = planterWidth; // אורך 3: planterWidth
                        const length4 = planterHeight; // אורך 4: planterHeight
                        
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
                        
                        // הוספת קורות אורך 4 (קורות חיזוק) - כמות: 4
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
                            
                            // קורות חיזוק המכסה - 2 קורות (מקוצרות ב-0.2 ס"מ = 2 מ"מ נוספים)
                            const coverSupportLength = planterWidth - (beamWidth * 4) - 0.2;
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
                    const legParam = this.product?.params?.find(
                        (p: any) => p.type === 'beamSingle' && p.name === 'leg'
                    );
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamWidth = legBeamSelected?.width / 10 || 0; // רוחב קורת הרגל
                    
                    this.debugLog('🔍 LEG BEAM:', {
                        legBeamWidth: legBeamWidth,
                        legBeamName: legBeamSelected?.name
                    });
                    
                    // יצירת קורות מדף נפרדות לארון (6 קורות לכל מדף)
                    const cabinetShelfBeams = this.createCabinetShelfBeams(
                        this.surfaceLength, // אורך המדף
                        beamWidth,
                        beamHeight
                    );
                    
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
                                    beamLength = beamLength - legBeamWidth; // מורידים רק רוחב קורת הרגל (5 ס"מ)
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
                    // חישוב קיצור קורות החיזוק - פעמיים גובה קורות הרגל
                    // מציאת קורת הרגל לחישוב הקיצור
                    const legParam = this.product?.params?.find(
                        (p: any) => p.type === 'beamSingle' && p.name === 'leg'
                    );
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamHeight = legBeamSelected?.height / 10 || 0;
                    const legBeamWidth = legBeamSelected?.width / 10 || 0;
                    const shorteningAmount = legBeamHeight * 2; // פעמיים גובה קורת הרגל
                    const shorteningAmountEx = legBeamWidth * 2; // פעמיים גובה קורת הרגל
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
                        this.shelves.forEach((shelf, shelfIndex) => {
                            // 4 קורות חיזוק מקוצרות לכל מדף (2 לרוחב, 2 לאורך)
                            // קורות רוחב מקוצרות
                            allBeams.push({
                                type: selectedType,
                                length: this.surfaceWidth - shorteningAmountEx,
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Width 1 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            allBeams.push({
                                type: selectedType,
                                length: this.surfaceWidth - shorteningAmountEx,
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Width 2 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            // קורות אורך מקוצרות (מקבילות לקורות המדפים)
                            allBeams.push({
                                type: selectedType,
                                length: this.surfaceLength - shorteningAmount,
                                width: frameWidth,
                                height: frameHeight,
                                name: `Frame Beam Length 1 - Shelf ${shelfIndex + 1}`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                            allBeams.push({
                                type: selectedType,
                                length: this.surfaceLength - shorteningAmount,
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
                const shelfParam = this.product?.params?.find(
                    (p: any) => p.type === 'beamArray' && p.name === 'shelfs'
                );
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
                        this.debugLog(
                            'DEBUG - Adding futon leg',
                            i + 1,
                            'with length:',
                            futonWidth
                        );
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
                    this.debugLog(
                        'DEBUG - Adding leg',
                        i + 1,
                        'with length:',
                        legHeight
                    );
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

                    // חישוב קורות מוסתרות (כמו בחישוב הקורות)
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

                        // בדיקה אם להסתיר קורות (כמו ב-3D model)
                        const beamAndGapWidth = beamWidth + gapBetweenBeams;
                        const shouldHideBeams =
                            beamAndGapWidth < legBeamWidth && !isTopShelf;

                        if (shouldHideBeams) {
                            totalHiddenBeams += 2; // 2 קורות מוסתרות לכל מדף שאיננו עליון
                        }
                    });

                    const totalBeams =
                        surfaceBeams.length * totalShelves - totalHiddenBeams; // כמות הקורות בפועל פחות הקורות המוסתרות

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
        
        console.log('ZOOM-3-D 📐 Product Dimensions:', {
            width: dimensions.width,
            length: dimensions.length,
            height: dimensions.height,
            cameraPosition: optimalPosition
        });
        
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
        console.log('ZOOM-3-D 📐 Product Dimensions:', {
            width: dimensions.width,
            length: dimensions.length,
            height: dimensions.height
        });
        
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
        
        console.log('🎯 DYNAMIC ZOOM CALCULATION:', {
            dimensions: { width: dimensions.width, length: dimensions.length, height: dimensions.height },
            rawMaxDimension: rawMaxDimension,
            maxDimension: maxDimension,
            zoomRatio: zoomRatio,
            dynamicZoomMultiplier: dynamicZoomMultiplier,
            baseZoomAmount: baseZoomAmount,
            finalZoomAmount: zoomAmount
        });
        
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
        
        console.log('📏 HEIGHT-BASED PAN & ROTATE:', {
            productHeight: productHeight,
            productWidth: dimensions.width,
            productLength: dimensions.length,
            totalHorizontalSize: totalHorizontalSize,
            isTallProduct: productHeight > 180,
            isWideProduct: totalHorizontalSize > 70 && dimensions.height < 300,
            widthBonus: totalHorizontalSize > 70 ? Math.min((totalHorizontalSize - 70) / 100, 1) : 0,
            heightReduction: dimensions.height < 300 ? Math.min(dimensions.height / 300, 1) : 1,
            heightBasedPanAmount: heightBasedPanAmount,
            heightBasedRotateAmount: heightBasedRotateAmount,
            azimuthalRotateAmount: azimuthalRotateAmount,
            wideProductLeftPan: wideProductLeftPan,
            horizontalPanPixels: horizontalPanPixels,
            horizontalPanAmount: horizontalPanAmount,
            totalPanAmount: panAmount + heightBasedPanAmount,
            zoomAmount: zoomAmount
        });
        
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
            } else {
                this.debugLog('AUTO ZOOM IN COMPLETED:', {
                    startDistance: currentDistance,
                    targetDistance: targetDistance,
                    finalDistance: this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0)),
                    rotateAngle: rotateAngle,
                    panAmount: panAmount,
                    azimuthalRotateAmount: azimuthalRotateAmount,
                    duration: elapsed
                });
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
        topHeight: number
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
        let shelfBeamHeight = this.beamHeight;
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
        // קיצור הרגליים בעובי קורות המדפים - הרגליים צריכות להגיע רק עד לתחתית המדף העליון
        this.debugLog('DEBUG - topHeight:', topHeight);
        this.debugLog('DEBUG - shelfBeamHeight:', shelfBeamHeight);
        legHeight = topHeight - shelfBeamHeight;
        this.debugLog(
            'DEBUG - legHeight calculation:',
            topHeight,
            '-',
            shelfBeamHeight,
            '=',
            legHeight
        );
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
            });
        });
    }
    
    // הוספת ברגים לרגליים
    private addScrewsToLegs(
        totalShelves: number,
        legPositions: any[],
        frameBeamHeight: number,
        shelfY: number
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
                // עבור ארון, השתמש באותו חישוב כמו הברגים של המדפים
                // הברגים של המדפים מוצבים ב: currentY + frameBeamHeight
                // אז הברגים של הרגליים צריכים להיות באותו גובה
                const shelfHeight = this.getShelfHeight(shelfIndex);
                const beamHeight = this.beamHeight;
                const frameHeight = this.frameHeight;
                // חישוב ידני של הגובה כמו ב-3D model
            let manualCurrentY = 0;
            for (let i = 0; i <= shelfIndex; i++) {
                manualCurrentY += this.shelves[i].gap;
                if (i < shelfIndex) {
                    manualCurrentY += this.frameHeight + this.beamHeight;
                }
            }
            const shelfHeightFromFunction = this.getShelfHeight(shelfIndex);
                const expectedManualY = manualCurrentY + this.frameHeight / 2;
                // עכשיו נציב את הברגים במרכז קורת החיזוק
                // getShelfHeight מחזיר כעת את המרכז של קורת החיזוק
                // אז אנחנו יכולים להשתמש בו ישירות
                currentShelfY = shelfHeightFromFunction;
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
                screwPositions.forEach((pos, screwIndex) => {
                    // בורג 0 = מבוסס height (depth), בורג 1 = מבוסס width
                    const screwType = screwIndex === 0 ? 'leg_height' : 'leg_width';
                    // מעביר גם את שתי המידות כדי לבחור את המקסימום + 3
                    const calculatedScrewLength = this.calculateScrewLength(
                        screwType,
                        screwIndex === 0 ? legBeamHeight : legBeamWidth,
                        screwIndex === 0 ? legBeamWidth : legBeamHeight
                    );
                    const screwGroup = this.createHorizontalScrewGeometry(calculatedScrewLength);
                    // הברגים אופקיים ומיושרים ל-X (מאונכים לדופן Z)
                    screwGroup.position.set(pos.x, pos.y, pos.z);
                    if (screwIndex === 0) {
                        screwGroup.rotation.y =
                            (Math.PI / 2) * (isEven ? 1 : -1);
                    } else {
                        screwGroup.rotation.y = legIndex > 1 ? 0 : Math.PI;
                    }
                    this.scene.add(screwGroup);
                    this.beamMeshes.push(screwGroup);
                    this.debugLog(
                        `Leg ${legIndex + 1}, Shelf ${shelfIndex + 1}, Screw ${screwIndex + 1}: x=${pos.x.toFixed(1)}, y=${pos.y.toFixed(1)}, z=${pos.z.toFixed(1)}`
                    );
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
            return currentY + this.frameHeight / 2;
        }
    }
    // פרמטרים של הבורג (מידות אמיתיות)
    screwLength: number = 4.0; // 40 מ"מ = 4 ס"מ
    screwRadius: number = 0.1; // 1 מ"מ = 0.1 ס"מ (רדיוס הבורג)
    headHeight: number = 0.2; // 2 מ"מ = 0.2 ס"מ (גובה הראש)
    headRadius: number = 0.3; // 3 מ"מ = 0.3 ס"מ (רדיוס הראש)
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
        // טיפול במוצר קורות לפי מידה
        if (this.isBelams) {
            return this.getBelamsDimensionsRaw();
        }

        // רוחב כולל
        let totalWidth = this.surfaceWidth;
        // אורך כולל
        let totalLength = this.surfaceLength;
        // גובה כולל
        let totalHeight = 0;
        if (this.isTable) {
            // עבור שולחן - הגובה הוא פשוט הפרמטר "גובה משטח" (כי כבר הורדנו את גובה קורות הפלטה)
            const heightParam = this.getParam('height');
            totalHeight = heightParam ? heightParam.default : 80; // ברירת מחדל 80 ס"מ
        } else if (this.isPlanter || this.isBox) {
            // עבור עדנית - מידות מהפרמטרים
            const heightParam = this.getParam('height');
            const depthParam = this.getParam('depth');
            const widthParam = this.getParam('width');
            
            // החלפה בין width ו-depth כמו בתצוגה התלת מימדית
            const planterDepth = widthParam ? widthParam.default : 50;  // depth input -> planterDepth
            const planterWidth = depthParam ? depthParam.default : 40;  // width input -> planterWidth
            const planterHeight = heightParam ? heightParam.default : 50;
            
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
        } else {
            // עבור ארון - חישוב זהה לחישוב הרגליים בפונקציה updateBeams
            // חישוב frameBeamHeight - זהה לחישוב בפונקציה updateBeams
            let frameBeamHeight = this.frameHeight;
            const frameParam = this.params.find(
                (p) => p.type === 'beamSingle' && p.name !== 'shelfs'
            );
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
            // חישוב totalY - זהה לחישוב בפונקציה updateBeams
            let totalY = 0;
            for (const shelf of this.shelves) {
                totalY += shelf.gap + frameBeamHeight + beamHeight;
            }
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
            // הגובה הכולל = גובה הרגל המחושב (totalY - shelfBeamHeight) - זהה לחישוב בפונקציה createLegBeams
            totalHeight = totalY;
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
        return {
            length: totalLength,
            width: totalWidth,
            height: totalHeight,
            beamCount: beamCount,
            gapBetweenBeams: gapBetweenBeams,
            shelfCount: shelfCount,
            shelfHeights: shelfHeights,
            totalScrews: totalScrews,
        };
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
                this.debugLog('CHECKSCREWS === COMPREHENSIVE SCREW POSITION ANALYSIS ===');
                this.debugLog('CHECKSCREWS === BASIC INFO ===');
                this.debugLog('CHECKSCREWS isShortenedBeam:', isShortenedBeam);
                this.debugLog('CHECKSCREWS beam.x (center):', beam.x);
                this.debugLog('CHECKSCREWS beam.width (רוחב):', beam.width);
                this.debugLog('CHECKSCREWS beam.height (גובה):', beam.height);
                this.debugLog('CHECKSCREWS beam.depth (עומק):', beam.depth);
                this.debugLog('CHECKSCREWS === FRAME BEAM INFO ===');
                this.debugLog('CHECKSCREWS frameBeamWidth (רוחב קורות הרגל/חיזוק):', frameBeamWidth);
                this.debugLog('CHECKSCREWS frameBeamHeight (גובה קורות הרגל/חיזוק):', this.frameHeight);
                this.debugLog('CHECKSCREWS === SCREW POSITIONS AFTER FILTERING ===');
                this.debugLog('CHECKSCREWS Remaining screws after filtering:');
                this.debugLog('CHECKSCREWS   startPositions:', startPositions);
                this.debugLog('CHECKSCREWS   endPositions:', endPositions);

                // חישוב הפרמטרים לפי הלוגיקה החדשה
                const A = this.surfaceWidth / 2; // הרוחב הכולל של הארון חלקי 2
                const X = this.frameHeight; // frameBeamHeight
                const Y = frameBeamWidth; // המידה השנייה של קורת הרגל (לא frameBeamHeight)
                const Q = beam.width; // beam.width

                this.debugLog('CHECKSCREWS === CALCULATION PARAMETERS ===');
                this.debugLog('CHECKSCREWS A (רוחב כולל חלקי 2):', A);
                this.debugLog('CHECKSCREWS X (frameBeamHeight):', X);
                this.debugLog('CHECKSCREWS Y (frameBeamWidth):', Y);
                this.debugLog('CHECKSCREWS Q (beam.width):', Q);

                // חישוב Z ו-R ו-L
                const Z = (X - Y) / 2;
                const R = (Q - Z) / 2;
                const L = R + Z;

                this.debugLog('CHECKSCREWS === INTERMEDIATE CALCULATIONS ===');
                this.debugLog('CHECKSCREWS Z ((X-Y)/2):', Z);
                this.debugLog('CHECKSCREWS R ((Q-Z)/2):', R);
                this.debugLog('CHECKSCREWS L (R+Z):', L);

                // המרחק הסופי של הברגים מהמרכז
                let finalDistance;
                if (Q > X) {
                    // מקרה קצה: Q > X
                    finalDistance = A - X / 2;
                    this.debugLog('CHECKSCREWS מקרה קצה: Q > X');
                    this.debugLog(
                        'CHECKSCREWS finalDistance (A - X/2):',
                        finalDistance
                    );
                } else {
                    // מקרה רגיל: Q <= X
                    finalDistance = A - L;
                    this.debugLog('CHECKSCREWS מקרה רגיל: Q <= X');
                    this.debugLog(
                        'CHECKSCREWS finalDistance (A-L):',
                        finalDistance
                    );
                }

                // חישוב הרווח מהקצה השמאלי של הקורה לבורג השמאלי
                const leftEdgeX = beam.x - beam.width / 2;
                const rightEdgeX = beam.x + beam.width / 2;
                const leftScrewX = Math.min(startPositions.x, endPositions.x);
                const rightScrewX = Math.max(startPositions.x, endPositions.x);
                const leftGap = leftScrewX - leftEdgeX;
                const rightGap = rightEdgeX - rightScrewX;
                this.debugLog('CHECKSCREWS Gap analysis:');
                this.debugLog('CHECKSCREWS   Left edge X:', leftEdgeX);
                this.debugLog('CHECKSCREWS   Right edge X:', rightEdgeX);
                this.debugLog('CHECKSCREWS   Left screw X:', leftScrewX);
                this.debugLog('CHECKSCREWS   Right screw X:', rightScrewX);
                this.debugLog(
                    'CHECKSCREWS   Gap from left edge to left screw:',
                    leftGap
                );
                this.debugLog(
                    'CHECKSCREWS   Gap from right screw to right edge:',
                    rightGap
                );
                this.debugLog(
                    'CHECKSCREWS   Total gap (left + right):',
                    leftGap + rightGap
                );
                this.debugLog(
                    'CHECKSCREWS   Gap percentage of beam width:',
                    (((leftGap + rightGap) / beam.width) * 100).toFixed(1) + '%'
                );
                this.debugLog('CHECKSCREWS === FINAL RESULT ===');
                this.debugLog('CHECKSCREWS Final screw positions:', screwPositions);
                this.debugLog('CHECKSCREWS === END COMPREHENSIVE SCREW POSITION ANALYSIS ===');
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
        
        console.log('CHECH_EDIT_PRICE - מחזיר קורות למצב המקורי');
        
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
        
        console.log('CHECH_EDIT_PRICE - קורות הוחזרו למצב המקורי');
    }
    
    // שחזור cuttingPlan למצב המקורי (ללא חישוב מחדש)
    private restoreOriginalCuttingPlan() {
        if (!this.originalBeamsData || !this.BeamsDataForPricing) {
            return;
        }
        
        console.log('CHECH_EDIT_PRICE - משחזר cuttingPlan למצב המקורי');
        
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
        
        console.log('CHECH_EDIT_PRICE - cuttingPlan שוחזר:', this.cuttingPlan);
    }
    
    // החזרת ברגים למצב המקורי
    private resetScrewsToOriginalState() {
        if (!this.originalScrewsData || !this.screwsPackagingPlan) {
            return;
        }
        
        console.log('CHECH_EDIT_PRICE - מחזיר ברגים למצב המקורי');
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
        console.log('CHECH_EDIT_PRICE - ברגים הוחזרו למצב המקורי');
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
        const xArrow = this.createArrow(axesLength, 0x0066ff, ''); // כחול בהיר ללא טקסט
        xArrow.position.set(0, 0, 0);
        this.scene.add(xArrow);
        this.coordinateAxes.push(xArrow);
        
        // חץ Y (כחול בינוני) - למעלה
        const yArrow = this.createArrow(axesLength, 0x4d94ff, ''); // כחול בינוני ללא טקסט
        yArrow.position.set(0, 0, 0);
        yArrow.rotation.z = -Math.PI / 2; // סיבוב 90 מעלות סביב Z
        this.scene.add(yArrow);
        this.coordinateAxes.push(yArrow);
        
        // חץ Z (כחול כהה) - קדימה (לכיוון המצלמה)
        const zArrow = this.createArrow(axesLength, 0x003d99, ''); // כחול כהה ללא טקסט
        zArrow.position.set(0, 0, 0);
        zArrow.rotation.x = Math.PI / 2; // סיבוב 90 מעלות סביב X
        this.scene.add(zArrow);
        this.coordinateAxes.push(zArrow);
        
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
            canvas.width = 64;
            canvas.height = 64;
            const context = canvas.getContext('2d')!;
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, 64, 64);
            context.fillStyle = '#000000';
            context.font = 'bold 32px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(label, 32, 32);
            
            const texture = new THREE.CanvasTexture(canvas);
            const textMaterial = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true,
                alphaTest: 0.1
            });
            const textGeometry = new THREE.PlaneGeometry(8, 8);
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            textMesh.position.y = length + 5; // מיקום הטקסט מעל החץ
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
        console.log('CUTTING_DEBUG - saveOriginalBeamsState נקרא');
        console.log('CUTTING_DEBUG - BeamsDataForPricing לפני שמירה:', this.BeamsDataForPricing);
        
        this.originalBeamsData = JSON.parse(JSON.stringify(this.BeamsDataForPricing || []));
        
        // שמירת הכמויות המקוריות של הקורות
        this.originalBeamQuantities = [];
        if (this.BeamsDataForPricing) {
            this.BeamsDataForPricing.forEach((beam, index) => {
                const quantity = this.getFullBeamsCount(beam);
                this.originalBeamQuantities[index] = quantity;
                console.log(`CUTTING_DEBUG - שומר כמות מקורית לקורה ${index}: ${quantity}`);
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
        
        console.log('CUTTING_DEBUG - originalBeamsData נשמר:', this.originalBeamsData);
        
        // הדפסת הכמויות המקוריות לכל קורה
        if (this.originalBeamsData) {
            this.originalBeamsData.forEach((beam, index) => {
                const originalQuantity = this.getFullBeamsCount(beam);
                console.log(`CUTTING_DEBUG - קורה מקורית ${index} (${beam.beamTranslatedName}): כמות=${originalQuantity}`);
            });
        }
        
        console.log(`CUTTING_DEBUG - אתחול מחירים: מקוריים=${this.originalBeamsPrice}, דינמיים=${this.dynamicBeamsPrice}`);
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
        
        console.log(`CHECH_EDIT_PRICE - אתחול מחירים: מקוריים=${this.originalScrewsPrice}, דינמיים=${this.dynamicScrewsPrice}`);
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
            console.log('🔍 BEAM_DEBUG - beam structure:', beam);
            console.log('🔍 BEAM_DEBUG - beam.beamTranslatedName:', beam.beamTranslatedName);
            console.log('🔍 BEAM_DEBUG - beam.type:', beam?.type);
            console.log('🔍 BEAM_DEBUG - beam.type?.length:', beam?.type?.length);
            console.log('🔍 BEAM_DEBUG - cuttingPlan:', this.cuttingPlan);
            this.beamDebugLogged = true;
        }
        
        // חיפוש הקורה ב-cuttingPlan כדי לקבל את האורך הנכון
        const beamInPlan = this.cuttingPlan?.find(plan => 
            plan.beamType === beam.beamTranslatedName
        );
        
        if (!this.beamDebugLogged && beamInPlan) {
            console.log('🔍 BEAM_DEBUG - Found beam in cuttingPlan for length:', beamInPlan);
            console.log('🔍 BEAM_DEBUG - beamLength:', beamInPlan.beamLength);
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
            console.log('🔍 BEAM_DEBUG - All beams of this type:', allBeamsOfThisType);
            console.log('🔍 BEAM_DEBUG - Total number of full beams:', allBeamsOfThisType.length);
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
        console.log(`CUTTING_DEBUG - updateBeamQuantity נקרא: beamIndex=${beamIndex}, newQuantity=${newQuantity}`);
        
        if (!this.BeamsDataForPricing || beamIndex < 0 || beamIndex >= this.BeamsDataForPricing.length) {
            console.log('CUTTING_DEBUG - updateBeamQuantity - תנאים לא מתקיימים, יוצא');
            return;
        }
        
        // עדכון הכמות
        const beam = this.BeamsDataForPricing[beamIndex];
        const oldQuantity = this.getFullBeamsCount(beam);
        
        console.log(`CUTTING_DEBUG - עדכון כמות קורה: ${oldQuantity} → ${newQuantity}`);
            
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
                    console.log('CHECH_EDIT_PRICE - הוספת קורה, החזרת V לקורות');
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
                console.log(`CUTTING_DEBUG - allBeamsOfThisType.length: ${allBeamsOfThisType.length}`);
                if (allBeamsOfThisType.length > 0) {
                    const beamPrice = allBeamsOfThisType[0].beamPrice;
                    const priceDifference = difference * beamPrice;
                    console.log(`CUTTING_DEBUG - קורא ל-updatePriceLocally עם beamPrice: ${beamPrice}, priceDifference: ${priceDifference}`);
                    this.updatePriceLocally('beam', beam, priceDifference);
                } else {
                    // אם אין קורות מהסוג הזה, עדיין צריך לעדכן את המחיר
                    // נשתמש במחיר מהנתונים המקוריים
                    console.log(`CUTTING_DEBUG - אין קורות מהסוג הזה, מחפש מחיר אלטרנטיבי`);
                    const originalBeam = this.originalBeamsData.find(b => b.beamTranslatedName === beam.beamTranslatedName);
                    if (originalBeam) {
                        // נמצא קורה דומה ב-cuttingPlan המקורי
                        const similarBeam = this.cuttingPlan.find(plan => plan.beamType === beam.beamTranslatedName);
                        if (similarBeam) {
                            const beamPrice = similarBeam.beamPrice;
                            const priceDifference = difference * beamPrice;
                            console.log(`CUTTING_DEBUG - קורא ל-updatePriceLocally (אלטרנטיבי) עם beamPrice: ${beamPrice}, priceDifference: ${priceDifference}`);
                            this.updatePriceLocally('beam', beam, priceDifference);
                        } else {
                            // אם לא נמצא, נשתמש במחיר מהנתונים המקוריים
                            console.log(`CUTTING_DEBUG - לא נמצא קורה דומה, משתמש במחיר מקורי`);
                            // נחשב מחיר על בסיס המחיר המקורי
                            const originalPrice = this.originalBeamsPrice;
                            const pricePerBeam = originalPrice / this.originalBeamQuantities.reduce((sum, q) => sum + q, 0);
                            const priceDifference = difference * pricePerBeam;
                            console.log(`CUTTING_DEBUG - קורא ל-updatePriceLocally (מחיר מקורי) עם pricePerBeam: ${pricePerBeam}, priceDifference: ${priceDifference}`);
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
                        console.log('CHECH_EDIT_PRICE - כל הקורות על 0, הסרת V מקורות');
                    }
                }
            }
            
            // עדכון סטטוס החיתוך בכל שינוי כמות
            console.log('CUTTING_DEBUG - קורא ל-updateCuttingStatus');
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
                console.log('CHECH_EDIT_PRICE - כל הברגים על 0, הסרת V מברגים');
            }
        }
        
        // אם הברגים לא היו מופעלים והוספנו ברג, נפעיל אותם
        if (difference > 0 && !this.isScrewsEnabled && oldQuantity === 0) {
            this.isScrewsEnabled = true;
            console.log('CHECH_EDIT_PRICE - הוספת ברג, החזרת V לברגים');
        }
    }
    
    // בדיקה אם הכמויות מספיקות לחיתוך
    private checkCuttingPossibility(): boolean {
        console.log('CUTTING_DEBUG - checkCuttingPossibility נקרא!');
        
        if (!this.originalBeamsData || !this.BeamsDataForPricing) {
            console.log('CUTTING_DEBUG - אין נתונים מקוריים, מחזיר true');
            return true;
        }
        
        console.log('CUTTING_DEBUG - בודק אפשרות חיתוך:');
        console.log('CUTTING_DEBUG - BeamsDataForPricing:', this.BeamsDataForPricing);
        console.log('CUTTING_DEBUG - originalBeamsData:', this.originalBeamsData);
        
        // בדיקה אם יש סוג קורה שהכמות הנוכחית שלו קטנה מהכמות המקורית הנדרשת
        for (let i = 0; i < this.BeamsDataForPricing.length; i++) {
            const currentBeam = this.BeamsDataForPricing[i];
            
            // הכמות הנוכחית של הקורות השלמות (מה שהמשתמש רואה באינפוט)
            const currentQuantity = this.getFullBeamsCount(currentBeam);
            // הכמות המקורית הנדרשת (מספר הקורות שהיו נדרשות לחיתוך)
            const originalQuantity = this.originalBeamQuantities[i] || 0;
            
            console.log(`CUTTING_DEBUG - קורה ${i} (${currentBeam.beamTranslatedName}): נוכחי=${currentQuantity}, מקורי=${originalQuantity}`);
            
            if (currentQuantity < originalQuantity) {
                console.log(`CUTTING_DEBUG - קורה ${i} לא מספיקה לחיתוך (${currentQuantity} < ${originalQuantity}), מחזיר false`);
                return false; // לא ניתן לבצע חיתוך
            }
        }
        
        console.log('CUTTING_DEBUG - כל הקורות מספיקות לחיתוך, מחזיר true');
        return true; // ניתן לבצע חיתוך
    }
    
    // עדכון סטטוס החיתוך
    private updateCuttingStatus() {
        console.log('CUTTING_DEBUG - updateCuttingStatus נקרא!');
        const wasPossible = this.isCuttingPossible;
        this.isCuttingPossible = this.checkCuttingPossibility();
        
        console.log(`CUTTING_DEBUG - updateCuttingStatus: wasPossible=${wasPossible}, isCuttingPossible=${this.isCuttingPossible}, isCuttingEnabled=${this.isCuttingEnabled}`);
        
        // אם החיתוך לא אפשרי יותר, נבטל אותו
        if (!this.isCuttingPossible && this.isCuttingEnabled) {
            this.isCuttingEnabled = false;
            // לא משנים את המחיר - הוא נשאר קבוע!
            console.log('CUTTING_DEBUG - חיתוך בוטל - הכמויות לא מספיקות');
        }
        
        // אם החיתוך הפך לאפשרי שוב, נפעיל אותו (רק אם קורות מופעלות)
        if (this.isCuttingPossible && !this.isCuttingEnabled && this.isBeamsEnabled) {
            this.isCuttingEnabled = true;
            // לא משנים את המחיר - הוא נשאר קבוע!
            console.log('CUTTING_DEBUG - חיתוך הופעל - הכמויות מספיקות');
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
            console.log('CHECH_EDIT_PRICE - מחירים דינמיים אופסו');
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
        
        console.log(`CHECH_EDIT_PRICE - עדכון מקומי של ${type}:`, item);
        console.log(`CHECH_EDIT_PRICE - הפרש כמות: ${quantityDifference}`);
        console.log(`CHECH_EDIT_PRICE - מחיר נוכחי לפני עדכון: ${this.calculatedPrice}`);
        
        let pricePerUnit = 0;
        
        if (type === 'beam') {
            // עדכון המחיר הספציפי של קורות (רק עץ, לא חיתוך)
            const oldBeamsPrice = this.dynamicBeamsPrice;
            
            // quantityDifference כבר מכיל את ההפרש במחיר (לא בכמות)
            const beamsPriceDifference = quantityDifference;
            
            this.dynamicBeamsPrice = Math.round((Math.max(0, this.dynamicBeamsPrice + beamsPriceDifference)) * 100) / 100;
            
            // סימון שיש שינויים בקורות
            this.hasBeamsChanged = true;
            
            console.log(`CHECH_EDIT_PRICE - עדכון מחיר קורות: ${oldBeamsPrice} → ${this.dynamicBeamsPrice} (הפרש: ${beamsPriceDifference})`);
            
        } else if (type === 'screw') {
            // מחיר לקופסת ברגים
            console.log(`CHECH_EDIT_PRICE - פרטי ברגים:`, {
                screwTranslatedName: item.screwTranslatedName,
                optimalPackage: item.optimalPackage,
                numPackages: item.numPackages
            });
            
            pricePerUnit = item.optimalPackage?.price || 0;
            console.log(`CHECH_EDIT_PRICE - מחיר לקופסת ברגים: ${pricePerUnit}`);
            
            // עדכון המחיר הספציפי של ברגים
            this.dynamicScrewsPrice = Math.round((Math.max(0, this.dynamicScrewsPrice + (quantityDifference * pricePerUnit))) * 100) / 100;
            
            // סימון שיש שינויים בברגים
            this.hasScrewsChanged = true;
            
            console.log(`CHECH_EDIT_PRICE - מחיר ברגים חדש: ${this.dynamicScrewsPrice}`);
        }
        
        // חישוב ההפרש במחיר
        const priceDifference = quantityDifference * pricePerUnit;
        
        // עדכון המחיר הכולל
        this.calculatedPrice = Math.round((Math.max(0, this.calculatedPrice + priceDifference)) * 100) / 100;
        
        // אילוץ Angular לעדכן את התצוגה
        this.cdr.detectChanges();
        
        console.log(`CHECH_EDIT_PRICE - הפרש מחיר: ${priceDifference}, מחיר חדש: ${this.calculatedPrice}`);
        console.log(`CHECH_EDIT_PRICE - עדכון מקומי הושלם`);
    }
    
    // פונקציה ליצירת קורות בסיס מיטה
    private createFutonBeams() {
        this.debugLog('יצירת קורות בסיס מיטה...');
        
        // קבלת פרמטרים
        const widthParam = this.getParam('width');
        const depthParam = this.getParam('depth');
        const plataParam = this.getParam('plata');
        const legParam = this.getParam('leg');
        
        if (!widthParam || !depthParam || !plataParam || !legParam) {
            console.warn('חסרים פרמטרים לבסיס מיטה');
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
                const geometry = new THREE.BoxGeometry(
                    futonWidth,    // אורך הקורה = רוחב המיטה (ציר X)
                    legBeamHeight, // גובה הקורה (ציר Y)
                    legBeamWidth   // רוחב הקורה (ציר Z)
                );
                const material = this.getWoodMaterial(legType ? legType.name : '');
                const mesh = new THREE.Mesh(geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                this.addWireframeToBeam(mesh);
                
                // חישוב מיקום Z - מתחיל ב-5 ס"מ מהקצה
                const zPosition = -totalLength / 2 + 5 + (i * spacing);
                
                // שמירת מיקום הרגל למערך
                legPositions.push(zPosition);
                
                // מיקום הרגל - צמודה למטה (Y=0) + חצי גובה הקורה
                mesh.position.set(0, legBeamHeight / 2, zPosition);
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
}


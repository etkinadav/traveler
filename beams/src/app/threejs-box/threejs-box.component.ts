import {
    Component,
    ElementRef,
    ViewChild,
    AfterViewInit,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { PricingService } from '../../../../src/app/services/pricing.service';
import * as THREE from 'three';
interface Shelf {
    gap: number; // רווח מהמדף שמתחתיו (או מהרצפה)
}
@Component({
    selector: 'app-threejs-box',
    templateUrl: './threejs-box.component.html',
    styleUrls: ['./threejs-box.component.scss'],
})
export class ThreejsBoxComponent implements AfterViewInit, OnDestroy, OnInit {
    private isUserAuthenticated = false;
    private authToken: string | null = null;
    // Validation messages (הוסרו - משתמשים ב-SnackBar)
    // Helper for numeric step
    getStep(type: number): number {
        return 1 / Math.pow(10, type);
    }
    // ...existing code...
    toggleDrawer() {
        this.drawerOpen = !this.drawerOpen;
        setTimeout(() => this.onResize(), 310); // Wait for transition to finish
    }
    toggleWireframe() {
        this.showWireframe = !this.showWireframe;
        if (this.showWireframe) {
            this.addWireframeCube();
        } else {
            this.removeWireframeCube();
        }
    }
    
    // פונקציה להפעלת מצב שקוף
    toggleTransparentMode() {
        this.isTransparentMode = !this.isTransparentMode;
        console.log('Toggle transparent mode:', this.isTransparentMode);
        // עדכון המודל כדי להחיל את השקיפות
        this.updateBeams();
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
        console.log(direction);
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
    onNumberInputChange(event: any, updateFunction: string) {
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
            }
        }
    }
    
    // פונקציה לטיפול בשינויי אינפוט של פרמטרים
    onParameterInputChange(event: any, param: any) {
        const value = parseFloat(event.target.value);
        if (!isNaN(value)) {
            // בדיקה אם זה שינוי על ידי חצים (לא הקלדה ידנית)
            const isArrowKey = event.inputType === undefined || event.inputType === 'insertReplacementText';
            if (isArrowKey) {
                // עדכון מיידי לחצים
                setTimeout(() => {
                    this.updateParameterValue(param, value);
                }, 0);
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
    product: any = null;
    params: any[] = [];
    selectedProductName: string = ''; // שם המוצר שנבחר מה-URL
    isTable: boolean = false; // האם זה שולחן או ארון
    isPlanter: boolean = false; // האם זה עדנית עץ
    isPriceManuOpen: boolean = false; // האם תפריט המחיר פתוח
    hasHiddenBeams: boolean = false; // האם יש קורות מוסתרות בגלל חסימת רגליים
    hiddenBeamsCount: number = 0; // כמות הקורות המוסתרות
    hasNoMiddleBeams: boolean = false; // האם נשארות רק שתי הקורות המקוצרות (אין קורות באמצע)
    isLoading: boolean = false; // האם התצוגה נטענת
    isModelLoading: boolean = false; // האם המודל התלת-מימדי נטען
    // נתונים לחישוב מחיר
    BeamsDataForPricing: any[] = []; // מערך של נתוני קורות לחישוב מחיר
    ForgingDataForPricing: any[] = []; // מערך של נתוני ברגים לחישוב מחיר
    calculatedPrice: number = 0; // מחיר מחושב
    cuttingPlan: any[] = []; // תוכנית חיתוך מפורטת
    quantity: number = 1; // כמות יחידות להזמנה
    constructor(
        private http: HttpClient,
        private snackBar: MatSnackBar,
        private route: ActivatedRoute,
        private pricingService: PricingService
    ) {}
    ngOnInit() {
        // הפעלת loading בטעינה הראשונית
        this.isLoading = true;
        
        this.checkUserAuthentication();
        // קבלת פרמטר המוצר מה-URL
        this.route.queryParams.subscribe((params) => {
            if (params['product']) {
                this.selectedProductName = params['product'];
                this.isTable = this.selectedProductName === 'table';
                this.isPlanter = this.selectedProductName === 'planter';
                console.log(
                    'מוצר נבחר:',
                    this.selectedProductName,
                    'שולחן:',
                    this.isTable,
                    'עדנית:',
                    this.isPlanter
                );
                // בדיקה אם זה מוצר שונה מהמוצר האחרון
                const lastProduct = localStorage.getItem('lastSelectedProduct');
                console.log(
                    'Last product from localStorage:',
                    lastProduct,
                    'Current product:',
                    this.selectedProductName
                );
                if (lastProduct && lastProduct !== this.selectedProductName) {
                    console.log(
                        'מוצר שונה נבחר, מנקה ערכים:',
                        lastProduct,
                        '->',
                        this.selectedProductName
                    );
                    this.clearUserConfiguration();
                } else {
                    console.log(
                        'Same product or first time, no need to clear configuration'
                    );
                }
                // שמירת המוצר הנוכחי כברמוצר האחרון
                localStorage.setItem(
                    'lastSelectedProduct',
                    this.selectedProductName
                );
                console.log(
                    'Saved current product to localStorage:',
                    this.selectedProductName
                );
                // טעינת המוצר הנכון לפי השם
                this.getProductByName(this.selectedProductName);
            } else {
                // אם אין פרמטר מוצר, נטען את המוצר האחרון או ברירת מחדל
                const lastProduct = localStorage.getItem('lastSelectedProduct');
                if (lastProduct) {
                    console.log('טעינת מוצר אחרון:', lastProduct);
                    this.selectedProductName = lastProduct;
                    this.isTable = this.selectedProductName === 'table';
                    this.isPlanter = this.selectedProductName === 'planter';
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
            console.log('User is authenticated');
        } else {
            this.isUserAuthenticated = false;
            console.log('User is not authenticated, using localStorage');
        }
    }
    // Clear user configuration when switching products
    private clearUserConfiguration() {
        // ניקוי כל ההגדרות הקשורות למוצר הקודם
        console.log('Current localStorage keys:', Object.keys(localStorage));
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
            console.log('Removed configuration:', key);
        });
        
        // מחיקת קונפיגורציה כללית
        localStorage.removeItem('beam-configuration');
        console.log('Removed beam-configuration');
        console.log(
            'User configuration cleared for new product. Removed keys:',
            keysToRemove
        );
        
        // איפוס הפרמטרים לערכי ברירת המחדל
        this.resetParamsToDefaults();
    }
    getProductById(id: string) {
        this.http.get(`/api/products/${id}`).subscribe({
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
                        param.selectedBeamIndex = 0;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[0].types) &&
                            param.beams[0].types.length
                                ? 0
                                : null;
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        param.selectedBeamIndex = 0;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[0].types) &&
                            param.beams[0].types.length
                                ? 0
                                : null;
                    }
                    return param;
                });
                this.initParamsFromProduct();
                console.log('Product loaded:', data);
                console.log('פרמטרים נטענו:', this.params);
                console.log('זה שולחן?', this.isTable);
                console.log('זה עדנית?', this.isPlanter);
                // בדיקת פרמטרים ספציפיים
                const heightParam = this.params.find(
                    (p) => p.name === 'height'
                );
                const plataParam = this.params.find((p) => p.name === 'plata');
                console.log('פרמטר height:', heightParam);
                console.log('פרמטר plata:', plataParam);
                // Load saved configuration after product is loaded (only if same product)
                const lastProduct = localStorage.getItem('lastSelectedProduct');
                if (lastProduct === this.selectedProductName) {
                this.loadConfiguration();
                }
                this.updateBeams();
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
                        param.selectedBeamIndex = 0;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[0].types) &&
                            param.beams[0].types.length
                                ? 0
                                : null;
                    }
                    if (
                        param.type === 'beamSingle' &&
                        Array.isArray(param.beams) &&
                        param.beams.length
                    ) {
                        param.selectedBeamIndex = 0;
                        param.selectedTypeIndex =
                            Array.isArray(param.beams[0].types) &&
                            param.beams[0].types.length
                                ? 0
                                : null;
                    }
                    return param;
                });
                this.initParamsFromProduct();
                console.log('Product loaded by name:', data);
                console.log('פרמטרים נטענו:', this.params);
                console.log('זה שולחן?', this.isTable);
                console.log('זה עדנית?', this.isPlanter);
                // בדיקת פרמטרים ספציפיים
                const heightParam = this.params.find(
                    (p) => p.name === 'height'
                );
                const plataParam = this.params.find((p) => p.name === 'plata');
                console.log('פרמטר height:', heightParam);
                console.log('פרמטר plata:', plataParam);
                // Load saved configuration after product is loaded (only if same product)
                const lastProduct = localStorage.getItem('lastSelectedProduct');
                if (lastProduct === this.selectedProductName) {
                this.loadConfiguration();
                }
                this.updateBeams();
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
                verticalPosition: 'top',
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
            legParam.selectedBeamIndex = legParam.selectedBeamIndex || 0;
            legParam.selectedTypeIndex =
                legParam.selectedTypeIndex ||
                (Array.isArray(legParam.beams[0].types) &&
                legParam.beams[0].types.length
                    ? 0
                    : null);
        }
        // Example: set frameWidth/frameHeight if present in params
        // You can extend this to other params as needed
        // וידוא שהערכים מתאפסים לברירת המחדל כשעוברים למוצר חדש
        this.resetParamsToDefaults();
    }
    // Reset all parameters to their default values
    private resetParamsToDefaults() {
        console.log(
            'Resetting parameters to defaults. Current params:',
            this.params
        );
        this.params.forEach((param) => {
            console.log(
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
                    param.selectedBeamIndex = 0;
                    param.selectedTypeIndex =
                        Array.isArray(param.beams[0].types) &&
                        param.beams[0].types.length
                            ? 0
                            : null;
                    console.log(
                        'Reset beam selection for:',
                        param.name,
                        'to beam 0, type 0'
                    );
                }
            }
        });
        console.log('Parameters reset to defaults for new product');
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
        
        // אם במצב שקוף, הפוך את הקורות לשקופות כמעט לחלוטין
        if (this.isTransparentMode) {
            material.transparent = true;
            material.opacity = 0.1; // 10% שקיפות
            console.log('Creating transparent material for:', beamType);
        }
        
        return material;
    }
    
    // Add wireframe edges to a mesh (for transparent mode)
    private addWireframeToBeam(mesh: THREE.Mesh) {
        if (this.isTransparentMode) {
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
        if (this.isUserAuthenticated && this.authToken) {
            this.saveConfigurationToServer(config);
        } else {
            this.saveConfigurationToLocalStorage(config);
        }
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
                    console.log('Configuration saved to server:', response);
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
        console.log('Configuration saved to localStorage');
    }
    // Load saved configuration (user-specific or localStorage)
    private loadConfiguration() {
        if (this.isUserAuthenticated && this.authToken) {
            this.loadConfigurationFromServer();
        } else {
            this.loadConfigurationFromLocalStorage();
        }
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
                        console.log('Configuration loaded from server');
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
    // Load configuration from localStorage (fallback)
    private loadConfigurationFromLocalStorage() {
        const savedConfig = localStorage.getItem('beam-configuration');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.applyConfiguration(config);
                console.log('Configuration loaded from localStorage');
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
                    const dx =
                        event.touches[0].clientX - event.touches[1].clientX;
                    const dy =
                        event.touches[0].clientY - event.touches[1].clientY;
                lastTouchDist = Math.sqrt(dx * dx + dy * dy);
                lastTouchAngle = Math.atan2(dy, dx);
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
        console.log('Total model height:', dimensions.height);
        this.scene.position.y = -120; // 200 * 0.5 = 100 (panSpeed)
        
        // מרכוז המצלמה על קוביית ה-wireframe
        this.centerCameraOnWireframe();
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
        this.beamMeshes = [];
    }
    private onResize() {
        const container = this.rendererContainer?.nativeElement as HTMLElement;
        if (!container || !this.camera || !this.renderer) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    updateBeams() {
        // הפעלת loading
        this.isLoading = true;
        this.isModelLoading = true;
        
        // Save current configuration to localStorage
        this.saveConfiguration();
        
        // איפוס המשתנים הבוליאניים לבדיקת קורות מוסתרות
        this.hasHiddenBeams = false;
        this.hiddenBeamsCount = 0;
        this.hasNoMiddleBeams = false;
        // חישוב מחיר אחרי עדכון המודל
        this.calculatePricing();
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
        // Defensive checks
        if (!this.isTable && !this.isPlanter && (!this.shelves || !this.shelves.length)) {
            console.warn('No shelves found, cannot render model.');
            return;
        }
        if (this.isTable && !this.getParam('height')) {
            console.warn(
                'No height parameter found for table, cannot render model.'
            );
            return;
        }
        if (this.isPlanter && !this.getParam('height')) {
            console.warn(
                'No height parameter found for planter, cannot render model.'
            );
            return;
        }
        if (!this.isPlanter && (!this.surfaceWidth || !this.surfaceLength)) {
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
        } else if (this.isPlanter) {
            // עבור עדנית, נשתמש בפרמטר beam
            console.log('מחפש פרמטר beam לעדנית...');
            console.log('פרמטרים זמינים:', this.product?.params?.map(p => ({name: p.name, type: p.type})));
            shelfsParam = this.product?.params?.find(
                (p: any) => p.type === 'beamSingle' && p.name === 'beam'
            );
            console.log('shelfsParam נמצא:', shelfsParam);
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
            console.log('shelfBeam נמצא:', shelfBeam);
            console.log('shelfType נמצא:', shelfType);
        } else {
            console.log('shelfsParam לא תקין:', shelfsParam);
            console.log('beams array:', shelfsParam?.beams);
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
        } else if (this.isPlanter) {
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
            
            console.log('Adding lower frame screws - tableHeight:', tableHeight, 'extraBeamDistance:', extraBeamDistance, 'totalDistance:', totalDistanceForLower, 'lowerFrameY:', lowerFrameY, 'frameBeamHeight:', calculatedFrameBeamHeightForLower);
            this.addScrewsToLowerFrameBeams(legs, lowerFrameY, frameBeamHeight);
        } else if (this.isPlanter) {
            // עבור עדנית, נציג רצפה של קורות
            const heightParam = this.getParam('height');
            const depthParam = this.getParam('depth');
            const widthParam = this.getParam('width');
            
            const planterHeight = heightParam ? heightParam.default : 50;
            const planterDepth = widthParam ? widthParam.default : 50;  // depth input -> planterDepth
            const planterWidth = depthParam ? depthParam.default : 40;  // width input -> planterWidth
            
            console.log('יצירת עדנית - גובה:', planterHeight, 'עומק:', planterDepth, 'רוחב:', planterWidth);
            console.log('מידות קורה - רוחב:', beamWidth, 'עומק:', beamHeight);
            
            // חישוב כמות הקורות בעומק (41/5 = 8 קורות)
            const beamsInDepth = Math.floor(planterWidth / beamWidth);
            console.log('כמות קורות בעומק:', beamsInDepth);
            
            // חישוב רווחים ויזואליים
            const visualGap = 0.1; // רווח של 0.1 ס"מ בין קורות
            const totalGaps = beamsInDepth - 1; // כמות הרווחים
            const totalGapWidth = totalGaps * visualGap; // רוחב כולל של כל הרווחים
            const availableWidth = planterWidth - totalGapWidth; // רוחב זמין לקורות
            const adjustedBeamWidth = availableWidth / beamsInDepth; // רוחב קורה מותאם
            
            console.log('רווח ויזואלי:', visualGap, 'רוחב קורה מותאם:', adjustedBeamWidth);
            
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
                
                console.log(`קורה ${i + 1} - מיקום Z:`, zPosition, 'רוחב:', adjustedBeamWidth, 'אורך:', planterDepth, 'גובה:', beamHeight);
            }
            
            console.log('רצפת עדנית נוצרה בהצלחה');
            
            // הוספת ברגים לקירות השמאליים והימניים בתחתית הרצפה
            this.addScrewsToSideWallsAtFloor(planterDepth, planterWidth, beamHeight, widthParam.default);
            
            // יצירת הקירות - חישוב גובה נכון
            const beamsInHeight = Math.floor(planterHeight / beamWidth); // כמות קורות לפי הגובה שהמשתמש הזין
            const actualWallHeight = beamsInHeight * beamWidth; // גובה אמיתי = כמות קורות * רוחב קורה
            
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
                        
                        console.log(`קיר ${wallName} קורה ${i + 1} - מיקום X:`, wallX, 'מיקום Y:', yPosition, 'מיקום Z:', wallZ, 'אורך:', wallLength, 'גובה:', adjustedBeamHeight, 'עומק:', beamHeight, isBottomBeam ? '(קורה תחתונה מוגבהת)' : '');
                    }
                }
                
                console.log('קירות עדנית נוצרו בהצלחה');
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
        if (!this.isTable && !this.isPlanter) {
            // עבור ארון - הקוד המקורי
            for (
                let shelfIndex = 0;
                shelfIndex < this.shelves.length;
                shelfIndex++
            ) {
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
            const surfaceBeams = this.createSurfaceBeams(
                this.surfaceWidth,
                this.surfaceLength,
                beamWidth,
                beamHeight,
                this.minGap
            );

                // חישוב רווח בין קורות
                const totalBeamWidth = surfaceBeams.length * beamWidth;
                const remainingSpace = this.surfaceWidth - totalBeamWidth;
                const gapsCount = surfaceBeams.length - 1;
                const gapBetweenBeams =
                    gapsCount > 0 ? remainingSpace / gapsCount : 0;

                // בדיקת נתוני הקורות לפני יצירת המדפים
                console.log(
                    '=== בדיקת נתוני קורות לפני יצירת מדף',
                    shelfIndex + 1,
                    '==='
                );

                // 1. בדיקת רוחב וגובה של קורת מדף בודדת
                console.log('1. קורת מדף בודדת:');
                console.log('   - רוחב:', beamWidth, 'ס"מ');
                console.log('   - גובה:', beamHeight, 'ס"מ');

                // 2. בדיקת הרווח בין הקורות במדף
                console.log('2. רווח בין הקורות במדף:');
                console.log('   - אורך כולל:', this.surfaceWidth, 'ס"מ');
                console.log('   - אורך כולל קורות:', totalBeamWidth, 'ס"מ');
                console.log('   - מקום פנוי:', remainingSpace, 'ס"מ');
                console.log('   - כמות רווחים:', gapsCount);
                console.log(
                    '   - רווח בין קורות:',
                    gapBetweenBeams.toFixed(2),
                    'ס"מ'
                );

                // 3. בדיקת רוחב וגובה של קורת הרגל
                console.log('3. קורת רגל:');
                console.log('   - רוחב:', legWidth, 'ס"מ');
                console.log('   - גובה:', legDepth, 'ס"מ');

                // 4. בדיקת חסימת קורות על ידי רגליים
                console.log('4. בדיקת חסימת קורות:');
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
                        console.log('   - מקרה קיצון: נשארות רק שתי הקורות המקוצרות (אין קורות באמצע)');
                    }
                }

                console.log(
                    '   - רוחב קורה + רווח:',
                    beamAndGapWidth.toFixed(2),
                    'ס"מ'
                );
                console.log('   - רוחב רגל:', legWidth, 'ס"מ');
                console.log('   - האם מדף עליון:', isTopShelf);
                console.log('   - האם להסתיר קורות:', shouldHideBeams);
                if (shouldHideBeams) {
                    console.log(
                        '   - קורות שיוסתרו: הקורה השנייה מההתחלה והקורה השנייה מהסוף'
                    );
                }

                console.log('==========================================');

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
                        console.log(
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
            // Frame beams (קורת חיזוק)
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
            // Add the height of the shelf itself for the next shelf
            currentY += frameBeamHeight + beamHeight;
        }
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
            } else if (this.isPlanter) {
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

            console.log(
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
            // Adjust position - raise by 2cm for length and width edges, keep height edges as is
            let textPosition = middle.clone();
            if (Math.abs(direction.z) > 0.9) {
                // Front/back edges (length)
                textPosition.y += 2; // Raise by 2cm
                textPosition = createTextSprite(edge.value, textPosition);
                textPosition.rotation.z = 0;
            } else if (Math.abs(direction.x) > 0.9) {
                // Left/right edges (width)
                textPosition.y += 2; // Raise by 2cm
                textPosition = createTextSprite(edge.value, textPosition);
                textPosition.rotation.z = Math.PI / 2;
            } else {
                // Vertical edges (height) - move outward by 3cm
                // Move outward in X and Y directions by 3cm
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
        console.log('Added dimension texts for all 12 edges');
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
        this.calculatePricing(); // הוספת חישוב מחיר בכל עדכון
    }
    // פונקציה לחישוב חומרים (קורות) לחישוב מחיר
    async calculatePricing() {
        await this.calculateBeamsData();
    }
    // חישוב נתוני הקורות לחישוב מחיר
    async calculateBeamsData() {
        this.BeamsDataForPricing = [];
        // איסוף כל הקורות מהמודל התלת מימדי
        const allBeams: any[] = [];
        // קבלת נתוני הקורות מהפרמטרים
        const shelfParam = this.isTable 
            ? this.product?.params?.find(
                  (p: any) => p.type === 'beamSingle' && p.name === 'plata'
              )
            : this.isPlanter
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
        if ((this.surfaceWidth && this.surfaceLength && shelfParam) || (this.isPlanter && shelfParam)) {
            const selectedBeam =
                shelfParam.beams?.[shelfParam.selectedBeamIndex || 0];
            const selectedType =
                selectedBeam?.types?.[shelfParam.selectedTypeIndex || 0];
            if (selectedBeam && selectedType) {
                let beamWidth = selectedType.width / 10 || this.beamWidth; // המרה ממ"מ לס"מ
                const beamHeight = selectedType.height / 10 || this.beamHeight;
                // עבור ארון, אם הקורה רחבה מדי, נשתמש ברוחב קטן יותר
                if (!this.isTable && !this.isPlanter && beamWidth > 5) {
                    beamWidth = 4; // רוחב קטן יותר עבור ארון
                }
                
                if (this.isPlanter) {
                    // עבור עדנית - קורות רצפה
                    const depthParam = this.getParam('depth');
                    const widthParam = this.getParam('width');
                    
                    const planterDepth = widthParam ? widthParam.default : 50;  // depth input -> planterDepth
                    const planterWidth = depthParam ? depthParam.default : 40;  // width input -> planterWidth
                    
                    // חישוב כמות הקורות בעומק (41/5 = 8 קורות)
                    const beamsInDepth = Math.floor(planterWidth / beamWidth);
                    
                    // חישוב רווחים ויזואליים (זהה לחישוב הויזואלי)
                    const visualGap = 0.1; // רווח של 0.1 ס"מ בין קורות
                    const totalGaps = beamsInDepth - 1; // כמות הרווחים
                    const totalGapWidth = totalGaps * visualGap; // רוחב כולל של כל הרווחים
                    const availableWidth = planterWidth - totalGapWidth; // רוחב זמין לקורות
                    const adjustedBeamWidth = availableWidth / beamsInDepth; // רוחב קורה מותאם
                    
                    // הוספת כל קורת רצפה
                    for (let i = 0; i < beamsInDepth; i++) {
                        allBeams.push({
                            type: selectedType,
                            length: planterDepth, // אורך הקורה = עומק העדנית
                            width: beamHeight,
                            height: adjustedBeamWidth, // רוחב קורה מותאם עם רווחים
                            name: `Planter Floor Beam ${i + 1}`,
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    }
                    
                    console.log('קורות רצפת עדנית נוספו לחישוב מחיר:', {
                        beamsCount: beamsInDepth,
                        length: planterDepth,
                        width: beamWidth,
                        height: adjustedBeamWidth,
                        visualGap: visualGap,
                        beamName: selectedBeam.name,
                        woodType: selectedType.translatedName
                    });
                    
                    // הוספת קורות הקירות לחישוב מחיר
                    const heightParam = this.getParam('height');
                    const planterHeight = heightParam ? heightParam.default : 50;
                    const maxWallHeight = planterHeight - beamHeight;
                    const beamsInHeight = Math.floor(maxWallHeight / beamWidth);
                    
                    if (beamsInHeight > 0) {
                        // חישוב רווחים ויזואליים לקירות
                        const wallVisualGap = 0.1; // רווח של 0.1 ס"מ בין קורות
                        const wallTotalGaps = beamsInHeight - 1; // כמות הרווחים
                        const wallTotalGapHeight = wallTotalGaps * wallVisualGap; // גובה כולל של כל הרווחים
                        const availableHeight = maxWallHeight - wallTotalGapHeight; // גובה זמין לקורות
                        const adjustedBeamHeight = availableHeight / beamsInHeight; // גובה קורה מותאם
                        
                        // הוספת קורות הקירות (2 קירות)
                        for (let wallIndex = 0; wallIndex < 2; wallIndex++) {
                            for (let i = 0; i < beamsInHeight; i++) {
                                allBeams.push({
                                    type: selectedType,
                                    length: widthParam.default, // אורך הקורה = width input (הוחלף עם depth)
                                    width: beamHeight,
                                    height: adjustedBeamHeight, // גובה קורה מותאם עם רווחים
                                    name: `Planter Wall ${wallIndex + 1} Beam ${i + 1}`,
                                    beamName: selectedBeam.name,
                                    beamTranslatedName: selectedBeam.translatedName,
                                    beamWoodType: selectedType.translatedName, // סוג העץ
                                });
                            }
                        }
                        
                        console.log('קורות קירות עדנית נוספו לחישוב מחיר:', {
                            wallsCount: 2,
                            beamsPerWall: beamsInHeight,
                            totalWallBeams: beamsInHeight * 2,
                            length: widthParam.default,
                            width: beamHeight,
                            height: adjustedBeamHeight,
                            visualGap: wallVisualGap,
                            beamName: selectedBeam.name,
                            woodType: selectedType.translatedName
                        });
                    }
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
                    // חישוב קיצור קורות המדפים
                    const totalShelves = this.shelves.length;
                    const shelvesWithoutTop = totalShelves - 1; // מדפים ללא המדף העליון
                    const shortenedBeamsCount = shelvesWithoutTop * 2; // 2 קורות מקוצרות לכל מדף שאיננו עליון
                    // מציאת קורת הרגל/החיזוק לחישוב הקיצור
                    const legParam = this.product?.params?.find(
                        (p: any) => p.type === 'beamSingle' && p.name === 'leg'
                    );
                    const legBeamSelected =
                        legParam?.beams?.[legParam.selectedBeamIndex || 0];
                    const legBeamHeight = legBeamSelected?.height / 10 || 0;
                    // קיצור קורות המדפים - פעם אחת גובה קורת הרגל/החיזוק
                    const shorteningPerBeam = legBeamHeight * 2;
                    this.shelves.forEach((shelf, index) => {
                        const isTopShelf = index === totalShelves - 1; // המדף העליון

                        // חישוב רווח בין קורות (כמו ב-3D model)
                        const totalBeamWidth = surfaceBeams.length * beamWidth;
                        const remainingSpace =
                            this.surfaceWidth - totalBeamWidth;
                        const gapsCount = surfaceBeams.length - 1;
                        const gapBetweenBeams =
                            gapsCount > 0 ? remainingSpace / gapsCount : 0;

                        // בדיקה אם להסתיר קורות (כמו ב-3D model)
                        const beamAndGapWidth = beamWidth + gapBetweenBeams;
                        const legBeamWidth = legBeamSelected?.width / 10 || 0;
                        const shouldHideBeams =
                            beamAndGapWidth < legBeamWidth && !isTopShelf;

                        surfaceBeams.forEach((beam, beamIndex) => {
                            let beamLength = beam.depth;

                            // בדיקה אם הקורה הזאת צריכה להיות מוסתרת
                            const shouldSkipThisBeam =
                                shouldHideBeams &&
                                (beamIndex === 1 ||
                                    beamIndex === surfaceBeams.length - 2);
                            if (shouldSkipThisBeam) {
                                return; // מדלג על הקורה הזאת
                            }
                            
                            // קיצור רק 2 קורות ספציפיות מכל מדף שאיננו עליון
                            // נניח שהקורות הראשונות הן אלה שצריכות להיות מקוצרות
                            if (!isTopShelf && beamIndex < 2) {
                                beamLength = beamLength - shorteningPerBeam;
                            }
                            allBeams.push({
                                type: selectedType,
                                length: beamLength,
                                width: beam.width,
                                height: beam.height,
                                name: `Shelf ${index + 1} Beam`,
                                beamName: selectedBeam.name,
                                beamTranslatedName: selectedBeam.translatedName,
                                beamWoodType: selectedType.translatedName, // סוג העץ
                            });
                        });
                    });
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
                        // שכפול קורות החיזוק לשולחן - עוד 4 קורות זהות
                        allBeams.push({
                            type: selectedType,
                            length: this.surfaceWidth - shorteningAmountEx,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Width 3',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        allBeams.push({
                            type: selectedType,
                            length: this.surfaceWidth - shorteningAmountEx,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Width 4',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        allBeams.push({
                            type: selectedType,
                            length: lengthBeamLength,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Length 3',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                        allBeams.push({
                            type: selectedType,
                            length: lengthBeamLength,
                            width: frameWidth,
                            height: frameHeight,
                            name: 'Table Frame Beam Length 4',
                            beamName: selectedBeam.name,
                            beamTranslatedName: selectedBeam.translatedName,
                            beamWoodType: selectedType.translatedName, // סוג העץ
                        });
                    } else {
                        console.log(
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
            console.log(
                'DEBUG - legHeight calculation:',
                totalHeight,
                '-',
                shelfBeamHeight,
                '=',
                legHeight
            );
            console.log(
                'DEBUG - legHeight type:',
                typeof legHeight,
                'value:',
                legHeight
            );
            if (selectedBeam && selectedType) {
                const legWidth = selectedType.width / 10 || 5; // המרה ממ"מ לס"מ
                const legHeightDimension = selectedType.height / 10 || 5;
                // 4 רגליים לשולחן או לארון
                const numLegs = 4;
                for (let i = 0; i < numLegs; i++) {
                    console.log(
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
                        beamWoodType: selectedType.name, // סוג העץ
                    });
                }
            }
        } else {
            console.log('Leg beams not processed - no legParam found');
        }
        // קיבוץ קורות לפי סוג עץ ושם קורה - איחוד קורות זהות
        console.log('=== STARTING beamTypesMap PROCESSING ===');
        console.log('Total beams in allBeams:', allBeams.length);
        allBeams.forEach((beam, index) => {
            console.log(`Beam ${index + 1}:`, {
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
            console.log(
                `Processing beam for beamTypesMap: typeKey=${typeKey}, beamName=${beam.beamName}, name=${beam.name}`
            );
            if (!beamTypesMap.has(typeKey)) {
                console.log(
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
            console.log(
                `Beam ${index + 1} (${beamData.beamName}) totalSizes:`,
                totalSizes
            );
        });
        // הצגת התוצאה הסופית של כל הקורות
        console.log('=== FINAL BEAMS DATA FOR PRICING ===');
        console.log('Total beam types:', this.BeamsDataForPricing.length);
        this.BeamsDataForPricing.forEach((beamData, index) => {
            console.log(`Beam Type ${index + 1}:`, {
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
        console.log('=== FINAL BEAMS DATA FOR PRICING ===');
        console.log('Total beam types:', this.BeamsDataForPricing.length);
        this.BeamsDataForPricing.forEach((beamData, index) => {
            console.log(`Beam Type ${index + 1}:`, {
                type: beamData.type,
                beamName: beamData.beamName,
                beamTranslatedName: beamData.beamTranslatedName,
                material: beamData.material,
                totalSizes: beamData.totalSizes,
                totalLength: beamData.totalLength,
                count: beamData.count,
            });
        });
        console.log('*** === END BEAMS DATA ===', this.BeamsDataForPricing);
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
                
            case 'leg_width': // ברגי רגליים מבוססי רוחב
                rawLength = dimension1 + 3.5; // dimension1 = beamWidth
                break;
                
            case 'leg_height': // ברגי רגליים מבוססי גובה
                rawLength = dimension1 + 3.5; // dimension1 = beamHeight
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
        console.log('=== CALCULATING SHELF FORGING DATA ===');
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
                    console.log(
                        `Table shelf screws: ${totalScrews} screws for ${totalBeams} beams (${screwsPerBeam} screws per beam)`
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
                    console.log(
                        `Cabinet shelf screws: ${totalScrews} screws for ${totalShelves} shelves (${totalHiddenBeams} hidden beams, ${screwsPerBeam} screws per beam)`
                    );
                }
            }
        }
        return shelfForgingData;
    }
    // פונקציה לחישוב ברגי הרגליים
    private calculateLegForgingData(): any[] {
        console.log('=== CALCULATING LEG FORGING DATA ===');
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
                const widthScrewLength = this.calculateScrewLength('leg_width', beamWidth);
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
                const heightScrewLength = this.calculateScrewLength('leg_height', beamHeight);
                legForgingData.push({
                    type: 'Leg Screws (Height)',
                    beamName: selectedBeam.name,
                    beamTranslatedName: selectedBeam.translatedName,
                    material: selectedType.translatedName,
                    count: remainingScrews,
                    length: heightScrewLength,
                    description: 'ברגי רגליים (לפי גובה)',
                });
                console.log(
                    `Leg screws: ${halfScrews} width-based (${widthScrewLength}cm) + ${remainingScrews} height-based (${heightScrewLength}cm)`
                );
            }
        }
        return legForgingData;
    }
    
    // פונקציה לחישוב ברגי קירות העדנית
    private calculatePlanterWallForgingData(): any[] {
        console.log('=== CALCULATING PLANTER WALL FORGING DATA ===');
        const planterWallForgingData: any[] = [];
        
        if (this.isPlanter) {
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
                    
                    console.log(
                        `Planter wall screws: ${totalScrews} screws for ${totalWallBeams} beams (${screwsPerBeam} screws per beam)`
                    );
                }
            }
        }
        
        return planterWallForgingData;
    }
    
    // פונקציה לחישוב ברגי רצפת העדנית
    private calculatePlanterFloorForgingData(): any[] {
        console.log('=== CALCULATING PLANTER FLOOR FORGING DATA ===');
        const planterFloorForgingData: any[] = [];
        
        if (this.isPlanter) {
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
                    
                    console.log(
                        `Planter floor screws: ${totalScrews} screws for ${beamsInDepth} beams (${screwsPerBeam} screws per beam)`
                    );
                }
            }
        }
        
        return planterFloorForgingData;
    }
    
    // פונקציה לחישוב ברגי קירות צדדיים עדנית
    private calculatePlanterSideWallForgingData(): any[] {
        console.log('=== CALCULATING PLANTER SIDE WALL FORGING DATA ===');
        const planterSideWallForgingData: any[] = [];
        
        if (this.isPlanter) {
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
                    
                    console.log(
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
            
            console.log(
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
            
            console.log(
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
            console.log(
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
            
            console.log(
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
            
            console.log(`קיר שמאלי בורג ${i}: x=${xPosition.toFixed(1)}, y=${(beamHeight / 2 - screwOffset).toFixed(1)}, z=${(-planterWidth / 2 + beamHeight / 2).toFixed(1)}`);
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
            
            console.log(`קיר ימני בורג ${i}: x=${xPosition.toFixed(1)}, y=${(beamHeight / 2 - screwOffset).toFixed(1)}, z=${(planterWidth / 2 - beamHeight / 2).toFixed(1)}`);
        }
        
        const actualScrewCount = Math.max(screwCount - 2, 1); // הסרת הקיצוניים, מינימום 1
        console.log(`נוספו ${actualScrewCount} ברגים לכל קיר צדדי (סה"כ ${actualScrewCount * 2} ברגים, ללא הקיצוניים)`);
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
        console.log('=== יצירת קורות חיזוק פנימיות לעדנית ===');
        
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
            
            console.log(`קורת חיזוק פנימית ${index + 1}: x=${pos.x.toFixed(1)}, y=${centerY.toFixed(1)}, z=${pos.z.toFixed(1)}, גובה=${actualWallHeight.toFixed(1)}`);
        });
        
        console.log('קורות חיזוק פנימיות נוצרו בהצלחה');
    }
    
    // פונקציה ראשית לחישוב כל הברגים
    private async calculateForgingData(): Promise<void> {
        console.log('=== CALCULATING FORGING DATA ===');
        // איפוס המערך
        this.ForgingDataForPricing = [];
        // חישוב ברגי מדפים/פלטה
        const shelfForgingData = this.calculateShelfForgingData();
        this.ForgingDataForPricing.push(...shelfForgingData);
        // חישוב ברגי רגליים
        const legForgingData = this.calculateLegForgingData();
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
        console.log('=== FINAL FORGING DATA FOR PRICING ===');
        console.log('Total forging types:', this.ForgingDataForPricing.length);
        this.ForgingDataForPricing.forEach((forgingData, index) => {
            console.log(`Forging Type ${index + 1}:`, {
                type: forgingData.type,
                beamName: forgingData.beamName,
                beamTranslatedName: forgingData.beamTranslatedName,
                material: forgingData.material,
                count: forgingData.count,
                length: forgingData.length,
                description: forgingData.description,
            });
        });
        console.log('*** === END FORGING DATA ===', this.ForgingDataForPricing);
        // חישוב מחיר כולל ותוכנית חיתוך
        this.calculatedPrice = await this.pricingService.calculatePrice(
            this.BeamsDataForPricing,
            this.ForgingDataForPricing
        );
        this.cuttingPlan = await this.pricingService.getCuttingPlan(
            this.BeamsDataForPricing,
            this.ForgingDataForPricing
        );
        console.log('=== FINAL CALCULATED PRICE ===', this.calculatedPrice);
        console.log('=== CUTTING PLAN ===', this.cuttingPlan);
        
        // חישוב סכום הקורות הבודדות
        let totalBeamPrices = 0;
        this.cuttingPlan.forEach((beam, index) => {
            console.log(`Beam ${index + 1}: ${beam.beamPrice}₪ (${beam.beamType} ${beam.beamLength}cm)`);
            totalBeamPrices += beam.beamPrice;
        });
        console.log('=== TOTAL OF INDIVIDUAL BEAM PRICES ===', totalBeamPrices);
        
        // חישוב מחיר הברגים
        let totalForgingPrices = 0;
        this.ForgingDataForPricing.forEach((forging, index) => {
            const pricePerUnit = this.pricingService.findPriceForLength(forging.type, forging.length);
            const forgingPrice = pricePerUnit * forging.count;
            console.log(`Forging ${index + 1}: ${forgingPrice}₪ (${forging.type} ${forging.length}cm x ${forging.count} @ ${pricePerUnit}₪ each)`);
            totalForgingPrices += forgingPrice;
        });
        console.log('=== TOTAL FORGING PRICES ===', totalForgingPrices);
        
        const totalExpectedPrice = totalBeamPrices + totalForgingPrices;
        console.log('=== EXPECTED TOTAL (BEAMS + FORGING) ===', totalExpectedPrice);
        console.log('=== ACTUAL CALCULATED PRICE ===', this.calculatedPrice);
        console.log('=== DIFFERENCE ===', this.calculatedPrice - totalExpectedPrice);
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
        const FIXED_DISTANCE = 100; // מרחק קבוע מהמרכז
        
        // מיקום המצלמה במרחק קבוע מהמרכז
        this.camera.position.set(0, FIXED_DISTANCE, 200);
        
        // מרכוז על מרכז העולם (0,0,0)
        this.camera.lookAt(0, 0, 0);

        // סיבוב המצלמה 30 מעלות כלפי מטה (קבוע)
        const offset = this.camera.position.clone();
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.phi += ROTATION_ANGLE * Math.PI / 180; // 30 מעלות כלפי מטה
        this.camera.position.setFromSpherical(spherical);
        this.camera.lookAt(0, 0, 0);
        
        // זום אאוט במצב הפתיחה
        const currentDistance = this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
        const zoomOutAmount = 200; // זום אאוט ב-200 יחידות (פי 2 יותר מקודם)
        const newDistance = currentDistance + zoomOutAmount;
        const direction = this.camera.position.clone().normalize();
        this.camera.position.copy(direction.multiplyScalar(newDistance));
        
        // pan למעלה במצב הפתיחה
        const screenHeight = window.innerHeight;
        const panAmount = screenHeight / 2; // חצי מגובה המסך
        const cam = this.camera;
        const pan = new THREE.Vector3();
        pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), panAmount * 0.2); // חיובי = למעלה
        cam.position.add(pan);
        this.scene.position.add(pan);
        
        // המתנה של חצי שניה ואז זום אין אוטומטי
        setTimeout(() => {
            this.performAutoZoomIn();
        }, 500);
        
        console.log('מצלמה מורכזת על מרכז העולם:', {
            fixedDistance: FIXED_DISTANCE,
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
        
        console.log('PAN UP HALF SCREEN:', {
            screenHeight,
            panAmount,
            panVector: pan,
            cameraPosition: this.camera.position.clone(),
            scenePosition: this.scene.position.clone()
        });
    }
    
    // פונקציה לביצוע זום אין אוטומטי עם ease-in-out
    private performAutoZoomIn() {
        const startTime = Date.now();
        const startPosition = this.camera.position.clone();
        const startScenePosition = this.scene.position.clone();
        const currentDistance = startPosition.distanceTo(new THREE.Vector3(0, 0, 0));
        const zoomAmount = -50; // זום אין (ערך שלילי כמו בגלגלת)
        const targetDistance = currentDistance + zoomAmount;
        
        // הורדה עדינה של המודל (30 פיקסלים)
        const panDownAmount = 30 * 0.2; // המרה לפיקסלים עם אותו מקדם כמו pan רגיל

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / 500, 1); // משך של חצי שנייה (פי 2 יותר מהיר)

            // Ease in out function
            const easeProgress = progress < 0.5
                ? 2 * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            let newDistance = THREE.MathUtils.lerp(currentDistance, targetDistance, easeProgress);
            if (newDistance < 1) newDistance = 1; // הגנה מפני מרחק קטן מדי
            
            // שימוש באותה לוגיקה כמו בגלגלת
            const direction = this.camera.position.clone().normalize();
            this.camera.position.copy(direction.multiplyScalar(newDistance));
            
            // הורדה עדינה של המודל במהלך האנימציה
            const panDownProgress = THREE.MathUtils.lerp(0, panDownAmount, easeProgress);
            const cam = this.camera;
            const pan = new THREE.Vector3();
            pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), -panDownProgress); // שלילי = למטה
            this.scene.position.copy(startScenePosition.clone().add(pan));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('AUTO ZOOM IN COMPLETED:', {
                    startDistance: currentDistance,
                    targetDistance: targetDistance,
                    finalDistance: this.camera.position.distanceTo(new THREE.Vector3(0, 0, 0)),
                    panDownAmount: panDownAmount,
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
                console.log(
                    'DEBUG - shelfBeam.height (raw):',
                    shelfBeam.height
                );
                console.log(
                    'DEBUG - shelfBeam.height / 10:',
                    shelfBeam.height / 10
                );
                shelfBeamHeight = shelfBeam.height / 10; // המרה ממ"מ לס"מ
                console.log(
                    'DEBUG - shelfBeamHeight (final):',
                    shelfBeamHeight
                );
            }
        }
        // קיצור הרגליים בעובי קורות המדפים - הרגליים צריכות להגיע רק עד לתחתית המדף העליון
        console.log('DEBUG - topHeight:', topHeight);
        console.log('DEBUG - shelfBeamHeight:', shelfBeamHeight);
        legHeight = topHeight - shelfBeamHeight;
        console.log(
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
        console.log('=== Adding screws to lower frame beams for table ===');
        console.log('frameY (screw height):', frameY);
        console.log('Number of legs:', legPositions.length);
        
        // קבלת מידות הרגל לחישוב אורך הבורג
        const legParam = this.getParam('leg');
        let legBeamWidth = frameBeamHeight;
        let legBeamHeight = frameBeamHeight;
        if (legParam && legParam.beams && legParam.beams.length > 0) {
            const selectedBeam = legParam.beams[legParam.selectedBeamIndex || 0];
            const selectedType = selectedBeam?.types?.[legParam.selectedTypeIndex || 0];
            if (selectedType) {
                legBeamWidth = selectedType.width / 10;
                legBeamHeight = selectedType.height / 10;
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
                const dimension = screwIndex === 0 ? legBeamHeight : legBeamWidth;
                const calculatedScrewLength = this.calculateScrewLength(screwType, dimension);
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
                
                console.log(
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
        console.log(
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
                console.log(
                    '=====================',
                    actualLegHeight,
                    legWidth,
                    plataBeamHeight
                );
                console.log('Table screw calculation:', {
                    actualLegHeight,
                    legWidth,
                    currentShelfY,
                });
                console.log(
                    'Previous calculation would be:',
                    actualLegHeight - legWidth / 2,
                    'New calculation:',
                    currentShelfY
                );
                console.log('Leg positions for calculation:', legPositions[0]);
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
                    const selectedType = selectedBeam?.types?.[legParam.selectedTypeIndex || 0];
                    if (selectedType) {
                        legBeamWidth = selectedType.width / 10;
                        legBeamHeight = selectedType.height / 10;
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
                    const dimension = screwIndex === 0 ? legBeamHeight : legBeamWidth;
                    const calculatedScrewLength = this.calculateScrewLength(screwType, dimension);
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
                    console.log(
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
        } else if (this.isPlanter) {
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
            totalHeight = actualHeight + beamHeight; // גובה אמיתי + גובה הריצפה
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
                console.log('CHECKSCREWS === COMPREHENSIVE SCREW POSITION ANALYSIS ===');
                console.log('CHECKSCREWS === BASIC INFO ===');
                console.log('CHECKSCREWS isShortenedBeam:', isShortenedBeam);
                console.log('CHECKSCREWS beam.x (center):', beam.x);
                console.log('CHECKSCREWS beam.width (רוחב):', beam.width);
                console.log('CHECKSCREWS beam.height (גובה):', beam.height);
                console.log('CHECKSCREWS beam.depth (עומק):', beam.depth);
                console.log('CHECKSCREWS === FRAME BEAM INFO ===');
                console.log('CHECKSCREWS frameBeamWidth (רוחב קורות הרגל/חיזוק):', frameBeamWidth);
                console.log('CHECKSCREWS frameBeamHeight (גובה קורות הרגל/חיזוק):', this.frameHeight);
                console.log('CHECKSCREWS === SCREW POSITIONS AFTER FILTERING ===');
                console.log('CHECKSCREWS Remaining screws after filtering:');
                console.log('CHECKSCREWS   startPositions:', startPositions);
                console.log('CHECKSCREWS   endPositions:', endPositions);

                // חישוב הפרמטרים לפי הלוגיקה החדשה
                const A = this.surfaceWidth / 2; // הרוחב הכולל של הארון חלקי 2
                const X = this.frameHeight; // frameBeamHeight
                const Y = frameBeamWidth; // המידה השנייה של קורת הרגל (לא frameBeamHeight)
                const Q = beam.width; // beam.width

                console.log('CHECKSCREWS === CALCULATION PARAMETERS ===');
                console.log('CHECKSCREWS A (רוחב כולל חלקי 2):', A);
                console.log('CHECKSCREWS X (frameBeamHeight):', X);
                console.log('CHECKSCREWS Y (frameBeamWidth):', Y);
                console.log('CHECKSCREWS Q (beam.width):', Q);

                // חישוב Z ו-R ו-L
                const Z = (X - Y) / 2;
                const R = (Q - Z) / 2;
                const L = R + Z;

                console.log('CHECKSCREWS === INTERMEDIATE CALCULATIONS ===');
                console.log('CHECKSCREWS Z ((X-Y)/2):', Z);
                console.log('CHECKSCREWS R ((Q-Z)/2):', R);
                console.log('CHECKSCREWS L (R+Z):', L);

                // המרחק הסופי של הברגים מהמרכז
                let finalDistance;
                if (Q > X) {
                    // מקרה קצה: Q > X
                    finalDistance = A - X / 2;
                    console.log('CHECKSCREWS מקרה קצה: Q > X');
                    console.log(
                        'CHECKSCREWS finalDistance (A - X/2):',
                        finalDistance
                    );
                } else {
                    // מקרה רגיל: Q <= X
                    finalDistance = A - L;
                    console.log('CHECKSCREWS מקרה רגיל: Q <= X');
                    console.log(
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
                console.log('CHECKSCREWS Gap analysis:');
                console.log('CHECKSCREWS   Left edge X:', leftEdgeX);
                console.log('CHECKSCREWS   Right edge X:', rightEdgeX);
                console.log('CHECKSCREWS   Left screw X:', leftScrewX);
                console.log('CHECKSCREWS   Right screw X:', rightScrewX);
                console.log(
                    'CHECKSCREWS   Gap from left edge to left screw:',
                    leftGap
                );
                console.log(
                    'CHECKSCREWS   Gap from right screw to right edge:',
                    rightGap
                );
                console.log(
                    'CHECKSCREWS   Total gap (left + right):',
                    leftGap + rightGap
                );
                console.log(
                    'CHECKSCREWS   Gap percentage of beam width:',
                    (((leftGap + rightGap) / beam.width) * 100).toFixed(1) + '%'
                );
                console.log('CHECKSCREWS === FINAL RESULT ===');
                console.log('CHECKSCREWS Final screw positions:', screwPositions);
                console.log('CHECKSCREWS === END COMPREHENSIVE SCREW POSITION ANALYSIS ===');
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

                console.log(
                    'CHECKSCREWS adjustedStartPositions:',
                    adjustedStartPositions
                );
                console.log(
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
}

import { Component, Input, Output, EventEmitter, ElementRef, ViewChild, AfterViewInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-product-mini-preview',
  templateUrl: './product-mini-preview.component.html',
  styleUrls: ['./product-mini-preview.component.scss']
})
export class ProductMiniPreviewComponent implements AfterViewInit, OnDestroy, OnChanges {
  private debugLogsTimer: any = null;
  private debugLogsEnabled = true;
  private miniPreviewLogsShown = new Set<string>();
  @Input() product: any;
  @Input() configurationIndex: number = 0;
  @Output() loadComplete = new EventEmitter<void>();
  @Output() userInteracted = new EventEmitter<void>(); // Event לכל פעולה של משתמש
  @Output() resetComplete = new EventEmitter<void>(); // Event להשלמת איפוס
  
  @ViewChild('miniPreviewContainer', { static: true }) container!: ElementRef;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId!: number;
  private textureLoader = new THREE.TextureLoader();

  // פרמטרים דינמיים - ערכי ברירת מחדל זהה לקובץ הראשי
  public dynamicParams = {
    width: 100, // זהה לקובץ הראשי
    length: 100, // זהה לקובץ הראשי
    height: 100, // זהה לקובץ הראשי
    beamWidth: 10, // זהה לקובץ הראשי
    beamHeight: 2, // זהה לקובץ הראשי
    frameWidth: 5, // זהה לקובץ הראשי
    frameHeight: 5, // זהה לקובץ הראשי
    gap: 1, // 🎯 תיקון: רווח מינימלי בין קורות (כמו בקובץ הראשי - minGap)
    shelfCount: 3,
    woodType: 0, // אינדקס סוג עץ
    beamType: 0,  // אינדקס סוג קורה
    coverOpenOffset: 0 as number | null // מרחק פתיחת המכסה: 0 (סגור), 50 (פתוח), או null (אין מכסה)
  };

  // גבהי המדפים הנוכחיים
  public shelfGaps: number[] = [];
  
  // פרמטרים נוכחיים של הקורה
  public currentBeamIndex: number = 0;
  public currentBeamTypeIndex: number = 0;
  
  // מרחק ברירת מחדל של המצלמה
  private defaultDistance: number = 0;
  
  // צבעי עץ שונים
  private woodColors = [
    0x8B4513, // חום עץ רגיל
    0xCD853F, // חום בהיר יותר
    0x654321  // חום כהה
  ];
  
  // צבעי קורות שונים
  private beamColors = [
    0x4a4a4a, // אפור כהה
    0x696969, // אפור בינוני
    0x2F4F4F  // אפור כהה יותר
  ];

  // Helper for numeric step
  getStep(type: number): number {
    return 1 / Math.pow(10, type);
  }

  // Get wood texture based on beam type - זהה לקובץ הראשי
  private getWoodTexture(beamType: string): THREE.Texture {
    let texturePath = 'assets/textures/pine.jpg'; // default
    if (beamType) {
      texturePath = 'assets/textures/' + beamType + '.jpg';
    } else {
      texturePath = 'assets/textures/pine.jpg';
    }
    
    // Debug log for texture loading
    const logKey = `texture-loading-${this.product?.id || this.product?.name || 'unknown'}-${beamType}`;
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey)) {
      // Loading texture
      this.miniPreviewLogsShown.add(logKey);
    }
    
    // נסה לטעון את הטקסטורה באופן סינכרוני
    let texture: THREE.Texture;
    try {
      // נסה ליצור טקסטורה עם תמונה שנטענה מראש
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = texturePath;
      
      if (image.complete) {
        texture = new THREE.Texture(image);
        texture.needsUpdate = true;
        // Texture loaded synchronously (preloaded)
      } else {
        // אם התמונה לא נטענה, נסה עם נתיב אחר
        texture = this.textureLoader.load(texturePath);
      }
    } catch (error) {
      console.warn('Sync loading failed, using async:', error);
      texture = this.textureLoader.load(texturePath);
    }
    
    // הוספת error handling לטקסטורה
    texture.onError = (error) => {
      console.error('Failed to load texture:', texturePath, error);
    };
    
    texture.onLoad = () => {
      // Texture loaded successfully
      // וידוא שהטקסטורה מוחלת על המודל
      texture.needsUpdate = true;
      // רנדור מחדש כדי להציג את הטקסטורה
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
        // Rendered scene after texture load
      }
    };
    
    // בדיקה אם הטקסטורה כבר נטענה (cache)
    if (texture.image && texture.image.complete) {
      // Texture already loaded from cache
      texture.needsUpdate = true;
    }
    
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey + '_loaded')) {
      // Texture debug info
      this.miniPreviewLogsShown.add(logKey + '_loaded');
    }
    
    return texture;
  }

  // פונקציה עזר לבחירת קורה לפי defaultType
  private getBeamIndexByDefaultType(param: any): number {
    let beamIndex = param.selectedBeamIndex || 0;
    
    // Debug log for beam selection
    const logKey = `beam-selection-${this.product?.id || this.product?.name || 'unknown'}-${param.name}`;
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey)) {
      // Debug beam index by default type
      this.miniPreviewLogsShown.add(logKey);
    }
    
    // אם יש defaultType, מחפשים את הקורה המתאימה לפי ה-ID
    if (param.defaultType && !param.selectedBeamIndex && param.beams && param.beams.length > 0) {
      const defaultTypeId = param.defaultType.$oid || param.defaultType._id || param.defaultType;
      const foundIndex = param.beams.findIndex((b: any) => {
        const beamId = b._id || b.$oid;
        return beamId === defaultTypeId;
      });
      if (foundIndex !== -1) {
        beamIndex = foundIndex;
      }
    }
    
    return beamIndex;
  }

  private meshes: THREE.Mesh[] = [];
  private target = new THREE.Vector3(0, 0, 0);
  private spherical = new THREE.Spherical();
  private isMouseDown = false;
  private isPan = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private hasUserInteracted = false; // האם המשתמש התחיל להזיז את המודל
  private hasUserPerformedAction = false; // האם המשתמש ביצע פעולה ממשית (זום/סיבוב/pan)
  private inactivityTimer: any = null; // טיימר לחוסר פעילות
  private rotationSpeed: number = 0.005; // מהירות הסיבוב האוטומטי (רדיאנים לפריים)
  
  // משתנה לאחסון הקורות הדינמיות עבור beams
  private dynamicBeams: Array<{length: number, quantity: number}> = [];

  ngAfterViewInit() {
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('chack01-ngAfterViewInit')) {
      this.miniPreviewLogsShown.add('chack01-ngAfterViewInit');
    }
    
    // Delay 3D initialization until component is visible
    this.delayedInit();
  }

  private delayedInit() {
    // Check if component is visible immediately
    if (this.isElementVisible()) {
      this.initializeThreeJS();
    } else {
      // If not visible, use Intersection Observer to wait for visibility
      this.setupIntersectionObserver();
    }
  }

  private setupIntersectionObserver() {
    if (!this.container || !this.container.nativeElement) {
      // Fallback: initialize after a short delay
      setTimeout(() => this.initializeThreeJS(), 100);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.initializeThreeJS();
          observer.disconnect(); // Stop observing once visible
        }
      });
    }, {
      threshold: 0.1 // Trigger when 10% of the element is visible
    });

    observer.observe(this.container.nativeElement);
  }

  private initializeThreeJS() {
    try {
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('ngAfterViewInit_started')) {
        // ngAfterViewInit started
        this.miniPreviewLogsShown.add('ngAfterViewInit_started');
      }
      this.initThreeJS();
      this.initializeParamsFromProduct();
      this.createSimpleProduct();
      
      // וידוא שהסיבוב האוטומטי מופעל
      this.hasUserInteracted = false;
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('ngAfterViewInit_animation')) {
        // Starting animation
        this.miniPreviewLogsShown.add('ngAfterViewInit_animation');
      }
      
      this.animate();
      
      // הפעלת טיימר לכיבוי לוגים אחרי 3 שניות
      this.debugLogsTimer = setTimeout(() => {
        this.debugLogsEnabled = false;
        // Debug logs disabled after 3 seconds
        // וידוא שהאנימציה ממשיכה לרוץ גם אחרי כיבוי הלוגים
        // Animation should continue running
      }, 3000);
      
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('chack01-init-completed')) {
        this.miniPreviewLogsShown.add('chack01-init-completed');
      }
      
      // Emit load complete event
      this.loadComplete.emit();
    } catch (error) {
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['product'] && this.scene) {
      // לוג חד פעמי להשוואה
      const logKey = `mini-preview-${this.product?.id || this.product?.name || 'unknown'}`;
        // לוג מפורט חד פעמי
        if (!this.miniPreviewLogsShown.has(logKey + '_detailed')) {
      // Detailed preview log
          this.miniPreviewLogsShown.add(logKey + '_detailed');
        }
      
      // אתחול מחדש של הסיבוב האוטומטי
      this.hasUserInteracted = false;
      
      // השתמש ב-setTimeout כדי למנוע את השגיאה
      setTimeout(() => {
        this.initializeParamsFromProduct();
        this.createSimpleProduct();
      }, 0);
    }
  }

  ngOnDestroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (this.debugLogsTimer) {
      clearTimeout(this.debugLogsTimer);
    }
  }

  // פונקציה לאפס את טיימר חוסר הפעילות
  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    this.inactivityTimer = setTimeout(() => {
      this.hasUserInteracted = false; // החזרת הסיבוב האוטומטי
    }, 30000); // 30 שניות
  }





  // פונקציה לקבלת שם התצוגה של קורת החיזוק הנוכחית
  getCurrentFrameBeamDisplayName(): string {
    if (!this.product || !this.product.params) {
      return 'קורת חיזוק לא זמינה';
    }
    
    // חיפוש קורות החיזוק
    let currentBeam: any = null;
    let currentBeamType: any = null;
    
    this.product.params.forEach((param: any) => {
      if (param.type === 'beamSingle' && param.beams && param.beams.length > 0) {
        const beamIndex = param.selectedBeamIndex || 0;
        if (param.beams[beamIndex]) {
          currentBeam = param.beams[beamIndex];
          const typeIndex = param.selectedBeamTypeIndex || 0;
          if (currentBeam.types && currentBeam.types[typeIndex]) {
            currentBeamType = currentBeam.types[typeIndex];
          }
        }
      }
    });
    
    if (!currentBeam) {
      return 'קורת חיזוק לא זמינה';
    }
    
    if (currentBeamType) {
      return `${currentBeam.translatedName || currentBeam.name} (${currentBeamType.translatedName || currentBeamType.name})`;
    }
    
    return currentBeam.translatedName || currentBeam.name || 'קורת חיזוק לא זמינה';
  }

  // פונקציה לקבלת שם התצוגה של קורת המדפים הנוכחית
  getCurrentShelfBeamDisplayName(): string {
    if (!this.product || !this.product.params) {
      return 'קורת מדפים לא זמינה';
    }
    
    // זיהוי סוג המוצר
    const isTable = this.product.name === 'table';
    const isPlanter = this.product.name === 'planter';
    const isBox = this.product.name === 'box';
    
    // חיפוש קורות המדפים
    let currentBeam: any = null;
    let currentBeamType: any = null;
    
    this.product.params.forEach((param: any) => {
      if (isTable) {
        // שולחן - חיפוש פרמטר plata
        if (param.type === 'beamSingle' && param.name === 'plata' && param.beams && param.beams.length > 0) {
          const beamIndex = param.selectedBeamIndex || 0;
          if (param.beams[beamIndex]) {
            currentBeam = param.beams[beamIndex];
            const typeIndex = param.selectedBeamTypeIndex || 0;
            if (currentBeam.types && currentBeam.types[typeIndex]) {
              currentBeamType = currentBeam.types[typeIndex];
            }
          }
        }
      } else if (isPlanter || isBox) {
        // עדנית או קופסא - חיפוש פרמטר beam
        if (param.name === 'beam' && param.beams && param.beams.length > 0) {
          const beamIndex = param.selectedBeamIndex || 0;
          if (param.beams[beamIndex]) {
            currentBeam = param.beams[beamIndex];
            const typeIndex = param.selectedBeamTypeIndex || 0;
            if (currentBeam.types && currentBeam.types[typeIndex]) {
              currentBeamType = currentBeam.types[typeIndex];
            }
          }
        }
      } else {
        // ארון - חיפוש פרמטר shelfs
        if (param.type === 'beamArray' && param.name === 'shelfs' && param.beams && param.beams.length > 0) {
          const beamIndex = param.selectedBeamIndex || 0;
          if (param.beams[beamIndex]) {
            currentBeam = param.beams[beamIndex];
            const typeIndex = param.selectedBeamTypeIndex || 0;
            if (currentBeam.types && currentBeam.types[typeIndex]) {
              currentBeamType = currentBeam.types[typeIndex];
            }
          }
        }
      }
    });
    
    if (!currentBeam) {
      return 'קורת מדפים לא זמינה';
    }
    
    if (currentBeamType) {
      return `${currentBeam.translatedName || currentBeam.name} (${currentBeamType.translatedName || currentBeamType.name})`;
    }
    
    return currentBeam.translatedName || currentBeam.name || 'קורת מדפים לא זמינה';
  }

  // פונקציה להחלפת סוג קורת החיזוק
  changeFrameBeamType() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    if (!this.product || !this.product.params) {
      return;
    }

    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();

    // חיפוש קורות החיזוק
    let frameBeams: any[] = [];
    let frameParam: any = null;
    this.product.params.forEach((param: any) => {
      if (param.type === 'beamSingle' && param.beams && param.beams.length > 0) {
        frameBeams = param.beams;
        frameParam = param;
      }
    });

    if (frameBeams.length === 0 || !frameParam) {
      return;
    }

    // בחירת קורה רנדומלית
    const randomBeamIndex = Math.floor(Math.random() * frameBeams.length);
    const beam = frameBeams[randomBeamIndex];
    
    // בחירת סוג קורה רנדומלי אם יש סוגים זמינים
    let randomTypeIndex = 0;
    if (beam.types && beam.types.length > 0) {
      randomTypeIndex = Math.floor(Math.random() * beam.types.length);
    }

    // עדכון האינדקסים בפרמטר
    frameParam.selectedBeamIndex = randomBeamIndex;
    frameParam.selectedBeamTypeIndex = randomTypeIndex;

    // עדכון הפרמטרים הדינמיים
    if (beam.types && beam.types[randomTypeIndex]) {
      const beamType = beam.types[randomTypeIndex];
      // בדיקות בטיחות למידות הקורה
      const beamWidth = beamType.width || beam.width || 50; // ברירת מחדל 50 מ"מ
      const beamHeight = beamType.height || beam.height || 50; // ברירת מחדל 50 מ"מ
      this.dynamicParams.frameWidth = beamHeight / 10; // height הופך ל-width
      this.dynamicParams.frameHeight = beamWidth / 10; // width הופך ל-height
    } else {
      // אם אין types, נשתמש במידות הקורה עצמה
      const beamWidth = beam.width || 50; // ברירת מחדל 50 מ"מ
      const beamHeight = beam.height || 50; // ברירת מחדל 50 מ"מ
      this.dynamicParams.frameWidth = beamHeight / 10;
      this.dynamicParams.frameHeight = beamWidth / 10;
    }


    // יצירת המודל מחדש ללא עדכון מצלמה
    this.createSimpleProductWithoutCameraUpdate();
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
  }

  // פונקציה להחלפת סוג קורת המדפים
  changeShelfBeamType() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    if (!this.product || !this.product.params) {
      return;
    }

    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();

    // זיהוי סוג המוצר
    const isTable = this.product.name === 'table';
    const isPlanter = this.product.name === 'planter';
    const isBox = this.product.name === 'box';

    // חיפוש קורות המדפים
    let shelfBeams: any[] = [];
    let shelfParam: any = null;
    this.product.params.forEach((param: any) => {
      if (isTable) {
        // שולחן - חיפוש פרמטר plata
        if (param.type === 'beamSingle' && param.name === 'plata' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      } else if (isPlanter || isBox) {
        // עדנית או קופסא - חיפוש פרמטר beam
        if (param.name === 'beam' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      } else {
        // ארון - חיפוש פרמטר shelfs
        if (param.type === 'beamArray' && param.name === 'shelfs' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      }
    });

    if (shelfBeams.length === 0 || !shelfParam) {
      return;
    }

    // בחירת קורה רנדומלית
    const randomBeamIndex = Math.floor(Math.random() * shelfBeams.length);
    const beam = shelfBeams[randomBeamIndex];
    
    // בחירת סוג קורה רנדומלי אם יש סוגים זמינים
    let randomTypeIndex = 0;
    if (beam.types && beam.types.length > 0) {
      randomTypeIndex = Math.floor(Math.random() * beam.types.length);
    }

    // עדכון האינדקסים בפרמטר
    shelfParam.selectedBeamIndex = randomBeamIndex;
    shelfParam.selectedBeamTypeIndex = randomTypeIndex;

    // עדכון הפרמטרים הדינמיים
    if (beam.types && beam.types[randomTypeIndex]) {
      const beamType = beam.types[randomTypeIndex];
      // בדיקות בטיחות למידות הקורה
      const beamWidth = beamType.width || beam.width || 100; // ברירת מחדל 100 מ"מ
      const beamHeight = beamType.height || beam.height || 25; // ברירת מחדל 25 מ"מ
      this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
      this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
    } else {
      // אם אין types, נשתמש במידות הקורה עצמה
      const beamWidth = beam.width || 100; // ברירת מחדל 100 מ"מ
      const beamHeight = beam.height || 25; // ברירת מחדל 25 מ"מ
      this.dynamicParams.beamWidth = beamWidth / 10;
      this.dynamicParams.beamHeight = beamHeight / 10;
    }


    // יצירת המודל מחדש ללא עדכון מצלמה
    this.createSimpleProductWithoutCameraUpdate();
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
  }

  // פונקציות אוטומטיות להחלפת קורות (ללא עצירת האנימציה)
  private changeFrameBeamTypeAuto() {
    if (!this.product || !this.product.params) {
      return;
    }

    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();

    // חיפוש קורות החיזוק
    let frameBeams: any[] = [];
    let frameParam: any = null;
    this.product.params.forEach((param: any) => {
      if (param.type === 'beamSingle' && param.beams && param.beams.length > 0) {
        frameBeams = param.beams;
        frameParam = param;
      }
    });

    if (frameBeams.length === 0 || !frameParam) {
      return;
    }

    // בחירת קורה רנדומלית
    const randomBeamIndex = Math.floor(Math.random() * frameBeams.length);
    const beam = frameBeams[randomBeamIndex];
    
    // בחירת סוג קורה רנדומלי אם יש סוגים זמינים
    let randomTypeIndex = 0;
    if (beam.types && beam.types.length > 0) {
      randomTypeIndex = Math.floor(Math.random() * beam.types.length);
    }

    // עדכון האינדקסים בפרמטר
    frameParam.selectedBeamIndex = randomBeamIndex;
    frameParam.selectedBeamTypeIndex = randomTypeIndex;

    // עדכון הפרמטרים הדינמיים
    if (beam.types && beam.types[randomTypeIndex]) {
      const beamType = beam.types[randomTypeIndex];
      // בדיקות בטיחות למידות הקורה
      const beamWidth = beamType.width || beam.width || 50; // ברירת מחדל 50 מ"מ
      const beamHeight = beamType.height || beam.height || 50; // ברירת מחדל 50 מ"מ
      this.dynamicParams.frameWidth = beamHeight / 10; // height הופך ל-width
      this.dynamicParams.frameHeight = beamWidth / 10; // width הופך ל-height
    } else {
      // אם אין types, נשתמש במידות הקורה עצמה
      const beamWidth = beam.width || 50; // ברירת מחדל 50 מ"מ
      const beamHeight = beam.height || 50; // ברירת מחדל 50 מ"מ
      this.dynamicParams.frameWidth = beamHeight / 10;
      this.dynamicParams.frameHeight = beamWidth / 10;
    }


    // יצירת המודל מחדש ללא עדכון מצלמה
    this.createSimpleProductWithoutCameraUpdate();
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
  }

  private changeShelfBeamTypeAuto() {
    if (!this.product || !this.product.params) {
      return;
    }

    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();

    // זיהוי סוג המוצר
    const isTable = this.product.name === 'table';
    const isPlanter = this.product.name === 'planter';
    const isBox = this.product.name === 'box';

    // חיפוש קורות המדפים
    let shelfBeams: any[] = [];
    let shelfParam: any = null;
    this.product.params.forEach((param: any) => {
      if (isTable) {
        // שולחן - חיפוש פרמטר plata
        if (param.type === 'beamSingle' && param.name === 'plata' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      } else if (isPlanter || isBox) {
        // עדנית או קופסא - חיפוש פרמטר beam
        if (param.name === 'beam' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      } else {
        // ארון - חיפוש פרמטר shelfs
        if (param.type === 'beamArray' && param.name === 'shelfs' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
          shelfParam = param;
        }
      }
    });

    if (shelfBeams.length === 0 || !shelfParam) {
      return;
    }

    // בחירת קורה רנדומלית
    const randomBeamIndex = Math.floor(Math.random() * shelfBeams.length);
    const beam = shelfBeams[randomBeamIndex];
    
    // בחירת סוג קורה רנדומלי אם יש סוגים זמינים
    let randomTypeIndex = 0;
    if (beam.types && beam.types.length > 0) {
      randomTypeIndex = Math.floor(Math.random() * beam.types.length);
    }

    // עדכון האינדקסים בפרמטר
    shelfParam.selectedBeamIndex = randomBeamIndex;
    shelfParam.selectedBeamTypeIndex = randomTypeIndex;

    // עדכון הפרמטרים הדינמיים
    if (beam.types && beam.types[randomTypeIndex]) {
      const beamType = beam.types[randomTypeIndex];
      // בדיקות בטיחות למידות הקורה
      const beamWidth = beamType.width || beam.width || 100; // ברירת מחדל 100 מ"מ
      const beamHeight = beamType.height || beam.height || 25; // ברירת מחדל 25 מ"מ
      this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
      this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
    } else {
      // אם אין types, נשתמש במידות הקורה עצמה
      const beamWidth = beam.width || 100; // ברירת מחדל 100 מ"מ
      const beamHeight = beam.height || 25; // ברירת מחדל 25 מ"מ
      this.dynamicParams.beamWidth = beamWidth / 10;
      this.dynamicParams.beamHeight = beamHeight / 10;
    }


    // יצירת המודל מחדש ללא עדכון מצלמה
    this.createSimpleProductWithoutCameraUpdate();
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
  }

  // פונקציות לשליטה ברוחב
  increaseWidth() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();
    
    this.dynamicParams.width += 5; // הוספת 5 ס"מ
    this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
    
  }

  decreaseWidth() {
    // חיפוש פרמטר הרוחב כדי לבדוק את המינימום המקורי
    const widthParam = this.product?.params?.find((p: any) => p.name === 'width');
    const minWidth = widthParam?.min || 0; // מינימום מקורי של הפרמטר
    
    if (this.dynamicParams.width > minWidth) { // הגבלה מינימלית מקורית
      // עצירת האנימציה האוטומטית למשך 30 שניות
      this.hasUserInteracted = true;
      this.resetInactivityTimer();
      
      // שמירת המצב הנוכחי של המצלמה
      const currentCameraState = this.saveCurrentCameraState();
      
      this.dynamicParams.width -= 5; // הפחתת 5 ס"מ
      this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
      this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
      
      // שחזור המצב של המצלמה
      this.restoreCameraState(currentCameraState);
      
    }
  }

  // פונקציות לשליטה באורך
  increaseLength() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();
    
    this.dynamicParams.length += 5; // הוספת 5 ס"מ
    this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // שחזור המצב של המצלמה
    this.restoreCameraState(currentCameraState);
    
  }

  decreaseLength() {
    // חיפוש פרמטר האורך כדי לבדוק את המינימום המקורי
    const lengthParam = this.product?.params?.find((p: any) => p.name === 'depth');
    const minLength = lengthParam?.min || 0; // מינימום מקורי של הפרמטר
    
    if (this.dynamicParams.length > minLength) { // הגבלה מינימלית מקורית
      // עצירת האנימציה האוטומטית למשך 30 שניות
      this.hasUserInteracted = true;
      this.resetInactivityTimer();
      
      // שמירת המצב הנוכחי של המצלמה
      const currentCameraState = this.saveCurrentCameraState();
      
      this.dynamicParams.length -= 5; // הפחתת 5 ס"מ
      this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
      this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
      
      // שחזור המצב של המצלמה
      this.restoreCameraState(currentCameraState);
      
    }
  }

  // פונקציות לשליטה בגובה המדף השלישי
  increaseShelfHeight() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    // שמירת המצב הנוכחי של המצלמה
    const currentCameraState = this.saveCurrentCameraState();
    
    // זיהוי סוג המוצר
    const isTable = this.product?.name === 'table';
    
    if (isTable) {
      // שולחן - הגדלת גובה המדף היחיד
      this.shelfGaps[0] += 5; // הוספת 5 ס"מ למדף היחיד
      this.dynamicParams.height = this.shelfGaps[0]; // עדכון פרמטר הגובה
    } else {
      // ארון - הגדלת גובה המדף השלישי
      this.shelfGaps[2] += 5; // הוספת 5 ס"מ למדף השלישי
    }
    
    this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
    this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
    
    // עדכון הזום בהתאם לגובה הכולל
    this.restoreCameraState(currentCameraState, true);
  }

  decreaseShelfHeight() {
    // עצירת האנימציה האוטומטית למשך 30 שניות
    this.hasUserInteracted = true;
    this.resetInactivityTimer();
    
    // זיהוי סוג המוצר
    const isTable = this.product?.name === 'table';
    
    if (isTable) {
      // שולחן - הקטנת גובה המדף היחיד
      // חיפוש פרמטר הגובה כדי לבדוק את המינימום המקורי
      const heightParam = this.product?.params?.find((p: any) => p.name === 'height');
      const minHeight = heightParam?.min || 0; // מינימום מקורי של הפרמטר
      
      if (this.shelfGaps[0] > minHeight) { // הגבלה מינימלית מקורית
        // שמירת המצב הנוכחי של המצלמה
        const currentCameraState = this.saveCurrentCameraState();
        
        this.shelfGaps[0] -= 5; // הפחתת 5 ס"מ למדף היחיד
        this.dynamicParams.height = this.shelfGaps[0]; // עדכון פרמטר הגובה
        this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
        this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
        
        // עדכון הזום בהתאם לגובה הכולל
        this.restoreCameraState(currentCameraState, true);
        
      }
    } else {
      // ארון - הקטנת גובה המדף השלישי
      // חיפוש פרמטר הגובה כדי לבדוק את המינימום המקורי
      const shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
      const minHeight = shelfsParam?.min || 0; // מינימום מקורי של הפרמטר
      
      if (this.shelfGaps[2] > minHeight) { // הגבלה מינימלית מקורית
        // שמירת המצב הנוכחי של המצלמה
        const currentCameraState = this.saveCurrentCameraState();
        
        this.shelfGaps[2] -= 5; // הפחתת 5 ס"מ למדף השלישי
        this.createSimpleProductWithoutCameraUpdate(); // יצירת המודל מחדש ללא עדכון מצלמה
        this.updateCameraPosition(); // עדכון מצלמה לשינויים אוטומטיים
        
        // עדכון הזום בהתאם לגובה הכולל
        this.restoreCameraState(currentCameraState, true);
        
      }
    }
  }

  private initThreeJS() {
    const container = this.container.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('initThreeJS_started')) {
      // initThreeJS started
      this.miniPreviewLogsShown.add('initThreeJS_started');
    }

    // Scene
    this.scene = new THREE.Scene();
    
    // Enhanced background with gradient like threejs-box
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#F8F8F8'); // Light gray
    gradient.addColorStop(1, '#E0E0E0'); // Slightly darker gray
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
    
    // Add infinite floor plane with subtle grid like threejs-box
    const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
    const floorMaterial = new THREE.MeshPhysicalMaterial({
        color: 0xF0F0F0, // Much whiter floor
        transparent: true,
        opacity: 0.5,  // 50% שקיפות
        roughness: 0.1,  // חלקות נמוכה לרפלקציה
        metalness: 0.0,  // לא מתכתי
        reflectivity: 0.25,  // 25% רפלקציה
        clearcoat: 0.1,  // שכבה שקופה דקה
        clearcoatRoughness: 0.1
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    floor.position.y = -0.1; // Slightly below ground level
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Camera
    this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    // מיקום המצלמה יתאים למידות האוביקט אחרי יצירת המודל
    this.target.set(0, 0, 0); // מרכז המודל
    this.camera.lookAt(this.target);
    
    // הגדרת מיקום התחלתי עבור הזום - יוגדר אחרי updateCameraPosition

    // Renderer with enhanced settings like threejs-box
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.8; // Increased for higher contrast
    container.appendChild(this.renderer.domElement);

    // Enhanced lighting setup like threejs-box
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
    const hemisphereLight = new THREE.HemisphereLight(0xF8F8F8, 0xD0D0D0, 0.6);
    this.scene.add(hemisphereLight);
    
    // Point light for accent
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 200);
    pointLight.position.set(0, 100, 0);
    this.scene.add(pointLight);

    // הוספת אירועי עכבר לזום וסיבוב
    this.addMouseControls();
    
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('initThreeJS_completed')) {
      // initThreeJS completed
      this.miniPreviewLogsShown.add('initThreeJS_completed');
    }
  }

  private addMouseControls() {
    const container = this.container.nativeElement;

    // לחיצה וגרירה לסיבוב ו-pan
    container.addEventListener('mousedown', (event: MouseEvent) => {
      this.isMouseDown = true;
      this.isPan = (event.button === 1 || event.button === 2); // כפתור אמצע או ימין
      this.hasUserInteracted = true; // המשתמש התחיל להזיז
      this.resetInactivityTimer(); // אפס את טיימר חוסר הפעילות
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      container.style.cursor = this.isPan ? 'grabbing' : 'grabbing';
    });

    container.addEventListener('mousemove', (event: MouseEvent) => {
      if (!this.isMouseDown) return;
      
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      // רק אם יש תנועה ממשית (לא רק לחיצה)
      if ((Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) && !this.hasUserPerformedAction) {
        this.hasUserPerformedAction = true;
        this.userInteracted.emit(); // שלח event רק בפעם הראשונה
      }
      
      if (this.isPan) {
        // Pan - הזזת המצלמה
        const panSpeed = 0.2;
        const panX = -deltaX * panSpeed;
        const panY = deltaY * panSpeed;
        const cam = this.camera;
        const pan = new THREE.Vector3();
        pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0), panX);
        pan.addScaledVector(new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1), panY);
        cam.position.add(pan);
        this.target.add(pan);
      } else {
        // סיבוב - תיקון כיוון (הפוך ימין-שמאל)
        const rotateSpeed = 0.01;
        this.spherical.theta -= deltaX * rotateSpeed; // הפוך מ-+ ל-- כדי לתקן את הכיוון
        this.spherical.phi -= deltaY * rotateSpeed;
        
        // הגבלת זווית אנכית
        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));
        
        // עדכון מיקום המצלמה
        this.camera.position.setFromSpherical(this.spherical).add(this.target);
      }
      
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
    });

    container.addEventListener('mouseup', () => {
      this.isMouseDown = false;
      container.style.cursor = 'grab';
    });

    container.addEventListener('mouseleave', () => {
      this.isMouseDown = false;
      container.style.cursor = 'grab';
    });

    // Mobile touch support
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchRotating = false;
    
    container.addEventListener('touchstart', (event: TouchEvent) => {
      this.hasUserInteracted = true; // המשתמש התחיל להזיז
      this.resetInactivityTimer(); // אפס את טיימר חוסר הפעילות
      
      if (event.touches.length === 1) {
        isTouchRotating = true;
        lastTouchX = event.touches[0].clientX;
        lastTouchY = event.touches[0].clientY;
      }
    }, { passive: false });

    container.addEventListener('touchmove', (event: TouchEvent) => {
      event.preventDefault();
      if (isTouchRotating && event.touches.length === 1) {
        const touch = event.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        const angleY = dx * 0.01;
        const angleX = dy * 0.01;
        const offset = this.camera.position.clone().sub(this.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += angleY; // הפוך מ-- ל-+ כדי לתקן את הכיוון במגע
        spherical.phi -= angleX;
        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
        this.camera.position.setFromSpherical(spherical).add(this.target);
      }
    }, { passive: false });

    container.addEventListener('touchend', (event: TouchEvent) => {
      isTouchRotating = false;
    });

    // הגדרת סגנון עכבר
    container.style.cursor = 'grab';
  }

  private initializeParamsFromProduct() {
    if (!this.product || !this.product.params) {
      // אם אין product או params, נשתמש בערכי ברירת מחדל
      return;
    }

    // זיהוי סוג המוצר
    const isTable = this.product.name === 'table';
    const isPlanter = this.product.name === 'planter';
    const isBox = this.product.name === 'box';
    const isFuton = this.product.name === 'futon';

    // אתחול אינדקס הקורה הנוכחית - תמיד הקורה הראשונה וה-type הראשון שלה
    this.currentBeamIndex = 0;
    this.currentBeamTypeIndex = 0;
    
    // אתחול הקורה הראשונה של המדפים אם יש קורות זמינות
    let shelfBeams: any[] = [];
    
    // חיפוש קורות המדפים
    this.product.params.forEach((param: any) => {
      if (isTable) {
        // שולחן - חיפוש פרמטר plata
        if (param.type === 'beamSingle' && param.name === 'plata' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
        }
      } else if (isPlanter || isBox) {
        // עדנית או קופסא - חיפוש פרמטר beam
        if (param.name === 'beam' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
        }
      } else if (isFuton) {
        // מיטה - חיפוש פרמטר plata (דומה לשולחן)
        if (param.type === 'beamSingle' && param.name === 'plata' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
        }
      } else {
        // ארון - חיפוש פרמטר shelfs
        if (param.type === 'beamArray' && param.name === 'shelfs' && param.beams && param.beams.length > 0) {
          shelfBeams = param.beams;
        }
      }
    });
    
    if (shelfBeams.length > 0) {
      const firstBeam = shelfBeams[0];
      
      // אם יש types לקורה הראשונה, נשתמש ב-type הראשון
      if (firstBeam.types && firstBeam.types.length > 0) {
        const firstBeamType = firstBeam.types[0];
        
        // עדכון פרמטרים דינמיים מה-type הראשון
        const beamWidth = firstBeamType.width || firstBeam.width || 100; // ברירת מחדל 100 מ"מ
        const beamHeight = firstBeamType.height || firstBeam.height || 25; // ברירת מחדל 25 מ"מ
        this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
        this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
      }
    }

    // אתחול הפרמטרים הדינמיים מהמוצר
    this.product.params.forEach((param: any) => {
      
      // בדיקה לפי שם הפרמטר עבור מידות
      if (param.name === 'width') {
        this.dynamicParams.width = param.default || 100;
      } else if (param.name === 'depth') {
        this.dynamicParams.length = param.default || 100;
      } else if (param.name === 'height') {
        this.dynamicParams.height = param.default || 100;
      } else if (param.name === 'gap') {
        // 🎯 תיקון: טעינת minGap מהפרמטר gap (כמו בקובץ הראשי)
        this.dynamicParams.gap = param.default || 1; // ברירת מחדל 1 כמו בקובץ הראשי
        console.log(`CHECK_MINI_SHELFS - Gap param loaded:`, JSON.stringify({
          gapParam: param.default,
          dynamicParamsGap: this.dynamicParams.gap
        }, null, 2));
      }
      
      // בדיקה לפי סוג הפרמטר עבור קורות
      if (param.type === 'beamSingle') {
        if (param.beams && param.beams.length > 0) {
          const beamIndex = this.getBeamIndexByDefaultType(param);
          const beam = param.beams[beamIndex];
          // if (this.debugLogsEnabled) console.log('beamSingle beam:', beam);
          // החלפה: width של הפרמטר הופך ל-height של הקורה, height של הפרמטר הופך ל-width של הקורה
          const beamWidth = beam.width || 50; // ברירת מחדל 50 מ"מ
          const beamHeight = beam.height || 50; // ברירת מחדל 50 מ"מ
          this.dynamicParams.frameWidth = beamHeight / 10; // height הופך ל-width
          this.dynamicParams.frameHeight = beamWidth / 10; // width הופך ל-height
          // if (this.debugLogsEnabled) console.log('אתחול מידות קורת חיזוק:', { beamWidth, beamHeight, frameWidthCm: this.dynamicParams.frameWidth, frameHeightCm: this.dynamicParams.frameHeight });
        }
      } else if (param.type === 'beamArray' && param.name === 'shelfs') {
        if (param.beams && param.beams.length > 0) {
          const beamIndex = this.getBeamIndexByDefaultType(param);
          const beam = param.beams[beamIndex];
          // if (this.debugLogsEnabled) console.log('shelfs beam:', beam);
          // המרה ממ"מ לס"מ כמו בקובץ הראשי
          const beamWidth = beam.width || 100; // ברירת מחדל 100 מ"מ
          const beamHeight = beam.height || 25; // ברירת מחדל 25 מ"מ
          this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
          this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
        }
        // 🎯 תיקון: טעינת גבהי המדפים כמו בקובץ הראשי - ישירות מ-default או מ-configurations
        // בקובץ הראשי משתמשים ב-shelfsParam.default ישירות, וגם מטופלות configurations
        // אם יש configuration index, נשתמש בו; אחרת נשתמש ב-default
        
        console.log(`CHECK_MINI_SHELFS - initializeParamsFromProduct: Processing shelfs param`);
        console.log(`CHECK_MINI_SHELFS - shelfs param state:`, JSON.stringify({
          name: param.name,
          type: param.type,
          default: param.default,
          defaultIsArray: Array.isArray(param.default),
          defaultLength: Array.isArray(param.default) ? param.default.length : 'NOT_ARRAY',
          hasConfigurations: !!param.configurations,
          configurationsLength: param.configurations?.length || 0,
          configurationIndex: this.configurationIndex || 0,
          selectedBeamIndex: param.selectedBeamIndex,
          selectedTypeIndex: param.selectedTypeIndex
        }, null, 2));
        
        if (Array.isArray(param.default)) {
          // אם default הוא מערך - זה הערך הנוכחי (יכול להיות מה-configuration שכבר הוחל)
          this.shelfGaps = [...param.default];
          console.log(`CHECK_MINI_SHELFS - Using param.default (array):`, JSON.stringify(this.shelfGaps, null, 2));
        } else if (param.configurations && param.configurations.length > 0) {
          // אם אין default מערך אבל יש configurations - נשתמש ב-configuration לפי האינדקס
          const configIndex = this.configurationIndex || 0;
          console.log(`CHECK_MINI_SHELFS - Checking configurations[${configIndex}]:`, JSON.stringify({
            configIndex: configIndex,
            configExists: !!param.configurations[configIndex],
            configIsArray: Array.isArray(param.configurations[configIndex]),
            configValue: param.configurations[configIndex]
          }, null, 2));
          
          if (param.configurations[configIndex] && Array.isArray(param.configurations[configIndex])) {
            this.shelfGaps = [...param.configurations[configIndex]];
            console.log(`CHECK_MINI_SHELFS - Using configurations[${configIndex}]:`, JSON.stringify(this.shelfGaps, null, 2));
          } else if (param.configurations[0] && Array.isArray(param.configurations[0])) {
            // fallback לקונפיגורציה הראשונה אם האינדקס לא קיים
            this.shelfGaps = [...param.configurations[0]];
            console.log(`CHECK_MINI_SHELFS - Fallback to configurations[0]:`, JSON.stringify(this.shelfGaps, null, 2));
          } else {
            // אם אין configurations תקינים, fallback למערך ריק (לא יהיו מדפים)
            this.shelfGaps = [];
            console.log(`CHECK_MINI_SHELFS - No valid configurations, shelfGaps set to empty array`);
          }
        } else {
          // אם אין default מערך ואין configurations - fallback למערך ריק
          this.shelfGaps = [];
          console.log(`CHECK_MINI_SHELFS - No default array and no configurations, shelfGaps set to empty array`);
        }
        
        // מספר מדפים - נקבע לפי shelfGaps.length (לא נשתמש ב-shelfCount)
        this.dynamicParams.shelfCount = this.shelfGaps.length || 3; // fallback ל-3 רק אם אין מדפים כלל
        console.log(`CHECK_MINI_SHELFS - Final shelfGaps after initializeParamsFromProduct:`, JSON.stringify({
          shelfGaps: this.shelfGaps,
          shelfGapsLength: this.shelfGaps.length,
          shelfCount: this.dynamicParams.shelfCount
        }, null, 2));
      } else if (isTable && param.type === 'beamSingle' && param.name === 'plata') {
        // שולחן - טיפול בפרמטר plata
        if (param.beams && param.beams.length > 0) {
          const beamIndex = this.getBeamIndexByDefaultType(param);
          const beam = param.beams[beamIndex];
          if (this.debugLogsEnabled) console.log('Plata beam:', beam);
          // המרה ממ"מ לס"מ כמו בקובץ הראשי
          const beamWidth = beam.width || 100; // ברירת מחדל 100 מ"מ
          const beamHeight = beam.height || 25; // ברירת מחדל 25 מ"מ
          this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
          this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
          if (this.debugLogsEnabled) console.log('Platform beam dimensions:', { beamWidth, beamHeight, beamWidthCm: this.dynamicParams.beamWidth, beamHeightCm: this.dynamicParams.beamHeight });
        }
        // שולחן - יש רק מדף אחד
        this.dynamicParams.shelfCount = 1;
        
        // גובה המדף נקבע על ידי פרמטר height
        const heightParam = this.product?.params?.find((p: any) => p.name === 'height');
        const tableHeight = heightParam ? this.dynamicParams.height || heightParam.default || 80 : 80;
        this.shelfGaps = [tableHeight]; // מדף אחד בגובה שנקבע
      } else if ((isPlanter || isBox) && param.name === 'beam') {
        // עדנית או קופסא - טיפול בפרמטר beam
        if (param.beams && param.beams.length > 0) {
          const beamIndex = this.getBeamIndexByDefaultType(param);
          const beam = param.beams[beamIndex];
          if (this.debugLogsEnabled) console.log(isBox ? 'Box beam:' : 'Planter beam:', beam);
          // המרה ממ"מ לס"מ כמו בקובץ הראשי
          const beamWidth = beam.width || 50; // ברירת מחדל 50 מ"מ
          const beamHeight = beam.height || 25; // ברירת מחדל 25 מ"מ
          this.dynamicParams.beamWidth = beamWidth / 10; // המרה ממ"מ לס"מ
          this.dynamicParams.beamHeight = beamHeight / 10; // המרה ממ"מ לס"מ
          if (this.debugLogsEnabled) console.log(isBox ? 'Box beam dimensions:' : 'Planter beam dimensions:', { beamWidth, beamHeight, beamWidthCm: this.dynamicParams.beamWidth, beamHeightCm: this.dynamicParams.beamHeight });
        }
      }
    });

    // אתחול ברירת מחדל עבור שולחן אם shelfGaps עדיין ריק
    if (isTable && this.shelfGaps.length === 0) {
      const heightParam = this.product?.params?.find((p: any) => p.name === 'height');
      const tableHeight = heightParam ? heightParam.default || 80 : 80;
      this.shelfGaps = [tableHeight];
      this.dynamicParams.height = tableHeight;
    }

  }

  private createSimpleProduct() {
    
    // console.log('🔍 DEBUG - createSimpleProduct called for product:', this.product?.name);
    
    // בדיקות בטיחות למידות לפני יצירת המודל
    // console.log('🔍 DEBUG - Before validateDynamicParams:', {
    //   dynamicParams: this.dynamicParams,
    //   productParams: this.product?.params?.map(p => ({ name: p.name, type: p.type, value: p.value }))
    // });
    this.validateDynamicParams();
    // console.log('🔍 DEBUG - After validateDynamicParams:', {
    //   dynamicParams: this.dynamicParams
    // });
    
    // ניקוי המודל הקודם
    this.meshes.forEach(mesh => this.scene.remove(mesh));
    this.meshes = [];

    // console.log('🔍 DEBUG - After clearing meshes, checking product type');
    
    // בדיקה אם זו עדנית, קופסא, מיטה או beams
    const isPlanter = this.product?.name === 'planter';
    const isBox = this.product?.name === 'box';
    const isFuton = this.product?.name === 'futon';
    const isBeams = this.product?.name === 'beams';
    if (isPlanter || isBox) {
      this.createPlanterModel();
      return; // יציאה מהפונקציה - העדנית/קופסא לא משתמשת במדפים רגילים
    }
    if (isFuton) {
      this.createFutonModel();
      return; // יציאה מהפונקציה - המיטה לא משתמשת במדפים רגילים
    }
    if (isBeams) {
      this.createBeamsModel();
      return; // יציאה מהפונקציה - beams לא משתמש במדפים רגילים
    }

    // יצירת מדפים דינמיים - זהה לקובץ הראשי
    // 🎯 תיקון: minGap מהפרמטר gap (כמו בקובץ הראשי), לא hardcoded
    const minGap = this.dynamicParams.gap || 1; // ברירת מחדל 1 כמו בקובץ הראשי
    console.log(`CHECK_MINI_SHELFS - Using minGap:`, JSON.stringify({
      minGap: minGap,
      fromDynamicParams: this.dynamicParams.gap
    }, null, 2));
    let currentY = 0;
    
    // זיהוי סוג המוצר - שולחן או ארון
    const isTable = this.product?.name === 'table';
    
    // קבלת רשימת gaps מהמוצר
    let shelfsParam = null;
    let shelfGaps = [];
    let totalShelves = 0;
    
    if (isTable) {
      // שולחן - יש רק מדף אחד בגובה שנקבע על ידי shelfGaps[0]
      shelfGaps = [this.shelfGaps[0]]; // מדף אחד בגובה שנקבע מ-shelfGaps
      totalShelves = 1;
      
      // עבור שולחן, נשתמש בפרמטר plata במקום shelfs
      shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamSingle' && p.name === 'plata');
    } else {
      // 🎯 תיקון: ארון - שימוש בגבהי המדפים כמו בקובץ הראשי
      // בקובץ הראשי: return shelfsParam.default.map((gap: number) => ({ gap }))
      shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
      
      console.log(`CHECK_MINI_SHELFS - createSimpleProduct: Processing cabinet (not table)`);
      console.log(`CHECK_MINI_SHELFS - shelfsParam found:`, JSON.stringify({
        shelfsParamExists: !!shelfsParam,
        shelfsParamDefault: shelfsParam?.default,
        defaultIsArray: Array.isArray(shelfsParam?.default),
        defaultLength: Array.isArray(shelfsParam?.default) ? shelfsParam.default.length : 'NOT_ARRAY',
        thisShelfGaps: this.shelfGaps,
        thisShelfGapsIsArray: Array.isArray(this.shelfGaps),
        thisShelfGapsLength: Array.isArray(this.shelfGaps) ? this.shelfGaps.length : 'NOT_ARRAY'
      }, null, 2));
      
      // 🎯 תיקון: כמו בקובץ הראשי - אם shelfsParam.default הוא מערך, נשתמש בו ישירות
      if (shelfsParam && Array.isArray(shelfsParam.default) && shelfsParam.default.length > 0) {
        // כמו בקובץ הראשי - משתמשים ב-default ישירות
        shelfGaps = [...shelfsParam.default];
        console.log(`CHECK_MINI_SHELFS - ✅ Using shelfsParam.default:`, JSON.stringify(shelfGaps, null, 2));
      } else if (this.shelfGaps && Array.isArray(this.shelfGaps) && this.shelfGaps.length > 0) {
        // fallback ל-shelfGaps שנטען ב-initializeParamsFromProduct
        shelfGaps = [...this.shelfGaps];
        console.log(`CHECK_MINI_SHELFS - ⚠️ Fallback to this.shelfGaps:`, JSON.stringify(shelfGaps, null, 2));
      } else {
        // אם אין מדפים כלל - fallback ל-3 מדפים עם gaps ברירת מחדל
        shelfGaps = [30, 30, 30]; // 3 מדפים ברירת מחדל
        console.log(`CHECK_MINI_SHELFS - ⚠️ No valid shelf gaps, using default [30, 30, 30]`);
      }
      
      totalShelves = shelfGaps.length;
      console.log(`CHECK_MINI_SHELFS - Final shelf calculation:`, JSON.stringify({
        totalShelves: totalShelves,
        shelfGaps: shelfGaps,
        shelfGapsLength: shelfGaps.length
      }, null, 2));
    }

    // קבלת סוג הקורה והעץ מהפרמטרים - זהה לקובץ הראשי
    let shelfBeam = null;
    let shelfType = null;
    if (shelfsParam && Array.isArray(shelfsParam.beams) && shelfsParam.beams.length) {
      const shelfBeamIndex = this.getBeamIndexByDefaultType(shelfsParam);
      shelfBeam = shelfsParam.beams[shelfBeamIndex];
      // if (this.debugLogsEnabled) console.log('shelfBeam:', shelfBeam);
      // if (this.debugLogsEnabled) console.log('shelfBeam.types:', shelfBeam ? shelfBeam.types : 'null');
      shelfType = shelfBeam.types && shelfBeam.types.length ? shelfBeam.types[shelfsParam.selectedBeamTypeIndex || 0] : null;
      
      // CHECK_SHELF_BEAM: לוג על קורת המדף
      console.log(`CHECK_SHELF_BEAM - CHECK_MINI_SHELFS: Shelf beam selected:`, JSON.stringify({
        shelfBeamIndex: shelfBeamIndex,
        beamName: shelfBeam?.name,
        beamWidth: shelfBeam?.width,
        beamHeight: shelfBeam?.height,
        translatedName: shelfBeam?.translatedName,
        selectedBeamIndex: shelfsParam?.selectedBeamIndex,
        selectedTypeIndex: shelfsParam?.selectedTypeIndex,
        shelfTypeName: shelfType?.name
      }, null, 2));
    }
    
    // קבלת טקסטורת עץ לקורות המדפים - זהה לקובץ הראשי
    const shelfWoodTexture = this.getWoodTexture(shelfType ? shelfType.name : '');
    
    // קבלת סוג הקורה והעץ של קורות החיזוק מהפרמטרים
    const frameParam = this.product?.params?.find((p: any) => p.type === 'beamSingle' && p.name === 'leg');
    let frameBeam = null;
    let frameType = null;
    if (frameParam && Array.isArray(frameParam.beams) && frameParam.beams.length) {
      const frameBeamIndex = this.getBeamIndexByDefaultType(frameParam);
      frameBeam = frameParam.beams[frameBeamIndex];
      // if (this.debugLogsEnabled) console.log('frameBeam:', frameBeam);
      // if (this.debugLogsEnabled) console.log('frameBeam.types:', frameBeam ? frameBeam.types : 'null');
      frameType = frameBeam.types && frameBeam.types.length ? frameBeam.types[frameParam.selectedBeamTypeIndex || 0] : null;
      
      // CHECK_SHELF_BEAM: לוג על קורת הרגל
      console.log(`CHECK_SHELF_BEAM - CHECK_MINI_SHELFS: Leg beam selected:`, JSON.stringify({
        frameBeamIndex: frameBeamIndex,
        beamName: frameBeam?.name,
        beamWidth: frameBeam?.width,
        beamHeight: frameBeam?.height,
        translatedName: frameBeam?.translatedName,
        selectedBeamIndex: frameParam?.selectedBeamIndex,
        selectedTypeIndex: frameParam?.selectedTypeIndex,
        frameTypeName: frameType?.name
      }, null, 2));
    }
    
    // קבלת פרמטר is-reinforcement-beams-outside עבור ארון ושולחן
    const isReinforcementBeamsOutsideParam = this.product?.params?.find((p: any) => p.name === 'is-reinforcement-beams-outside');
    const isReinforcementBeamsOutside = isReinforcementBeamsOutsideParam ? !!(isReinforcementBeamsOutsideParam.default === true) : false;
    
    // קבלת טקסטורת עץ לקורות החיזוק
    const frameWoodTexture = this.getWoodTexture(frameType ? frameType.name : '');
    
    // חישוב מידות אמיתיות של קורת החיזוק פעם אחת
    let actualFrameWidth = this.dynamicParams.frameWidth;
    let actualFrameHeight = this.dynamicParams.frameHeight;
    if (frameType) {
      actualFrameWidth = frameType.width ? frameType.width / 10 : this.dynamicParams.frameWidth;
      actualFrameHeight = frameType.height ? frameType.height / 10 : this.dynamicParams.frameHeight;
    } else if (frameBeam) {
      actualFrameWidth = frameBeam.width ? frameBeam.width / 10 : this.dynamicParams.frameWidth;
      actualFrameHeight = frameBeam.height ? frameBeam.height / 10 : this.dynamicParams.frameHeight;
    }
    
    // בדיקות בטיחות למידות
    actualFrameWidth = actualFrameWidth || 5; // ברירת מחדל 5 ס"מ
    actualFrameHeight = actualFrameHeight || 5; // ברירת מחדל 5 ס"מ
    
    console.log(`CHECK_MINI_SHELFS - Starting shelf creation loop:`, JSON.stringify({
      totalShelves: totalShelves,
      shelfGaps: shelfGaps,
      currentY: currentY,
      isTable: isTable
    }, null, 2));
    
    for (let shelfIndex = 0; shelfIndex < totalShelves; shelfIndex++) {
      const isTopShelf = shelfIndex === totalShelves - 1;
      const shelfGap = shelfGaps[shelfIndex];
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1}/${totalShelves}:`, JSON.stringify({
        shelfIndex: shelfIndex,
        isTopShelf: isTopShelf,
        shelfGap: shelfGap,
        currentYBefore: currentY
      }, null, 2));
      
      // הוספת gap לכל מדף - זהה לקובץ הראשי
      currentY += shelfGap;
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} after adding gap:`, JSON.stringify({
        currentYAfter: currentY,
        shelfGap: shelfGap
      }, null, 2));
      
      // Surface beams (קורת משטח) - זהה לקובץ הראשי
      const surfaceBeams = this.createSurfaceBeams(
        this.dynamicParams.width,
        this.dynamicParams.length,
        this.dynamicParams.beamWidth,
        this.dynamicParams.beamHeight,
        minGap
      );
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} surface beams:`, JSON.stringify({
        shelfIndex: shelfIndex,
        surfaceBeamsCount: surfaceBeams.length,
        beamWidth: this.dynamicParams.beamWidth,
        beamHeight: this.dynamicParams.beamHeight,
        shelfBeamName: shelfBeam?.name,
        shelfBeamTranslatedName: shelfBeam?.translatedName
      }, null, 2));
      
      for (let i = 0; i < surfaceBeams.length; i++) {
        let beam = { ...surfaceBeams[i] };
        // Only shorten first and last beam in the length (depth) direction for non-top shelves
        // Top shelf (last shelf) gets full-length beams
        if (!isTopShelf && (i === 0 || i === surfaceBeams.length - 1)) {
          // If is-reinforcement-beams-outside is true, shorten by (2 * frameBeamWidth) + (2 * legDepth)
          // Otherwise, shorten by 2 * frameBeamWidth
          if (isReinforcementBeamsOutside && !isTable) {
            // For cabinet: legDepth = actualFrameWidth (after swap in line 1677), frameBeamWidth = actualFrameWidth
            // So: (2 * actualFrameWidth) + (2 * actualFrameWidth) = 4 * actualFrameWidth
            // But we need legDepth which is actualFrameWidth for cabinet (swapped)
            const legDepthForCabinet = actualFrameWidth; // legDepth after swap (line 1677: legDepth = actualFrameWidth)
            beam.depth = Math.max(0.1, beam.depth - ((2 * actualFrameWidth) + (2 * legDepthForCabinet)));
          } else {
            beam.depth = beam.depth - 2 * actualFrameWidth;
          }
        }
        
        const beamGeometry = new THREE.BoxGeometry(beam.width, beam.height, beam.depth);
        this.setCorrectTextureMapping(beamGeometry, beam.width, beam.height, beam.depth);
        const beamMaterial = new THREE.MeshStandardMaterial({ map: shelfWoodTexture });
        const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
        beamMesh.position.set(beam.x, currentY + this.dynamicParams.frameHeight + beam.height / 2, 0);
        beamMesh.castShadow = true;
        beamMesh.receiveShadow = true;
        this.scene.add(beamMesh);
        this.meshes.push(beamMesh);
      }
      
      // Frame beams (קורת חיזוק) - רק עבור ארון, לא עבור שולחן
      if (!isTable) {
        const frameBeams = this.createFrameBeams(
          this.dynamicParams.width,
          this.dynamicParams.length,
          actualFrameWidth,
          actualFrameHeight,
          actualFrameHeight,  // legWidth - עומק הרגל אחרי החלפה
          actualFrameWidth   // legDepth - רוחב הרגל אחרי החלפה
        );
        
        for (const beam of frameBeams) {
          // When is-reinforcement-beams-outside is true (cabinet only):
          // - X-spanning pair: extend width by 2a (a = legWidth which is actualFrameHeight after swap)
          // - Z-spanning pair: shorten depth by 2b (b = legDepth which is actualFrameWidth after swap)
          let widthToUseCab = beam.width;
          let depthToUseCab = beam.depth;
          if (isReinforcementBeamsOutside) {
            const tol = (2 * actualFrameHeight) + 0.001;
            const isXSpan = Math.abs(beam.width - this.dynamicParams.width) <= tol;
            const isZSpan = Math.abs(beam.depth - this.dynamicParams.length) <= tol;
            // a = legWidth = actualFrameHeight (after swap), b = legDepth = actualFrameWidth (after swap)
            const a_extend = actualFrameHeight;
            const b_shorten = actualFrameWidth;
            if (isXSpan && a_extend > 0) {
              widthToUseCab = beam.width + (2 * a_extend);
            }
            if (isZSpan && b_shorten > 0) {
              // Shorten on both ends: total reduction = 2 * b
              depthToUseCab = Math.max(0.1, beam.depth - (2 * b_shorten));
            }
          }
          const frameGeometry = new THREE.BoxGeometry(widthToUseCab, beam.height, depthToUseCab);
          this.setCorrectTextureMapping(frameGeometry, widthToUseCab, beam.height, depthToUseCab);
          const frameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
          const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
          frameMesh.position.set(beam.x, currentY + beam.height / 2, beam.z);
          frameMesh.castShadow = true;
          frameMesh.receiveShadow = true;
          this.scene.add(frameMesh);
          this.meshes.push(frameMesh);
        }
      }
      
      // Add the height of the shelf itself for the next shelf
      currentY += actualFrameHeight + this.dynamicParams.beamHeight;
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} completed:`, JSON.stringify({
        shelfIndex: shelfIndex,
        currentYAfterShelf: currentY,
        actualFrameHeight: actualFrameHeight,
        beamHeight: this.dynamicParams.beamHeight
      }, null, 2));
    }
    
    console.log(`CHECK_MINI_SHELFS - All shelves creation completed:`, JSON.stringify({
      totalShelves: totalShelves,
      finalCurrentY: currentY,
      shelfGapsUsed: shelfGaps
    }, null, 2));

    // יצירת רגליים (legs) - זהה לקורות החיזוק
    // הרגליים משתמשות באותן הגדרות של קורות החיזוק
    // לא צריך לחפש פרמטר נפרד - משתמשים ב-frameParam שכבר נמצא

    // חישוב גובה הרגליים - הרגליים מגיעות רק עד לקורות החיזוק התחתונות
    let totalY = 0;
    for (let i = 0; i < totalShelves; i++) {
      const safeShelfGap = shelfGaps[i] || 30; // ברירת מחדל 30 ס"מ
      const safeActualFrameHeight = actualFrameHeight || 5; // ברירת מחדל 5 ס"מ
      const safeBeamHeight = this.dynamicParams.beamHeight || 2.5; // ברירת מחדל 2.5 ס"מ
      totalY += safeShelfGap + safeActualFrameHeight + safeBeamHeight; // גובה מלא
    }
    // הרגליים מגיעות רק עד לקורות החיזוק התחתונות (לא כולל קורות המדפים העליונות)
    // הרגליים צריכות להיות בגובה הכולל פחות גובה קורת מדף העליונה ופחות מרווח המדף העליון
    // הרגליים מגיעות רק עד לקורות החיזוק התחתונות, לא עד קורות המדפים העליונות
    // לפי הלוגיקה של threejs-box: legHeight = topHeight - shelfBeamHeight
    const safeBeamHeight = this.dynamicParams.beamHeight || 2.5; // גובה קורת מדף
    const legHeight = Math.max(totalY - safeBeamHeight, 20); // מינימום 20 ס"מ
    
    
    
    // קבלת מידות הרגליים מקורת החיזוק (לא מקורת הפלטה)
    let legWidth = actualFrameWidth;
    let legDepth = actualFrameHeight;
    if (isTable && frameBeam) {
      // עבור שולחן, נשתמש במידות קורת הפלטה
      legWidth = frameBeam.width ? frameBeam.width / 10 : actualFrameWidth; // רוחב הרגל מקורת החיזוק
      legDepth = frameBeam.height ? frameBeam.height / 10 : actualFrameHeight; // עומק הרגל מקורת החיזוק
      // if (this.debugLogsEnabled) console.log('מידות רגליים משולחן (מקורת חיזוק):', { legWidth, legDepth, frameBeam });
    } else if (!isTable) {
      // עבור ארון - הפיכת הפרופיל של הרגליים (width ↔ height)
      legWidth = actualFrameHeight;  // רוחב הרגל = גובה קורת החיזוק
      legDepth = actualFrameWidth;  // עומק הרגל = רוחב קורת החיזוק
    }

    // מיקום הרגליים - זהה לקובץ הראשי
    const legPositions = [
      [-this.dynamicParams.width/2 + legWidth/2, 0, -this.dynamicParams.length/2 + legDepth/2],
      [this.dynamicParams.width/2 - legWidth/2, 0, -this.dynamicParams.length/2 + legDepth/2],
      [-this.dynamicParams.width/2 + legWidth/2, 0, this.dynamicParams.length/2 - legDepth/2],
      [this.dynamicParams.width/2 - legWidth/2, 0, this.dynamicParams.length/2 - legDepth/2]
    ];

    legPositions.forEach(pos => {
      // בדיקות בטיחות למידות הרגל
      const safeLegHeight = legHeight || 10; // ברירת מחדל 10 ס"מ
      const safeLegWidth = legWidth || 5; // ברירת מחדל 5 ס"מ
      const safeLegDepth = legDepth || 5; // ברירת מחדל 5 ס"מ
      
      const legGeometry = new THREE.BoxGeometry(
        safeLegWidth,
        safeLegHeight,
        safeLegDepth
      );
      this.setCorrectTextureMapping(legGeometry, legWidth, legHeight, legDepth);
      const legMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      let legZPosition = pos[2];
      // If is-reinforcement-beams-outside is true, move legs toward Z=0 by b (leg profile height in cm)
      // This applies to both cabinet and table
      if (isReinforcementBeamsOutside && frameBeam) {
        const legProfileHeightCm = (frameBeam.height && typeof frameBeam.height === 'number') ? (frameBeam.height / 10) : 0;
        if (legProfileHeightCm > 0) {
          const dirZ = legZPosition >= 0 ? 1 : -1;
          legZPosition = legZPosition - dirZ * legProfileHeightCm;
        }
      }
      leg.position.set(pos[0], legHeight/2, legZPosition);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.scene.add(leg);
      this.meshes.push(leg);
    });

    // יצירת קורות חיזוק עבור שולחן - אחרי הרגליים
    if (isTable) {
      // סט ראשון: קורות חיזוק מתחת למדף (בגובה הרגליים)
      const frameBeams = this.createFrameBeams(
        this.dynamicParams.width,
        this.dynamicParams.length,
        actualFrameWidth,
        actualFrameHeight,
        legWidth, // legWidth - מידות נכונות מהפלטה
        legDepth  // legDepth - מידות נכונות מהפלטה
      );
      
      for (const beam of frameBeams) {
        // Adjust frame beams when reinforcement beams are outside (table):
        // - X-spanning beams (depth == actualFrameWidth) extend by 2a (leg width)
        // - Z-spanning beams (width == actualFrameWidth) shorten by 2b (leg height)
        let widthToUse = beam.width;
        let depthToUse = beam.depth;
        if (isReinforcementBeamsOutside && isTable && frameBeam) {
          // Determine a,b from selected leg beam
          const a_legWidthCm = (frameBeam.width || 0) / 10;
          const b_legHeightCm = (frameBeam.height || frameBeam.depth || 0) / 10;
          const isXSpanning = Math.abs(beam.depth - actualFrameWidth) < 0.001; // front/back
          const isZSpanning = Math.abs(beam.width - actualFrameWidth) < 0.001; // left/right
          if (isXSpanning) {
            widthToUse = beam.width + (2 * a_legWidthCm);
          }
          if (isZSpanning) {
            depthToUse = Math.max(0.1, beam.depth - (2 * b_legHeightCm));
          }
        }
        const frameGeometry = new THREE.BoxGeometry(widthToUse, beam.height, depthToUse);
        this.setCorrectTextureMapping(frameGeometry, widthToUse, beam.height, depthToUse);
        const frameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
        const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
        // מיקום קורות החיזוק מתחת למדף (בגובה הרגליים) - קיצור בגובה קורת המדף
        frameMesh.position.set(beam.x, currentY - beam.height / 2 - this.dynamicParams.beamHeight, beam.z);
        frameMesh.castShadow = true;
        frameMesh.receiveShadow = true;
        this.scene.add(frameMesh);
        this.meshes.push(frameMesh);
      }
      
      // סט שני: קורות חיזוק נוספות (extraBeam) מתחת לסט הראשון
      const extraBeamParam = this.product?.params?.find((p: any) => p.name === 'extraBeam');
      if (extraBeamParam && extraBeamParam.default > 0) {
        const extraBeamDistance = extraBeamParam.default;
        // if (this.debugLogsEnabled) console.log('Adding extra frame beams for table with distance:', extraBeamDistance);
        
        // יצירת קורות חיזוק נוספות באותו מיקום אבל יותר נמוך
        const extraFrameBeams = this.createFrameBeams(
          this.dynamicParams.width,
          this.dynamicParams.length,
          actualFrameWidth,
          actualFrameHeight,
          legWidth, // legWidth - מידות נכונות מהפלטה
          legDepth  // legDepth - מידות נכונות מהפלטה
        );
        
        // המרחק הכולל = הנתון החדש + גובה קורות החיזוק
        const totalDistance = extraBeamDistance + actualFrameHeight;
        // if (this.debugLogsEnabled) console.log('Extra beam calculation:', { extraBeamDistance, actualFrameHeight, totalDistance });
        
        for (const beam of extraFrameBeams) {
          // Apply the same outside adjustments to duplicated lower frame beams
          let widthToUseExtra = beam.width;
          let depthToUseExtra = beam.depth;
          if (isReinforcementBeamsOutside && isTable && frameBeam) {
            // Determine a,b from selected leg beam (same as upper frame beams)
            const a_legWidthCm = (frameBeam.width || 0) / 10;
            const b_legHeightCm = (frameBeam.height || frameBeam.depth || 0) / 10;
            const isXSpanning = Math.abs(beam.depth - actualFrameWidth) < 0.001; // front/back
            const isZSpanning = Math.abs(beam.width - actualFrameWidth) < 0.001; // left/right
            if (isXSpanning) {
              widthToUseExtra = beam.width + (2 * a_legWidthCm);
            }
            if (isZSpanning) {
              depthToUseExtra = Math.max(0.1, beam.depth - (2 * b_legHeightCm));
            }
          }
          const extraFrameGeometry = new THREE.BoxGeometry(widthToUseExtra, beam.height, depthToUseExtra);
          this.setCorrectTextureMapping(extraFrameGeometry, widthToUseExtra, beam.height, depthToUseExtra);
          const extraFrameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
          const extraFrameMesh = new THREE.Mesh(extraFrameGeometry, extraFrameMaterial);
          // מיקום יותר נמוך במידת totalDistance (הנתון החדש + גובה קורות החיזוק) - קיצור נוסף בגובה קורת המדף
          extraFrameMesh.position.set(beam.x, currentY - beam.height / 2 - totalDistance - this.dynamicParams.beamHeight, beam.z);
          extraFrameMesh.castShadow = true;
          extraFrameMesh.receiveShadow = true;
          this.scene.add(extraFrameMesh);
          this.meshes.push(extraFrameMesh);
          // if (this.debugLogsEnabled) console.log('Created extra frame beam at position:', beam.x, currentY - beam.height / 2 - totalDistance - this.dynamicParams.beamHeight, beam.z);
        }
      }
    }

    // סיבוב המודל - זהה לקובץ הראשי
    this.scene.rotation.y = Math.PI / 6; // 30 מעלות סיבוב
    
    
    // התאמת מיקום המצלמה למידות האוביקט - זהה לקובץ הראשי
    this.updateCameraPosition();
    
    const logKey = `createSimpleProduct-completed-${this.product?.id || this.product?.name || 'unknown'}`;
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey)) {
      // createSimpleProduct completed
      this.miniPreviewLogsShown.add(logKey);
    }
  }

  // יצירת מוצר פשוט ללא עדכון מצלמה (לשימוש בכפתורי שליטה)
  private createSimpleProductWithoutCameraUpdate() {
    // בדיקות בטיחות למידות לפני יצירת המודל
    this.validateDynamicParams();
    
    // ניקוי המודל הקודם
    this.meshes.forEach(mesh => this.scene.remove(mesh));
    this.meshes = [];

    // בדיקה אם זו עדנית, קופסא, מיטה או beams
    const isPlanter = this.product?.name === 'planter';
    const isBox = this.product?.name === 'box';
    const isFuton = this.product?.name === 'futon';
    const isBeams = this.product?.name === 'beams';
    if (isPlanter || isBox) {
      this.createPlanterModel();
      return; // יציאה מהפונקציה - העדנית/קופסא לא משתמשת במדפים רגילים
    }
    if (isFuton) {
      this.createFutonModel();
      return; // יציאה מהפונקציה - המיטה לא משתמשת במדפים רגילים
    }
    if (isBeams) {
      this.createBeamsModel();
      return; // יציאה מהפונקציה - beams לא משתמש במדפים רגילים
    }

    // יצירת מדפים דינמיים - זהה לקובץ הראשי
    // 🎯 תיקון: minGap מהפרמטר gap (כמו בקובץ הראשי), לא hardcoded
    const minGap = this.dynamicParams.gap || 1; // ברירת מחדל 1 כמו בקובץ הראשי
    console.log(`CHECK_MINI_SHELFS - Using minGap:`, JSON.stringify({
      minGap: minGap,
      fromDynamicParams: this.dynamicParams.gap
    }, null, 2));
    let currentY = 0;
    
    // זיהוי סוג המוצר - שולחן או ארון
    const isTable = this.product?.name === 'table';
    
    // קבלת רשימת gaps מהמוצר
    let shelfsParam = null;
    let shelfGaps = [];
    let totalShelves = 0;
    
    if (isTable) {
      // שולחן - יש רק מדף אחד בגובה שנקבע על ידי shelfGaps[0]
      shelfGaps = [this.shelfGaps[0]]; // מדף אחד בגובה שנקבע מ-shelfGaps
      totalShelves = 1;
      
      // עבור שולחן, נשתמש בפרמטר plata במקום shelfs
      shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamSingle' && p.name === 'plata');
    } else {
      // 🎯 תיקון: ארון - שימוש בגבהי המדפים כמו בקובץ הראשי
      // בקובץ הראשי: return shelfsParam.default.map((gap: number) => ({ gap }))
      shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
      
      console.log(`CHECK_MINI_SHELFS - createSimpleProduct: Processing cabinet (not table)`);
      console.log(`CHECK_MINI_SHELFS - shelfsParam found:`, JSON.stringify({
        shelfsParamExists: !!shelfsParam,
        shelfsParamDefault: shelfsParam?.default,
        defaultIsArray: Array.isArray(shelfsParam?.default),
        defaultLength: Array.isArray(shelfsParam?.default) ? shelfsParam.default.length : 'NOT_ARRAY',
        thisShelfGaps: this.shelfGaps,
        thisShelfGapsIsArray: Array.isArray(this.shelfGaps),
        thisShelfGapsLength: Array.isArray(this.shelfGaps) ? this.shelfGaps.length : 'NOT_ARRAY'
      }, null, 2));
      
      // 🎯 תיקון: כמו בקובץ הראשי - אם shelfsParam.default הוא מערך, נשתמש בו ישירות
      if (shelfsParam && Array.isArray(shelfsParam.default) && shelfsParam.default.length > 0) {
        // כמו בקובץ הראשי - משתמשים ב-default ישירות
        shelfGaps = [...shelfsParam.default];
        console.log(`CHECK_MINI_SHELFS - ✅ Using shelfsParam.default:`, JSON.stringify(shelfGaps, null, 2));
      } else if (this.shelfGaps && Array.isArray(this.shelfGaps) && this.shelfGaps.length > 0) {
        // fallback ל-shelfGaps שנטען ב-initializeParamsFromProduct
        shelfGaps = [...this.shelfGaps];
        console.log(`CHECK_MINI_SHELFS - ⚠️ Fallback to this.shelfGaps:`, JSON.stringify(shelfGaps, null, 2));
      } else {
        // אם אין מדפים כלל - fallback ל-3 מדפים עם gaps ברירת מחדל
        shelfGaps = [30, 30, 30]; // 3 מדפים ברירת מחדל
        console.log(`CHECK_MINI_SHELFS - ⚠️ No valid shelf gaps, using default [30, 30, 30]`);
      }
      
      totalShelves = shelfGaps.length;
      console.log(`CHECK_MINI_SHELFS - Final shelf calculation:`, JSON.stringify({
        totalShelves: totalShelves,
        shelfGaps: shelfGaps,
        shelfGapsLength: shelfGaps.length
      }, null, 2));
    }

    // קבלת סוג הקורה והעץ מהפרמטרים - זהה לקובץ הראשי
    let shelfBeam = null;
    let shelfType = null;
    if (shelfsParam && Array.isArray(shelfsParam.beams) && shelfsParam.beams.length) {
      const shelfBeamIndex = this.getBeamIndexByDefaultType(shelfsParam);
      shelfBeam = shelfsParam.beams[shelfBeamIndex];
      // if (this.debugLogsEnabled) console.log('shelfBeam:', shelfBeam);
      // if (this.debugLogsEnabled) console.log('shelfBeam.types:', shelfBeam ? shelfBeam.types : 'null');
      shelfType = shelfBeam.types && shelfBeam.types.length ? shelfBeam.types[shelfsParam.selectedBeamTypeIndex || 0] : null;
      
      // CHECK_SHELF_BEAM: לוג על קורת המדף
      console.log(`CHECK_SHELF_BEAM - CHECK_MINI_SHELFS: Shelf beam selected:`, JSON.stringify({
        shelfBeamIndex: shelfBeamIndex,
        beamName: shelfBeam?.name,
        beamWidth: shelfBeam?.width,
        beamHeight: shelfBeam?.height,
        translatedName: shelfBeam?.translatedName,
        selectedBeamIndex: shelfsParam?.selectedBeamIndex,
        selectedTypeIndex: shelfsParam?.selectedTypeIndex,
        shelfTypeName: shelfType?.name
      }, null, 2));
    }
    
    // קבלת טקסטורת עץ לקורות המדפים - זהה לקובץ הראשי
    const shelfWoodTexture = this.getWoodTexture(shelfType ? shelfType.name : '');
    
    // קבלת סוג הקורה והעץ של קורות החיזוק מהפרמטרים
    const frameParam = this.product?.params?.find((p: any) => p.type === 'beamSingle' && p.name === 'leg');
    let frameBeam = null;
    let frameType = null;
    if (frameParam && Array.isArray(frameParam.beams) && frameParam.beams.length) {
      const frameBeamIndex = this.getBeamIndexByDefaultType(frameParam);
      frameBeam = frameParam.beams[frameBeamIndex];
      // if (this.debugLogsEnabled) console.log('frameBeam:', frameBeam);
      // if (this.debugLogsEnabled) console.log('frameBeam.types:', frameBeam ? frameBeam.types : 'null');
      frameType = frameBeam.types && frameBeam.types.length ? frameBeam.types[frameParam.selectedBeamTypeIndex || 0] : null;
      
      // CHECK_SHELF_BEAM: לוג על קורת הרגל
      console.log(`CHECK_SHELF_BEAM - CHECK_MINI_SHELFS: Leg beam selected:`, JSON.stringify({
        frameBeamIndex: frameBeamIndex,
        beamName: frameBeam?.name,
        beamWidth: frameBeam?.width,
        beamHeight: frameBeam?.height,
        translatedName: frameBeam?.translatedName,
        selectedBeamIndex: frameParam?.selectedBeamIndex,
        selectedTypeIndex: frameParam?.selectedTypeIndex,
        frameTypeName: frameType?.name
      }, null, 2));
    }
    
    // קבלת פרמטר is-reinforcement-beams-outside עבור ארון ושולחן
    const isReinforcementBeamsOutsideParam = this.product?.params?.find((p: any) => p.name === 'is-reinforcement-beams-outside');
    const isReinforcementBeamsOutside = isReinforcementBeamsOutsideParam ? !!(isReinforcementBeamsOutsideParam.default === true) : false;
    
    // קבלת טקסטורת עץ לקורות החיזוק
    const frameWoodTexture = this.getWoodTexture(frameType ? frameType.name : '');
    
    // חישוב מידות אמיתיות של קורת החיזוק פעם אחת
    let actualFrameWidth = this.dynamicParams.frameWidth;
    let actualFrameHeight = this.dynamicParams.frameHeight;
    if (frameType) {
      actualFrameWidth = frameType.width ? frameType.width / 10 : this.dynamicParams.frameWidth;
      actualFrameHeight = frameType.height ? frameType.height / 10 : this.dynamicParams.frameHeight;
    } else if (frameBeam) {
      actualFrameWidth = frameBeam.width ? frameBeam.width / 10 : this.dynamicParams.frameWidth;
      actualFrameHeight = frameBeam.height ? frameBeam.height / 10 : this.dynamicParams.frameHeight;
    }
    
    // בדיקות בטיחות למידות
    actualFrameWidth = actualFrameWidth || 5; // ברירת מחדל 5 ס"מ
    actualFrameHeight = actualFrameHeight || 5; // ברירת מחדל 5 ס"מ
    
    console.log(`CHECK_MINI_SHELFS - Starting shelf creation loop:`, JSON.stringify({
      totalShelves: totalShelves,
      shelfGaps: shelfGaps,
      currentY: currentY,
      isTable: isTable
    }, null, 2));
    
    for (let shelfIndex = 0; shelfIndex < totalShelves; shelfIndex++) {
      const isTopShelf = shelfIndex === totalShelves - 1;
      const shelfGap = shelfGaps[shelfIndex];
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1}/${totalShelves}:`, JSON.stringify({
        shelfIndex: shelfIndex,
        isTopShelf: isTopShelf,
        shelfGap: shelfGap,
        currentYBefore: currentY
      }, null, 2));
      
      // הוספת gap לכל מדף - זהה לקובץ הראשי
      currentY += shelfGap;
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} after adding gap:`, JSON.stringify({
        currentYAfter: currentY,
        shelfGap: shelfGap
      }, null, 2));
      
      // Surface beams (קורת משטח) - זהה לקובץ הראשי
      const surfaceBeams = this.createSurfaceBeams(
        this.dynamicParams.width,
        this.dynamicParams.length,
        this.dynamicParams.beamWidth,
        this.dynamicParams.beamHeight,
        minGap
      );
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} surface beams:`, JSON.stringify({
        shelfIndex: shelfIndex,
        surfaceBeamsCount: surfaceBeams.length,
        beamWidth: this.dynamicParams.beamWidth,
        beamHeight: this.dynamicParams.beamHeight,
        shelfBeamName: shelfBeam?.name,
        shelfBeamTranslatedName: shelfBeam?.translatedName
      }, null, 2));
      
      for (let i = 0; i < surfaceBeams.length; i++) {
        let beam = { ...surfaceBeams[i] };
        // Only shorten first and last beam in the length (depth) direction for non-top shelves
        // Top shelf (last shelf) gets full-length beams
        if (!isTopShelf && (i === 0 || i === surfaceBeams.length - 1)) {
          // If is-reinforcement-beams-outside is true, shorten by (2 * frameBeamWidth) + (2 * legDepth)
          // Otherwise, shorten by 2 * frameBeamWidth
          if (isReinforcementBeamsOutside && !isTable) {
            // For cabinet: legDepth = actualFrameWidth (after swap in line 1677), frameBeamWidth = actualFrameWidth
            // So: (2 * actualFrameWidth) + (2 * actualFrameWidth) = 4 * actualFrameWidth
            // But we need legDepth which is actualFrameWidth for cabinet (swapped)
            const legDepthForCabinet = actualFrameWidth; // legDepth after swap (line 1677: legDepth = actualFrameWidth)
            beam.depth = Math.max(0.1, beam.depth - ((2 * actualFrameWidth) + (2 * legDepthForCabinet)));
          } else {
            beam.depth = beam.depth - 2 * actualFrameWidth;
          }
        }
        
        const beamGeometry = new THREE.BoxGeometry(beam.width, beam.height, beam.depth);
        this.setCorrectTextureMapping(beamGeometry, beam.width, beam.height, beam.depth);
        const beamMaterial = new THREE.MeshStandardMaterial({ map: shelfWoodTexture });
        const beamMesh = new THREE.Mesh(beamGeometry, beamMaterial);
        beamMesh.position.set(beam.x, currentY + this.dynamicParams.frameHeight + beam.height / 2, 0);
        beamMesh.castShadow = true;
        beamMesh.receiveShadow = true;
        this.scene.add(beamMesh);
        this.meshes.push(beamMesh);
      }
      
      // Frame beams (קורת חיזוק) - רק עבור ארון, לא עבור שולחן
      if (!isTable) {
        const frameBeams = this.createFrameBeams(
          this.dynamicParams.width,
          this.dynamicParams.length,
          actualFrameWidth,
          actualFrameHeight,
          actualFrameHeight,  // legWidth - עומק הרגל אחרי החלפה
          actualFrameWidth   // legDepth - רוחב הרגל אחרי החלפה
        );
        
        for (const beam of frameBeams) {
          // When is-reinforcement-beams-outside is true (cabinet only):
          // - X-spanning pair: extend width by 2a (a = legWidth which is actualFrameHeight after swap)
          // - Z-spanning pair: shorten depth by 2b (b = legDepth which is actualFrameWidth after swap)
          let widthToUseCab = beam.width;
          let depthToUseCab = beam.depth;
          if (isReinforcementBeamsOutside) {
            const tol = (2 * actualFrameHeight) + 0.001;
            const isXSpan = Math.abs(beam.width - this.dynamicParams.width) <= tol;
            const isZSpan = Math.abs(beam.depth - this.dynamicParams.length) <= tol;
            // a = legWidth = actualFrameHeight (after swap), b = legDepth = actualFrameWidth (after swap)
            const a_extend = actualFrameHeight;
            const b_shorten = actualFrameWidth;
            if (isXSpan && a_extend > 0) {
              widthToUseCab = beam.width + (2 * a_extend);
            }
            if (isZSpan && b_shorten > 0) {
              // Shorten on both ends: total reduction = 2 * b
              depthToUseCab = Math.max(0.1, beam.depth - (2 * b_shorten));
            }
          }
          const frameGeometry = new THREE.BoxGeometry(widthToUseCab, beam.height, depthToUseCab);
          this.setCorrectTextureMapping(frameGeometry, widthToUseCab, beam.height, depthToUseCab);
          const frameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
          const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
          frameMesh.position.set(beam.x, currentY + beam.height / 2, beam.z);
          frameMesh.castShadow = true;
          frameMesh.receiveShadow = true;
          this.scene.add(frameMesh);
          this.meshes.push(frameMesh);
        }
      }
      
      // Add the height of the shelf itself for the next shelf
      currentY += actualFrameHeight + this.dynamicParams.beamHeight;
      
      console.log(`CHECK_MINI_SHELFS - Shelf ${shelfIndex + 1} completed:`, JSON.stringify({
        shelfIndex: shelfIndex,
        currentYAfterShelf: currentY,
        actualFrameHeight: actualFrameHeight,
        beamHeight: this.dynamicParams.beamHeight
      }, null, 2));
    }
    
    console.log(`CHECK_MINI_SHELFS - All shelves creation completed:`, JSON.stringify({
      totalShelves: totalShelves,
      finalCurrentY: currentY,
      shelfGapsUsed: shelfGaps
    }, null, 2));

    // יצירת רגליים (legs) - זהה לקורות החיזוק
    // הרגליים משתמשות באותן הגדרות של קורות החיזוק
    // לא צריך לחפש פרמטר נפרד - משתמשים ב-frameParam שכבר נמצא

    // חישוב גובה הרגליים - הרגליים מגיעות רק עד לקורות החיזוק התחתונות
    let totalY = 0;
    for (let i = 0; i < totalShelves; i++) {
      const safeShelfGap = shelfGaps[i] || 30; // ברירת מחדל 30 ס"מ
      const safeActualFrameHeight = actualFrameHeight || 5; // ברירת מחדל 5 ס"מ
      const safeBeamHeight = this.dynamicParams.beamHeight || 2.5; // ברירת מחדל 2.5 ס"מ
      totalY += safeShelfGap + safeActualFrameHeight + safeBeamHeight; // גובה מלא
    }
    // הרגליים מגיעות רק עד לקורות החיזוק התחתונות (לא כולל קורות המדפים העליונות)
    // הרגליים צריכות להיות בגובה הכולל פחות גובה קורת מדף העליונה ופחות מרווח המדף העליון
    // הרגליים מגיעות רק עד לקורות החיזוק התחתונות, לא עד קורות המדפים העליונות
    // לפי הלוגיקה של threejs-box: legHeight = topHeight - shelfBeamHeight
    const safeBeamHeight = this.dynamicParams.beamHeight || 2.5; // גובה קורת מדף
    const legHeight = Math.max(totalY - safeBeamHeight, 20); // מינימום 20 ס"מ
    
    
    
    // קבלת מידות הרגליים מקורת החיזוק (לא מקורת הפלטה)
    let legWidth = actualFrameWidth;
    let legDepth = actualFrameHeight;
    if (isTable && frameBeam) {
      // עבור שולחן, נשתמש במידות קורת הפלטה
      legWidth = frameBeam.width ? frameBeam.width / 10 : actualFrameWidth; // רוחב הרגל מקורת החיזוק
      legDepth = frameBeam.height ? frameBeam.height / 10 : actualFrameHeight; // עומק הרגל מקורת החיזוק
      // if (this.debugLogsEnabled) console.log('מידות רגליים משולחן (מקורת חיזוק):', { legWidth, legDepth, frameBeam });
    } else if (!isTable) {
      // עבור ארון - הפיכת הפרופיל של הרגליים (width ↔ height)
      legWidth = actualFrameHeight;  // רוחב הרגל = גובה קורת החיזוק
      legDepth = actualFrameWidth;  // עומק הרגל = רוחב קורת החיזוק
    }

    // מיקום הרגליים - זהה לקובץ הראשי
    const legPositions = [
      [-this.dynamicParams.width/2 + legWidth/2, 0, -this.dynamicParams.length/2 + legDepth/2],
      [this.dynamicParams.width/2 - legWidth/2, 0, -this.dynamicParams.length/2 + legDepth/2],
      [-this.dynamicParams.width/2 + legWidth/2, 0, this.dynamicParams.length/2 - legDepth/2],
      [this.dynamicParams.width/2 - legWidth/2, 0, this.dynamicParams.length/2 - legDepth/2]
    ];

    legPositions.forEach(pos => {
      // בדיקות בטיחות למידות הרגל
      const safeLegHeight = legHeight || 10; // ברירת מחדל 10 ס"מ
      const safeLegWidth = legWidth || 5; // ברירת מחדל 5 ס"מ
      const safeLegDepth = legDepth || 5; // ברירת מחדל 5 ס"מ
      
      const legGeometry = new THREE.BoxGeometry(
        safeLegWidth,
        safeLegHeight,
        safeLegDepth
      );
      this.setCorrectTextureMapping(legGeometry, legWidth, legHeight, legDepth);
      const legMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
      const leg = new THREE.Mesh(legGeometry, legMaterial);
      let legZPosition = pos[2];
      // If is-reinforcement-beams-outside is true, move legs toward Z=0 by b (leg profile height in cm)
      // This applies to both cabinet and table
      if (isReinforcementBeamsOutside && frameBeam) {
        const legProfileHeightCm = (frameBeam.height && typeof frameBeam.height === 'number') ? (frameBeam.height / 10) : 0;
        if (legProfileHeightCm > 0) {
          const dirZ = legZPosition >= 0 ? 1 : -1;
          legZPosition = legZPosition - dirZ * legProfileHeightCm;
        }
      }
      leg.position.set(pos[0], legHeight/2, legZPosition);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.scene.add(leg);
      this.meshes.push(leg);
    });

    // יצירת קורות חיזוק עבור שולחן - אחרי הרגליים
    if (isTable) {
      // סט ראשון: קורות חיזוק מתחת למדף (בגובה הרגליים)
      const frameBeams = this.createFrameBeams(
        this.dynamicParams.width,
        this.dynamicParams.length,
        actualFrameWidth,
        actualFrameHeight,
        legWidth, // legWidth - מידות נכונות מהפלטה
        legDepth  // legDepth - מידות נכונות מהפלטה
      );
      
      for (const beam of frameBeams) {
        // Adjust frame beams when reinforcement beams are outside (table):
        // - X-spanning beams (depth == actualFrameWidth) extend by 2a (leg width)
        // - Z-spanning beams (width == actualFrameWidth) shorten by 2b (leg height)
        let widthToUse = beam.width;
        let depthToUse = beam.depth;
        if (isReinforcementBeamsOutside && isTable && frameBeam) {
          // Determine a,b from selected leg beam
          const a_legWidthCm = (frameBeam.width || 0) / 10;
          const b_legHeightCm = (frameBeam.height || frameBeam.depth || 0) / 10;
          const isXSpanning = Math.abs(beam.depth - actualFrameWidth) < 0.001; // front/back
          const isZSpanning = Math.abs(beam.width - actualFrameWidth) < 0.001; // left/right
          if (isXSpanning) {
            widthToUse = beam.width + (2 * a_legWidthCm);
          }
          if (isZSpanning) {
            depthToUse = Math.max(0.1, beam.depth - (2 * b_legHeightCm));
          }
        }
        const frameGeometry = new THREE.BoxGeometry(widthToUse, beam.height, depthToUse);
        this.setCorrectTextureMapping(frameGeometry, widthToUse, beam.height, depthToUse);
        const frameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
        const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
        // מיקום קורות החיזוק מתחת למדף (בגובה הרגליים) - קיצור בגובה קורת המדף
        frameMesh.position.set(beam.x, currentY - beam.height / 2 - this.dynamicParams.beamHeight, beam.z);
        frameMesh.castShadow = true;
        frameMesh.receiveShadow = true;
        this.scene.add(frameMesh);
        this.meshes.push(frameMesh);
      }
      
      // סט שני: קורות חיזוק נוספות (extraBeam) מתחת לסט הראשון
      const extraBeamParam = this.product?.params?.find((p: any) => p.name === 'extraBeam');
      if (extraBeamParam && extraBeamParam.default > 0) {
        const extraBeamDistance = extraBeamParam.default;
        // if (this.debugLogsEnabled) console.log('Adding extra frame beams for table with distance:', extraBeamDistance);
        
        // יצירת קורות חיזוק נוספות באותו מיקום אבל יותר נמוך
        const extraFrameBeams = this.createFrameBeams(
          this.dynamicParams.width,
          this.dynamicParams.length,
          actualFrameWidth,
          actualFrameHeight,
          legWidth, // legWidth - מידות נכונות מהפלטה
          legDepth  // legDepth - מידות נכונות מהפלטה
        );
        
        // המרחק הכולל = הנתון החדש + גובה קורות החיזוק
        const totalDistance = extraBeamDistance + actualFrameHeight;
        // if (this.debugLogsEnabled) console.log('Extra beam calculation:', { extraBeamDistance, actualFrameHeight, totalDistance });
        
        for (const beam of extraFrameBeams) {
          // Apply the same outside adjustments to duplicated lower frame beams
          let widthToUseExtra = beam.width;
          let depthToUseExtra = beam.depth;
          if (isReinforcementBeamsOutside && isTable && frameBeam) {
            // Determine a,b from selected leg beam (same as upper frame beams)
            const a_legWidthCm = (frameBeam.width || 0) / 10;
            const b_legHeightCm = (frameBeam.height || frameBeam.depth || 0) / 10;
            const isXSpanning = Math.abs(beam.depth - actualFrameWidth) < 0.001; // front/back
            const isZSpanning = Math.abs(beam.width - actualFrameWidth) < 0.001; // left/right
            if (isXSpanning) {
              widthToUseExtra = beam.width + (2 * a_legWidthCm);
            }
            if (isZSpanning) {
              depthToUseExtra = Math.max(0.1, beam.depth - (2 * b_legHeightCm));
            }
          }
          const extraFrameGeometry = new THREE.BoxGeometry(widthToUseExtra, beam.height, depthToUseExtra);
          this.setCorrectTextureMapping(extraFrameGeometry, widthToUseExtra, beam.height, depthToUseExtra);
          const extraFrameMaterial = new THREE.MeshStandardMaterial({ map: frameWoodTexture });
          const extraFrameMesh = new THREE.Mesh(extraFrameGeometry, extraFrameMaterial);
          // מיקום יותר נמוך במידת totalDistance (הנתון החדש + גובה קורות החיזוק) - קיצור נוסף בגובה קורת המדף
          extraFrameMesh.position.set(beam.x, currentY - beam.height / 2 - totalDistance - this.dynamicParams.beamHeight, beam.z);
          extraFrameMesh.castShadow = true;
          extraFrameMesh.receiveShadow = true;
          this.scene.add(extraFrameMesh);
          this.meshes.push(extraFrameMesh);
          // if (this.debugLogsEnabled) console.log('Created extra frame beam at position:', beam.x, currentY - beam.height / 2 - totalDistance - this.dynamicParams.beamHeight, beam.z);
        }
      }
    }

    // סיבוב המודל - זהה לקובץ הראשי
    this.scene.rotation.y = Math.PI / 6; // 30 מעלות סיבוב
    
    // לא מעדכנים את מיקום המצלמה - שומרים על הזווית והסיבוב הנוכחיים
  }

  // שמירת המצב הנוכחי של המצלמה
  private saveCurrentCameraState() {
    return {
      cameraPosition: this.camera.position.clone(),
      target: this.target.clone(),
      spherical: {
        radius: this.spherical.radius,
        theta: this.spherical.theta,
        phi: this.spherical.phi
      },
      sceneRotation: {
        x: this.scene.rotation.x,
        y: this.scene.rotation.y,
        z: this.scene.rotation.z
      }
    };
  }

  // שחזור המצב של המצלמה - לא משנה את המבט הנוכחי
  private restoreCameraState(cameraState: any, isCamera: boolean = false) {
    // לא משנים את מיקום המצלמה או את המבט - שומרים על המצב הנוכחי
    // רק מעדכנים את סיבוב המודל אם צריך
    if (cameraState.sceneRotation) {
      this.scene.rotation.x = cameraState.sceneRotation.x;
      this.scene.rotation.y = cameraState.sceneRotation.y;
      this.scene.rotation.z = cameraState.sceneRotation.z;
    }
    
    // עדכון נקודת המבט הנוכחית
    this.camera.lookAt(this.target);
  }

  // התאמת מיקום המצלמה למידות האוביקט - מבוסס על resetCameraView מהקובץ הראשי
  private updateCameraPosition() {
    if (!this.camera || !this.renderer || !this.scene) {
      console.error('MINI_CAMERA - Camera, renderer, or scene not initialized');
      return;
    }

    // ============================================
    // פתרון חדש: מיקום המצלמה לפי Bounding Box
    // ============================================

    // קבלת מידות המסך
    const containerNew = this.renderer.domElement.parentElement;
    if (!containerNew) {
      console.error('MINI_CAMERA - Container not found');
      return;
    }

    const viewportWidthNew = this.renderer.domElement.clientWidth || containerNew.clientWidth;
    const viewportHeightNew = this.renderer.domElement.clientHeight || containerNew.clientHeight;

    // איפוס מלא של הסצנה לפני חישוב bounding box
    this.scene.rotation.set(0, 0, 0);
    this.scene.position.set(0, -120, 0);
    this.scene.scale.set(1, 1, 1);
    this.scene.updateMatrix();
    this.scene.updateMatrixWorld(true);

    // חישוב bounding box של כל האוביקטים בסצנה
    let minXNew = Infinity, minYNew = Infinity, minZNew = Infinity;
    let maxXNew = -Infinity, maxYNew = -Infinity, maxZNew = -Infinity;
    let hasObjects = false;

    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.geometry) {
        const objectBox = new THREE.Box3().setFromObject(object);
        if (!objectBox.isEmpty()) {
          // Manual expansion by comparing min/max values
          minXNew = Math.min(minXNew, objectBox.min.x);
          minYNew = Math.min(minYNew, objectBox.min.y);
          minZNew = Math.min(minZNew, objectBox.min.z);
          maxXNew = Math.max(maxXNew, objectBox.max.x);
          maxYNew = Math.max(maxYNew, objectBox.max.y);
          maxZNew = Math.max(maxZNew, objectBox.max.z);
          hasObjects = true;
        }
      }
    });

    const box = new THREE.Box3();
    if (hasObjects) {
      box.setFromPoints([
        new THREE.Vector3(minXNew, minYNew, minZNew),
        new THREE.Vector3(maxXNew, maxYNew, maxZNew)
      ]);
    }

    if (!hasObjects || box.isEmpty()) {
      console.warn('MINI_CAMERA - No objects found in scene, using fallback method');
      return;
    }

    // מציאת המרכז הגיאומטרי של ה-bounding box
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // הזזת הסצנה כך שהמרכז יהיה ב-(0,0,0)
    const offset = center.clone().negate();
    this.scene.position.set(offset.x, offset.y - 120, offset.z);
    this.scene.updateMatrix();
    this.scene.updateMatrixWorld(true);

    // חישוב המרחק כך שה-bounding box יכנס ל-view frustum
    const cameraFOV = this.camera instanceof THREE.PerspectiveCamera ? this.camera.fov : 40;
    const fovRadians = cameraFOV * (Math.PI / 180);
    const aspect = viewportWidthNew / viewportHeightNew;

    // חישוב המרחק לפי הגובה והרוחב של ה-bounding box
    const distanceHeight = (size.y / 2) / Math.tan(fovRadians / 2);
    const distanceWidth = (size.x / 2) / (Math.tan(fovRadians / 2) * aspect);
    const distanceDepth = (size.z / 2) / Math.tan(fovRadians / 2);

    // מציאת הצלע הגדולה ביותר של המוצר (width, height, length)
    // נשתמש במידות מהפרמטרים במקום מה-bounding box כדי לקבל ערכים מדויקים בס"מ
    let maxDimension = 0;
    let height = 0; // גובה המוצר
    try {
      // ננסה לקבל את המידות מהפרמטרים
      const widthParam = this.product?.params?.find((p: any) => p.name === 'width');
      const depthParam = this.product?.params?.find((p: any) => p.name === 'depth');
      const heightParam = this.product?.params?.find((p: any) => p.name === 'height');

      const width = widthParam?.default || this.dynamicParams.width || 0;
      const depth = depthParam?.default || this.dynamicParams.length || 0;
      height = heightParam?.default || this.dynamicParams.height || 0;

      maxDimension = Math.max(width, depth, height);

      // אם לא מצאנו מידות מהפרמטרים, נשתמש ב-bounding box
      if (maxDimension === 0) {
        const maxDimensionInSceneUnits = Math.max(size.x, size.y, size.z);
        maxDimension = maxDimensionInSceneUnits / 40; // המרה לס"מ
      }
    } catch (e) {
      // אם יש שגיאה, נשתמש ב-bounding box
      const maxDimensionInSceneUnits = Math.max(size.x, size.y, size.z);
      maxDimension = maxDimensionInSceneUnits / 40; // המרה לס"מ
    }

    // חישוב פרמטר zoom-out/zoom-in הדרגתי לפי המידה הגדולה ביותר בלבד
    const referenceSize = 120; // ס"מ - המידה שממנה מתחילים לחשב את הפער
    const baseMargin = 0.072; // margin בסיסי
    
    // חישוב scaleFactor כך שב-200 ס"מ יהיה zoom out של 30% מ-baseMargin
    // 30% של baseMargin = 0.072 * 0.3 = 0.0216
    // difference ב-200 = 200 - 120 = 80
    // scaleFactor = 0.0216 / 80 = 0.00027
    // הוגדל פי 1.7: 0.00027 * 1.7 = 0.000459
    // הוגדל עוד פי 1.5: 0.000459 * 1.5 = 0.0006885
    // scaleFactor חיובי = zoom out למוצרים גדולים (מגדיל margin)
    const scaleFactor = 0.0006885; // פקטור שמשפיע על עוצמת האפקט (הוגדל פי 1.7 ואז פי 1.5)

    // חישוב הפער מהמידה הייחוסית
    // אם maxDimension > referenceSize: המצלמה תהיה יותר רחוקה (zoom out)
    // אם maxDimension < referenceSize: המצלמה תהיה יותר קרובה (zoom in)
    const difference = maxDimension > referenceSize ? maxDimension - referenceSize : 0;
    
    // האפקט: difference חיובי = zoom out (מגדיל margin), רק למוצרים גדולים מ-120
    // margin גדול יותר = מצלמה רחוקה יותר = zoom out
    const zoomAdjustment = difference * scaleFactor;

    // אפקט נוסף: zoom out של 80% מ-baseMargin לכל 100 ס"מ מעל 120 (הוגדל פי 2 מ-40%)
    // למשל: מוצר בגודל 220 = 100 ס"מ מעל 120 → תוספת של 80% מ-baseMargin
    // מוצר בגודל 320 = 200 ס"מ מעל 120 → תוספת של 160% מ-baseMargin
    let additionalZoomOut = 0;
    if (maxDimension > referenceSize) {
      const excessOver120 = maxDimension - referenceSize; // כמה ס"מ מעל 120
      const hundredsOver120 = excessOver120 / 100; // כמה "100 ס"מ" יש מעל 120
      additionalZoomOut = hundredsOver120 * (baseMargin * 0.8); // 80% מ-baseMargin לכל 100 ס"מ (הוגדל פי 2)
    }

    // חישוב המרחק הסופי עם margin
    // margin קטן יותר = מצלמה קרובה יותר = zoom in
    // margin גדול יותר = מצלמה רחוקה יותר = zoom out
    // למוצרים גדולים מ-120: נוסיף zoomAdjustment חיובי ל-margin כדי להגדיל את המרחק (zoom out)
    // בנוסף: נוסיף additionalZoomOut של 40% לכל 100 ס"מ מעל 120
    const margin = baseMargin + zoomAdjustment + additionalZoomOut;
    const cameraDistance = Math.max(distanceHeight, distanceWidth, distanceDepth) * margin;

    // זווית קבועה
    const BASE_VERTICAL_ANGLE = 30; // מעלות
    const verticalAngle = BASE_VERTICAL_ANGLE * (Math.PI / 180);
    const horizontalAngle = 45 * (Math.PI / 180); // 45 מעלות אופקית

    // חישוב מיקום המצלמה במערכת קואורדינטות כדורית
    const cameraX = Math.sin(horizontalAngle) * Math.cos(verticalAngle) * cameraDistance;
    const cameraY = Math.sin(verticalAngle) * cameraDistance;
    const cameraZ = Math.cos(horizontalAngle) * Math.cos(verticalAngle) * cameraDistance;

    // איפוס המצלמה
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.camera.up.set(0, 1, 0);
    this.camera.quaternion.set(0, 0, 0, 1);

    // הגדרת מיקום המצלמה
    this.camera.position.set(cameraX, cameraY, cameraZ);
    this.scene.rotation.y = Math.PI / 6; // 30 degrees rotation

    // מבט על המרכז (0,0,0)
    this.camera.lookAt(0, 0, 0);

    // עדכון רוטציית הסצנה
    this.scene.updateMatrix();
    this.scene.updateMatrixWorld(true);

    // עדכון רוטציית המצלמה מחדש אחרי סיבוב הסצנה
    this.camera.lookAt(0, 0, 0);

    // עדכון הפרויקציה והרינדורר
    this.camera.aspect = aspect;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.updateProjectionMatrix();
    }
    this.renderer.setSize(viewportWidthNew, viewportHeightNew);

    // עדכון מטריצות
    this.camera.updateMatrix();
    this.camera.updateMatrixWorld(true);
    this.scene.updateMatrix();
    this.scene.updateMatrixWorld(true);

    // רינדור
    this.renderer.render(this.scene, this.camera);

    // עדכון target ו-spherical עבור הסיבוב האוטומטי
    this.target.set(0, 0, 0);
    const offsetForSpherical = this.camera.position.clone().sub(this.target);
    this.spherical.setFromVector3(offsetForSpherical);
    this.defaultDistance = cameraDistance;
  }
  
  // פונקציה לאיפוס המצלמה והסיבוב למצב התחלתי
  resetCameraAndRotation() {
    // איפוס משתנה הפעולה
    this.hasUserPerformedAction = false;
    
    // קריאה לפונקציה updateCameraPosition שתאפס את המצלמה למצב התחלתי
    this.updateCameraPosition();
    
    // איפוס משתנה הסיבוב האוטומטי
    this.hasUserInteracted = false;
    this.resetInactivityTimer();
    
    // שלח event שהאיפוס הסתיים
    this.resetComplete.emit();
  }


  private lastTime = 0;
  private animate() {
    // עצירת הלוגים של requestAnimationFrame לגמרי
    this.animationId = requestAnimationFrame((currentTime) => {
      // הגבלת תדירות ל-60 FPS
      if (currentTime - this.lastTime < 16.67) { // 16.67ms = ~60 FPS
        this.animate();
        return;
      }
      this.lastTime = currentTime;
      
      this.animate();
    });
    
    // בדיקה אם הקומפוננט נראה במסך (Intersection Observer)
    if (!this.isElementVisible()) {
      // אם האלמנט לא נראה, נעצור את האנימציה לגמרי
      if (this.animationId) {
        cancelAnimationFrame(this.animationId);
        this.animationId = 0;
      }
      return; // לא להמשיך עם האנימציה אם האלמנט לא נראה
    }
    
    // אם האנימציה נעצרה אבל האלמנט חזר להיות נראה, נמשיך אותה
    if (!this.animationId && this.isElementVisible()) {
      this.animate();
      return;
    }
    
    // עדכון נקודת המבט של המצלמה
    this.camera.lookAt(this.target);
    
    // סיבוב איטי של המודל (רק אם המשתמש לא התחיל להזיז)
    if (!this.hasUserInteracted) {
      const oldRotation = this.scene.rotation.y;
      this.scene.rotation.y += 0.005; // סיבוב איטי
      
      
      // לוג חד פעמי להשוואה (רק פעם אחת לכל מוצר)
      const logKey = `animation-${this.product?.id || this.product?.name || 'unknown'}`;
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey)) {
        // Animation started
        this.miniPreviewLogsShown.add(logKey);
      }
      
      
    }
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
      
      // לוג לבדיקת מודלים בסצנה (רק פעם אחת)
      const logKey = `scene-meshes-${this.product?.id || this.product?.name || 'unknown'}`;
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(logKey)) {
        // Scene check
        this.miniPreviewLogsShown.add(logKey);
      }
      
      // לוג לבדיקת האנימציה (כל 5 שניות)
      const animationLogKey = `animation-check-${this.product?.id || this.product?.name || 'unknown'}`;
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has(animationLogKey)) {
        // Animation check
        this.miniPreviewLogsShown.add(animationLogKey);
        // נוסיף timeout כדי לבדוק שוב אחרי 5 שניות
        setTimeout(() => {
          this.miniPreviewLogsShown.delete(animationLogKey);
        }, 5000);
      }
      
      // לוג לבדיקת האנימציה גם אחרי כיבוי הלוגים (כל 10 שניות)
      const animationLogKeyAfter = `animation-check-after-${this.product?.id || this.product?.name || 'unknown'}`;
      if (!this.miniPreviewLogsShown.has(animationLogKeyAfter)) {
        // Animation check after
        this.miniPreviewLogsShown.add(animationLogKeyAfter);
        // נוסיף timeout כדי לבדוק שוב אחרי 10 שניות
        setTimeout(() => {
          this.miniPreviewLogsShown.delete(animationLogKeyAfter);
        }, 10000);
      }
    }
  }

  // קורות משטח - זהה לקובץ הראשי
  private createSurfaceBeams(
    totalWidth: number,
    totalLength: number,
    beamWidth: number,
    beamHeight: number,
    minGap: number
  ): { x: number, width: number, height: number, depth: number }[] {
    const n = Math.floor((totalWidth + minGap) / (beamWidth + minGap));
    const actualGap = n > 1 ? (totalWidth - n * beamWidth) / (n - 1) : 0;
    const beams = [];
    for (let i = 0; i < n; i++) {
      const x = -totalWidth / 2 + i * (beamWidth + actualGap) + beamWidth / 2;
      beams.push({
        x,
        width: beamWidth,
        height: beamHeight,
        depth: totalLength
      });
    }
    return beams;
  }

  // קורות חיזוק - זהה לקובץ הראשי
  private createFrameBeams(
    totalWidth: number,
    totalLength: number,
    frameWidth: number,
    frameHeight: number,
    legWidth: number,
    legDepth: number
  ): { x: number, y: number, z: number, width: number, height: number, depth: number }[] {
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
    
    // console.log('createFrameBeams called with:', { totalWidth, totalLength, frameWidth, frameHeight, legWidth, legDepth });
    // console.log('Using frameBeamWidth/Height:', frameBeamWidth, frameBeamHeight);
    // console.log('Leg width/depth:', legWidth, legDepth);
    // console.log('Total width/length:', totalWidth, totalLength);
    
    const beams = [];
    // X axis beams (front/back) - קורות אופקיות קדמיות ואחוריות
    for (const z of [
      -totalLength / 2 + legDepth / 2,    // קדמית - צמודה לקצה לפי מידות הרגליים
      totalLength / 2 - legDepth / 2      // אחורית - צמודה לקצה לפי מידות הרגליים
    ]) {
      const beamWidth = totalWidth - 2 * legWidth;
      // console.log('Creating horizontal frame beam:', {
      //   z: z,
      //   beamWidth: beamWidth,
      //   totalWidth: totalWidth,
      //   legWidth: legWidth,
      //   beamStart: -beamWidth / 2,
      //   beamEnd: beamWidth / 2,
      //   legStart: -totalWidth / 2 + legWidth / 2,
      //   legEnd: totalWidth / 2 - legWidth / 2
      // });
      beams.push({
        x: 0,  // ממורכזות במרכז
        y: 0,
        z: z,  // מיקום זהה לארון
        width: beamWidth,  // עבור שולחן וארון, רוחב מותאם לעובי הרגליים
        height: frameBeamHeight,           // גובה מקורות החיזוק
        depth: frameBeamWidth              // עומק מקורות החיזוק
      });
    }
    // Z axis beams (left/right) - קורות אופקיות שמאליות וימניות
    for (const x of [
      -totalWidth / 2 + legWidth / 2,     // שמאלית - צמודה לקצה לפי מידות הרגליים
      totalWidth / 2 - legWidth / 2       // ימנית - צמודה לקצה לפי מידות הרגליים
    ]) {
      const originalX = x;
      const adjustedX = x;  // עבור שולחן וארון - מיקום זהה
      // console.log('Creating vertical frame beam:', {
      //   originalX: originalX,
      //   adjustedX: adjustedX,
      //   legWidth: legWidth,
      //   beamDepth: totalLength - 2 * legDepth
      // });
      beams.push({
        x: adjustedX,  // עבור שולחן, שתי הקורות ממורכזות למרכז הרגל
        y: 0,
        z: 0,
        width: frameBeamWidth,              // רוחב מקורות החיזוק
        height: frameBeamHeight,           // גובה מקורות החיזוק
        depth: totalLength - 2 * legDepth  // עומק זהה לארון
      });
    }
    return beams;
  }

  // פונקציה להגדרת UV mapping נכון לטקסטורה - זהה לקובץ הראשי
  private setCorrectTextureMapping(geometry: THREE.BoxGeometry, width: number, height: number, depth: number) {
    const uvAttribute = geometry.attributes.uv;
    const uvArray = uvAttribute.array as Float32Array;
    
    // מצא את הצלע הארוכה ביותר
    const maxDimension = Math.max(width, height, depth);
    const isWidthLongest = width === maxDimension;
    const isHeightLongest = height === maxDimension;
    const isDepthLongest = depth === maxDimension;
    
    // התאם את ה-UV mapping כך שהכיוון הרחב של הטקסטורה יהיה על הצלע הארוכה ביותר
    for (let i = 0; i < uvArray.length; i += 2) {
      const u = uvArray[i];
      const v = uvArray[i + 1];
      
      if (isWidthLongest) {
        // אם הרוחב הוא הארוך ביותר, השאר את הטקסטורה כפי שהיא
        uvArray[i] = u;
        uvArray[i + 1] = v;
      } else if (isHeightLongest) {
        // אם הגובה הוא הארוך ביותר, סובב את הטקסטורה 90 מעלות
        uvArray[i] = 1 - v;
        uvArray[i + 1] = u;
      } else if (isDepthLongest) {
        // אם העומק הוא הארוך ביותר, סובב את הטקסטורה 90 מעלות בכיוון אחר
        uvArray[i] = v;
        uvArray[i + 1] = 1 - u;
      }
    }
    
    uvAttribute.needsUpdate = true;
  }

  // פונקציה שמחזירה את גובה המדפים הכולל ברגע נתון
  getTotalShelfHeight(): number {
    let totalHeight = 0;
    for (let i = 0; i < this.shelfGaps.length; i++) {
      totalHeight += this.shelfGaps[i] + this.dynamicParams.frameHeight + this.dynamicParams.beamHeight;
    }
    return totalHeight;
  }

  // פונקציה שמחזירה את גובה המדפים הכולל של ברירת המחדל מהמוצר
  getTotalShelfHeightDefault(): number {
    const shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
    const defaultShelfGaps = shelfsParam?.default || [10, 50, 50];
    let defaultTotalHeight = 0;
    for (let i = 0; i < defaultShelfGaps.length; i++) {
      defaultTotalHeight += defaultShelfGaps[i] + this.dynamicParams.frameHeight + this.dynamicParams.beamHeight;
    }
    return defaultTotalHeight;
  }

  // עדכון הזום בהתאם לגובה הכולל של המדפים
  private updateZoomBasedOnTotalHeight(cameraState: any) {
    // חישוב הגובה הכולל הנוכחי של המדפים
    const currentTotalHeight = this.getTotalShelfHeight();
    
    // חישוב הגובה הכולל של ברירת המחדל מהמוצר
    const defaultTotalHeight = this.getTotalShelfHeightDefault();
    
    
    // חישוב יחס הזום (ברירת מחדל = זום רגיל)
    const zoomRatio = currentTotalHeight / defaultTotalHeight;
    
    // רדיוס בסיסי לזום רגיל (הרדיוס הנוכחי של המצלמה)
    const baseRadius = cameraState.spherical.radius;
    
    // חישוב הרדיוס החדש בהתאם ליחס הזום
    const newRadius = baseRadius * zoomRatio;
    
    // הגבלת טווח הזום
    const minRadius = 30;
    const maxRadius = 250;
    const clampedRadius = Math.max(minRadius, Math.min(maxRadius, newRadius));
    
    // Zoom calculation
    
    // עדכון המצב של המצלמה עם הרדיוס החדש
    cameraState.spherical.radius = clampedRadius;
    
    // עדכון ישיר של המצלמה עם הרדיוס החדש
    this.spherical.radius = clampedRadius;
    this.camera.position.setFromSpherical(this.spherical).add(this.target);
    this.camera.lookAt(this.target);
    
    }

  // פונקציה לבדיקת תקינות הפרמטרים הדינמיים
  private validateDynamicParams() {
    // בדיקת מידות בסיסיות
    if (!this.dynamicParams.width || this.dynamicParams.width <= 0 || isNaN(this.dynamicParams.width)) {
      console.warn('רוחב לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.width);
      this.dynamicParams.width = 100;
    }
    if (!this.dynamicParams.length || this.dynamicParams.length <= 0 || isNaN(this.dynamicParams.length)) {
      console.warn('אורך לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.length);
      this.dynamicParams.length = 100;
    }
    if (!this.dynamicParams.height || this.dynamicParams.height <= 0 || isNaN(this.dynamicParams.height)) {
      console.warn('גובה לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.height);
      this.dynamicParams.height = 100;
    }

    // בדיקת מידות קורות מדפים
    if (!this.dynamicParams.beamWidth || this.dynamicParams.beamWidth <= 0 || isNaN(this.dynamicParams.beamWidth)) {
      console.warn('רוחב קורת מדפים לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.beamWidth);
      this.dynamicParams.beamWidth = 10;
    }
    if (!this.dynamicParams.beamHeight || this.dynamicParams.beamHeight <= 0 || isNaN(this.dynamicParams.beamHeight)) {
      console.warn('גובה קורת מדפים לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.beamHeight);
      this.dynamicParams.beamHeight = 2.5;
    }

    // בדיקת מידות קורות חיזוק
    if (!this.dynamicParams.frameWidth || this.dynamicParams.frameWidth <= 0 || isNaN(this.dynamicParams.frameWidth)) {
      console.warn('רוחב קורת חיזוק לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.frameWidth);
      this.dynamicParams.frameWidth = 5;
    }
    if (!this.dynamicParams.frameHeight || this.dynamicParams.frameHeight <= 0 || isNaN(this.dynamicParams.frameHeight)) {
      console.warn('גובה קורת חיזוק לא תקין, מגדיר לברירת מחדל:', this.dynamicParams.frameHeight);
      this.dynamicParams.frameHeight = 5;
    }

  }

  // פונקציות לבדיקת גבולות עבור disabled של כפתורים
  isWidthAtMinimum(): boolean {
    const widthParam = this.product?.params?.find((p: any) => p.name === 'width');
    if (!widthParam) return true;
    
    const minWidth = widthParam.min || 0;
    return this.dynamicParams.width <= minWidth;
  }

  isWidthAtMaximum(): boolean {
    const widthParam = this.product?.params?.find((p: any) => p.name === 'width');
    if (!widthParam) return true;
    
    const maxWidth = widthParam.max || 200;
    return this.dynamicParams.width >= maxWidth;
  }

  isLengthAtMinimum(): boolean {
    const lengthParam = this.product?.params?.find((p: any) => p.name === 'depth');
    if (!lengthParam) return true;
    
    const minLength = lengthParam.min || 0;
    return this.dynamicParams.length <= minLength;
  }

  isLengthAtMaximum(): boolean {
    const lengthParam = this.product?.params?.find((p: any) => p.name === 'depth');
    if (!lengthParam) return true;
    
    const maxLength = lengthParam.max || 200;
    return this.dynamicParams.length >= maxLength;
  }

  isShelfHeightAtMinimum(): boolean {
    const isTable = this.product?.name === 'table';
    
    if (isTable) {
      const heightParam = this.product?.params?.find((p: any) => p.name === 'height');
      if (!heightParam) return true;
      
      const minHeight = heightParam.min || 0;
      return this.shelfGaps[0] <= minHeight;
    } else {
      const shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
      if (!shelfsParam) return true;
      
      const minHeight = shelfsParam.min || 0;
      return this.shelfGaps[2] <= minHeight;
    }
  }

  isShelfHeightAtMaximum(): boolean {
    const isTable = this.product?.name === 'table';
    
    if (isTable) {
      const heightParam = this.product?.params?.find((p: any) => p.name === 'height');
      if (!heightParam) return true;
      
      const maxHeight = heightParam.max || 200;
      return this.shelfGaps[0] >= maxHeight;
    } else {
      const shelfsParam = this.product?.params?.find((p: any) => p.type === 'beamArray' && p.name === 'shelfs');
      if (!shelfsParam) return true;
      
      const maxHeight = shelfsParam.max || 200;
      return this.shelfGaps[2] >= maxHeight;
    }
  }

  // יצירת מודל עדנית
  private createPlanterModel() {
    // console.log('=== Creating Planter Model ===');
    
    // שימוש בפרמטרים הדינמיים כדי שהעדנית תשתנה באופן דינמי
    const planterWidth = this.dynamicParams.width || 70; // רוחב העדנית
    const planterDepth = this.dynamicParams.length || 50; // עומק העדנית
    const planterHeight = this.dynamicParams.height || 40; // גובה העדנית
    
    // קבלת פרמטרי קורה - שימוש ב-dynamicParams
    const beamWidth = this.dynamicParams.beamWidth || 5;
    const beamHeight = this.dynamicParams.beamHeight || 2.5;
    
    // קבלת טקסטורה
    const beamParam = this.product?.params?.find((p: any) => p.name === 'beam');
    let beamType = null;
    
    if (beamParam && beamParam.beams && beamParam.beams.length > 0) {
      const selectedBeam = beamParam.beams[beamParam.selectedBeamIndex || 0];
      if (selectedBeam && selectedBeam.types && selectedBeam.types.length > 0) {
        beamType = selectedBeam.types[beamParam.selectedBeamTypeIndex || 0];
      }
    }
    
    const woodTexture = this.getWoodTexture(beamType ? beamType.name : '');
    
    // console.log('Planter params:', { planterWidth, planterDepth, planterHeight, beamWidth, beamHeight });
    
    // 1. יצירת קורות רצפה
    const beamsInDepth = Math.floor(planterWidth / beamWidth);
    const visualGap = 0.1;
    const totalGaps = beamsInDepth - 1;
    const totalGapWidth = totalGaps * visualGap;
    const availableWidth = planterWidth - totalGapWidth;
    const adjustedBeamWidth = availableWidth / beamsInDepth;
    
    for (let i = 0; i < beamsInDepth; i++) {
      const geometry = new THREE.BoxGeometry(
        planterDepth,
        beamHeight,
        adjustedBeamWidth
      );
      this.setCorrectTextureMapping(geometry, planterDepth, beamHeight, adjustedBeamWidth);
      const material = new THREE.MeshStandardMaterial({ map: woodTexture });
      const mesh = new THREE.Mesh(geometry, material);
      
      const zPosition = (i * (adjustedBeamWidth + visualGap)) - (planterWidth / 2) + (adjustedBeamWidth / 2);
      mesh.position.set(0, beamHeight / 2, zPosition);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      this.scene.add(mesh);
      this.meshes.push(mesh);
    }
    
    // 2. יצירת קירות
    const beamsInHeight = Math.floor(planterHeight / beamWidth);
    const actualWallHeight = beamsInHeight * beamWidth;
    const wallVisualGap = 0.1;
    const wallTotalGaps = beamsInHeight - 1;
    const wallTotalGapHeight = wallTotalGaps * wallVisualGap;
    const availableHeight = actualWallHeight - wallTotalGapHeight;
    const adjustedBeamHeight = availableHeight / beamsInHeight;
    
    // 4 קירות: שמאלי, ימני, קדמי, אחורי
    const walls = [
      { index: 0, name: 'שמאלי', x: 0, z: -planterWidth / 2 + beamHeight / 2, length: planterDepth - (2 * beamHeight), rotate: false },
      { index: 1, name: 'ימני', x: 0, z: planterWidth / 2 - beamHeight / 2, length: planterDepth - (2 * beamHeight), rotate: false },
      { index: 2, name: 'קדמי', x: -planterDepth / 2 + beamHeight / 2, z: 0, length: planterWidth, rotate: true },
      { index: 3, name: 'אחורי', x: planterDepth / 2 - beamHeight / 2, z: 0, length: planterWidth, rotate: true }
    ];
    
    walls.forEach(wall => {
      for (let i = 0; i < beamsInHeight; i++) {
        const geometry = new THREE.BoxGeometry(
          wall.length,
          adjustedBeamHeight,
          beamHeight
        );
        this.setCorrectTextureMapping(geometry, wall.length, adjustedBeamHeight, beamHeight);
        const material = new THREE.MeshStandardMaterial({ map: woodTexture });
        const mesh = new THREE.Mesh(geometry, material);
        
        if (wall.rotate) {
          mesh.rotation.y = Math.PI / 2;
        }
        
        const isBottomBeam = i === 0;
        const baseYPosition = (i * (adjustedBeamHeight + wallVisualGap)) + beamHeight + (adjustedBeamHeight / 2);
        const yPosition = isBottomBeam ? baseYPosition + 0.1 : baseYPosition;
        
        mesh.position.set(wall.x, yPosition, wall.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);
        this.meshes.push(mesh);
      }
    });
    
    // 3. יצירת קורות חיזוק פנימיות (4 פינות)
    const supportBeamPositions = [
      { x: -planterDepth / 2 + beamHeight + beamWidth / 2, z: -planterWidth / 2 + beamHeight + beamHeight / 2 },
      { x: planterDepth / 2 - beamHeight - beamWidth / 2, z: -planterWidth / 2 + beamHeight + beamHeight / 2 },
      { x: -planterDepth / 2 + beamHeight + beamWidth / 2, z: planterWidth / 2 - beamHeight - beamHeight / 2 },
      { x: planterDepth / 2 - beamHeight - beamWidth / 2, z: planterWidth / 2 - beamHeight - beamHeight / 2 }
    ];
    
    supportBeamPositions.forEach(pos => {
      const geometry = new THREE.BoxGeometry(
        beamWidth,
        actualWallHeight,
        beamHeight
      );
      this.setCorrectTextureMapping(geometry, beamWidth, actualWallHeight, beamHeight);
      const material = new THREE.MeshStandardMaterial({ map: woodTexture });
      const mesh = new THREE.Mesh(geometry, material);
      
      const centerY = beamHeight + actualWallHeight / 2;
      mesh.position.set(pos.x, centerY, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      this.scene.add(mesh);
      this.meshes.push(mesh);
    });
    
    // 4. יצירת מכסה (רק אם coverOpenOffset אינו null)
    const isBox = this.product?.name === 'box';
    const shouldShowCover = isBox && this.dynamicParams.coverOpenOffset !== null;
    
    if (shouldShowCover) {
      // console.log('יצירת מכסה לקופסא במיני-פרוויו...');
      
      // גובה המכסה = beamHeight (עובי רצפה) + (beamsInHeight × beamWidth) + חצי beamHeight של המכסה + offset פתיחה
      const coverY = beamHeight + (beamsInHeight * beamWidth) + beamHeight / 2 + (this.dynamicParams.coverOpenOffset || 0);
      
      // קורות רצפת המכסה
      for (let i = 0; i < beamsInDepth; i++) {
        const geometry = new THREE.BoxGeometry(
          planterDepth, // אורך הקורה = עומק הקופסא
          beamHeight,    // גובה הקורה = גובה הקורה
          adjustedBeamWidth    // רוחב קורה מותאם עם רווחים
        );
        this.setCorrectTextureMapping(geometry, planterDepth, beamHeight, adjustedBeamWidth);
        const material = new THREE.MeshStandardMaterial({ map: woodTexture });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // מיקום הקורה - זהה לרצפה אבל בגובה המכסה
        const zPosition = (i * (adjustedBeamWidth + visualGap)) - (planterWidth / 2) + (adjustedBeamWidth / 2);
        mesh.position.set(0, coverY, zPosition);
        
        this.scene.add(mesh);
        this.meshes.push(mesh);
      }
      
      // קורות תמיכה למכסה (בציר Z - לאורך planterWidth, מתחת למכסה)
      // console.log('יצירת קורות תמיכה למכסה במיני-פרוויו...');
      const supportBeamY = coverY - beamHeight - 0.05; // מתחת למכסה בגובה של קורה + רווח קטן
      const supportBeamLength = planterWidth - (4 * beamHeight) - 0.4; // קיצור נוסף של 0.2 ס"מ מכל צד
      
      // שתי קורות תמיכה - אחת מכל צד (בציר X)
      for (let i = 0; i < 2; i++) {
        const geometry = new THREE.BoxGeometry(
          adjustedBeamWidth,   // רוחב = רוחב הקורה
          beamHeight,         // גובה = height של הקורה
          supportBeamLength  // אורך מקוצר - לאורך ציר Z
        );
        this.setCorrectTextureMapping(geometry, adjustedBeamWidth, beamHeight, supportBeamLength);
        const material = new THREE.MeshStandardMaterial({ map: woodTexture });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // מיקום - אחת בקצה שמאלי ואחת בקצה ימני (ציר X), מוזזות פנימה ב-0.2 ס"מ נוסף
        const xPosition = i === 0 
          ? -planterDepth / 2 + adjustedBeamWidth / 2 + beamHeight + 0.2
          : planterDepth / 2 - adjustedBeamWidth / 2 - beamHeight - 0.2;
        mesh.position.set(xPosition, supportBeamY, 0);
        
        this.scene.add(mesh);
        this.meshes.push(mesh);
      }
      
      // console.log('מכסה קופסא נוצר בהצלחה במיני-פרוויו');
    }
    
    // סיבוב המודל
    this.scene.rotation.y = Math.PI / 6;
    
    // התאמת מצלמה
    this.updateCameraPosition();
    
    // console.log('Planter model created successfully');
  }

  private createBeamsModel() {
    // ניקוי המודל הקודם
    this.meshes.forEach(mesh => this.scene.remove(mesh));
    this.meshes = [];

    // קבלת פרמטר beams מהמוצר
    const beamsParam = this.product?.params?.find((p: any) => p.name === 'beams');
    if (!beamsParam || !beamsParam.beams || beamsParam.beams.length === 0) {
      return;
    }

    // קבלת קורה ברירת מחדל
    const defaultBeam = beamsParam.beams[0];
    const defaultType = defaultBeam.types && defaultBeam.types.length > 0 ? defaultBeam.types[0] : defaultBeam;
    
    // מידות הקורה
    const beamWidthCm = (defaultType.width || defaultBeam.width || 40) / 10; // המרה ממ"מ לס"מ
    const beamHeightCm = (defaultType.height || defaultBeam.height || 15) / 10; // המרה ממ"מ לס"מ
    const beamDepthCm = (defaultType.depth || defaultBeam.depth || 100) / 10; // המרה ממ"מ לס"מ

    // יצירת קורה אחת ברירת מחדל (100 ס"מ)
    this.dynamicBeams = [{ length: 100, quantity: 1 }];

    // יצירת הקורות הדינמיות
    this.createDynamicBeams(beamWidthCm, beamHeightCm, beamDepthCm);
    
    // סיבוב המודל
    this.scene.rotation.y = Math.PI / 6;
    
    // התאמת מצלמה
    this.updateCameraPosition();
    
    }


  private createDynamicBeams(beamWidthCm: number, beamHeightCm: number, beamDepthCm: number) {
    const beamSpacing = 10; // רווח של 10 ס"מ בין קורות
    let currentZ = 0; // מיקום Z הנוכחי לקורות - מתחיל מ-0
    
    // קבלת טקסטורת עץ - כמו שאר המוצרים
    const woodTexture = this.getWoodTexture('pine'); // טקסטורה אחת כמו שאר המוצרים
    
    this.dynamicBeams.forEach((beamInfo, index) => {
      // יצירת גיאומטריה של הקורה
      const geometry = new THREE.BoxGeometry(
        beamInfo.length, // אורך
        beamHeightCm, // גובה
        beamDepthCm // עומק
      );
      
      // הגדרת מיפוי טקסטורה נכון
      this.setCorrectTextureMapping(geometry, beamInfo.length, beamHeightCm, beamDepthCm);
      
      // יצירת חומר עם טקסטורה
      const material = new THREE.MeshStandardMaterial({ map: woodTexture });
      const mesh = new THREE.Mesh(geometry, material);
      
      // מיקום הקורה - מיושר לצדדים ומוזז מהמרכז כמו בקובץ הראשי
      mesh.position.set(
        50, // מוזז 50 ס"מ ימינה (כיוון החץ האדום) - זהה לקובץ הראשי
        0, // במרכז ה-Y כמו מוצרים אחרים
        currentZ - 25 // רווח קבוע של 10 ס"מ בין הקורות על ציר Z, מוזז 25 ס"מ לכיוון הפוך לחץ הכחול - מותאם למיני
      );
      
      // כליפ הקורה כך שהקצה התחילי יהיה בנקודה הקבועה
      mesh.translateX(-beamInfo.length / 2); // מזיז את הקורה כך שהקצה התחילי יהיה בנקודה 0
      
      // הגדרות צל
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // הוספה לסצנה
      this.scene.add(mesh);
      this.meshes.push(mesh);
      
      // התקדמות למיקום הבא (עומק הקורה + רווח קבוע של 10 ס"מ)
      currentZ += beamDepthCm + beamSpacing;
    });
    
    }


  // יצירת מודל מיטה
  private createFutonModel() {
    // שימוש בפרמטרים הדינמיים
    const futonWidth = this.dynamicParams.width || 200; // רוחב המיטה
    const futonDepth = this.dynamicParams.length || 120; // עומק המיטה
    
    // קבלת פרמטרי קורת הפלטה
    const plataParam = this.product?.params?.find((p: any) => p.name === 'plata');
    let plataBeam = null;
    let plataType = null;
    
    if (plataParam && plataParam.beams && plataParam.beams.length > 0) {
      plataBeam = plataParam.beams[plataParam.selectedBeamIndex || 0];
      if (plataBeam && plataBeam.types && plataBeam.types.length > 0) {
        plataType = plataBeam.types[plataParam.selectedBeamTypeIndex || 0];
      }
    }
    
    // קבלת פרמטרי קורת הרגל
    const legParam = this.product?.params?.find((p: any) => p.name === 'leg');
    let legBeam = null;
    let legType = null;
    
    if (legParam && legParam.beams && legParam.beams.length > 0) {
      legBeam = legParam.beams[legParam.selectedBeamIndex || 0];
      if (legBeam && legBeam.types && legBeam.types.length > 0) {
        legType = legBeam.types[legParam.selectedBeamTypeIndex || 0];
      }
    }
    
    // מידות קורות
    const plataBeamWidth = plataType ? (plataType.width || plataBeam.width || 100) / 10 : 10;
    const plataBeamHeight = plataType ? (plataType.height || plataBeam.height || 25) / 10 : 2.5;
    const legBeamWidth = legType ? (legType.width || legBeam.width || 50) / 10 : 5;
    const legBeamHeight = legType ? (legType.height || legBeam.height || 50) / 10 : 5;
    
    // גובה הפלטה - רוחב קורת הרגל מעל הקרקע
    const platformHeight = legBeamWidth;
    
    // קבלת טקסטורות
    const plataWoodTexture = this.getWoodTexture(plataType ? plataType.name : '');
    const legWoodTexture = this.getWoodTexture(legType ? legType.name : '');
    
    // 1. יצירת קורות הפלטה (דומה לשולחן)
    const minGap = 2; // רווח מינימלי בין קורות
    const surfaceBeams = this.createSurfaceBeamsForFuton(futonWidth, futonDepth, plataBeamWidth, plataBeamHeight, minGap);
    
    surfaceBeams.forEach((beam, i) => {
      const geometry = new THREE.BoxGeometry(beam.width, beam.height, beam.depth);
      this.setCorrectTextureMapping(geometry, beam.width, beam.height, beam.depth);
      const material = new THREE.MeshStandardMaterial({ map: plataWoodTexture });
      const mesh = new THREE.Mesh(geometry, material);
      
      // מיקום הפלטה בגובה של רוחב קורת הרגל
      mesh.position.set(beam.x, platformHeight + beam.height / 2, beam.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      this.scene.add(mesh);
      this.meshes.push(mesh);
      
      });
    
    // 2. יצירת קורות הרגליים (3 רגליים עם הזחה של 5 ס"מ מכל קצה)
    const legOffset = 5; // הזחה של 5 ס"מ מכל קצה (כמו בקובץ threejs)
    const availableWidth = futonWidth - (legOffset * 2); // רוחב זמין אחרי הזחה
    const legSpacing = availableWidth / 2; // רווח בין הרגליים (2 רווחים בין 3 רגליים)
    
    const legPositions = [
      { x: -futonWidth / 2 + legOffset, z: 0 }, // רגל שמאלית - מוזחת 5 ס"מ מהקצה
      { x: 0, z: 0 }, // רגל מרכזית
      { x: futonWidth / 2 - legOffset, z: 0 }  // רגל ימנית - מוזחת 5 ס"מ מהקצה
    ];
    
    legPositions.forEach((pos, i) => {
      const geometry = new THREE.BoxGeometry(
        legBeamHeight, // גובה הקורה (ציר X) - החלפה
        legBeamWidth,  // רוחב הקורה (ציר Y) - החלפה
        futonDepth     // אורך הקורה = עומק המיטה (ציר Z)
      );
      this.setCorrectTextureMapping(geometry, legBeamHeight, legBeamWidth, futonDepth);
      const material = new THREE.MeshStandardMaterial({ map: legWoodTexture });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // מיקום הרגל - צמודה למטה (Y=0) + חצי רוחב הקורה (כי עכשיו legBeamWidth הוא הגובה)
      mesh.position.set(pos.x, legBeamWidth / 2, pos.z);
      this.scene.add(mesh);
      this.meshes.push(mesh);
      
      });
    
    // התאמת מצלמה
    this.updateCameraPosition();
    
    }
  
  // פונקציה עזר ליצירת קורות פלטה למיטה (דומה לשולחן)
  private createSurfaceBeamsForFuton(width: number, depth: number, beamWidth: number, beamHeight: number, minGap: number) {
    const beams: Array<{x: number, y: number, z: number, width: number, height: number, depth: number}> = [];
    
    // חישוב כמות הקורות
    const beamsCount = Math.floor(depth / (beamWidth + minGap));
    if (beamsCount === 0) return beams;
    
    // חישוב רווחים
    const totalGaps = beamsCount - 1;
    const totalGapWidth = totalGaps * minGap;
    const availableWidth = depth - totalGapWidth;
    const adjustedBeamWidth = availableWidth / beamsCount;
    
    // יצירת הקורות
    for (let i = 0; i < beamsCount; i++) {
      const x = 0; // ממורכז בציר X
      const z = (i * (adjustedBeamWidth + minGap)) - (depth / 2) + (adjustedBeamWidth / 2);
      
      beams.push({
        x: x,
        y: 0,
        z: z,
        width: width,
        height: beamHeight,
        depth: adjustedBeamWidth
      });
    }
    
    return beams;
  }

  // פונקציה להפסקת הסיבוב האוטומטי
  public stopAutoRotation(): void {
    this.hasUserInteracted = true;
    }

  // פונקציה להסרת הכיסוי
  public removeOverlay(): void {
    this.hasUserInteracted = true;
    }

  // פונקציות public לבדיקה ושליטה בסיבוב (לשימוש מהקומפוננטה הראשית)
  public isVisible(): boolean {
    return this.isElementVisible();
  }

  public isInitialized(): boolean {
    return !!(this.scene && this.camera && this.renderer);
  }

  public isRotating(): boolean {
    // בדיקה אם יש animationId פעיל (אם המודל מסתובב)
    return !!(this.animationId && this.animationId !== null);
  }

  public getUserHasInteracted(): boolean {
    return this.hasUserInteracted;
  }

  public startRotation(): void {
    // אם המודל לא מסתובב ואף משתמש לא התחיל להזיז אותו - התחל סיבוב
    if (!this.isRotating() && !this.hasUserInteracted && this.scene && this.camera && this.renderer) {
      this.hasUserInteracted = false;
      // הפעל את האנימציה מחדש (אם הפונקציה animate קיימת)
      if (typeof (this as any).animate === 'function') {
        (this as any).animate();
      } else {
        // אם אין פונקציה animate, נפעיל את הסיבוב דרך updateCameraPosition או לוגיקה אחרת
        // ננסה למצוא ולהפעיל את הלוגיקה של הסיבוב
        console.warn('CHECK_ROTATION - animate function not found, trying alternative method');
        // אפשרות נוספת: הפעל את הסיבוב דרך spherical.theta
        // אבל זה דורש לוגיקה של animate loop
      }
    }
  }

  // בדיקה אם הקומפוננט נראה במסך
  private isElementVisible(): boolean {
    
    if (!this.container || !this.container.nativeElement) {
      if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('chack01-no-container')) {
        this.miniPreviewLogsShown.add('chack01-no-container');
      }
      return false;
    }
    
    const rect = this.container.nativeElement.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const windowWidth = window.innerWidth || document.documentElement.clientWidth;
    
    const isVisible = (
      rect.top < windowHeight &&
      rect.bottom > 0 &&
      rect.left < windowWidth &&
      rect.right > 0
    );
    
    if (this.debugLogsEnabled && !this.miniPreviewLogsShown.has('chack01-visibility-check')) {
      this.miniPreviewLogsShown.add('chack01-visibility-check');
    }
    
    return isVisible;
  }
}


# תוכנית יישום "שמור שינויים" - מפרט טכני מפורט

## 📋 סקירה כללית
יישום מלא של פונקציונליות שמירת שינויים במוצר, כולל עדכון/יצירה של דגמים, קטגוריות ופרמטרים.

---

## 🔄 FRONTEND - שינויים נדרשים

### 1. עדכון פונקציית `saveChanges()` ב-`ProductEditInfoComponent`

**קובץ**: `beams/src/app/dialog/product-edit-info/product-edit-info.component.ts`

**מה לשלוח לבק-אנד**:
```typescript
const dataToSend = {
  productId: this.product._id,
  
  // שם הדגם והסטטוס שלו
  productName: {
    value: this.currentDisplayName,
    status: this.getProductNameStatus() // 'original' | 'new'
  },
  
  // קטגוריות
  singleCategoryName: {
    value: this.currentSingleCategoryName,
    status: this.getSingleNameStatus() // 'original' | 'other' | 'new'
  },
  
  pluralCategoryName: {
    value: this.currentPluralCategoryName, 
    status: this.getPluralNameStatus() // 'original' | 'other' | 'new'
  },
  
  // שם סידורי (רק אם קיים)
  serialName: this.serialName,
  
  // כל הפרמטרים עם הערכים הנוכחיים
  parameters: this.currentParams.map(param => ({
    name: param.name,
    value: param.default, // הערך הנוכחי
    type: param.type,
    // עבור beam parameters
    selectedBeamIndex: param.selectedBeamIndex,
    selectedTypeIndex: param.selectedTypeIndex,
    beamConfiguration: param.beams?.[param.selectedBeamIndex]?.configuration
  }))
}
```

**HTTP Call**:
```typescript
this.http.post('/api/products/save-changes', dataToSend)
  .subscribe({
    next: (response) => {
      console.log('Product saved successfully');
      this.dialogService.onCloseProductEditInfoDialog();
      // הצגת הודעת הצלחה
    },
    error: (error) => {
      console.error('Error saving product:', error);
      // הצגת הודעת שגיאה
    }
  });
```

---

## 🔧 BACKEND - יישום מלא

### 1. יצירת Route חדש

**קובץ**: `beams/backend/routes/products.js`

```javascript
// POST /api/products/save-changes
router.post('/save-changes', async (req, res) => {
  try {
    const { 
      productId, 
      productName, 
      singleCategoryName, 
      pluralCategoryName, 
      serialName, 
      parameters 
    } = req.body;

    // מציאת המוצר
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // קביעה האם זה דגם חדש
    const isNewModel = productName.status === 'new';
    
    // עדכון המוצר
    await updateProductData(product, {
      productName,
      singleCategoryName,
      pluralCategoryName, 
      serialName,
      parameters,
      isNewModel
    });

    await product.save();
    
    res.json({ 
      success: true, 
      message: 'Product updated successfully',
      product: product 
    });

  } catch (error) {
    console.error('Error saving product changes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 2. פונקציית עדכון ראשית

```javascript
async function updateProductData(product, data) {
  const { 
    productName, 
    singleCategoryName, 
    pluralCategoryName, 
    serialName, 
    parameters, 
    isNewModel 
  } = data;

  // שלב 1: עדכון singleNames אם נדרש
  if (singleCategoryName.status === 'new') {
    product.singleNames[serialName] = singleCategoryName.value;
  }

  // שלב 2: עדכון names אם נדרש  
  if (pluralCategoryName.status === 'new') {
    product.names[serialName] = pluralCategoryName.value;
  }

  // שלב 3: עדכון/הוספת configuration אם דגם חדש
  let configurationIndex;
  if (isNewModel) {
    // הוספת configuration חדש
    const newConfig = {
      product: serialName, // השם הסידורי
      translatedName: productName.value
      // אין name - לא בשימוש
    };
    product.configurations.push(newConfig);
    configurationIndex = product.configurations.length - 1;
  } else {
    // מציאת האינדקס של הקונפיגורציה הנוכחית
    configurationIndex = product.configurationIndex || 0;
    
    // עדכון השם אם השתנה (ללא יצירת דגם חדש)
    if (productName.status !== 'original') {
      product.configurations[configurationIndex].translatedName = productName.value;
    }
  }

  // שלב 4: עדכון כל הפרמטרים
  for (const paramData of parameters) {
    await updateParameter(product, paramData, configurationIndex, isNewModel);
  }
}
```

### 3. עדכון פרמטרים בודדים

```javascript
async function updateParameter(product, paramData, configIndex, isNewModel) {
  const { name, value, type, selectedBeamIndex, selectedTypeIndex, beamConfiguration } = paramData;
  
  // מציאת הפרמטר במוצר
  const param = product.params.find(p => p.name === name);
  if (!param) return;

  // עדכון לפי סוג הפרמטר
  switch (param.type) {
    case 0: // מספר
    case 1: // מספר עשרוני  
    case 2: // בוליאן
      updateNumericParameter(param, value, configIndex, isNewModel);
      break;
      
    case 'beamSingle':
      updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel);
      break;
      
    case 'beamArray':
      updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel);
      break;
  }
}

function updateNumericParameter(param, value, configIndex, isNewModel) {
  if (isNewModel) {
    // הוספה בסוף
    param.configurations.push(value);
  } else {
    // עדכון במיקום הנכון
    param.configurations[configIndex] = value;
  }
}

function updateBeamSingleParameter(param, value, beamConfiguration, configIndex, isNewModel) {
  if (isNewModel) {
    // הוספה בסוף
    param.beamsConfigurations.push(beamConfiguration);
  } else {
    // עדכון במיקום הנכון
    param.beamsConfigurations[configIndex] = beamConfiguration;
  }
}

function updateBeamArrayParameter(param, value, beamConfiguration, configIndex, isNewModel) {
  if (isNewModel) {
    // הוספה בסוף - גם configurations וגם beamsConfigurations
    param.configurations.push(value); // המערך של הערכים
    param.beamsConfigurations.push(beamConfiguration);
  } else {
    // עדכון במיקום הנכון
    param.configurations[configIndex] = value;
    param.beamsConfigurations[configIndex] = beamConfiguration;
  }
}
```

---

## 📝 רשימת קבצים לעדכון

### Frontend:
1. `beams/src/app/dialog/product-edit-info/product-edit-info.component.ts`
   - עדכון `saveChanges()` 
   - הוספת HTTP call
   - הוספת error handling

2. `beams/src/app/dialog/product-edit-info/product-edit-info.component.html`
   - הוספת loading spinner בזמן שמירה (אופציונלי)

### Backend:
1. `beams/backend/routes/products.js`
   - הוספת route חדש `/save-changes`
   - יישום לוגיקת העדכון

2. `beams/backend/models/product.js` (אם נדרש)
   - וידוא שהמודל תומך בכל השדות

---

## 🔍 נקודות חשובות לוודא

1. **Validation**: וידוא שכל הנתונים הנדרשים מגיעים
2. **Error Handling**: טיפול בשגיאות בכל השלבים
3. **Atomic Operations**: וידוא שהעדכון כולו מצליח או נכשל
4. **Index Management**: וידוא שהאינדקסים של הקונפיגורציות נכונים
5. **Serial Name Validation**: וידוא ששם סידורי ייחודי
6. **UI Feedback**: הודעות הצלחה/שגיאה למשתמש

---

## ✅ בדיקות נדרשות

1. **עדכון דגם קיים** - וידוא שהערכים מתעדכנים במקום הנכון
2. **יצירת דגם חדש** - וידוא שנוסף בסוף כל הרשימות
3. **עדכון קטגוריות חדשות** - וידוא שנוספות ל-names/singleNames
4. **פרמטרים מעורבים** - מספריים + beam parameters
5. **Edge Cases** - שם סידורי ריק, ערכים לא תקינים וכו'

---

האם התוכנית נראית נכונה? יש משהו שצריך לשנות או להוסיף לפני שאתחיל ביישום?

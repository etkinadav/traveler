# תכנית עבודה - מערכת Speech-to-Text לתרגום

## 🎯 מטרה
בניית מערכת Speech-to-Text בקומפוננטת Translator שתאפשר:
- בקשת הרשאה למיקרופון
- האזנה למיקרופון והמרה לטקסט בזמן אמת
- תמיכה במגוון שפות רחב (100+ שפות)
- בחירת שפה דרך ממשק משתמש

---

## 📊 השוואת פתרונות

### אפשרות 1: Web Speech API (מומלץ לשלב ראשון)
**יתרונות:**
- ✅ חינמי לחלוטין
- ✅ לא דורש API keys
- ✅ עובד ישירות בדפדפן (לא דורש backend)
- ✅ קל ליישום
- ✅ תמיכה ב-50+ שפות

**חסרונות:**
- ❌ תמיכה מוגבלת בדפדפנים (בעיקר Chrome/Edge)
- ❌ לא עובד ב-Safari
- ❌ איכות פחותה מפתרונות Cloud
- ❌ דורש חיבור לאינטרנט

**תמיכה בשפות:** ~50 שפות (כולל עברית, אנגלית, ערבית, צרפתית, ספרדית, גרמנית, ועוד)

---

### אפשרות 2: Google Cloud Speech-to-Text API
**יתרונות:**
- ✅ תמיכה ב-100+ שפות
- ✅ איכות גבוהה מאוד
- ✅ תמיכה ב-Safari
- ✅ Free tier: 60 דקות/חודש

**חסרונות:**
- ❌ דורש API key
- ❌ דורש backend endpoint
- ❌ עלויות לאחר Free tier
- ❌ דורש חיבור לאינטרנט

**תמיכה בשפות:** 100+ שפות

---

### אפשרות 3: Microsoft Azure Speech Services
**יתרונות:**
- ✅ תמיכה ב-100+ שפות
- ✅ איכות גבוהה מאוד
- ✅ Free tier: 5 שעות/חודש
- ✅ תמיכה ב-Safari

**חסרונות:**
- ❌ דורש API key
- ❌ דורש backend endpoint
- ❌ עלויות לאחר Free tier
- ❌ דורש חיבור לאינטרנט

**תמיכה בשפות:** 100+ שפות

---

### אפשרות 4: AssemblyAI / Deepgram
**יתרונות:**
- ✅ תמיכה ב-100+ שפות
- ✅ איכות גבוהה
- ✅ Free tier זמין

**חסרונות:**
- ❌ דורש API key
- ❌ דורש backend endpoint
- ❌ עלויות לאחר Free tier

---

## 💡 המלצה: גישה היברידית

### שלב 1: Web Speech API (MVP)
- יישום מהיר וקל
- ללא עלויות
- מספיק לבדיקת ה-concept
- תמיכה ב-50+ שפות

### שלב 2: הוספת Cloud API (אם נדרש)
- Google Cloud או Azure כגיבוי/שיפור
- רק אם Web Speech API לא מספיק
- ניתן להוסיף fallback אוטומטי

---

## 🏗️ ארכיטקטורה מומלצת

### Frontend (Angular)
```
translator.component.ts
├── SpeechRecognitionService (Service)
│   ├── requestMicrophonePermission()
│   ├── startListening(language: string)
│   ├── stopListening()
│   ├── getSupportedLanguages()
│   └── handleRecognitionResult()
│
└── translator.component.html
    ├── Language Selector (Mat-Select / Checkbox)
    ├── Microphone Button
    ├── Status Indicator
    └── Text Output Area
```

### Backend (אם נדרש Cloud API)
```
backend/routes/speech.js
├── POST /api/speech/recognize
│   ├── Receive audio stream
│   ├── Send to Cloud API
│   └── Return transcript
```

---

## 📋 תכנית עבודה מפורטת

### שלב 1: הגדרת בסיס (2-3 שעות)
1. **יצירת Speech Recognition Service**
   - בדיקת תמיכה בדפדפן
   - יצירת service עם methods בסיסיים
   - טיפול בשגיאות

2. **בקשת הרשאה למיקרופון**
   - שימוש ב-`navigator.mediaDevices.getUserMedia()`
   - טיפול בסירוב הרשאה
   - הודעות משתמש ברורות

3. **UI בסיסי**
   - כפתור Start/Stop
   - אינדיקטור מצב (מאזין/עוצר)
   - אזור הצגת טקסט

### שלב 2: בחירת שפה (2-3 שעות)
1. **רשימת שפות נתמכות**
   - יצירת רשימה של כל השפות הנתמכות
   - קוד שפה + שם שפה (עברית/אנגלית/ערבית)

2. **בחירת שפה**
   - Mat-Select או Autocomplete
   - חיפוש שפה
   - שמירת בחירה ב-localStorage

3. **הגדרת שפה ב-Speech Recognition**
   - עדכון `recognition.lang` לפי בחירה

### שלב 3: זיהוי דיבור בזמן אמת (3-4 שעות)
1. **האזנה רציפה**
   - `continuous: true`
   - `interimResults: true` (תוצאות זמניות)

2. **עדכון טקסט בזמן אמת**
   - הצגת תוצאות זמניות
   - עדכון תוצאות סופיות
   - ניקוי טקסט בין משפטים

3. **טיפול באירועים**
   - `onresult` - תוצאות
   - `onerror` - שגיאות
   - `onend` - סיום
   - `onstart` - התחלה

### שלב 4: שיפורים ו-UX (2-3 שעות)
1. **ויזואליזציה**
   - אנימציה של גלי קול
   - אינדיקטור רמת קול
   - הודעות סטטוס

2. **ניהול מצב**
   - שמירת היסטוריה
   - אפשרות למחוק טקסט
   - העתקה לזיכרון

3. **טיפול בשגיאות**
   - הודעות שגיאה ברורות
   - fallback למצבים שונים
   - הדרכה למשתמש

### שלב 5: אופציונלי - Cloud API Integration (4-6 שעות)
1. **הגדרת Backend Endpoint**
   - קבלת audio stream
   - שליחה ל-Google Cloud / Azure
   - החזרת תוצאות

2. **Fallback Logic**
   - ניסיון Web Speech API קודם
   - מעבר ל-Cloud API אם נדרש
   - בחירת provider לפי שפה

---

## 📦 חבילות נדרשות

### Frontend
```json
{
  "dependencies": {
    // אין צורך בחבילות נוספות - Web Speech API מובנה בדפדפן
    // Angular Material כבר קיים לכפתורים ו-select
  }
}
```

### Backend (אם נדרש Cloud API)
```json
{
  "dependencies": {
    "@google-cloud/speech": "^6.0.0",  // או
    "microsoft-cognitiveservices-speech-sdk": "^1.34.0"
  }
}
```

---

## 🔧 קבצים שייווצרו

### Frontend
```
main-app/src/app/translator/
├── translator.component.ts (עדכון)
├── translator.component.html (עדכון)
├── translator.component.css (עדכון)
└── services/
    └── speech-recognition.service.ts (חדש)
```

### Backend (אם נדרש)
```
main-app/backend/
├── routes/
│   └── speech.js (חדש)
└── controllers/
    └── speech.js (חדש)
```

---

## 🌍 רשימת שפות נתמכות (Web Speech API)

### שפות עיקריות:
- עברית (he-IL)
- אנגלית (en-US, en-GB, en-AU)
- ערבית (ar-SA, ar-EG, ar-IL)
- צרפתית (fr-FR, fr-CA)
- ספרדית (es-ES, es-MX)
- גרמנית (de-DE)
- איטלקית (it-IT)
- רוסית (ru-RU)
- סינית (zh-CN, zh-TW)
- יפנית (ja-JP)
- קוריאנית (ko-KR)
- ועוד 40+ שפות...

**רשימה מלאה:** https://cloud.google.com/speech-to-text/docs/languages

---

## ⚠️ שיקולים חשובים

### 1. תאימות דפדפנים
- ✅ Chrome/Edge: תמיכה מלאה
- ⚠️ Firefox: תמיכה חלקית (דורש polyfill)
- ❌ Safari: לא נתמך (דורש Cloud API)

### 2. HTTPS
- Web Speech API דורש HTTPS (או localhost)
- צריך לוודא שהשרת רץ על HTTPS בפרודקשן

### 3. ביצועים
- זיהוי בזמן אמת יכול להיות כבד
- מומלץ לעצור/להתחיל לפי דרישה
- לא להשאיר מאזין פתוח ללא צורך

### 4. פרטיות
- הקלטות לא נשלחות לשרת (Web Speech API)
- אם משתמשים ב-Cloud API - צריך להזהיר משתמשים

---

## 🚀 הצעה להתחלה

**אני ממליץ להתחיל עם Web Speech API** כי:
1. ✅ מהיר ליישום
2. ✅ ללא עלויות
3. ✅ מספיק לבדיקת ה-concept
4. ✅ תמיכה ב-50+ שפות (כולל עברית, אנגלית, ערבית)
5. ✅ ניתן להוסיף Cloud API מאוחר יותר אם נדרש

**אם תצטרך תמיכה ב-100+ שפות או Safari** - נוסיף Cloud API בשלב מאוחר יותר.

---

## 📝 שאלות להחלטה

1. **איזה פתרון תרצה?**
   - [ ] Web Speech API בלבד (מומלץ להתחלה)
   - [ ] Cloud API (Google/Azure)
   - [ ] היברידי (Web Speech + Cloud fallback)

2. **תמיכה ב-Safari חשובה?**
   - אם כן → צריך Cloud API
   - אם לא → Web Speech API מספיק

3. **תקציב?**
   - חינמי → Web Speech API
   - מוכן לשלם → Cloud API

---

## ✅ הצעה לשלב הבא

**אני ממליץ להתחיל עם Web Speech API** ולבנות:
1. Service לניהול Speech Recognition
2. UI עם בחירת שפה
3. כפתור Start/Stop
4. הצגת טקסט בזמן אמת

**לאחר מכן** נוכל להעריך אם צריך Cloud API.

---

**האם תרצה שאתחיל ליישם את הפתרון המומלץ (Web Speech API)?**


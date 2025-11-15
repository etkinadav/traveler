# MEAN Stack Base Application

מערכת בסיסית לפיתוח ממשקים חדשים - MEAN Stack (MongoDB, Express, Angular, Node.js)

## 📋 תכונות בסיסיות

- ✅ **משתמשים** - הרשמה, התחברות, ניהול פרופיל
- ✅ **הזמנות** - יצירה וניהול הזמנות
- ✅ **תשלומים** - ניהול תשלומים ואשראי
- ✅ **אימות** - JWT Authentication
- ✅ **תרגומים** - תמיכה ב-i18n (עברית, אנגלית, ערבית)
- ✅ **UI** - Angular Material

## 🚀 התקנה והרצה

### דרישות מוקדמות

- Node.js (v16 או גבוה יותר)
- MongoDB (Atlas או מקומי)
- npm או yarn

### שלב 1: התקנת חבילות

```bash
# התקנת חבילות Frontend
npm install

# התקנת חבילות Backend
cd backend
npm install
cd ..
```

### שלב 2: הגדרת משתני סביבה

צור קובץ `.env` בתיקיית `backend/` על בסיס `.env.example`:

```bash
cp backend/.env.example backend/.env
```

ערוך את הקובץ `.env` והוסף את הערכים הנדרשים (ראה `.env.example`).

### שלב 3: הרצת השרת

#### אפשרות 1: הרצה נפרדת

```bash
# Terminal 1 - Backend
cd backend
npm run start:server

# Terminal 2 - Frontend
npm run start:front
```

#### אפשרות 2: הרצה משולבת (Windows)

```bash
start_all.bat
```

### שלב 4: גישה לאפליקציה

- Frontend: http://localhost:4200
- Backend API: http://localhost:3000

## 📁 מבנה הפרויקט

```
traveler/
├── backend/              # Backend (Node.js + Express)
│   ├── controllers/      # Controllers
│   ├── models/          # Mongoose Models
│   ├── routes/          # API Routes
│   ├── middleware/      # Middleware (Auth, etc.)
│   ├── app.js           # Express App Configuration
│   └── server.js        # Server Entry Point
│
├── main-app/            # Frontend (Angular)
│   ├── src/
│   │   ├── app/
│   │   │   ├── auth/           # Authentication Components
│   │   │   ├── other-pages/    # Other Pages (Orders, Profile)
│   │   │   ├── main-nav/       # Navigation
│   │   │   └── dialog/         # Dialog Components
│   │   └── assets/             # Assets (images, i18n)
│   └── angular.json
│
└── package.json         # Root package.json
```

## 🔧 API Endpoints

### משתמשים (`/api/user`)
- `POST /api/user/signup` - הרשמה
- `POST /api/user/login` - התחברות
- `GET /api/user/:id` - קבלת משתמש
- `PUT /api/user/:id` - עדכון משתמש

### הזמנות (`/api/orders`)
- `GET /api/orders` - קבלת כל ההזמנות
- `POST /api/orders` - יצירת הזמנה חדשה
- `GET /api/orders/:id` - קבלת הזמנה ספציפית
- `PUT /api/orders/:id` - עדכון הזמנה
- `DELETE /api/orders/:id` - מחיקת הזמנה

## 🔐 אימות

המערכת משתמשת ב-JWT (JSON Web Tokens) לאימות.

Headers נדרשים:
```
Authorization: Bearer <token>
```

## 🌐 תרגומים

המערכת תומכת בתרגומים דרך `@ngx-translate/core`.

קבצי תרגום נמצאים ב: `src/assets/i18n/`

שפות נתמכות:
- עברית (he) - ברירת מחדל
- אנגלית (en)
- ערבית (ar)

## 📝 פיתוח ממשק חדש

כדי להתחיל ממשק חדש מהבסיס הזה:

1. העתק את הפרויקט
2. התקן חבילות: `npm install`
3. הגדר משתני סביבה
4. התחל להוסיף את הפיצ'רים הספציפיים שלך

## 🛠️ Scripts

```bash
# Frontend
npm run start:front      # הרצת Angular Dev Server
npm run build            # Build ל-Production
npm run test             # הרצת Tests

# Backend
npm run start:server     # הרצת Node.js Server (עם nodemon)
```

## 📦 חבילות עיקריות

### Frontend
- Angular 16
- Angular Material
- @ngx-translate/core
- RxJS

### Backend
- Express
- Mongoose
- jsonwebtoken
- bcryptjs
- dotenv

## ⚠️ הערות חשובות

- הקבצים `.env` לא נשמרים ב-Git (מופיעים ב-.gitignore)
- ודא שיש לך חיבור ל-MongoDB לפני הרצה
- Ports ברירת מחדל: Frontend (4200), Backend (3000)

## 📄 רישיון

Private Project

---

**נוצר כבסיס לפיתוח ממשקים חדשים**

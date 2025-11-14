# Traveler Project

פרויקט Full-Stack MEAN (MongoDB, Express, Angular, Node.js) - מערכת ניהול מוצרים עם Angular Frontend ו-Node.js Backend.

## 🚀 התקנה והפעלה

### דרישות מוקדמות
- Node.js (גרסה 16 ומעלה)
- npm או yarn
- MongoDB Atlas (או MongoDB מקומי)

### התקנת Dependencies

#### Frontend
```bash
npm install
```

#### Backend
```bash
cd backend
npm install
cd ..
```

### הגדרת Backend

1. צור קובץ `.env` בתיקיית `backend/`:
```env
MONGO_URI=your_mongodb_connection_string
PORT=3000
```

2. הרצת Backend Server:
```bash
npm run start:server
```
השרת ירוץ על `http://localhost:3000`

### הרצת Frontend

```bash
npm run start:front
```
האפליקציה תהיה זמינה ב-`http://localhost:4200`

## 📁 מבנה הפרויקט

```
traveler/
├── backend/           # Node.js Backend
│   ├── controllers/   # Controllers
│   ├── models/        # MongoDB Models
│   ├── routes/        # API Routes
│   ├── middleware/    # Authentication Middleware
│   └── server.js      # Server Entry Point
├── src/               # Angular Frontend
│   ├── app/           # Angular Components & Services
│   ├── assets/        # Static Assets
│   └── environments/  # Environment Configurations
└── angular.json       # Angular Configuration
```

## 🛠️ Scripts זמינים

- `npm run start:front` - הרצת Frontend Development Server
- `npm run start:server` - הרצת Backend Server
- `npm run build` - Build לפרודקשן
- `npm test` - הרצת Tests

## 🔧 הגדרות נוספות

### Backend API
הבאק-אנד מספק API endpoints על `/api/`:
- `/api/user` - ניהול משתמשים
- `/api/products` - ניהול מוצרים
- `/api/orders` - ניהול הזמנות
- `/api/screws` - ניהול ברגים
- `/api/woods` - ניהול קורות עץ

### Frontend Proxy
ה-Frontend מוגדר עם proxy שמפנה בקשות ל-`/api/` ל-`http://localhost:3000` (ראה `proxy.conf.json`).

## 📝 הערות

- ודא שה-Backend רץ לפני הרצת Frontend
- בדוק שהקובץ `.env` מוגדר נכון ב-backend
- הקבצים `.env` ו-`node_modules` לא נשמרים ב-git (מוגדר ב-`.gitignore`)

## 🔐 Security

- אל תעלה את קובץ `.env` ל-git
- הקפד להשתמש בסיסמאות חזקות ל-MongoDB
- בדוק את הגדרות ה-CORS ב-backend לפני פריסה לפרודקשן

## 📄 License

פרויקט זה הוא פרטי.

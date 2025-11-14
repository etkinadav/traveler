# הוראות שמירה ב-GitHub - שלב אחר שלב

## שלב 1: יצירת Repository ב-GitHub

1. הכנס ל-github.com והתחבר לחשבון שלך
2. לחץ על כפתור ה-"+" בפינה הימנית העליונה
3. בחר "New repository"
4. הזן שם לפרויקט (לדוגמה: `traveler`)
5. השאר את כל ההגדרות ברירת מחדל
6. **אל תסמן** את התיבות: "Add a README file", "Add .gitignore", "Choose a license"
7. לחץ על "Create repository"

## שלב 2: קבלת URL של ה-Repository

1. לאחר יצירת ה-repository, תראה עמוד עם הוראות
2. העתק את ה-URL שמופיע (נראה כך: `https://github.com/your-username/traveler.git`)
3. העתק גם את שם המשתמש שלך ב-GitHub (אם לא זוכר)

## שלב 3: הוספת Remote ודחיפת הקוד

1. פתח PowerShell או Terminal בתיקיית הפרויקט
2. הפעל את הפקודה הבאה (החלף `YOUR-USERNAME` ו-`REPOSITORY-NAME` בנתונים שלך):

```bash
git remote add origin https://github.com/YOUR-USERNAME/REPOSITORY-NAME.git
```

3. דחף את הקוד:

```bash
git push -u origin main
```

4. אם תתבקש להתחבר, הכנס את שם המשתמש והסיסמה של GitHub שלך

## סיום ✅

הקוד שלך נשמר ב-GitHub!

---

**הערה:** אם יש לך שגיאה בשלב 3, שלח לי את ה-URL של ה-repository ואני אעשה את זה עבורך.


# دليل الإعداد وتشغيل تطبيق "ميار" (Mayar — com.mayar.app)

تطبيق **ميار** هو منصة تواصل فورية ومكالمات صوت وفيديو احترافية باللغة العربية مبنية باستخدام **React + Vite + Express + Capacitor** لدعم تشغيل الويب وتوليد تطبيق أندرويد حقيقي أصيل (Native Android App).

---

## 📱 1. معلومات حزمة أندرويد الرسمية (Android Identity)

- **اسم الحزمة (Package Name / Application ID)**: `com.mayar.app`
- **اسم التطبيق (App Name)**: `Mayar` / `ميار`
- **مسار المشروع**: `/android`
- **ملف تهيئة أندرويد الرئيسي**: `/android/app/build.gradle` (يحتوي `applicationId "com.mayar.app"` و `namespace "com.mayar.app"`)

---

## 🛠️ 2. تثبيت التبعيات (Dependencies & Installation)

لتثبيت حزم التطبيق الأساسية وحزم Capacitor الرسمية:

```bash
npm install
```

الحزم المضمنة في المشروع لدعم الأندرويد:
- `@capacitor/core`: النواة لربط الويب بالنظام
- `@capacitor/android`: المحرك الأصيل لنظام أندروid
- `@capacitor/cli`: أدوات التحكم والبناء خط الأوامر
- `@capacitor/push-notifications`: استقبال إشعارات FCM
- `@capacitor/app`: إدارة حالة التطبيق (Foreground / Background / Terminated)
- `@capacitor/device`: جلب معلومات الجهاز
- `@capacitor/network`: مراقبة حالة الاتصال بالشبكة

---

## 🔥 3. إعداد Firebase لـ Android وتعيين ملف `google-services.json`

1. **تحميل الملف من Firebase Console**:
   - قم بإنشاء تطبيق Android داخل مشروع Firebase بنفس اسم الحزمة المعرف: `com.mayar.app`.
   - قم بإنزال ملف `google-services.json`.

2. **المكان الصحيح لوضع الملف**:
   ضع ملف `google-services.json` مباشرة في المسار التالي داخل المشروع:
   ```text
   android/app/google-services.json
   ```

3. **التحقق من إعدادات Gradle**:
   - تم ربط إتاحة الإشعارات تلقائياً في `android/app/build.gradle`:
     ```groovy
     apply plugin: 'com.google.gms.google-services'
     ```
   - وتم إضافة `classpath 'com.google.gms:google-services:4.4.4'` في `android/build.gradle`.

---

## 🔒 4. أذونات الأندرويد (Android Permissions)

تمت إضافة جميع الأذونات التشغيلية في ملف `android/app/src/main/AndroidManifest.xml`:

- `INTERNET`: للاتصال بخادم الإشارات وبث WebRTC
- `ACCESS_NETWORK_STATE`: للتحقق من الاتصال بالشبكة
- `CAMERA`: للمكالمات المرئية (فيديو)
- `RECORD_AUDIO`: للمكالمات الصوتية والرسائل الصوتية
- `MODIFY_AUDIO_SETTINGS`: للتحكم في مخرج الصوت والميكروفون
- `POST_NOTIFICATIONS`: لإظهار الإشعارات والمكالمات الواردة على أندرويد 13+
- `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`: لدعم السماعات والمايكات اللاسلكية
- `VIBRATE`, `WAKE_LOCK`: للاهتزاز وإيقاظ الشاشة عند ورود مكالمة

> **ملاحظة**: يتم طلب الأذونات الحساسة من المستخدم تشغيلياً (Runtime Permissions) فقط عند بدء أو قبول المكالمة أو تفعيل الإشعارات.

---

## 📞 5. هندسة إشعارات المكالمات الواردة بحسب حالة التطبيق (Call Notification Architecture)

لضمان وصول المكالمات الصوتية والمرئية عبر نظام أندرويد بشكل موثوق، يعتمد المشروع على تمييز حالات التطبيق الثلاث:

1. **التطبيق في الواجهة (App in Foreground)**:
   - تعمل وصلة WebSocket ومسارات WebRTC مباشرة داخل WebView.
   - تظهر شاشة المكالمة الواردة فوراً داخل واجهة التطبيق مع صوت الجرس والتأثيرات التفاعلية.

2. **التطبيق في الخلفية (App in Background)**:
   - يتم إرسال إشعار FCM عالي الأولوية (`High-Priority Data FCM Message`).
   - يقوم المكون الأصيل بإظهار إشعار نظام مخصص (Heads-up Notification) مع أزرار "رد" و "رفض".
   - عند الضغط على "رد"، ينفتح التطبيق وتتصل إشارات WebRTC فوراً.

3. **التطبيق مغلق تماماً (App Terminated / Closed)**:
   - يتم معالجة الرسالة عبر خدمة `FirebaseMessagingService` في أندرويد الأصيل.
   - يُظهر النظام إشعار مكالمة واردة بملء الشاشة أو رأس الشاشة.
   - عند الضغط على الإشعار، يتم إقلاع `MainActivity` وإيصال بيانات المكالمة `callId` لفتح شاشة الاستقبال الفوري.

---

## 🚀 6. خطوات بناء وتزامن التطبيق (Build & Capacitor Sync Workflow)

عند التعديل على واجهة الويب أو إضافة ميزات جديدة، اتبع الخطوات التالية:

### الخطوة A: بناء كود الويب (Vite Production Build)
```bash
npm run build
```
يقوم هذا الأمر بإنشاء مجلد `dist/` الذي يحتوي على مخرجات الويب وتجميع خادم Express.

### الخطوة B: مزامنة كود الويب مع مشروع الأندرويد (Capacitor Sync)
```bash
npx cap sync android
```
يقوم هذا الأمر بنسخ محتويات `dist/` إلى `android/app/src/main/assets/public` ومزامنة جميع إضافات Capacitor.

---

## 📦 7. فتح وبناء تطبيق الأندرويد الأصيل (Android Build & Release)

### فتح المشروع في Android Studio:
```bash
npx cap open android
```

### بناء حزمة التجربة (Debug APK):
من داخل المجلد الرئيسي أو مجلد `android/`:
```bash
cd android
./gradlew assembleDebug
```
يتم توليد ملف الـ APK في: `android/app/build/outputs/apk/debug/app-debug.apk`.

### بناء حزمة النشر لمتجر جوجل بلاي (Release AAB):
```bash
cd android
./gradlew bundleRelease
```
يتم توليد ملف الـ AAB في: `android/app/build/outputs/bundle/release/app-release.aab`.

---

## ⚡ 8. التشغيل المباشر في بيئة التطوير الحالي (Live Development Server)

تشغيل الخادم المحلي وواجهة التطبيق المباشرة:
```bash
npm run dev
```
أو عبر المنفذ `3000`.

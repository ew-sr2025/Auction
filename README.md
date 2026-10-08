# Lot: onlayn auksion

Backend: Node.js, Express, MongoDB (Mongoose), Socket.io, JWT, bcrypt
Frontend: React (Vite), React Router, Axios, socket.io-client

## Ishga tushirish

1. MongoDB ishlab turganini tekshiring.
2. Backend:
   ```
   cd backend
   # o'zingizdagi .env faylni shu papkaga qo'ying (namuna: .env.example)
   npm install
   npm run dev
   ```
3. Frontend (boshqa terminalda):
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Brauzerda http://localhost:5173 ni oching.

## Frontend va backend manzili

Backend manzili frontend kodida `frontend/backend-url.js` faylidagi
`DEFAULT_BACKEND_URL` orqali standart qilib ko'rsatilgan. Shu sababli alohida
environment sozlamasi kiritmasdan deploy qilish mumkin. Backend manzili o'zgarsa,
shu fayldagi URL'ni yangilab frontendni qayta build/deploy qiling.

Ixtiyoriy ravishda Render kabi frontend hosting xizmatining build environment
sozlamasida `VITE_BACKEND` ni ko'rsatib, koddagi standart URL o'rniga boshqa
manzildan foydalanish mumkin (`backend/.env` ichida emas):

```
VITE_BACKEND=https://api.example.com
```

`VITE_BACKEND` yoki koddagi standart URL HTTP API, yuklangan fayllar va Socket.IO
ulanishlarida ishlatiladi. URL faqat origin bo'lishi kerak (masalan, `/api`
qo'shmang).

Lokal backendga ulanish uchun frontend papkasidagi `.env` fayliga
`VITE_BACKEND=http://localhost:5000` yozing. Bu standart public URL o'rniga
lokal backendni ishlatadi; API va Socket.IO so'rovlari Vite proxy orqali o'tadi.

Cross-origin so'rovlar uchun backend `.env` dagi `CLIENT_URL` frontendning
originiga mos kelishi kerak. `CLIENT_URL` berilmasa, backend CORS uchun `*`
ishlatadi.

## .env (backend)

| Nom | Izoh |
|---|---|
| PORT | server porti |
| MONGO_URI | MongoDB manzili |
| JWT_SECRET | JWT kaliti |
| JWT_EXPIRES_IN | ixtiyoriy, standart 7d |
| CLIENT_URL | ixtiyoriy (CORS), standart * |
| SMTP_HOST | email yuborish serveri |
| SMTP_PORT | ixtiyoriy, SMTP porti (standart 587; 465 bo'lsa TLS) |
| SMTP_USER | SMTP foydalanuvchi nomi |
| SMTP_PASS | SMTP paroli yoki ilova paroli |
| EMAIL_FROM | yuboruvchi email manzili |
| GOOGLE_CLIENT_ID | Google OAuth web client ID (backend token tekshiruvi uchun) |
| IMAGEKIT_PRIVATE_KEY | ImageKit server-side upload private key (`backend/.env` va hosting secrets ichida saqlang) |

Nomlar boshqacha bo'lsa, `backend/src/config/env.js` ni moslang.
Ro'yxatdan o'tishda emailga 6 xonali tasdiqlash kodi yuboriladi. Kod 10 daqiqa
amal qiladi; qayta yuborish tugmasi 2 daqiqadan keyin faollashadi.

Google orqali kirishni yoqish uchun Google Cloud Console'da OAuth client ID
(Web application) yarating va JavaScript origins ro'yxatiga frontend manzilini
qo'shing (masalan `http://localhost:5173` hamda production domen). OAuth
consent screen'ni ham sozlang.

- `backend/.env`: `GOOGLE_CLIENT_ID=...`
- `frontend/.env`: `VITE_GOOGLE_CLIENT_ID=...`

Ikkala joyda ham bir xil Web client ID ishlatiladi. Frontend `.env` o'zgargach,
Vite serverini qayta ishga tushiring yoki production buildni yangilang.
Google tasdiqlagan email avval ro'yxatdan o'tgan bo'lsa, shu hisobga kiradi;
yangi bo'lsa, akkaunt avtomatik yaratiladi.

Yangi mahsulot rasmlari va avatarlar ImageKit'ga yuklanadi, MongoDB'da esa
ImageKit URL saqlanadi. ImageKit dashboard'dan private key oling va uni
`backend/.env` faylida `IMAGEKIT_PRIVATE_KEY` nomi bilan yoki production
hostingdagi environment variable sifatida sozlang. Private key'ni frontendga,
repositoryga yoki ochiq chatga qo'ymang. Sozlama bo'lmasa rasm yuklash
endpointi aniq sozlama xatosini qaytaradi. Oldin serverning `/uploads/`
manzilida turgan rasmlar avtomatik ko'chirilmaydi; mavjud URL'lar o'sha
serverdagi fayllar bor ekan, eski usulda ko'rsatilaveradi.

## Qoidalar (backend/src/config/constants.js)

- Minimal boshlang'ich narx: 50 000 so'm
- Har bir yangi taklif oldingisidan kamida 1 000 so'm ko'p
- Standart muddat 5 kun; taklif bo'lmasa bir marta +2 kun
- Muddat tugagach: taklif bor bo'lsa `sold`, yo'q bo'lsa `expired`
- Muallifda nofaol mahsulot qoladi, "Qayta faollashtirish" tugmasi bilan yangidan boshlanadi
- O'chirish soft delete: bazada `isDeleted: true` bo'lib qoladi

## Administrator

`admin` roli bor foydalanuvchi navigatsiyadagi **Admin panel** orqali
foydalanuvchilarni qidirishi, bloklashi va blokdan chiqarishi, shuningdek
mahsulotlar bo‘limidan istalgan mahsulotni darhol o‘chirishi mumkin. Blok
vaqtinchalik (soat yoki kun miqdorini admin kiritadi) yoki cheksiz bo'lishi,
sabab esa ixtiyoriy yozilishi mumkin. Muddati tugagan blok avtomatik bekor
bo'ladi. Ban paytida foydalanuvchining mahsulotlari yashiriladi, faol
mahsulotlari pauza qilinadi va faol auksionlardagi takliflari yashirilib narx
qayta hisoblanadi. Ban bekor bo'lsa mahsulotlar davom etadi; boshqa xaridorlar
ban davrida taklif bergan faol auksionlarda eski takliflar nizoni oldini olish
uchun yashirin qoladi. Tugagan yoki sotilgan auksionlar o'zgarmaydi. Admin API
faqat `admin` roli uchun ochiq; administrator akkauntlarini paneldan bloklab
bo'lmaydi.

Tizimga kirgan foydalanuvchi mahsulot sahifasidan bir marta shikoyat yuborishi
mumkin. Har bir noyob foydalanuvchi shikoyati mahsulot limitiga bittadan
qo‘shadi; 5 ta shikoyatga yetganda mahsulot soft-delete qilinadi. Shikoyat
mahsulot muallifini 5 kunga avtomatik bloklaydi (admin muallif bundan mustasno).

Mahsulot joylashda O‘zbekistonning 14 viloyati va 210 tuman/shaharidan
joylashuvni tanlash ixtiyoriy. GPS ruxsati berilsa, koordinatalar OpenStreetMap
Nominatim xizmatiga hududni aniqlash uchun bir martalik yuboriladi, lekin
saqlanmaydi. Mahsulotda faqat viloyat va tuman/shahar nomlari saqlanib,
ko‘rsatiladi. Joylashuvni tahrirlash yoki olib tashlash mumkin.
Hududlar ro‘yxati [MIMAXUZ Uzbekistan Regions Data](https://github.com/MIMAXUZ/uzbekistan-regions-data/tree/9f66e4129891744218e169e8a61c212ce9852208/JSON)
ma’lumotlar to‘plamidan olingan; manba ayrim ma’lumotlarda tafovut bo‘lishi
mumkinligini qayd etadi.

## Sayt haqida

Yuqori navigatsiyadagi **Sayt haqida** sahifasida platforma statistikasi
ko‘rsatiladi. Ma’lumotlar `GET /api/site/stats` endpointidan olinadi:
ro‘yxatdan o‘tgan foydalanuvchilar, e’lon qilingan mahsulotlar, faol auksionlar
va sotilgan deb belgilangan mahsulotlar soni. Sayt internetga 5-oktabr kuni
chiqarilgan. Yangiliklar bo‘limida administrator yozgan e’lonlar hamda
boshlang‘ich narxidan kamida 1,5 baravariga sotilgan mahsulotlar avtomatik
ko‘rsatiladi. Admin yangiliklarni Admin paneldagi **Yangiliklar** bo‘limidan
qo‘shishi yoki o‘chirishi mumkin.

## API

| Metod | Yo'l | Izoh |
|---|---|---|
| POST | /api/auth/register/code | Ro'yxatdan o'tish ma'lumotlari bilan email tasdiqlash kodini yuborish |
| POST | /api/auth/register/resend | `{ "email": "..." }` bilan yangi tasdiqlash kodi yuborish |
| POST | /api/auth/register/verify | Ro'yxatdan o'tish ma'lumotlari va `{ "code": "123456" }` bilan tasdiqlash |
| POST | /api/auth/google | Google ID tokenini tekshirib, tizimga kiritish yoki akkaunt yaratish |
| POST | /api/auth/login | identifier (username yoki email), password |
| GET | /api/auth/me | joriy foydalanuvchi |
| GET | /api/site/stats | ochiq: foydalanuvchi va mahsulot statistikasi |
| GET | /api/site/news | ochiq: admin yangiliklari va 1,5 baravar yoki yuqori narxda sotilgan mahsulotlar |
| POST | /api/site/news | administrator: `{ "title": "...", "body": "..." }` yangilik yaratish |
| DELETE | /api/site/news/:id | administrator: admin joylagan yangilikni o‘chirish |
| GET | /api/admin/users | administrator: foydalanuvchilar ro'yxati (`page`, `limit`, `q`) |
| GET | /api/admin/products | administrator: o‘chirilmagan mahsulotlar va shikoyat soni (`page`, `limit`, `q`) |
| DELETE | /api/admin/products/:id | administrator: mahsulotni darhol soft-delete qilish |
| PATCH | /api/admin/users/:id/ban | administrator: `{ "isBanned": false }` bilan blokdan chiqarish; bloklashda `isBanned: true`, `durationType: "temporary"/"permanent"`, vaqtinchalik uchun `duration` va `durationUnit: "hours"/"days"`, ixtiyoriy `reason` |
| PUT | /api/users/me | profil: firstName, lastName, username, bio, phone, avatar (multipart) |
| GET | /api/products | faol mahsulotlar (q, sort, page, limit) |
| GET | /api/products/mine | mening mahsulotlarim (faol va nofaol) |
| GET | /api/products/locations | O‘zbekistonning viloyat, tuman va shahar ro‘yxati |
| POST | /api/products/location/resolve | GPS `{ "latitude": 41.3, "longitude": 69.2 }` koordinatasidan tuman/shaharni aniqlash (auth talab qiladi, koordinata saqlanmaydi) |
| POST | /api/products | mahsulot joylash (telefon majburiy, multipart, images, ixtiyoriy `locationRegionId` va `locationDistrictId`) |
| PUT | /api/products/:id | mahsulotni tahrirlash: title, description, durationDays, startingPrice (faqat birinchi taklif yo'q bo'lsa), images, removeImages va viloyat/tuman ID'lari (ikkala location maydonini bo'sh yuborib olib tashlash mumkin) |
| GET | /api/products/:id | mahsulot va takliflar tarixi |
| GET | /api/chats/conversations | tizimga kirgan foydalanuvchining so‘nggi suhbatlari; har bir suhbatda tegishli mahsulot ko‘rsatiladi |
| GET | /api/products/:id/messages | xaridorning o'z suhbati yoki muallif uchun `?buyerId=...` |
| GET | /api/products/:id/conversations | mahsulot muallifining xaridorlar bilan suhbatlari |
| POST | /api/products/:id/messages | xabar yuborish: `{ "text": "...", "buyerId": "..." }` (`buyerId` muallifdan yuborilganda kerak) |
| POST | /api/products/:id/accept | oxirgi taklifni qabul qilib, mahsulotni sotilgan deb belgilash |
| POST | /api/products/:id/reactivate | qayta faollashtirish |
| DELETE | /api/products/:id | o'chirish (soft) |
| POST | /api/products/:id/ban-buyer | Muallif: mahsulotga kirishni ma'lum foydalanuvchidan man etish (body: { buyerId, reason }) — agar foydalanuvchi 5 ta mahsulotdan bloklansa, avtomatik global block (10 kun) qo'llanadi |
| POST | /api/products/:id/report | Foydalanuvchi mahsulot haqida bir marta xabar beradi; 5 ta noyob xabarda mahsulot soft-delete qilinib, muallif 5 kunga bloklanadi |

## Socket.io hodisalari

Mijoz yuboradi: `feed:join`, `feed:leave`, `product:join`, `product:leave`, `bid:place`, `chat:join`, `chat:leave`, `chat:watch`
Server yuboradi: `bid:new`, `product:updated`, `product:created`, `product:extended`, `product:ended`, `product:reactivated`, `product:removed`, `chat:new`, `chat:inbox:new`

Yozishmalar faqat tizimga kirgan xaridor va mahsulot muallifiga ko'rinadi. Tizimga kirgan foydalanuvchi yuqoridagi **Chatlar** bo'limida barcha mahsulotlar bo'yicha suhbatlarini ko'radi; har bir suhbatda u tegishli mahsulotga o'tishi mumkin. Yangi xabarlar suhbat ro'yxatini real vaqtda yangilaydi; sotilgan mahsulot umumiy mahsulotlar ro'yxatidan chiqariladi.

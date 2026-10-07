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

## Qoidalar (backend/src/config/constants.js)

- Minimal boshlang'ich narx: 50 000 so'm
- Har bir yangi taklif oldingisidan kamida 1 000 so'm ko'p
- Standart muddat 5 kun; taklif bo'lmasa bir marta +2 kun
- Muddat tugagach: taklif bor bo'lsa `sold`, yo'q bo'lsa `expired`
- Muallifda nofaol mahsulot qoladi, "Qayta faollashtirish" tugmasi bilan yangidan boshlanadi
- O'chirish soft delete: bazada `isDeleted: true` bo'lib qoladi

## API

| Metod | Yo'l | Izoh |
|---|---|---|
| POST | /api/auth/register/code | Ro'yxatdan o'tish ma'lumotlari bilan email tasdiqlash kodini yuborish |
| POST | /api/auth/register/resend | `{ "email": "..." }` bilan yangi tasdiqlash kodi yuborish |
| POST | /api/auth/register/verify | Ro'yxatdan o'tish ma'lumotlari va `{ "code": "123456" }` bilan tasdiqlash |
| POST | /api/auth/google | Google ID tokenini tekshirib, tizimga kiritish yoki akkaunt yaratish |
| POST | /api/auth/login | identifier (username yoki email), password |
| GET | /api/auth/me | joriy foydalanuvchi |
| PUT | /api/users/me | profil: firstName, lastName, username, bio, phone, avatar (multipart) |
| GET | /api/products | faol mahsulotlar (q, sort, page, limit) |
| GET | /api/products/mine | mening mahsulotlarim (faol va nofaol) |
| POST | /api/products | mahsulot joylash (telefon majburiy, multipart, images) |
| PUT | /api/products/:id | mahsulotni tahrirlash: title, description, durationDays, startingPrice (faqat birinchi taklif yo'q bo'lsa), images, removeImages (URL MongoDB'dan o'chadi, fayl diskda qoladi) |
| GET | /api/products/:id | mahsulot va takliflar tarixi |
| GET | /api/products/:id/messages | xaridorning o'z suhbati yoki muallif uchun `?buyerId=...` |
| GET | /api/products/:id/conversations | mahsulot muallifining xaridorlar bilan suhbatlari |
| POST | /api/products/:id/messages | xabar yuborish: `{ "text": "...", "buyerId": "..." }` (`buyerId` muallifdan yuborilganda kerak) |
| POST | /api/products/:id/accept | oxirgi taklifni qabul qilib, mahsulotni sotilgan deb belgilash |
| POST | /api/products/:id/reactivate | qayta faollashtirish |
| DELETE | /api/products/:id | o'chirish (soft) |

## Socket.io hodisalari

Mijoz yuboradi: `feed:join`, `feed:leave`, `product:join`, `product:leave`, `bid:place`, `chat:join`, `chat:leave`, `chat:watch`
Server yuboradi: `bid:new`, `product:updated`, `product:created`, `product:extended`, `product:ended`, `product:reactivated`, `product:removed`, `chat:new`, `chat:inbox:new`

Yozishmalar faqat tizimga kirgan xaridor va mahsulot muallifiga ko'rinadi. Muallif har bir mahsulotdagi xaridorlar suhbatlarini real vaqtda ko'radi; sotilgan mahsulot umumiy mahsulotlar ro'yxatidan chiqariladi.

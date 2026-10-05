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

Frontend va backend turli serverlarda ishlasa, `VITE_BACKEND` ni frontend
servisining build/deploy environment sozlamasida backendning ommaviy URL
manziliga sozlang (`backend/.env` ichiga emas):

```
VITE_BACKEND=https://api.example.com
```

Bu bitta sozlama HTTP API, yuklangan fayllar va Socket.IO ulanishlarida ishlatiladi.
Vite bu o'zgaruvchini build vaqtida o'qiydi; manzil o'zgarganda frontendni qayta
build/deploy qiling. URL faqat origin bo'lishi kerak (masalan, `/api` qo'shmang).
`VITE_BACKEND` bo'lmasa production build noto'g'ri sozlamali deploy hosil qilmaslik
uchun xato bilan to'xtaydi.

Lokal ishga tushirishda `VITE_BACKEND` ni ko'rsatmasangiz, frontend API va
Socket.IO so'rovlarini Vite proksisi orqali `http://localhost:5000` ga uzatadi.
Backend boshqa portda bo'lsa, frontend papkasidagi `.env` fayliga
`VITE_BACKEND=http://localhost:<port>` yozing.

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

Nomlar boshqacha bo'lsa, `backend/src/config/env.js` ni moslang.

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
| POST | /api/auth/register | firstName, lastName, email, birthDate, password, username (ixtiyoriy) |
| POST | /api/auth/login | identifier (username yoki email), password |
| GET | /api/auth/me | joriy foydalanuvchi |
| PUT | /api/users/me | profil: firstName, lastName, bio, phone, avatar (multipart) |
| GET | /api/products | faol mahsulotlar (q, sort, page, limit) |
| GET | /api/products/mine | mening mahsulotlarim (faol va nofaol) |
| POST | /api/products | mahsulot joylash (telefon majburiy, multipart, images) |
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

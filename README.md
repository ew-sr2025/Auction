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

Backend porti 5000 dan boshqa bo'lsa (`.env` dagi PORT):
`VITE_BACKEND=http://localhost:4000 npm run dev`

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

const http = require('http');
const { port } = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');
const initSocket = require('./sockets');
const { startAuctionScheduler } = require('./jobs/auctionScheduler');

(async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = require('socket.io')(http, {
    cors: {
      origin: "https://auction-8qw6.onrender.com", // Render'dagi frontend manzilingiz
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  app.set('io', io); // controllerlarda: req.app.get('io')

  startAuctionScheduler(io);

  server.listen(port, () => console.log(`Server ${port}-portda ishlayapti`));
})().catch((err) => {
  console.error('Ishga tushmadi:', err.message);
  process.exit(1);
});

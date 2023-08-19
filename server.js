'use strict';
const routes = require('./routes.js');
const auth = require('./auth.js');
require('dotenv').config();
const bcrypt = require('bcrypt')
const express = require('express');
const myDB = require('./connection');
const fccTesting = require('./freeCodeCamp/fcctesting.js');
const session = require('express-session');
const passport = require('passport');
const { ObjectID } = require('mongodb');
const LocalStrategy = require('passport-local');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const passportSocketIo = require('passport.socketio')
const MongoStore = require('connect-mongo')(session)
const cookieParser = require('cookie-parser')
const URI = process.env.MONGO_URI;
const store = new MongoStore({ url: URI });

app.set('view engine', 'pug');
app.set('views', './views/pug');

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false },
  key: 'express.sid',
  store: store
}));

app.use(passport.initialize());
app.use(passport.session());

fccTesting(app); // For fCC testing purposes
app.use('/public', express.static(process.cwd() + '/public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

io.use(
  passportSocketIo.authorize({
    cookieParser: cookieParser,
    key: 'express.sid',
    secret: process.env.SESSION_SECRET,
    store: store,
    success: onAuthorizeSuccess,
    fail: onAuthorizeFail
  })
);

myDB(async client => {
  const myDataBase = await client.db('database').collection('users');
  routes(app, myDataBase);
  auth(app, myDataBase);
  
  let currentUsers = 0;
  io.on('connection', socket => {
    ++currentUsers;
    io.emit('user', {
      username: socket.request.user.username,
      currentUsers,
      connected: true
    });
    socket.on('chat message', (message) => {
      io.emit('chat message', { username: socket.request.user.username, message });
    });
    console.log('A user has connected');
    socket.on('disconnect', () => {
      --currentUsers;
      io.emit('user count', currentUsers);
          });
  });
}).catch(e => {
  app.route('/').get((req, res) => {
    res.render('index', { title: e, message: 'Unable to connect to database' });
  });
});
  
function onAuthorizeSuccess(data, accept) {
  console.log('successful connection to socket.io');
  console.log('user ' + socket.request.user.username + ' connected');
  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept) {
  if (error) throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});



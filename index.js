const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const request = require('request');
const bodyParser = require('body-parser');
const http    = require("http");
const { Issuer,Strategy } = require('openid-client');

const path = require("path");

const app = express();

app.use(cookieParser());
app.use(express.urlencoded({
  extended: true,
}));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

app.use(express.json({ limit: '15mb' }));
app.use(session({secret: 'secret', 
                 resave: false, 
                 saveUninitialized: true,}));
app.use(helmet());
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
  console.log('-----------------------------');
  console.log('serialize user');
  console.log(user);
  console.log('-----------------------------');
  done(null, user);
});

passport.deserializeUser((user, done) => {
  console.log('-----------------------------');
  console.log('deserialize user');
  console.log(user);
  console.log('-----------------------------');
  done(null, user);
});

Issuer.discover('http://127.0.0.1:8200/v1/identity/oidc/provider/test').then((oidcIssuer) => {
  var client = new oidcIssuer.Client({
    client_id: '3Ev8oYCDNohMIQhwiKqBq1KN2rknYq64',
    client_secret: 'hvo_secret_QtKTaRSpM3bGXTr0N4eQjmixCQVphz4oSrBmCcU9T6tXpB7sEMEk6uHYjVWGMWIm',
    redirect_uris: ["http://127.0.0.1:8080/login/callback"],
    // redirect_uris: ["https://oidcdebugger.com/debug"],
    response_types: ['code'],
  });

  passport.use(
    'oidc',
    new Strategy({ client, passReqToCallback: true, usePKCE: true }, (req, tokenSet, userinfo, done) => {
      console.log("tokenSet", tokenSet);
      console.log("userinfo", userinfo);
      req.session.tokenSet = tokenSet;
      req.session.userinfo = userinfo;
      return done(null, tokenSet.claims());
    })
  );
});

passport.use(new LocalStrategy(function verify(username, password, cb){
  const vaultUrl = `http://127.0.0.1:8200/v1/auth/userpass/login/${username}`
  const requestBody = {}
  requestBody.password = password

  request.post({ 
    headers: {'content-type' : 'application/json'},
    url: vaultUrl,
    body: requestBody,
    json: true
  }, function(error, response, body){
    if (error) { return cb(error) }
    console.log(body)
    if (body.errors) { return cb(null, false, { message: body.errors }) }

    const user = {}
    user.sub = body.auth.entity_id
    user.username = body.auth.metadata.username
  
    return cb(null, user)
  }); 
}));

app.get('/login-oidc', (req, res, next) => {
    console.log('-----------------------------');
    console.log('/Start oidc login handler');
    next();
  },
  passport.authenticate('oidc',{scope:"openid"}
));

app.get('/login/callback',(req,res,next) =>{
  console.log('-----------------------------');
  console.log('/Callback');
  passport.authenticate('oidc',{ successRedirect: '/user', failureRedirect: '/' })(req, res, next)
})

app.post('/login-userpass', passport.authenticate('local',{ successRedirect: '/user', failureRedirect: '/'}))

app.get("/",(req,res) =>{
  res.send(`
  <hr>
  <h2><a href='/login-oidc'>Log In with OAuth 2.0 Provider </a></h2>
  <br>
  <hr>
  <br>
  <form action="/login-userpass" method="post">
    <section>
      <label for="username">Username</label>
      <input id="username" name="username" type="text" autocomplete="username" required autofocus>
    </section>
    <br>
    <section>
      <label for="current-password">Password</label>
      <input id="current-password" name="password" type="password" autocomplete="current-password" required>
    </section>
    <button type="submit">Sign in</button>
  </form>
  `)
})

app.get ("/user",(req,res) =>{
    res.header("Content-Type",'application/json');
    console.log(req.session);
    res.end(JSON.stringify({tokenset:req.session.passport},null,2));
})

const httpServer = http.createServer(app)
//const server= https.createServer(options,app).listen(3003);
httpServer.listen(8080,() =>{
    console.log(`Http Server Running on`)
    console.log(`http://127.0.0.1:8080`)
})
const express = require('express');
const openid = require('openid-client');
const cookieParser = require('cookie-parser');

const app = express();

app.set('view engine', 'jade');
app.use(cookieParser());

app.use(async (req, res, next) => {
  if (res.app.get('client') === undefined) {
    // Humanode Issuer a.k.a. Identity provider.
    const humanodeIssuer = await openid.Issuer.discover(
      'https://auth.staging.oauth2.humanode.io'
    );

    // Set up the common hackathon client.
    const client = new humanodeIssuer.Client({
      client_id: 'hackathon-participant',
      client_secret: 'q4_GkveX47i3M9wYXSkU5CKn3h',
      redirect_uris: ['http://localhost:3000/callback'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post'
    });

    // Save client configuration for later use.
    res.app.set('client', client);
  }
  next();
});

app.get('/', (req, res) => {
  const name = req.cookies.jwtSet ? 'user' : 'guest';
  /*
  Humanode NFT Minter
   - If authentication was successful, it would have passed the NFT smart contract control mechanism
   - We will still run a test against the cookie to ensure again
   - showmintbtn true will then show the MINT button on frontend 
  */ 
  let showmintbtn = 'false';
  if(name == 'user'){
    const jwtSet = req.cookies.jwtSet ? new openid.TokenSet(req.cookies.jwtSet) : undefined;
    showmintbtn = (req.cookies.jwtSet && jwtSet.claims().aud.includes('hackathon-participant') && jwtSet.claims().iss === 'https://auth.staging.oauth2.humanode.io/') ? 'true' : 'false';
  }
  res.render('index', {
    name, showmintbtn
  });
});

app.get('/login', async (req, res) => {
  // Get OAuth 2 client.
  const client = res.app.get('client');

  // Set up codeVerifier and save it as a cookie for later use.
  const codeVerifier = openid.generators.codeVerifier(64);
  res.cookie('codeVerifier', codeVerifier, { maxAge: 360000 });

  // Set up codeChallenge for login flow.
  const codeChallenge = openid.generators.codeChallenge(codeVerifier);

  // Get the redirect URI.
  const redirectUri = client.authorizationUrl({
    scope: 'openid',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: 'some-state'
  });

  // Redirect end-user to Humanode login page.
  // After the login flow user will be redirected to our callback URI.
  res.redirect(redirectUri);
});

app.get('/callback', async (req, res) => {
  // Get codeVerifier and client.
  const { codeVerifier } = req.cookies;
  const client = res.app.get('client');

  // Get callback params with auth code.
  const params = client.callbackParams(req);

  // If callback params have an error instead of auth code
  // render error page with description.
  if ('error' in params) {
    res.render('error', { errorDescription: params.error_description });
    return;
  }

  // Exchange auth code for JWT token.
  const tokenSet = await client.callback('http://localhost:3000/callback', params, { state: 'some-state', code_verifier: codeVerifier });
  // Save JWT.
  res.cookie('jwtSet', tokenSet, { maxAge: 360000 });

  /*
  Humanode NFT Minter
   - Run a call to NFT smart contract and check if current user's wallet is already holding max amount of NFT (if this is a desired control) 
   - If pass the smart contract control checks, render the MINT button on main page 
  */ 
  // Save showMintButton (for this demo. with assumption that smart contract control checks are passed.) 
  res.cookie('showMintButton', tokenSet, { maxAge: 360000 });

  // Redirect end-user to root route.
  res.redirect('/');
});

app.listen(3000, () => {
  console.log('App listening on port 3000!');
});

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();

app.use(express.json());

// ✅ FIX CORS (VERY IMPORTANT)
app.use(cors({
  origin: 'https://kendieasykenyafashionglobe.blogspot.com'
}));

// ✅ TEST ROUTE (so you don’t see "Cannot GET /")
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// 🔐 PayPal credentials (from Render ENV)
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;

// 🔑 Get PayPal access token
async function getAccessToken() {
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ":" + SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  const data = await res.json();
  return data.access_token;
}

// 💳 CREATE PAYPAL ORDER
app.post('/create-paypal-order', async (req, res) => {
  try {
    const { region, quantity } = req.body;

    let price = 0;

    if (region === 'USA') price = 29;
    if (region === 'Canada') price = 40;
    if (region === 'Rest') price = 49;

    const total = (price * quantity).toFixed(2);

    const accessToken = await getAccessToken();

    const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: 'USD',
            value: total
          }
        }]
      })
    });

    const data = await response.json();

    res.json({ id: data.id });

  } catch (err) {
    console.error(err);
    res.status(500).send('Error creating PayPal order');
  }
});

// 💰 CAPTURE PAYMENT
app.post('/capture-paypal-order', async (req, res) => {
  try {
    const { orderID } = req.body;

    const accessToken = await getAccessToken();

    const response = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    console.log("✅ PAYMENT SUCCESS:", data);

    // 🔥 NEXT STEP: send to Printify (we add after this works)

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing payment');
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json());

// ✅ CORS FIX (keep yours)
app.use(cors({
  origin: 'https://kendieasykenyafashionglobe.blogspot.com'
}));

// ✅ TEST ROUTE
app.get('/', (req, res) => {
  res.send('Backend is LIVE 🚀');
});

// 🔐 ENV VARIABLES
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.SHOP_ID;

// 📧 EMAIL SETUP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 🔑 GET PAYPAL TOKEN (🔥 NOW LIVE NOT SANDBOX)
async function getAccessToken() {
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
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

// 💳 CREATE ORDER
app.post('/create-paypal-order', async (req, res) => {
  try {
    const { region, quantity } = req.body;

    let price = 0;

    if (region === 'USA') price = 29;
    if (region === 'Canada') price = 40;
    if (region === 'Rest') price = 49;

    const total = (price * quantity).toFixed(2);

    const accessToken = await getAccessToken();

    const response = await fetch('https://api-m.paypal.com/v2/checkout/orders', {
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

// 💰 CAPTURE + PRINTIFY + EMAIL
app.post('/capture-paypal-order', async (req, res) => {
  try {
    const { orderID, region, quantity } = req.body;

    const accessToken = await getAccessToken();

    // 🔥 CAPTURE PAYMENT
    const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    console.log("✅ PAYMENT SUCCESS:", data);

    // =========================
    // 📦 PRINTIFY ORDER
    // =========================

    let productId = '';
    let variantId = '';

    if (region === 'USA') {
      productId = '69bfface47c38225cd091007';
      variantId = 104692;
    }

    if (region === 'Canada') {
      productId = '69c0387f77c22d11f40f29cf';
      variantId = 65216;
    }

    if (region === 'Rest') {
      productId = '69c037ae4a734703850466a8';
      variantId = 65216;
    }

    await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        line_items: [{
          product_id: productId,
          variant_id: variantId,
          quantity: quantity
        }],
        send_shipping_notification: true
      })
    });

    // =========================
    // 📧 EMAIL NOTIFICATION
    // =========================

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "🛒 New Order!",
      text: `New Order Received!

Region: ${region}
Quantity: ${quantity}

Order ID: ${orderID}`
    });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing payment');
  }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

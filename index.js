const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());

app.use(cors({
  origin: 'https://kendieasykenyafashionglobe.blogspot.com'
}));

app.get('/', (req, res) => {
  res.send('Backend is LIVE 🚀');
});

// 🔐 ENV
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_SECRET;
const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.SHOP_ID;
const WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID;

// 📊 MEMORY DATABASE (NEW)
let orders = [];

// 📧 EMAIL
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 🔑 PAYPAL TOKEN
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

// 💰 CAPTURE + LOG + PRINTIFY
app.post('/capture-paypal-order', async (req, res) => {
  try {
    const { orderID, region, quantity } = req.body;

    const accessToken = await getAccessToken();

    const response = await fetch(`https://api-m.paypal.com/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    // 💰 CALCULATE PROFIT (NEW)
    let price = region === 'USA' ? 29 : region === 'Canada' ? 40 : 49;
    let revenue = price * quantity;
    let cost = revenue * 0.7;
    let profit = revenue - cost;

    // 📊 SAVE ORDER (NEW)
    orders.push({
      orderID,
      region,
      quantity,
      revenue,
      cost,
      profit,
      date: new Date()
    });

    // 📦 PRINTIFY
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

    // 📧 EMAIL
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "🛒 New Order!",
      text: `Order ID: ${orderID}
Region: ${region}
Quantity: ${quantity}
Revenue: $${revenue}
Profit: $${profit}`
    });

    res.json(data);

  } catch (err) {
    console.error(err);
    res.status(500).send('Error capturing payment');
  }
});

// 🔒 PAYPAL WEBHOOK (NEW)
app.post('/paypal-webhook', (req, res) => {
  const event = req.body;

  // Basic event filter
  if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
    console.log("✅ Webhook confirmed order:", event.resource.id);
  }

  res.sendStatus(200);
});

// 📊 DASHBOARD DATA (NEW)
app.get('/dashboard-data', (req, res) => {
  let totalOrders = orders.length;
  let totalRevenue = orders.reduce((sum, o) => sum + o.revenue, 0);
  let totalProfit = orders.reduce((sum, o) => sum + o.profit, 0);

  // 📈 Daily revenue
  let daily = {};
  orders.forEach(o => {
    let day = o.date.toISOString().split('T')[0];
    daily[day] = (daily[day] || 0) + o.revenue;
  });

  // 📦 Product analytics
  let products = {};
  orders.forEach(o => {
    products[o.region] = products[o.region] || { sales: 0, revenue: 0 };
    products[o.region].sales += o.quantity;
    products[o.region].revenue += o.revenue;
  });

  res.json({
    totalOrders,
    totalRevenue,
    totalProfit,
    orders,
    dailyRevenue: daily,
    productAnalytics: products
  });
});

// 🚀 START
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const PRICES = { USA: 29, Canada: 40, Rest: 49 };
const COSTS  = { USA: 6.51, Canada: 4.99, Rest: 4.99 };

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.SHOP_ID;

// Nodemailer for Gmail alerts
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// Set sandbox or live
const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com'; // sandbox first

// Create PayPal order
app.post('/create-paypal-order', async (req, res) => {
  try {
    const { productId, variantId, quantity, region } = req.body;
    const price = PRICES[region];

    const response = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET).toString('base64')}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          amount: { currency_code: "USD", value: (price*quantity).toFixed(2) },
          custom_id: `${productId}|${variantId}|${quantity}|${region}`
        }]
      })
    });

    const data = await response.json();
    console.log('PayPal create-order response:', data);

    if (!data.id) return res.status(400).json({ error: 'Failed to create PayPal order' });
    res.json({ id: data.id });

  } catch(err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PayPal webhook
app.post('/paypal-webhook', async (req,res) => {
  try {
    const event = req.body;
    if(!event || !event.event_type.includes('CHECKOUT.ORDER')) return res.sendStatus(200);

    const resource = event.resource;
    const [productId, variantId, quantity, region] = resource.purchase_units[0].custom_id.split('|');
    const price = PRICES[region];
    const cost  = COSTS[region]*quantity;
    const profit = price*quantity - cost;

    const shipping = resource.purchase_units[0].shipping;

    const orderData = {
      line_items: [{ variant_id: variantId, quantity: +quantity, retail_price: price.toString() }],
      shipping_address: {
        name: shipping.name.full_name,
        address1: shipping.address.address_line_1,
        city: shipping.address.admin_area_2,
        country: shipping.address.country_code,
        zip: shipping.address.postal_code
      }
    };

    await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
      method:'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify(orderData)
    });

    // Send Gmail notification
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'New Order Received!',
      text:`${shipping.name.full_name} bought ${quantity} units of ${productId} from ${region}. Revenue: $${price*quantity}, Profit: $${profit}`
    });

    res.sendStatus(200);

  } catch(err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Render server running'));

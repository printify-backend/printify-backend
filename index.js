require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.SHOP_ID;

// Region prices
const PRICES = {
  USA: 29.00,
  Canada: 40.00,
  Rest: 49.99
};

// Endpoint to handle order
app.post('/order', async (req, res) => {
  try {
    const { productId, variantId, region, quantity, customer } = req.body;

    // Set price for region
    const price = PRICES[region] || PRICES['Rest'];

    // 1. Here you would process payment using Stripe/PayPal
    // For now, we simulate success
    const paymentSuccess = true;

    if (!paymentSuccess) return res.status(400).send('Payment failed');

    // 2. Create Printify order
    const orderData = {
      line_items: [
        {
          variant_id: variantId,
          quantity: quantity || 1,
          retail_price: price.toString()
        }
      ],
      shipping_address: customer, // object with name, address, city, country, etc.
      send_shipping_notification: true
    };

    const response = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PRINTIFY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const result = await response.json();

    res.send({ success: true, order: result });

  } catch (error) {
    console.error(error);
    res.status(500).send({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.send('Custom payout server running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

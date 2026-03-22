const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Middleware
app.use(express.json());

// Use your Render environment variable
const PRINTIFY_API_KEY = process.env.BLOGGER_BACKEND;

// Route: Create Order
app.post("/create-order", async (req, res) => {
  try {
    const { product_id, variant_id, quantity, customer } = req.body;

    const response = await fetch("https://api.printify.com/v1/orders.json", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PRINTIFY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        line_items: [{ product_id, variant_id, quantity }],
        shipping_method: 1,
        send_shipping_notification: true,
        address_to: customer
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Get Variants for a Product
app.get("/get-variants/:productId", async (req, res) => {
  try {
    const { productId } = req.params;

    const response = await fetch(
      `https://api.printify.com/v1/products/${productId}.json`,
      {
        headers: {
          "Authorization": `Bearer ${PRINTIFY_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();
    res.json(data.variants); // returns all variants

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Health check
app.get("/", (req, res) => {
  res.send("Printify backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

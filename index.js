const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors"); // ✅ ADD THIS
const app = express();

// Middleware
app.use(cors()); // ✅ ADD THIS
app.use(express.json());

// Use your Render environment variables
const PRINTIFY_API_KEY = process.env.BLOGGER_BACKEND;
const SHOP_ID = process.env.PRINTIFY_SHOP_ID;

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

// Route: Get Variants
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
    res.json(data.variants);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Route: Create Product
app.post("/create-product", async (req, res) => {
  try {
    const { title, description, blueprint_id, print_provider_id, variants } = req.body;

    if (!title || !description || !blueprint_id || !print_provider_id || !variants) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const response = await fetch(
      `https://api.printify.com/v1/shops/${SHOP_ID}/products.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PRINTIFY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title,
          description,
          blueprint_id,
          print_provider_id,
          variants
        })
      }
    );

    const data = await response.json();

    if (data.id) {
      res.json({
        message: "Product created successfully!",
        product_id: data.id,
        variants: data.variants
      });
    } else {
      res.status(500).json({ error: data });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Printify backend is running 🚀");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

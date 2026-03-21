const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());
const PRINTIFY_API_KEY = process.env.BLOGGER_BACKEND;
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
        line_items: [{
          product_id,
          variant_id,
          quantity
        }],
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

app.get("/", (req, res) => {
  res.send("Printify backend is running 🚀");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));

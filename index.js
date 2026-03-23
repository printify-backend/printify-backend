const express = require("express");
const fetch = require("node-fetch");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
app.use(express.json());

const PRICES = {
  USA: { price: 29, productId: "69bfface47c38225cd091007", variantId: 104692 },
  Canada: { price: 40, productId: "69c0387f77c22d11f40f29cf", variantId: 65216 },
  ROW: { price: 49, productId: "69c037ae4a734703850466a8", variantId: 65216 }
};

async function getAccessToken(){
  const res = await fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token", {
    method:"POST",
    headers:{
      "Authorization": "Basic " + Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET).toString("base64"),
      "Content-Type":"application/x-www-form-urlencoded"
    },
    body:"grant_type=client_credentials"
  });

  const data = await res.json();
  return data.access_token;
}

app.post("/create-paypal-order", async (req,res)=>{
  const {region, quantity} = req.body;
  const item = PRICES[region];

  const total = item.price * quantity;

  const token = await getAccessToken();

  const response = await fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${token}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      intent:"CAPTURE",
      purchase_units:[{
        amount:{currency_code:"USD", value: total}
      }]
    })
  });

  const data = await response.json();
  res.json(data);
});

app.post("/capture-paypal-order", async (req,res)=>{
  const {orderID, region, quantity} = req.body;
  const item = PRICES[region];

  const token = await getAccessToken();

  await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderID}/capture`,{
    method:"POST",
    headers:{ "Authorization":`Bearer ${token}` }
  });

  // SEND TO PRINTIFY
  await fetch(`https://api.printify.com/v1/shops/${process.env.SHOP_ID}/orders.json`,{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${process.env.PRINTIFY_API_KEY}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      line_items:[{
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: quantity
      }],
      shipping_method:1,
      send_shipping_notification:true,
      address_to:{
        first_name:"Customer",
        last_name:"Buyer",
        email:"customer@email.com",
        country:"US"
      }
    })
  });

  // EMAIL
  const transporter = nodemailer.createTransport({
    service:"gmail",
    auth:{
      user:process.env.EMAIL_USER,
      pass:process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from:process.env.EMAIL_USER,
    to:process.env.EMAIL_USER,
    subject:"New Order",
    text:`Region: ${region} Qty: ${quantity}`
  });

  res.json({status:"done"});
});

app.get("/", (req,res)=> res.send("Backend running"));

app.listen(process.env.PORT || 10000);

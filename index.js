require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
app.use(bodyParser.json());

const PRINTIFY_API_KEY = process.env.PRINTIFY_API_KEY;
const SHOP_ID = process.env.SHOP_ID;

const PRICES = { USA:29, Canada:40, Rest:49 };
const COSTS = { USA:6.51, Canada:4.99, Rest:4.99 };

const transporter = nodemailer.createTransport({
  service:'gmail',
  auth:{ user:'euncandy206@gmail.com', pass:process.env.EMAIL_PASS }
});

app.post('/create-paypal-order', async (req,res)=>{
  const {productId,variantId,quantity,region} = req.body;
  const price = PRICES[region];

  const response = await fetch('https://api-m.paypal.com/v2/checkout/orders',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'Authorization':`Basic ${Buffer.from(process.env.PAYPAL_CLIENT_ID+":"+process.env.PAYPAL_SECRET).toString('base64')}`
    },
    body: JSON.stringify({
      intent:"CAPTURE",
      purchase_units:[{
        amount:{currency_code:"USD",value:(price*quantity).toFixed(2)},
        custom_id:`${productId}|${variantId}|${quantity}|${region}`
      }]
    })
  });

  const data = await response.json();
  res.send({id:data.id});
});

app.post('/paypal-webhook', async (req,res)=>{
  const event = req.body;
  if(event.event_type !== 'CHECKOUT.ORDER.APPROVED') return res.sendStatus(200);

  const resource = event.resource;
  const [productId,variantId,quantity,region] =
  resource.purchase_units[0].custom_id.split('|');

  const price = PRICES[region];
  const cost = COSTS[region]*quantity;
  const profit = price*quantity - cost;

  const shipping = resource.purchase_units[0].shipping;

  const orderData = {
    line_items:[{variant_id:variantId,quantity:+quantity,retail_price:price.toString()}],
    shipping_address:{
      name: shipping.name.full_name,
      address1: shipping.address.address_line_1,
      city: shipping.address.admin_area_2,
      country: shipping.address.country_code,
      zip: shipping.address.postal_code
    }
  };

  await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`,{
    method:'POST',
    headers:{
      'Authorization':`Bearer ${PRINTIFY_API_KEY}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify(orderData)
  });

  const record = {date:new Date(),productId,quantity,region,price,profit,customer:shipping.name.full_name};
  fs.appendFileSync('orders.txt',JSON.stringify(record)+'\n');

  await transporter.sendMail({
    from:'euncandy206@gmail.com',
    to:'euncandy206@gmail.com',
    subject:'New Order',
    text:`${shipping.name.full_name} bought ${quantity}`
  });

  res.sendStatus(200);
});

app.get('/dashboard-data',(req,res)=>{
  if(!fs.existsSync('orders.txt')) return res.send({totalOrders:0,totalRevenue:0,totalProfit:0,orders:[],products:{}});
  const lines = fs.readFileSync('orders.txt','utf8').trim().split('\n');

  let revenue=0, profit=0;
  const products={};

  const orders = lines.map(l=>{
    const o=JSON.parse(l);
    revenue+=o.price*o.quantity;
    profit+=o.profit;

    if(!products[o.productId]) products[o.productId]={sales:0,revenue:0};
    products[o.productId].sales+=o.quantity;
    products[o.productId].revenue+=o.price*o.quantity;

    return o;
  });

  res.send({totalOrders:orders.length,totalRevenue:revenue,totalProfit:profit,orders:orders.reverse(),products});
});

app.listen(3000,()=>console.log("LIVE"));

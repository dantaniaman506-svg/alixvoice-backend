const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/create-checkout', async (req, res) => {
  try {
    const { user_id, plan_name, plan_price } = req.body;

    const productIds = {
      trial: process.env.DODO_TRIAL_PRODUCT_ID,
      starter: process.env.DODO_STARTER_PRODUCT_ID,
      pro: process.env.DODO_PRO_PRODUCT_ID,
      elite: process.env.DODO_ELITE_PRODUCT_ID,
    };

    const response = await axios.post(
      'https://test.dodopayments.com/subscriptions',
      {
        billing: {
          city: "New York",
          country: "US",
          state: "NY",
          street: "123 Main St",
          zipcode: "10001"
        },
        customer: {
          email: "test@test.com",
          name: "Test User"
        },
        product_id: productIds[plan_name],
        quantity: 1,
        payment_link: true,
        metadata: {
          user_id,
          plan_name
        },
        return_url: 'https://alixvoice-ai.vercel.app/dashboard'
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DODO_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ checkout_url: response.data.payment_link });

  } catch (error) {
    console.error('Checkout error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
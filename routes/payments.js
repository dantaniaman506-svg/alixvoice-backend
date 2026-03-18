const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.post('/create-checkout', async (req, res) => {
  try {
    const { user_id, plan_name } = req.body;

    const { data: userData } = await supabase.auth.admin.getUserById(user_id);
    const userEmail = userData?.user?.email || 'customer@example.com';
    const userName = userData?.user?.user_metadata?.full_name || 'Customer';

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
          email: userEmail,
          name: userName,
        },
        product_id: productIds[plan_name],
        quantity: 1,
        payment_link: true,
        metadata: {
          user_id,
          plan_name
        },
        return_url: 'return_url: 'https://alixvoice-ai.vercel.app/pricing-select?payment_status=succeeded'
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
    console.error('Full error:', JSON.stringify(error.response?.data));
    console.error('Status:', error.response?.status);
    res.status(500).json({ 
      error: error.message,
      details: error.response?.data 
    });
  }
});

module.exports = router;

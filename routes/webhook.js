const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Dodo Payment Webhook
router.post('/dodo', async (req, res) => {
  try {
    const { data } = req.body;
    
    if (data.type === 'payment.succeeded') {
      const { user_id, plan_name, amount } = data.attributes;
      
      // Order save karo
      await supabase.from('orders').insert({
        user_id,
        plan_name,
        amount,
        payment_status: 'paid',
        provider_order_id: data.id
      });

      // User ka plan update karo
      let minutes = 20;
      if (plan_name === 'starter') minutes = 120;
      if (plan_name === 'pro') minutes = 300;
      if (plan_name === 'elite') minutes = 700;

      await supabase.from('users').update({
        subscription_plan: plan_name,
        minutes_total: minutes
      }).eq('id', user_id);

      // Auto setup trigger karo
      await axios.post(`${process.env.BACKEND_URL}/telnyx/buy-number`, {
        user_id
      });

      await axios.post(`${process.env.BACKEND_URL}/elevenlabs/create-agent`, {
        user_id
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

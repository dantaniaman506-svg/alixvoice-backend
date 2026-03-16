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
    const event = req.body;

    // Payment success hone pe
    if (event.type === 'payment.succeeded' || 
        event.type === 'subscription.created') {
      
      const user_id = event.data.metadata?.user_id;
      const plan_name = event.data.metadata?.plan_name;
      const amount = event.data.amount / 100;

      if (!user_id) {
        return res.json({ success: true });
      }

      // Minutes set karo plan ke hisaab se
      let minutes = 20;
      if (plan_name === 'starter') minutes = 120;
      if (plan_name === 'pro') minutes = 300;
      if (plan_name === 'elite') minutes = 700;

      // Order save karo
      await supabase.from('orders').insert({
        user_id,
        plan_name: plan_name || 'trial',
        amount,
        payment_status: 'paid',
        provider_order_id: event.data.id
      });

      // User ka plan update karo
      await supabase.from('users').update({
        subscription_plan: plan_name || 'trial',
        minutes_total: minutes,
        minutes_used: 0
      }).eq('id', user_id);

      // Telnyx se number kharido
      await axios.post(
        `${process.env.BACKEND_URL}/telnyx/buy-number`,
        { user_id }
      );

    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
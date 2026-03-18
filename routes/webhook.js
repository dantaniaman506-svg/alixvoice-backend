const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.post('/dodo', async (req, res) => {
  try {
    const event = req.body;
    console.log('Webhook received:', JSON.stringify(event));

    const eventType = event.type || event.event_type;

    if (
      eventType === 'payment.succeeded' ||
      eventType === 'subscription.created' ||
      eventType === 'subscription.active' ||
      eventType === 'payment.succeeded'
    ) {
      const metadata = event.data?.metadata || event.metadata || {};
      const user_id = metadata.user_id;
      const plan_name = metadata.plan_name;
      const amount = (event.data?.amount || event.amount || 0) / 100;

      console.log('User ID:', user_id);
      console.log('Plan:', plan_name);

      if (!user_id) {
        console.log('No user_id found in metadata');
        return res.json({ success: true });
      }

      // Minutes set karo
      let minutes = 20;
      if (plan_name === 'starter') minutes = 120;
      if (plan_name === 'pro') minutes = 300;
      if (plan_name === 'elite') minutes = 700;

      // Order save karo
      const { error: orderError } = await supabase.from('orders').insert({
        user_id,
        plan_name: plan_name || 'trial',
        amount,
        payment_status: 'paid',
        provider_order_id: event.data?.id || event.id
      });

      if (orderError) console.error('Order error:', orderError);

      // User update karo
      const { error: userError } = await supabase.from('users').update({
        subscription_plan: plan_name || 'trial',
        minutes_total: minutes,
        minutes_used: 0
      }).eq('id', user_id);

      if (userError) console.error('User error:', userError);

      // Telnyx number kharido
      try {
        await axios.post(
          `${process.env.BACKEND_URL}/telnyx/buy-number`,
          { user_id }
        );
      } catch (telnyxError) {
        console.error('Telnyx error:', telnyxError.message);
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
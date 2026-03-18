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
    console.log('Webhook type:', event.type);
    console.log('Metadata:', JSON.stringify(event.data?.metadata));

    const eventType = event.type;
    const allowedEvents = [
      'subscription.created',
      'subscription.renewed',
      'subscription.updated',
      'subscription.active',
      'payment.succeeded'
    ];

    if (allowedEvents.includes(eventType)) {
      const metadata = event.data?.metadata || {};
      const user_id = metadata.user_id;
      const plan_name = metadata.plan_name;
      const amount = (event.data?.recurring_pre_tax_amount || 0) / 100;

      console.log('User ID:', user_id);
      console.log('Plan:', plan_name);

      if (!user_id) {
        console.log('No user_id in metadata');
        return res.json({ success: true });
      }

      let minutes = 20;
      if (plan_name === 'trial') minutes = 20;
      if (plan_name === 'starter') minutes = 120;
      if (plan_name === 'pro') minutes = 300;
      if (plan_name === 'elite') minutes = 700;

      // Order save karo
      await supabase.from('orders').insert({
        user_id,
        plan_name: plan_name || 'trial',
        amount,
        payment_status: 'paid',
        provider_order_id: event.data?.subscription_id || event.data?.id
      });

      // User update karo
      await supabase.from('users').update({
        subscription_plan: plan_name || 'trial',
        minutes_total: minutes,
        minutes_used: 0
      }).eq('id', user_id);

      console.log('User updated with', minutes, 'minutes');

      // Telnyx number kharido
      try {
        const telnyxRes = await axios.post(
          `${process.env.BACKEND_URL}/telnyx/buy-number`,
          { user_id }
        );
        console.log('Telnyx success:', telnyxRes.data);
      } catch (telnyxError) {
        console.error('Telnyx error:', telnyxError.response?.data || telnyxError.message);
      }
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
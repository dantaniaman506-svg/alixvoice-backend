const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Appointment book karo
router.post('/book', async (req, res) => {
  try {
    const {
      user_id,
      customer_name,
      customer_phone,
      customer_email,
      service_type,
      service_address,
      appointment_date,
      appointment_time
    } = req.body;

    const { data, error } = await supabase
      .from('appointments')
      .insert({
        user_id,
        customer_name,
        customer_phone,
        customer_email,
        service_type,
        service_address,
        appointment_date,
        appointment_time,
        status: 'confirmed'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, appointment: data });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Appointment cancel karo
router.post('/cancel', async (req, res) => {
  try {
    const { appointment_id } = req.body;

    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointment_id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Appointment reschedule karo
router.post('/reschedule', async (req, res) => {
  try {
    const {
      appointment_id,
      appointment_date,
      appointment_time
    } = req.body;

    await supabase
      .from('appointments')
      .update({
        appointment_date,
        appointment_time,
        status: 'rescheduled'
      })
      .eq('id', appointment_id);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Saari appointments dekho
router.get('/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('user_id', user_id)
      .order('appointment_date', { ascending: true });

    if (error) throw error;

    res.json({ success: true, appointments: data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

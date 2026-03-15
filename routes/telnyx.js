const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Client ke liye phone number kharidna
router.post('/buy-number', async (req, res) => {
  try {
    const { user_id } = req.body;

    // Supabase se user ka area code nikalo
    const { data: user } = await supabase
      .from('users')
      .select('area_code, country')
      .eq('id', user_id)
      .single();

    // Telnyx se available numbers dhundho
    const searchRes = await axios.get(
      'https://api.telnyx.com/v2/available_phone_numbers',
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`
        },
        params: {
          filter: {
            national_destination_code: user.area_code,
            features: ['voice'],
            limit: 1
          }
        }
      }
    );

    const phoneNumber = searchRes.data.data[0].phone_number;

    // Number kharido
    const buyRes = await axios.post(
      'https://api.telnyx.com/v2/phone_numbers',
      {
        phone_number: phoneNumber,
        connection_id: process.env.TELNYX_CONNECTION_ID
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Supabase mein number save karo
    await supabase.from('virtual_numbers').insert({
      user_id,
      phone_number: phoneNumber,
      country: user.country,
      area_code: user.area_code,
      telnyx_number_id: buyRes.data.data.id
    });

    res.json({ success: true, phone_number: phoneNumber });
  } catch (error) {
    console.error('Telnyx error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

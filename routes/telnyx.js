const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

router.post('/inbound-call', async (req, res) => {
  try {
    const calledNumber = req.body.to || req.body.called_number;

    const { data: virtualNumber } = await supabase
      .from('virtual_numbers')
      .select('user_id')
      .eq('phone_number', calledNumber)
      .single();

    if (!virtualNumber) {
      return res.status(404).json({ error: 'Number not found' });
    }

    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', virtualNumber.user_id)
      .single();

    const dynamicPrompt = `
You are ${agent.agent_name}, AI receptionist for ${agent.business_name}.
Business Type: ${agent.business_type}
Location: ${agent.location}
Working Hours: ${agent.working_hours}
Services: ${agent.services}
Emergency: ${agent.emergency_number || 'Not available'}

YOUR JOB:
1. Greet caller warmly
2. Understand their need
3. Book/Reschedule/Cancel appointments
4. Answer basic questions

BOOKING STEPS:
- Ask: service needed, date, time, address
- Collect: full name, phone, email
- Confirm all details before finalizing

RULES:
- Max 2 sentences per response
- One question at a time
- Never make up information
- If unsure: I will have our team call you back

END CALL:
Thank you for choosing ${agent.business_name}. We look forward to serving you.
    `;

    const elevenLabsResponse = await axios.post(
      `https://api.elevenlabs.io/v1/convai/agents/${process.env.ELEVENLABS_AGENT_ID}/call`,
      {
        prompt: dynamicPrompt,
        first_message: `Thank you for calling ${agent.business_name}! How can I help you today?`
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true, data: elevenLabsResponse.data });

  } catch (error) {
    console.error('Inbound call error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/buy-number', async (req, res) => {
  try {
    const { user_id } = req.body;

    const { data: user } = await supabase
      .from('users')
      .select('area_code, country')
      .eq('id', user_id)
      .single();

    const areaCode = user?.area_code || '212';
    const country = user?.country || 'US';

    let phoneNumber = null;

    try {
      const searchRes = await axios.get(
        'https://api.telnyx.com/v2/available_phone_numbers',
        {
          headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
          params: {
            'filter[country_code]': 'US',
            'filter[national_destination_code]': areaCode,
            'filter[features][]': 'voice',
            'filter[limit]': 1
          }
        }
      );
      if (searchRes.data.data?.length > 0) {
        phoneNumber = searchRes.data.data[0].phone_number;
        console.log('Found number for area code:', areaCode);
      }
    } catch (e) {
      console.log('Area code search failed');
    }

    if (!phoneNumber) {
      const anySearch = await axios.get(
        'https://api.telnyx.com/v2/available_phone_numbers',
        {
          headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
          params: {
            'filter[country_code]': 'US',
            'filter[features][]': 'voice',
            'filter[limit]': 1
          }
        }
      );
      if (anySearch.data.data?.length > 0) {
        phoneNumber = anySearch.data.data[0].phone_number;
        console.log('Found any US number:', phoneNumber);
      }
    }

    if (!phoneNumber) {
      return res.status(404).json({ error: 'No numbers available' });
    }

    console.log('Buying number:', phoneNumber);

    // Seedha number buy karo
    const buyRes = await axios.post(
      `https://api.telnyx.com/v2/phone_numbers`,
      {
        phone_number: phoneNumber,
        connection_id: process.env.TELNYX_CONNECTION_ID,
        messaging_profile_id: null
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const telnyxNumberId = buyRes.data.data?.id;
    console.log('Number bought successfully:', phoneNumber, telnyxNumberId);

    await supabase.from('virtual_numbers').insert({
      user_id,
      phone_number: phoneNumber,
      country: country,
      area_code: areaCode,
      telnyx_number_id: telnyxNumberId
    });

    res.json({ success: true, phone_number: phoneNumber });

  } catch (error) {
    console.error('Telnyx full error:', JSON.stringify(error.response?.data));
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

router.post('/connect-elevenlabs', async (req, res) => {
  try {
    const { user_id } = req.body;

    const { data: virtualNumber } = await supabase
      .from('virtual_numbers')
      .select('telnyx_number_id')
      .eq('user_id', user_id)
      .single();

    await axios.patch(
      `https://api.telnyx.com/v2/phone_numbers/${virtualNumber.telnyx_number_id}`,
      { connection_id: process.env.TELNYX_CONNECTION_ID },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Connect error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
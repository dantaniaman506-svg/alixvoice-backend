const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Jab koi client ke number pe call aaye
router.post('/inbound-call', async (req, res) => {
  try {
    const calledNumber = req.body.to || req.body.called_number;

    // Supabase se number ka owner dhundho
    const { data: virtualNumber } = await supabase
      .from('virtual_numbers')
      .select('user_id')
      .eq('phone_number', calledNumber)
      .single();

    if (!virtualNumber) {
      return res.status(404).json({ error: 'Number not found' });
    }

    // Business info nikalo
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', virtualNumber.user_id)
      .single();

    // Dynamic prompt banao
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

    // ElevenLabs agent ko call forward karo
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
    console.error('Inbound call error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Client ke liye number kharidna
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

// ElevenLabs se connect karo
router.post('/connect-elevenlabs', async (req, res) => {
  try {
    const { user_id } = req.body;

    // Number nikalo
    const { data: virtualNumber } = await supabase
      .from('virtual_numbers')
      .select('telnyx_number_id')
      .eq('user_id', user_id)
      .single();

    // Telnyx number pe webhook set karo
    await axios.patch(
      `https://api.telnyx.com/v2/phone_numbers/${virtualNumber.telnyx_number_id}`,
      {
        connection_id: process.env.TELNYX_CONNECTION_ID
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
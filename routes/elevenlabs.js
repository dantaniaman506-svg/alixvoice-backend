const express = require('express');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Client ke liye AI agent banana
router.post('/create-agent', async (req, res) => {
  try {
    const { user_id } = req.body;

    // Supabase se business info nikalo
    const { data: agent } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user_id)
      .single();

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    // Dynamic prompt banana
    const systemPrompt = `
You are ${agent.agent_name}, AI receptionist for ${agent.business_name}, 
a ${agent.business_type} in ${agent.location}.

BUSINESS INFO:
- Hours: ${agent.working_hours}
- Services: ${agent.services}
- Emergency: ${agent.emergency_number || 'Not available'}

YOUR JOB:
1. Greet caller warmly
2. Understand their need
3. Book/Reschedule/Cancel appointments
4. Answer basic questions

BOOKING STEPS:
- Ask: service needed, date, time, address
- Collect: full name, phone, email
- Confirm all details before finalizing

EMERGENCY:
If caller says urgent/emergency, prioritize immediately.

RULES:
- Max 2 sentences per response
- One question at a time
- Never make up information
- If unsure say: I will have our team call you back

END CALL:
Thank you for choosing ${agent.business_name}. We look forward to serving you.
    `;

    // ElevenLabs mein agent banao
    const response = await axios.post(
      'https://api.elevenlabs.io/v1/convai/agents/create',
      {
        name: `${agent.business_name} - ${agent.agent_name}`,
        conversation_config: {
          agent: {
            prompt: {
              prompt: systemPrompt
            },
            first_message: `Thank you for calling ${agent.business_name}! How can I help you today?`,
            language: 'en'
          },
          tts: {
            voice_id: process.env.ELEVENLABS_VOICE_ID
          }
        }
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const elevenlabs_agent_id = response.data.agent_id;

    // Agent ID Supabase mein save karo
    await supabase
      .from('agents')
      .update({ vapi_agent_id: elevenlabs_agent_id })
      .eq('user_id', user_id);

    // Telnyx number se ElevenLabs connect karo
    await axios.post(
      `${process.env.BACKEND_URL}/telnyx/connect-elevenlabs`,
      { user_id, elevenlabs_agent_id }
    );

    res.json({ success: true, agent_id: elevenlabs_agent_id });
  } catch (error) {
    console.error('ElevenLabs error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Call webhook - jab call aaye
router.post('/call-webhook', async (req, res) => {
  try {
    const { agent_id, call_duration_secs, status } = req.body;

    // Agent se user dhundho
    const { data: agent } = await supabase
      .from('agents')
      .select('user_id')
      .eq('vapi_agent_id', agent_id)
      .single();

    if (agent) {
      const minutes_used = Math.ceil(call_duration_secs / 60);

      // Minutes update karo
      await supabase.rpc('increment_minutes_used', {
        p_user_id: agent.user_id,
        p_minutes: minutes_used
      });

      // Call log save karo
      await supabase.from('call_logs').insert({
        user_id: agent.user_id,
        duration_seconds: call_duration_secs,
        duration_minutes: minutes_used,
        call_status: status || 'completed'
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Call webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

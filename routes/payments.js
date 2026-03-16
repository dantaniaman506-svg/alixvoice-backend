const response = await axios.post(
  'https://api.dodopayments.com/subscriptions',
  {
    billing: {
      city: "New York",
      country: "US",
      state: "NY",
      street: "123 Main St",
      zipcode: "10001"
    },
    customer: {
      email: "test@test.com",
      name: "Test User"
    },
    product_id: productIds[plan_name],
    quantity: 1,
    payment_link: true,
    metadata: {
      user_id,
      plan_name
    },
    return_url: 'https://alixvoice-ai.vercel.app/dashboard'
  },
  {
    headers: {
      Authorization: `Bearer ${process.env.DODO_API_KEY}`,
      'Content-Type': 'application/json'
    }
  }
);
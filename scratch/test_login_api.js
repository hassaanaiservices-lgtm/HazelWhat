async function testLogin() {
  console.log("Testing POST to http://localhost:3000/api/auth/login or remote...");
  
  // Test local first or remote
  const url = "https://hazelwhat.com/api/auth/login";
  
  const payload = {
    username: "pizzabox_hayatabad",
    password: "PizzaPass2025",
    remember: true
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const status = res.status;
    const data = await res.json();
    console.log("Status:", status);
    console.log("Response Data:", JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Test error:", e);
  }
}

testLogin();

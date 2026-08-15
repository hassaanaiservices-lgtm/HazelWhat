async function run() {
  try {
    const res = await fetch("https://hazelwhat.com/api/whatsapp/pairing-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ phoneNumber: "923177598978" })
    });
    const data = await res.json();
    console.log("Pairing Code Response:", JSON.stringify(data, null, 2));
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}
run();

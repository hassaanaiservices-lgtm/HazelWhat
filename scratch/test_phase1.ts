process.env.SESSION_SECRET = "super_secret_session_token_123456789";

import { signJWT, verifyJWT } from '../src/lib/auth-session';

async function testJWT() {
  console.log("=== STARTING PHASE 1 JWT TESTS ===");

  const payload = {
    role: "client" as const,
    tenantId: "t-1001",
    name: "Test Customer"
  };

  // Test Case 1: Sign and verify success
  const token = await signJWT(payload, 3600);
  console.log("Generated Token length:", token.length);
  
  const verifiedPayload = await verifyJWT(token);
  console.log("Verified Payload:", verifiedPayload);
  if (verifiedPayload && verifiedPayload.tenantId === "t-1001") {
    console.log("✅ Token Sign/Verify SUCCESS");
  } else {
    console.error("❌ Token Sign/Verify FAILED");
    process.exit(1);
  }

  // Test Case 2: Tampered Token
  const tamperedToken = token.slice(0, -5) + "aaaaa";
  const verifiedTampered = await verifyJWT(tamperedToken);
  console.log("Tampered token verification result:", verifiedTampered);
  if (verifiedTampered === null) {
    console.log("✅ Tampered Token verification correctly returns null. SUCCESS");
  } else {
    console.error("❌ Tampered Token verification FAILED");
    process.exit(1);
  }

  // Test Case 3: Expired Token
  const expiredToken = await signJWT(payload, -10); // Expiration in the past
  const verifiedExpired = await verifyJWT(expiredToken);
  console.log("Expired token verification result:", verifiedExpired);
  if (verifiedExpired === null) {
    console.log("✅ Expired Token verification correctly returns null. SUCCESS");
  } else {
    console.error("❌ Expired Token verification FAILED");
    process.exit(1);
  }

  console.log("=== ALL PHASE 1 JWT TESTS PASSED ===");
  process.exit(0);
}

testJWT().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});

// Chạy cùng các tình huống API + Socket.IO bằng SQL Supabase, qua SDK thật.
process.env.SKY_TEST_SUPABASE = "1";
await import("./integration.test.mjs");

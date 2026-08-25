# PHASE 5 AUTOMATED LOAD TEST REPORT

> **Execution Date:** 2026-08-23T16:27:23.979Z  
> **Environment:** Isolated Synthetic Staging Sandbox  
> **Test Suite Version:** HazelWhat Phase 5 Production Scale Certification

---

## 📊 Summary Matrix of Load Test Scenarios

| Test ID | Scenario Name | Concurrency | Total Req | Duration | RPS | P50 Latency | P95 Latency | P99 Latency | Error % | Timeout % | Peak Heap | Status |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| TEST_A | Baseline Load | 10 | 100 | 0.47s | 212.09 | 31.54ms | 47.04ms | 47.87ms | 0% | 0% | 30.81MB | PASS |
| TEST_B | Small Scale | 50 | 500 | 0.46s | 1077.84 | 31.61ms | 46.79ms | 47.73ms | 0% | 0% | 32.33MB | PASS |
| TEST_C | Medium Scale | 100 | 1000 | 0.46s | 2156.38 | 31.21ms | 46.94ms | 47.19ms | 0% | 0% | 34.8MB | PASS |
| TEST_D | Higher Scale | 500 | 2500 | 0.23s | 10767.84 | 30.41ms | 46.19ms | 46.54ms | 0% | 0% | 34.14MB | PASS |
| TEST_E | Large Scale | 1000 | 5000 | 0.23s | 21996.14 | 29.89ms | 45.08ms | 45.58ms | 0% | 0% | 40.27MB | WARN |
| TEST_F | Burst Load | 2000 | 5000 | 0.15s | 33508.63 | 33.26ms | 45.99ms | 49.18ms | 0% | 0% | 43.45MB | PASS |
| TEST_G | Extreme Burst | 3500 | 10000 | 0.15s | 66130.13 | 37.83ms | 44.84ms | 48.17ms | 0% | 0% | 41.84MB | PASS |
| SUSTAINED_10_RPS | Sustained 10 RPS Benchmark | 20 | 50 | 0.14s | 357.16 | 32.65ms | 47.98ms | 48.01ms | 0% | 0% | 36.85MB | PASS |
| SUSTAINED_25_RPS | Sustained 25 RPS Benchmark | 50 | 125 | 0.14s | 905.42 | 35.72ms | 46.71ms | 46.74ms | 0% | 0% | 37.16MB | PASS |
| SUSTAINED_50_RPS | Sustained 50 RPS Benchmark | 100 | 250 | 0.14s | 1779 | 31.16ms | 46.71ms | 47.26ms | 0% | 0% | 37.73MB | PASS |
| SUSTAINED_100_RPS | Sustained 100 RPS Benchmark | 200 | 500 | 0.14s | 3637.86 | 30.98ms | 46.43ms | 46.5ms | 0% | 0% | 38.87MB | PASS |
| SUSTAINED_250_RPS | Sustained 250 RPS Benchmark | 500 | 1250 | 0.15s | 8601.64 | 31.17ms | 49.72ms | 49.95ms | 0% | 0% | 41.64MB | PASS |
| SUSTAINED_500_RPS | Sustained 500 RPS Benchmark | 1000 | 2500 | 0.13s | 18819.83 | 30.4ms | 46.16ms | 46.44ms | 0% | 0% | 42.29MB | PASS |
| SUSTAINED_1000_RPS | Sustained 1000 RPS Benchmark | 2000 | 5000 | 0.15s | 32457.23 | 30.59ms | 53.09ms | 54.73ms | 0% | 0% | 40.28MB | PASS |
| QUEUE_NORMAL | Normal Queue Flow | 20 | 200 | 0.46s | 438.15 | 31.22ms | 47.09ms | 47.71ms | 0% | 0% | 36.69MB | PASS |
| QUEUE_SLOWDOWN | Worker Slowdown | 20 | 200 | 1.56s | 128.54 | 155.24ms | 157.72ms | 157.72ms | 0% | 0% | 37.22MB | PASS |
| QUEUE_CRASH_RECOVERY | Worker Crash & Recovery | 50 | 300 | 0.28s | 1070.04 | 31.4ms | 47.39ms | 47.67ms | 0% | 0% | 37.98MB | PASS |
| TENANT_FAIRNESS | Noisy Tenant Isolation | 100 | 400 | 0.09s | 4307.31 | 0ms | 46.61ms | 46.73ms | 62.5% | 0% | 38.68MB | PASS |
| LLM_FALLBACK_429 | Primary 429 -> Fallback | 50 | 200 | 0.26s | 779.75 | 50.62ms | 76.56ms | 81.13ms | 0% | 0% | 39.31MB | PASS |
| LLM_ALL_DOWN | All Providers Down | 20 | 100 | 0.01s | 9811.62 | 0.19ms | 8.18ms | 8.33ms | 100% | 0% | 39.57MB | PASS |
| REDIS_OUTAGE | Redis Outage Fallback | 50 | 300 | 0.28s | 1064.65 | 40.16ms | 46.01ms | 46.05ms | 0% | 0% | 40.3MB | PASS |
| DB_OUTAGE | Database Latency Spike | 50 | 300 | 0.3s | 1006.67 | 43.67ms | 57.8ms | 57.89ms | 0% | 0% | 41.12MB | PASS |
| MEM_LEAK_SUSTAINED | Memory Leak Audit | 100 | 5000 | 2.34s | 2138.14 | 31.08ms | 46.96ms | 47.83ms | 0% | 0% | 52.21MB | WARN |


---

## 🔍 Detailed Test Scenario Breakdown


### Scenario: TEST_A (Baseline Load)
- **Status:** **PASS**
- **Concurrency / Load Level:** 10 concurrent requests
- **Throughput (RPS):** 212.09 req/sec
- **Latency Distribution:** P50: `31.54ms` | P95: `47.04ms` | P99: `47.87ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 30.41MB → End: 30.81MB (Peak: 30.81MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TEST_B (Small Scale)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 1077.84 req/sec
- **Latency Distribution:** P50: `31.61ms` | P95: `46.79ms` | P99: `47.73ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 30.88MB → End: 32.33MB (Peak: 32.33MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TEST_C (Medium Scale)
- **Status:** **PASS**
- **Concurrency / Load Level:** 100 concurrent requests
- **Throughput (RPS):** 2156.38 req/sec
- **Latency Distribution:** P50: `31.21ms` | P95: `46.94ms` | P99: `47.19ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 32.57MB → End: 29.07MB (Peak: 34.8MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TEST_D (Higher Scale)
- **Status:** **PASS**
- **Concurrency / Load Level:** 500 concurrent requests
- **Throughput (RPS):** 10767.84 req/sec
- **Latency Distribution:** P50: `30.41ms` | P95: `46.19ms` | P99: `46.54ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 29.56MB → End: 28.15MB (Peak: 34.14MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TEST_E (Large Scale)
- **Status:** **WARN**
- **Concurrency / Load Level:** 1000 concurrent requests
- **Throughput (RPS):** 21996.14 req/sec
- **Latency Distribution:** P50: `29.89ms` | P95: `45.08ms` | P99: `45.58ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 29.56MB → End: 40.27MB (Peak: 40.27MB)
- **Memory Classification:** SLOWLY INCREASING
- **Notes & Observations:** Slight performance degradation: P95 45.08ms, Error rate 0%.


### Scenario: TEST_F (Burst Load)
- **Status:** **PASS**
- **Concurrency / Load Level:** 2000 concurrent requests
- **Throughput (RPS):** 33508.63 req/sec
- **Latency Distribution:** P50: `33.26ms` | P95: `45.99ms` | P99: `49.18ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 43.45MB → End: 38.8MB (Peak: 43.45MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TEST_G (Extreme Burst)
- **Status:** **PASS**
- **Concurrency / Load Level:** 3500 concurrent requests
- **Throughput (RPS):** 66130.13 req/sec
- **Latency Distribution:** P50: `37.83ms` | P95: `44.84ms` | P99: `48.17ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 41.84MB → End: 30.18MB (Peak: 41.84MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_10_RPS (Sustained 10 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 20 concurrent requests
- **Throughput (RPS):** 357.16 req/sec
- **Latency Distribution:** P50: `32.65ms` | P95: `47.98ms` | P99: `48.01ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 36.74MB → End: 36.85MB (Peak: 36.85MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_25_RPS (Sustained 25 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 905.42 req/sec
- **Latency Distribution:** P50: `35.72ms` | P95: `46.71ms` | P99: `46.74ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 36.88MB → End: 37.16MB (Peak: 37.16MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_50_RPS (Sustained 50 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 100 concurrent requests
- **Throughput (RPS):** 1779 req/sec
- **Latency Distribution:** P50: `31.16ms` | P95: `46.71ms` | P99: `47.26ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 37.22MB → End: 37.73MB (Peak: 37.73MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_100_RPS (Sustained 100 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 200 concurrent requests
- **Throughput (RPS):** 3637.86 req/sec
- **Latency Distribution:** P50: `30.98ms` | P95: `46.43ms` | P99: `46.5ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 37.85MB → End: 38.87MB (Peak: 38.87MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_250_RPS (Sustained 250 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 500 concurrent requests
- **Throughput (RPS):** 8601.64 req/sec
- **Latency Distribution:** P50: `31.17ms` | P95: `49.72ms` | P99: `49.95ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 39.11MB → End: 41.64MB (Peak: 41.64MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_500_RPS (Sustained 500 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 1000 concurrent requests
- **Throughput (RPS):** 18819.83 req/sec
- **Latency Distribution:** P50: `30.4ms` | P95: `46.16ms` | P99: `46.44ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 42.29MB → End: 34.8MB (Peak: 42.29MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: SUSTAINED_1000_RPS (Sustained 1000 RPS Benchmark)
- **Status:** **PASS**
- **Concurrency / Load Level:** 2000 concurrent requests
- **Throughput (RPS):** 32457.23 req/sec
- **Latency Distribution:** P50: `30.59ms` | P95: `53.09ms` | P99: `54.73ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 36.23MB → End: 33.1MB (Peak: 40.28MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: QUEUE_NORMAL (Normal Queue Flow)
- **Status:** **PASS**
- **Concurrency / Load Level:** 20 concurrent requests
- **Throughput (RPS):** 438.15 req/sec
- **Latency Distribution:** P50: `31.22ms` | P95: `47.09ms` | P99: `47.71ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 36.21MB → End: 36.69MB (Peak: 36.69MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: QUEUE_SLOWDOWN (Worker Slowdown)
- **Status:** **PASS**
- **Concurrency / Load Level:** 20 concurrent requests
- **Throughput (RPS):** 128.54 req/sec
- **Latency Distribution:** P50: `155.24ms` | P95: `157.72ms` | P99: `157.72ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 36.78MB → End: 37.22MB (Peak: 37.22MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: QUEUE_CRASH_RECOVERY (Worker Crash & Recovery)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 1070.04 req/sec
- **Latency Distribution:** P50: `31.4ms` | P95: `47.39ms` | P99: `47.67ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 37.31MB → End: 37.98MB (Peak: 37.98MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: TENANT_FAIRNESS (Noisy Tenant Isolation)
- **Status:** **PASS**
- **Concurrency / Load Level:** 100 concurrent requests
- **Throughput (RPS):** 4307.31 req/sec
- **Latency Distribution:** P50: `0ms` | P95: `46.61ms` | P99: `46.73ms`
- **Error & Timeout Rate:** Errors: 62.5% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 38.14MB → End: 38.68MB (Peak: 38.68MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Isolation and error handling operating as expected under fault injection.


### Scenario: LLM_FALLBACK_429 (Primary 429 -> Fallback)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 779.75 req/sec
- **Latency Distribution:** P50: `50.62ms` | P95: `76.56ms` | P99: `81.13ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 38.84MB → End: 39.31MB (Peak: 39.31MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: LLM_ALL_DOWN (All Providers Down)
- **Status:** **PASS**
- **Concurrency / Load Level:** 20 concurrent requests
- **Throughput (RPS):** 9811.62 req/sec
- **Latency Distribution:** P50: `0.19ms` | P95: `8.18ms` | P99: `8.33ms`
- **Error & Timeout Rate:** Errors: 100% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 39.4MB → End: 39.57MB (Peak: 39.57MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Isolation and error handling operating as expected under fault injection.


### Scenario: REDIS_OUTAGE (Redis Outage Fallback)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 1064.65 req/sec
- **Latency Distribution:** P50: `40.16ms` | P95: `46.01ms` | P99: `46.05ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 39.62MB → End: 40.3MB (Peak: 40.3MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: DB_OUTAGE (Database Latency Spike)
- **Status:** **PASS**
- **Concurrency / Load Level:** 50 concurrent requests
- **Throughput (RPS):** 1006.67 req/sec
- **Latency Distribution:** P50: `43.67ms` | P95: `57.8ms` | P99: `57.89ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 40.43MB → End: 41.12MB (Peak: 41.12MB)
- **Memory Classification:** STABLE
- **Notes & Observations:** Operating within safe performance limits.


### Scenario: MEM_LEAK_SUSTAINED (Memory Leak Audit)
- **Status:** **WARN**
- **Concurrency / Load Level:** 100 concurrent requests
- **Throughput (RPS):** 2138.14 req/sec
- **Latency Distribution:** P50: `31.08ms` | P95: `46.96ms` | P99: `47.83ms`
- **Error & Timeout Rate:** Errors: 0% | Timeouts: 0%
- **Resource Footprint:** Heap Start: 41.35MB → End: 52.21MB (Peak: 52.21MB)
- **Memory Classification:** SLOWLY INCREASING
- **Notes & Observations:** Slight performance degradation: P95 46.96ms, Error rate 0%.


---

## 🛡️ Circuit Breakers & Fallback Verification
- **Primary Provider Rate Limiting (429):** Seamlessly failed over to secondary fallback provider with 100% success rate.
- **Provider Outage Casing (503):** Graceful response handling enforced, zero unhandled worker rejections or infinite retry loops.
- **Redis Outage Simulation:** In-memory queue fallback maintained message processing with bounded memory usage.
- **Database Latency Spike Simulation:** Non-blocking asynchronous observability store successfully decoupled from core customer flow.

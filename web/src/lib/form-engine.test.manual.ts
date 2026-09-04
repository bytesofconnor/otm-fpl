/**
 * Manual test cases for Form Engine
 * 
 * Run with: npx tsx web/src/lib/form-engine.test.manual.ts
 * 
 * TODO: Convert to proper unit tests when test framework is configured
 * (e.g., Jest, Vitest, or Node test runner)
 */

import {
  computeFormScore,
  formScoreToHeat,
  heatLabel,
  heatEmoji,
  computeFormScoreSimple,
  gameweeksSinceLastReturn,
  computeMinutesStability,
  computeStartRate,
  type FormInput,
} from "./form-engine"

// ============================================================================
// Test Utilities
// ============================================================================

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string): void {
  const diff = Math.abs(actual - expected)
  if (diff > tolerance) {
    console.error(`❌ FAIL: ${message} (expected ${expected}, got ${actual}, diff ${diff})`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message} (${actual} ≈ ${expected})`)
}

// ============================================================================
// Test Cases
// ============================================================================

console.log("\n🔥 Form Engine Test Suite\n")

// ----------------------------------------------------------------------------
// Test 1: High Form Player (3 straight returns)
// ----------------------------------------------------------------------------
console.log("Test 1: High form player (3 straight returns, all starts)")
{
  const input: FormInput = {
    lastGW: 9,      // Recent goal + assist
    priorGW: 8,     // Clean sheet
    prior2GW: 7,    // Goal
    minutesStability: 1.0,  // All games 60+ minutes
    startRate: 1.0,         // All games started
    projBeat: true,         // Beat projection
    gameweeksSinceLastReturn: 0, // Last GW had return
  }
  const result = computeFormScore(input)
  
  // Expected: (9*3 + 8*1.5 + 7*0.5) + (1*8 + 1*6) + 5 = 27 + 12 + 3.5 + 14 + 5 = 61.5 * 1.0 = 61.5
  assertApprox(result.score, 61.5, 1, "High form score should be ~61.5")
  assert(result.heat === "hot" || result.heat === "fire", "High form should be Hot or Fire")
  assert(result.breakdown.baseScore > 0, "Base score should be positive")
  assert(result.breakdown.minutesBonus > 0, "Minutes bonus should be positive")
  assert(result.breakdown.surpriseBonus === 5, "Surprise bonus should be 5")
  assert(result.breakdown.decayFactor === 1.0, "Decay should be 1.0 (no decay)")
}

// ----------------------------------------------------------------------------
// Test 2: Low Form Player (benched, no returns)
// ----------------------------------------------------------------------------
console.log("\nTest 2: Low form player (benched, no returns)")
{
  const input: FormInput = {
    lastGW: 0,      // Benched
    priorGW: 0,     // Benched
    prior2GW: 0,    // Benched
    minutesStability: 0.0,  // No minutes
    startRate: 0.0,         // No starts
    projBeat: false,
    gameweeksSinceLastReturn: 3, // 3 GW without return
  }
  const result = computeFormScore(input)
  
  // Expected: 0 base + 0 minutes + 0 surprise = 0, decay = 1 - 3/4 = 0.25, so 0 * 0.25 = 0
  assertApprox(result.score, 0, 0.1, "Low form score should be ~0")
  assert(result.heat === "cold", "Low form should be Cold")
  assert(result.breakdown.decayFactor === 0.25, "Decay should be 0.25 (3/4 GW)")
}

// ----------------------------------------------------------------------------
// Test 3: Moderate Form (rotation risk)
// ----------------------------------------------------------------------------
console.log("\nTest 3: Moderate form player (rotation risk)")
{
  const input: FormInput = {
    lastGW: 5,      // One return
    priorGW: 0,     // Benched
    prior2GW: 4,    // One return
    minutesStability: 0.5,  // 50% games with 60+ min
    startRate: 0.67,        // 2/3 games started
    projBeat: false,
    gameweeksSinceLastReturn: 0,
  }
  const result = computeFormScore(input)
  
  // Expected: (5*3 + 0*1.5 + 4*0.5) + (0.5*8 + 0.67*6) = 15 + 2 + 4 + 4 = 25 * 1.0 = 25
  assertApprox(result.score, 25, 3, "Moderate form score should be ~25")
  assert(result.heat === "warm", "Moderate form should be Warm")
}

// ----------------------------------------------------------------------------
// Test 4: Decay after 4 GW
// ----------------------------------------------------------------------------
console.log("\nTest 4: Decay after 4 GW with no returns")
{
  const input: FormInput = {
    lastGW: 0,
    priorGW: 0,
    prior2GW: 8,    // Had a big game 3 GW ago
    minutesStability: 0.8,
    startRate: 0.8,
    projBeat: false,
    gameweeksSinceLastReturn: 4, // 4 GW without return
  }
  const result = computeFormScore(input)
  
  // Expected: decay = 1 - 4/4 = 0, so score → 0 regardless of base
  assertApprox(result.score, 0, 0.1, "Score after 4 GW decay should be ~0")
  assert(result.heat === "cold", "Decayed form should be Cold")
  assert(result.breakdown.decayFactor === 0, "Decay should be 0 (4/4 GW)")
}

// ----------------------------------------------------------------------------
// Test 5: Elite Form (Burning)
// ----------------------------------------------------------------------------
console.log("\nTest 5: Elite form player (Burning)")
{
  const input: FormInput = {
    lastGW: 12,     // Brace + assist
    priorGW: 10,    // Goal + assist
    prior2GW: 9,    // Goal
    minutesStability: 1.0,
    startRate: 1.0,
    projBeat: true,
    gameweeksSinceLastReturn: 0,
  }
  const result = computeFormScore(input)
  
  // Expected: (12*3 + 10*1.5 + 9*0.5) + (1*8 + 1*6) + 5 = 55.5 + 14 + 5 = 74.5 * 1.0 = 74.5
  assertApprox(result.score, 74.5, 2, "Elite form score should be ~74.5")
  assert(result.heat === "fire", "Elite form should be Fire")
}

// ----------------------------------------------------------------------------
// Test 6: Heat Bucket Thresholds
// ----------------------------------------------------------------------------
console.log("\nTest 6: Heat bucket thresholds")
{
  assert(formScoreToHeat(0) === "cold", "0 should be Cold")
  assert(formScoreToHeat(10) === "cold", "10 should be Cold")
  assert(formScoreToHeat(15) === "cold", "15 should be Cold")
  assert(formScoreToHeat(16) === "warm", "16 should be Warm")
  assert(formScoreToHeat(25) === "warm", "25 should be Warm")
  assert(formScoreToHeat(35) === "warm", "35 should be Warm")
  assert(formScoreToHeat(36) === "hot", "36 should be Hot")
  assert(formScoreToHeat(50) === "hot", "50 should be Hot")
  assert(formScoreToHeat(60) === "hot", "60 should be Hot")
  assert(formScoreToHeat(61) === "fire", "61 should be Fire")
  assert(formScoreToHeat(75) === "fire", "75 should be Fire")
  assert(formScoreToHeat(80) === "fire", "80 should be Fire")
  assert(formScoreToHeat(81) === "burning", "81 should be Burning")
  assert(formScoreToHeat(95) === "burning", "95 should be Burning")
  assert(formScoreToHeat(100) === "burning", "100 should be Burning")
}

// ----------------------------------------------------------------------------
// Test 7: Simple Convenience Function
// ----------------------------------------------------------------------------
console.log("\nTest 7: Simple convenience function")
{
  const result = computeFormScoreSimple({
    lastGW: 7,
    priorGW: 8,
    prior2GW: 6,
  })
  assert(result.score > 0, "Simple function should compute score")
  assert(result.heat !== undefined, "Simple function should compute heat")
}

// ----------------------------------------------------------------------------
// Test 8: Helper Functions
// ----------------------------------------------------------------------------
console.log("\nTest 8: Helper functions")
{
  // gameweeksSinceLastReturn
  assert(gameweeksSinceLastReturn([8, 7, 0, 5]) === 0, "Should be 0 (last GW had return)")
  assert(gameweeksSinceLastReturn([0, 0, 7, 5]) === 2, "Should be 2 (2 GW ago)")
  assert(gameweeksSinceLastReturn([0, 0, 0]) === 3, "Should be 3 (no returns)")
  
  // computeMinutesStability
  assertApprox(computeMinutesStability([90, 70, 60]), 1.0, 0.01, "All 60+ should be 1.0")
  assertApprox(computeMinutesStability([90, 30, 60]), 0.67, 0.01, "2/3 60+ should be 0.67")
  assertApprox(computeMinutesStability([30, 20, 10]), 0.0, 0.01, "None 60+ should be 0.0")
  
  // computeStartRate
  assertApprox(computeStartRate([true, true, true]), 1.0, 0.01, "All starts should be 1.0")
  assertApprox(computeStartRate([true, false, true]), 0.67, 0.01, "2/3 starts should be 0.67")
  assertApprox(computeStartRate([false, false, false]), 0.0, 0.01, "No starts should be 0.0")
}

// ----------------------------------------------------------------------------
// Test 9: Display Helpers
// ----------------------------------------------------------------------------
console.log("\nTest 9: Display helpers")
{
  assert(heatLabel("cold") === "Cold", "Cold label should be 'Cold'")
  assert(heatLabel("warm") === "Warm", "Warm label should be 'Warm'")
  assert(heatLabel("hot") === "Hot", "Hot label should be 'Hot'")
  assert(heatLabel("fire") === "Fire", "Fire label should be 'Fire'")
  assert(heatLabel("burning") === "Burning", "Burning label should be 'Burning'")
  
  assert(heatEmoji("cold") === "❄️", "Cold emoji should be ❄️")
  assert(heatEmoji("burning") === "🔥🔥🔥", "Burning emoji should be 🔥🔥🔥")
}

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log("\n✨ All tests passed! Form Engine is working correctly.\n")
console.log("Next steps:")
console.log("1. Add proper test framework (Jest, Vitest, or Node test runner)")
console.log("2. Convert these manual tests to unit tests")
console.log("3. Add more edge case coverage\n")

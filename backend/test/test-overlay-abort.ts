import { ScreenControlOverlay } from "../src/overlay/index.js";

async function runAbortTest() {
  console.log("=== Testing Screen Control Overlay & Product Intelligence Panel ===");
  const overlay = new ScreenControlOverlay();

  let stopReceived = false;
  overlay.onStop((event) => {
    console.log(`[Test] onStop triggered with reason: ${event.reason}`);
    stopReceived = true;
  });

  console.log("1. Starting overlay...");
  await overlay.start();
  console.log("2. Overlay started successfully.");

  console.log("3. Emitting product intelligence events...");
  overlay.setStatus("searching", "Searching Amazon", undefined, {
    activity: "Searching for creatine monohydrate listings on Amazon.in.",
    budgetINR: 500,
  });
  await new Promise((r) => setTimeout(r, 600));

  overlay.setStatus("analyzing", "Comparing products", undefined, {
    activity: "Comparing 70 extracted listings against ₹500 budget limit.",
    candidatesFound: 70,
    candidatesEvaluated: 10,
    currentProduct: {
      id: 2,
      title: "Optimum Nutrition (ON) Micronized Creatine Powder – 100 g",
      price: "₹479",
      rating: "4.3 ★",
      reviews: "(12.4k)",
      status: "selected",
      budgetComparison: "₹479 within ₹500 budget limit",
    },
    reasoningSummary: "Pure micronized creatine monohydrate within budget from reputable brand.",
    candidates: [
      { id: 1, title: "Wellcore Pure Micronised Creatine Powder", price: "₹539", status: "rejected" },
      { id: 2, title: "Optimum Nutrition (ON) Micronized Creatine", price: "₹479", status: "selected" },
      { id: 3, title: "MuscleBlaze Micronised Creatine", price: "₹545", status: "rejected" },
    ],
  });
  await new Promise((r) => setTimeout(r, 600));

  overlay.setStatus("adding_to_cart", "Adding to cart", undefined, {
    activity: "Submitting Add to Cart for Optimum Nutrition Creatine.",
  });
  await new Promise((r) => setTimeout(r, 600));

  console.log("4. Simulating user stop request...");
  const abortPromise = new Promise<void>((resolve) => {
    overlay.abortSignal.addEventListener("abort", () => {
      console.log("5. AbortSignal fired as expected! Reason:", overlay.abortSignal.reason);
      resolve();
    });
  });

  // Trigger stop on the controller
  (overlay as any).triggerStop({
    type: "stop",
    reason: "escape_pressed",
    timestamp: Date.now(),
  });

  await abortPromise;

  if (!overlay.isAborted) {
    throw new Error("Overlay should be in aborted state!");
  }

  if (!stopReceived) {
    throw new Error("onStop listener was not called!");
  }

  console.log("6. Closing overlay...");
  await overlay.close();
  console.log("7. Overlay closed cleanly. Test passed!");
}

runAbortTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

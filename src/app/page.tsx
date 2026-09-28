import { Suspense } from "react";
import { PlanningPokerApp } from "@/features/planning-poker/PlanningPokerApp";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="loading-screen">Loading Planning Poker...</main>}>
      <PlanningPokerApp />
    </Suspense>
  );
}

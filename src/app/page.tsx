import { Suspense } from "react";
import { PlanningPokerApp } from "@/features/planning-poker/PlanningPokerApp";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="min-h-screen grid place-items-center text-slate-400">Loading Planning Poker...</main>}>
      <PlanningPokerApp />
    </Suspense>
  );
}

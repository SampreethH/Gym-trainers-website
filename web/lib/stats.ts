import type { Role, StoreData, TrainingGoal, User } from "./types";

export function progressKg(user: Pick<User, "goal" | "weightKg" | "startWeightKg">) {
  if (user.goal === "weight_gain") {
    return Number((user.weightKg - user.startWeightKg).toFixed(1));
  }
  return Number((user.startWeightKg - user.weightKg).toFixed(1));
}

export type BoardRow = {
  id: string;
  name: string;
  kcal: number;
  points: number;
  gained: number;
  goal: TrainingGoal;
};

export function studioBoard(store: StoreData, tenantId: string | null, role: Role): BoardRow[] {
  return store.users
    .filter((u) => u.tenantId === tenantId && u.role === role && u.status === "active")
    .map((u) => ({
      id: u.id,
      name: u.name,
      kcal: u.kcalBurned ?? 0,
      points: u.points ?? 0,
      gained: progressKg(u),
      goal: u.goal ?? "fat_loss",
    }));
}

export function goalLabel(goal: TrainingGoal) {
  if (goal === "fat_loss") return "Fat loss";
  if (goal === "weight_gain") return "Weight gain";
  return "Shredding";
}

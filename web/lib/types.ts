export type Role = "gt_client" | "pt_client" | "trainer" | "platform_admin";
export type TrainingGoal = "fat_loss" | "weight_gain" | "shredding";
export type UserStatus = "active" | "suspended" | "deleted";
export type SubStatus = "active" | "trialing" | "past_due" | "canceled" | "unpaid";
export type ProgramType = "gt" | "pt";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type BookingStatus =
  | "booked"
  | "checked_in"
  | "completed"
  | "no_show"
  | "rescheduled"
  | "canceled";

export type Exercise = {
  id: string;
  name: string;
  primaryMuscle: string;
  secondary: string[];
  cues: string;
  equipment: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  tenantId: string | null;
  status: UserStatus;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  streak: number;
  badges: string[];
  goal: TrainingGoal;
  startWeightKg: number;
  kcalBurned: number;
  points: number;
};

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  subscriptionStatus: SubStatus;
  tier: "studio" | "atelier" | "maison";
};

export type MuscleGroupPlan = {
  muscle: string;
  exerciseIds: string[];
};

export type GtPlan = {
  id: string;
  tenantId: string;
  date: string;
  revision: number;
  groups: MuscleGroupPlan[];
};

export type PtProgram = {
  id: string;
  tenantId: string;
  clientId: string;
  kind: "cardio" | "strength";
  trainerLocked: boolean;
  exercises: { exerciseId: string; prescribedSets: number }[];
};

export type SetLog = {
  id: string;
  exerciseId: string;
  setNumber: number;
  reps: string;
  weightKg: string;
  restSeconds: string;
  notes: string;
  completedAt: string | null;
};

export type WorkoutSession = {
  id: string;
  tenantId: string;
  clientId: string;
  programType: ProgramType;
  kind?: "cardio" | "strength";
  date: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
  sets: SetLog[];
  certificateId: string | null;
};

export type Booking = {
  id: string;
  tenantId: string;
  trainerId: string;
  clientId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  graceMinutes: number;
  rescheduledFromId: string | null;
};

export type Message = {
  id: string;
  tenantId: string;
  fromId: string;
  toId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type MetricPoint = {
  id: string;
  clientId: string;
  recordedAt: string;
  weightKg: number;
  heightCm: number;
  bodyFatPct: number;
  bmi: number;
};

export type ProgressImage = {
  id: string;
  clientId: string;
  kind: "before" | "after" | "progress";
  dataUrl: string;
  capturedAt: string;
};

export type Certificate = {
  id: string;
  token: string;
  sessionId: string;
  clientName: string;
  date: string;
  programLabel: string;
  validSets: number;
  totalKg: number;
  durationMin: number;
  muscles: string[];
};

export type AuditEvent = {
  id: string;
  at: string;
  actorId: string;
  action: string;
  detail: string;
};

export type StoreData = {
  users: User[];
  tenants: Tenant[];
  exercises: Exercise[];
  gtPlans: GtPlan[];
  ptPrograms: PtProgram[];
  sessions: WorkoutSession[];
  bookings: Booking[];
  messages: Message[];
  notifications: Notification[];
  metrics: MetricPoint[];
  images: ProgressImage[];
  certificates: Certificate[];
  audit: AuditEvent[];
};

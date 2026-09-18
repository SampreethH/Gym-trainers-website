import { promises as fs } from "node:fs";
import path from "node:path";
import { bmi, hashPassword, todayISO, uid } from "./crypto";
import type {
  Booking,
  Exercise,
  GtPlan,
  StoreData,
  User,
  WorkoutSession,
} from "./types";

const FILE = path.join(process.cwd(), "data", "elevate-store.json");

const EXERCISES: Exercise[] = [
  { id: "ex_bench", name: "Barbell bench press", primaryMuscle: "Chest", secondary: ["Triceps", "Shoulders"], cues: "Wrists stacked, slight arch, control the descent.", equipment: "Barbell" },
  { id: "ex_incline", name: "Incline dumbbell press", primaryMuscle: "Chest", secondary: ["Shoulders"], cues: "30° bench, elbows ~45°, squeeze at top.", equipment: "Dumbbells" },
  { id: "ex_fly", name: "Cable fly", primaryMuscle: "Chest", secondary: ["Shoulders"], cues: "Soft elbows, meet hands at sternum height.", equipment: "Cables" },
  { id: "ex_pushup", name: "Weighted push-up", primaryMuscle: "Chest", secondary: ["Triceps", "Core"], cues: "Ribs down, full lockout without shrugging.", equipment: "Bodyweight" },
  { id: "ex_dip", name: "Chest dip", primaryMuscle: "Chest", secondary: ["Triceps"], cues: "Lean forward, stop at 90° elbows.", equipment: "Dip bars" },
  { id: "ex_row", name: "Chest-supported row", primaryMuscle: "Back", secondary: ["Biceps"], cues: "Pull to hip, pause, no shrug.", equipment: "Dumbbells" },
  { id: "ex_lat", name: "Lat pulldown", primaryMuscle: "Back", secondary: ["Biceps"], cues: "Depress scapula first, bar to collarbone.", equipment: "Cable" },
  { id: "ex_pullup", name: "Assisted pull-up", primaryMuscle: "Back", secondary: ["Biceps"], cues: "Full hang, chest to bar.", equipment: "Assisted machine" },
  { id: "ex_face", name: "Face pull", primaryMuscle: "Back", secondary: ["Rear delts"], cues: "Externally rotate at the finish.", equipment: "Cable" },
  { id: "ex_rdl", name: "Romanian deadlift", primaryMuscle: "Back", secondary: ["Hamstrings", "Glutes"], cues: "Hips back, bar close, soft knees.", equipment: "Barbell" },
  { id: "ex_squat", name: "Goblet squat", primaryMuscle: "Legs", secondary: ["Glutes", "Core"], cues: "Elbows inside knees, heels heavy.", equipment: "Kettlebell" },
  { id: "ex_lunge", name: "Walking lunge", primaryMuscle: "Legs", secondary: ["Glutes"], cues: "Long step, rear knee kisses floor.", equipment: "Dumbbells" },
  { id: "ex_legpress", name: "Leg press", primaryMuscle: "Legs", secondary: ["Glutes"], cues: "Do not lock out harshly; full foot.", equipment: "Machine" },
  { id: "ex_ham", name: "Lying hamstring curl", primaryMuscle: "Legs", secondary: ["Calves"], cues: "Hips glued down, slow negative.", equipment: "Machine" },
  { id: "ex_calf", name: "Standing calf raise", primaryMuscle: "Legs", secondary: [], cues: "Pause in stretch and squeeze.", equipment: "Machine" },
  { id: "ex_ohp", name: "Seated overhead press", primaryMuscle: "Shoulders", secondary: ["Triceps"], cues: "Ribs down, head through at lockout.", equipment: "Barbell" },
  { id: "ex_latraise", name: "Lateral raise", primaryMuscle: "Shoulders", secondary: [], cues: "Lead with elbows, stop at shoulder height.", equipment: "Dumbbells" },
  { id: "ex_rear", name: "Rear-delt swing", primaryMuscle: "Shoulders", secondary: ["Back"], cues: "Chest on bench, pinkies up.", equipment: "Dumbbells" },
  { id: "ex_front", name: "Front raise", primaryMuscle: "Shoulders", secondary: ["Chest"], cues: "Slight elbow bend, no swing.", equipment: "Plate" },
  { id: "ex_shrug", name: "Trap shrug", primaryMuscle: "Shoulders", secondary: ["Back"], cues: "Straight up, 1-second hold.", equipment: "Dumbbells" },
  { id: "ex_plank", name: "Long-lever plank", primaryMuscle: "Core", secondary: ["Shoulders"], cues: "Posterior tilt, breathe into ribs.", equipment: "Bodyweight" },
  { id: "ex_deadbug", name: "Dead bug", primaryMuscle: "Core", secondary: [], cues: "Low back pinned, slow limbs.", equipment: "Bodyweight" },
  { id: "ex_pallof", name: "Pallof press", primaryMuscle: "Core", secondary: ["Shoulders"], cues: "Do not rotate with the cable.", equipment: "Cable" },
  { id: "ex_hang", name: "Hanging knee raise", primaryMuscle: "Core", secondary: ["Hip flexors"], cues: "Posterior tilt before lift.", equipment: "Bar" },
  { id: "ex_carry", name: "Farmer carry", primaryMuscle: "Core", secondary: ["Grip", "Traps"], cues: "Tall walk, no sway.", equipment: "Dumbbells" },
  { id: "ex_bike", name: "Assault bike intervals", primaryMuscle: "Cardio", secondary: ["Legs"], cues: "Arms and legs even drive, nasal inhale.", equipment: "Air bike" },
  { id: "ex_run", name: "Incline treadmill walk", primaryMuscle: "Cardio", secondary: ["Glutes"], cues: "8–12% incline, no handrail hang.", equipment: "Treadmill" },
  { id: "ex_rower", name: "Row erg", primaryMuscle: "Cardio", secondary: ["Back", "Legs"], cues: "Legs-body-arms, then reverse.", equipment: "Rower" },
  { id: "ex_ski", name: "SkiErg", primaryMuscle: "Cardio", secondary: ["Lats", "Core"], cues: "Hinge, long arms, snap hips.", equipment: "SkiErg" },
  { id: "ex_jump", name: "Box step-overs", primaryMuscle: "Cardio", secondary: ["Legs"], cues: "Soft landings, even sides.", equipment: "Box" },
];

function five(ids: string[]): string[] {
  if (ids.length !== 5) throw new Error("Each muscle group requires exactly 5 variations");
  return ids;
}

async function seed(): Promise<StoreData> {
  const passwordHash = hashPassword("elevate-demo");
  const tenantId = "ten_atelier";
  const lapsedId = "ten_lapsed";
  const today = todayISO();
  const yest = todayISO(new Date(Date.now() - 86400000));
  const tom = todayISO(new Date(Date.now() + 86400000));

  const users: User[] = [
    { id: "u_gt", email: "gt@elevate.demo", name: "Aisha Khan", passwordHash, role: "gt_client", tenantId, status: "active", heightCm: 178, weightKg: 68.4, bodyFatPct: 22, streak: 6, badges: ["First iron", "Week of fire"], goal: "fat_loss", startWeightKg: 73, kcalBurned: 1840, points: 420 },
    { id: "u_gt2", email: "jordan@elevate.demo", name: "Jordan Rao", passwordHash, role: "gt_client", tenantId, status: "active", heightCm: 170, weightKg: 81, bodyFatPct: 22, streak: 4, badges: ["Week of fire"], goal: "weight_gain", startWeightKg: 76.2, kcalBurned: 1210, points: 310 },
    { id: "u_gt3", email: "meera@elevate.demo", name: "Meera Iyer", passwordHash, role: "gt_client", tenantId, status: "active", heightCm: 162, weightKg: 61.4, bodyFatPct: 24, streak: 2, badges: [], goal: "shredding", startWeightKg: 64.8, kcalBurned: 960, points: 180 },
    { id: "u_pt", email: "pt@elevate.demo", name: "Daniel Reed", passwordHash, role: "pt_client", tenantId, status: "active", heightCm: 182, weightKg: 81.2, bodyFatPct: 18.4, streak: 3, badges: ["Show-up"], goal: "shredding", startWeightKg: 86.4, kcalBurned: 2460, points: 540 },
    { id: "u_pt2", email: "priya@elevate.demo", name: "Priya Shah", passwordHash, role: "pt_client", tenantId, status: "active", heightCm: 168, weightKg: 58.1, bodyFatPct: 21, streak: 5, badges: ["Show-up"], goal: "fat_loss", startWeightKg: 63.4, kcalBurned: 1980, points: 610 },
    { id: "u_pt3", email: "omar@elevate.demo", name: "Omar Patel", passwordHash, role: "pt_client", tenantId, status: "active", heightCm: 176, weightKg: 79.6, bodyFatPct: 16.2, streak: 4, badges: [], goal: "weight_gain", startWeightKg: 74.0, kcalBurned: 1720, points: 390 },
    { id: "u_tr", email: "trainer@elevate.demo", name: "Maya Singh", passwordHash, role: "trainer", tenantId, status: "active", heightCm: 165, weightKg: 58, bodyFatPct: 18, streak: 0, badges: [], goal: "fat_loss", startWeightKg: 58, kcalBurned: 0, points: 0 },
    { id: "u_lapse", email: "lapsed@elevate.demo", name: "Cole Vance", passwordHash, role: "trainer", tenantId: lapsedId, status: "active", heightCm: 180, weightKg: 84, bodyFatPct: 16, streak: 0, badges: [], goal: "fat_loss", startWeightKg: 84, kcalBurned: 0, points: 0 },
    { id: "u_ad", email: "admin@elevate.demo", name: "Platform Ops", passwordHash, role: "platform_admin", tenantId: null, status: "active", heightCm: 0, weightKg: 0, bodyFatPct: 0, streak: 0, badges: [], goal: "fat_loss", startWeightKg: 0, kcalBurned: 0, points: 0 },
  ];

  const gtPlans: GtPlan[] = [
    {
      id: "plan_today",
      tenantId,
      date: today,
      revision: 1,
      groups: [
        { muscle: "Chest", exerciseIds: five(["ex_bench", "ex_incline", "ex_fly", "ex_pushup", "ex_dip"]) },
        { muscle: "Back", exerciseIds: five(["ex_row", "ex_lat", "ex_pullup", "ex_face", "ex_rdl"]) },
      ],
    },
    {
      id: "plan_yest",
      tenantId,
      date: yest,
      revision: 1,
      groups: [{ muscle: "Legs", exerciseIds: five(["ex_squat", "ex_lunge", "ex_legpress", "ex_ham", "ex_calf"]) }],
    },
    {
      id: "plan_tom",
      tenantId,
      date: tom,
      revision: 1,
      groups: [
        { muscle: "Shoulders", exerciseIds: five(["ex_ohp", "ex_latraise", "ex_rear", "ex_front", "ex_shrug"]) },
        { muscle: "Core", exerciseIds: five(["ex_plank", "ex_deadbug", "ex_pallof", "ex_hang", "ex_carry"]) },
      ],
    },
  ];

  const missedStart = new Date(Date.now() - 20 * 60 * 1000).toISOString();
  const missedEnd = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  return {
    users,
    tenants: [
      { id: tenantId, name: "Atelier Singh", slug: "atelier-singh", ownerUserId: "u_tr", subscriptionStatus: "active", tier: "atelier" },
      { id: lapsedId, name: "Vance Studio", slug: "vance-studio", ownerUserId: "u_lapse", subscriptionStatus: "canceled", tier: "studio" },
    ],
    exercises: EXERCISES,
    gtPlans,
    ptPrograms: [
      {
        id: "pt_str",
        tenantId,
        clientId: "u_pt",
        kind: "strength",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_squat", prescribedSets: 3 },
          { exerciseId: "ex_bench", prescribedSets: 3 },
          { exerciseId: "ex_row", prescribedSets: 3 },
          { exerciseId: "ex_ohp", prescribedSets: 3 },
          { exerciseId: "ex_rdl", prescribedSets: 3 },
        ],
      },
      {
        id: "pt_card",
        tenantId,
        clientId: "u_pt",
        kind: "cardio",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_bike", prescribedSets: 3 },
          { exerciseId: "ex_run", prescribedSets: 3 },
          { exerciseId: "ex_rower", prescribedSets: 3 },
          { exerciseId: "ex_ski", prescribedSets: 3 },
          { exerciseId: "ex_jump", prescribedSets: 3 },
        ],
      },
      {
        id: "pt_str2",
        tenantId,
        clientId: "u_pt2",
        kind: "strength",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_squat", prescribedSets: 3 },
          { exerciseId: "ex_bench", prescribedSets: 3 },
          { exerciseId: "ex_row", prescribedSets: 3 },
          { exerciseId: "ex_ohp", prescribedSets: 3 },
          { exerciseId: "ex_rdl", prescribedSets: 3 },
        ],
      },
      {
        id: "pt_card2",
        tenantId,
        clientId: "u_pt2",
        kind: "cardio",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_bike", prescribedSets: 3 },
          { exerciseId: "ex_run", prescribedSets: 3 },
          { exerciseId: "ex_rower", prescribedSets: 3 },
          { exerciseId: "ex_ski", prescribedSets: 3 },
          { exerciseId: "ex_jump", prescribedSets: 3 },
        ],
      },
      {
        id: "pt_str3",
        tenantId,
        clientId: "u_pt3",
        kind: "strength",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_squat", prescribedSets: 3 },
          { exerciseId: "ex_bench", prescribedSets: 3 },
          { exerciseId: "ex_row", prescribedSets: 3 },
          { exerciseId: "ex_ohp", prescribedSets: 3 },
          { exerciseId: "ex_rdl", prescribedSets: 3 },
        ],
      },
      {
        id: "pt_card3",
        tenantId,
        clientId: "u_pt3",
        kind: "cardio",
        trainerLocked: false,
        exercises: [
          { exerciseId: "ex_bike", prescribedSets: 3 },
          { exerciseId: "ex_run", prescribedSets: 3 },
          { exerciseId: "ex_rower", prescribedSets: 3 },
          { exerciseId: "ex_ski", prescribedSets: 3 },
          { exerciseId: "ex_jump", prescribedSets: 3 },
        ],
      },
    ],
    sessions: [],
    bookings: [
      {
        id: "bk_miss",
        tenantId,
        trainerId: "u_tr",
        clientId: "u_pt",
        startAt: missedStart,
        endAt: missedEnd,
        status: "booked",
        graceMinutes: 15,
        rescheduledFromId: null,
      },
      {
        id: "bk_future",
        tenantId,
        trainerId: "u_tr",
        clientId: "u_pt",
        startAt: new Date(Date.now() + 86400000 * 2).toISOString(),
        endAt: new Date(Date.now() + 86400000 * 2 + 3600000).toISOString(),
        status: "booked",
        graceMinutes: 15,
        rescheduledFromId: null,
      },
    ],
    messages: [
      {
        id: "msg_1",
        tenantId,
        fromId: "u_tr",
        toId: "u_gt",
        body: "Chest and back are loaded for today. Film your last set of rows if the squeeze feels off.",
        createdAt: new Date().toISOString(),
        readAt: null,
      },
    ],
    notifications: [],
    metrics: [
      { id: "m1", clientId: "u_pt", recordedAt: "2026-07-18", weightKg: 86.4, heightCm: 182, bodyFatPct: 21.2, bmi: bmi(86.4, 182) },
      { id: "m2", clientId: "u_pt", recordedAt: "2026-08-18", weightKg: 83.8, heightCm: 182, bodyFatPct: 19.6, bmi: bmi(83.8, 182) },
      { id: "m3", clientId: "u_pt", recordedAt: "2026-09-18", weightKg: 81.2, heightCm: 182, bodyFatPct: 18.4, bmi: bmi(81.2, 182) },
      { id: "m4", clientId: "u_gt", recordedAt: "2026-07-18", weightKg: 73, heightCm: 178, bodyFatPct: 25, bmi: bmi(73, 178) },
      { id: "m5", clientId: "u_gt", recordedAt: "2026-09-18", weightKg: 68.4, heightCm: 178, bodyFatPct: 22, bmi: bmi(68.4, 178) },
    ],
    images: [],
    certificates: [],
    audit: [
      { id: "a1", at: new Date().toISOString(), actorId: "u_ad", action: "seed", detail: "Elevate OS demo store initialized" },
    ],
  };
}

let cache: StoreData | null = null;
let chain = Promise.resolve();

export function processNoShows(store: StoreData) {
  const now = Date.now();
  for (const booking of store.bookings) {
    if (booking.status !== "booked") continue;
    const deadline = new Date(booking.startAt).getTime() + booking.graceMinutes * 60_000;
    if (now <= deadline) continue;
    booking.status = "no_show";
    const nextStart = new Date(new Date(booking.startAt).getTime() + 86_400_000);
    const nextEnd = new Date(new Date(booking.endAt).getTime() + 86_400_000);
    const next: Booking = {
      id: uid("bk"),
      tenantId: booking.tenantId,
      trainerId: booking.trainerId,
      clientId: booking.clientId,
      startAt: nextStart.toISOString(),
      endAt: nextEnd.toISOString(),
      status: "booked",
      graceMinutes: booking.graceMinutes,
      rescheduledFromId: booking.id,
    };
    store.bookings.push(next);
    const when = nextStart.toLocaleString();
    notify(store, booking.clientId, "Session moved", `No-show recorded. New slot: ${when}.`);
    notify(store, booking.trainerId, "Client no-show", `Auto-rescheduled to ${when}.`);
    store.audit.push({
      id: uid("a"),
      at: new Date().toISOString(),
      actorId: "system",
      action: "booking.no_show",
      detail: `${booking.id} → ${next.id}`,
    });
  }
}

function notify(store: StoreData, userId: string, title: string, body: string) {
  store.notifications.unshift({
    id: uid("n"),
    userId,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

async function writeStore(store: StoreData) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(store, null, 2));
  cache = store;
}

function migrate(store: StoreData) {
  for (const user of store.users) {
    if (!user.goal) user.goal = user.role === "pt_client" ? "shredding" : "fat_loss";
    if (user.startWeightKg == null) user.startWeightKg = user.weightKg;
    if (user.kcalBurned == null) user.kcalBurned = 0;
    if (user.points == null) user.points = 0;
  }
}

export async function getStore(): Promise<StoreData> {
  if (!cache) {
    try {
      const raw = await fs.readFile(FILE, "utf8");
      cache = JSON.parse(raw) as StoreData;
    } catch {
      cache = await seed();
      await writeStore(cache);
    }
  }
  migrate(cache);
  const before = cache.bookings.filter((b) => b.status === "no_show").length;
  processNoShows(cache);
  const after = cache.bookings.filter((b) => b.status === "no_show").length;
  if (after !== before) await writeStore(cache);
  return cache;
}

export function mutate<T>(fn: (store: StoreData) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const store = await getStore();
    processNoShows(store);
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function publicUser(user: User) {
  const { passwordHash: _p, ...rest } = user;
  return rest;
}

export function tenantAccess(store: StoreData, user: User) {
  if (user.role !== "trainer") return true;
  const tenant = store.tenants.find((t) => t.id === user.tenantId);
  return tenant?.subscriptionStatus === "active" || tenant?.subscriptionStatus === "trialing";
}

export function findExercise(store: StoreData, id: string) {
  return store.exercises.find((e) => e.id === id);
}

export function assertFive(groups: GtPlan["groups"]) {
  for (const group of groups) {
    if (group.exerciseIds.length !== 5) {
      throw new Error(`${group.muscle} must have exactly 5 exercise variations`);
    }
  }
}

export function openSession(
  store: StoreData,
  client: User,
  opts: { date: string; programType: "gt" | "pt"; kind?: "cardio" | "strength" },
): WorkoutSession {
  const existing = store.sessions.find(
    (s) =>
      s.clientId === client.id &&
      s.date === opts.date &&
      s.programType === opts.programType &&
      s.kind === opts.kind &&
      s.status !== "abandoned",
  );
  if (existing) return existing;

  const sets = [];
  if (opts.programType === "gt") {
    const plan = store.gtPlans.find((p) => p.tenantId === client.tenantId && p.date === opts.date);
    if (!plan) throw new Error("No published plan for that date");
    assertFive(plan.groups);
    for (const group of plan.groups) {
      for (const exerciseId of group.exerciseIds) {
        for (let n = 1; n <= 3; n += 1) {
          sets.push({
            id: uid("set"),
            exerciseId,
            setNumber: n,
            reps: "",
            weightKg: "",
            restSeconds: "90",
            notes: "",
            completedAt: null,
          });
        }
      }
    }
  } else {
    const program = store.ptPrograms.find(
      (p) => p.clientId === client.id && p.kind === opts.kind,
    );
    if (!program) throw new Error("Program not found");
    for (const block of program.exercises) {
      for (let n = 1; n <= block.prescribedSets; n += 1) {
        sets.push({
          id: uid("set"),
          exerciseId: block.exerciseId,
          setNumber: n,
          reps: "",
          weightKg: "",
          restSeconds: "90",
          notes: "",
          completedAt: null,
        });
      }
    }
  }

  const session: WorkoutSession = {
    id: uid("ses"),
    tenantId: client.tenantId ?? "",
    clientId: client.id,
    programType: opts.programType,
    kind: opts.kind,
    date: opts.date,
    status: "in_progress",
    startedAt: new Date().toISOString(),
    completedAt: null,
    sets,
    certificateId: null,
  };
  store.sessions.push(session);
  return session;
}

export { notify };

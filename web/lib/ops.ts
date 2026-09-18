import { bmi, hashPassword, todayISO, uid, verifyPassword } from "./crypto";
import { studioBoard } from "./stats";
import { assertFive, findExercise, mutate, notify, openSession, publicUser, tenantAccess } from "./store";
import type { Role, StoreData, TrainingGoal, User } from "./types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function requireUser(user: User | null): User {
  if (!user) throw new ApiError(401, "Sign in required");
  if (user.status !== "active") throw new ApiError(403, "Account is not active");
  return user;
}

function requireRole(user: User, roles: Role[]) {
  if (!roles.includes(user.role)) throw new ApiError(403, "Wrong workspace for this account");
}

function requireTrainerPaid(store: StoreData, user: User) {
  if (user.role !== "trainer") return;
  if (!tenantAccess(store, user)) {
    throw new ApiError(402, "SUBSCRIPTION_INACTIVE");
  }
}

function hydrateSession(store: StoreData, sessionId: string) {
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) throw new ApiError(404, "Session not found");
  const exercises = store.exercises;
  return {
    ...session,
    sets: session.sets.map((set) => ({
      ...set,
      exercise: exercises.find((e) => e.id === set.exerciseId) ?? null,
    })),
  };
}

function validSets(session: { sets: { completedAt: string | null; weightKg: string; reps: string; exerciseId: string }[] }) {
  return session.sets.filter((s) => s.completedAt);
}

export async function dispatch(op: string, body: Record<string, unknown>, actor: User | null) {
  return mutate((store) => {
    switch (op) {
      case "login": {
        const email = String(body.email ?? "").toLowerCase().trim();
        const password = String(body.password ?? "");
        const user = store.users.find((u) => u.email === email && u.status !== "deleted");
        if (!user || !verifyPassword(password, user.passwordHash)) {
          throw new ApiError(401, "Those credentials were not recognized");
        }
        if (user.status === "suspended") throw new ApiError(403, "This account is suspended");
        store.audit.push({
          id: uid("a"),
          at: new Date().toISOString(),
          actorId: user.id,
          action: "auth.login",
          detail: user.email,
        });
        return { user: publicUser(user), tenant: store.tenants.find((t) => t.id === user.tenantId) ?? null };
      }
      case "bootstrap": {
        const user = requireUser(actor);
        const tenant = store.tenants.find((t) => t.id === user.tenantId) ?? null;
        return {
          user: publicUser(user),
          tenant,
          notifications: store.notifications.filter((n) => n.userId === user.id).slice(0, 12),
          exercises: store.exercises,
        };
      }
      case "gt.calendar": {
        const user = requireUser(actor);
        requireRole(user, ["gt_client"]);
        const dates = store.gtPlans.filter((p) => p.tenantId === user.tenantId).map((p) => p.date);
        const sessions = store.sessions.filter((s) => s.clientId === user.id && s.programType === "gt");
        return {
          dates,
          sessions,
          leaderboard: studioBoard(store, user.tenantId, "gt_client"),
          messages: store.messages.filter((m) => m.toId === user.id),
        };
      }
      case "gt.plan": {
        const user = requireUser(actor);
        requireRole(user, ["gt_client", "trainer"]);
        const date = String(body.date ?? todayISO());
        const tenantId = user.role === "trainer" ? user.tenantId : user.tenantId;
        const plan = store.gtPlans.find((p) => p.tenantId === tenantId && p.date === date);
        if (!plan) throw new ApiError(404, "No plan published for that date");
        return {
          plan: {
            ...plan,
            groups: plan.groups.map((g) => ({
              ...g,
              exercises: g.exerciseIds.map((id) => findExercise(store, id)),
            })),
          },
        };
      }
      case "session.open": {
        const user = requireUser(actor);
        const programType = body.programType === "pt" ? "pt" : "gt";
        if (programType === "gt") requireRole(user, ["gt_client"]);
        else requireRole(user, ["pt_client"]);
        const date = String(body.date ?? todayISO());
        const kind = body.kind === "cardio" || body.kind === "strength" ? body.kind : undefined;
        const session = openSession(store, user, { date, programType, kind });
        return { session: hydrateSession(store, session.id) };
      }
      case "set.save": {
        const user = requireUser(actor);
        const session = store.sessions.find((s) => s.id === body.sessionId);
        if (!session || session.clientId !== user.id) throw new ApiError(404, "Session not found");
        if (session.status !== "in_progress") throw new ApiError(409, "Session is closed");
        const set = session.sets.find((s) => s.id === body.setId);
        if (!set) throw new ApiError(404, "Set not found");
        if (set.completedAt) throw new ApiError(409, "Completed sets cannot be silently edited");
        set.reps = String(body.reps ?? set.reps);
        set.weightKg = String(body.weightKg ?? set.weightKg);
        set.restSeconds = String(body.restSeconds ?? set.restSeconds);
        set.notes = String(body.notes ?? set.notes);
        return { session: hydrateSession(store, session.id) };
      }
      case "set.complete": {
        const user = requireUser(actor);
        const session = store.sessions.find((s) => s.id === body.sessionId);
        if (!session || session.clientId !== user.id) throw new ApiError(404, "Session not found");
        if (session.status !== "in_progress") throw new ApiError(409, "Session is closed");
        const set = session.sets.find((s) => s.id === body.setId);
        if (!set) throw new ApiError(404, "Set not found");
        if (set.completedAt) return { session: hydrateSession(store, session.id) };
        set.reps = String(body.reps ?? set.reps);
        set.weightKg = String(body.weightKg ?? set.weightKg);
        set.restSeconds = String(body.restSeconds ?? set.restSeconds);
        set.notes = String(body.notes ?? set.notes);
        if (!set.reps || !set.weightKg) {
          throw new ApiError(422, "Log reps and weight before Complete Set");
        }
        set.completedAt = new Date().toISOString();
        return { session: hydrateSession(store, session.id) };
      }
      case "session.complete": {
        const user = requireUser(actor);
        const session = store.sessions.find((s) => s.id === body.sessionId && s.clientId === user.id);
        if (!session) throw new ApiError(404, "Session not found");
        const open = session.sets.filter((s) => !s.completedAt);
        if (open.length) {
          throw new ApiError(409, `${open.length} set(s) still need Complete Set`);
        }
        session.status = "completed";
        session.completedAt = new Date().toISOString();
        user.streak += 1;
        if (user.streak >= 3 && !user.badges.includes("Show-up")) user.badges.push("Show-up");
        if (user.streak >= 7 && !user.badges.includes("Week of fire")) user.badges.push("Week of fire");
        const counted = validSets(session);
        const totalKg = counted.reduce((n, s) => n + Number(s.weightKg || 0) * Number(s.reps || 0), 0);
        const durationMin = Math.max(
          1,
          Math.round((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000),
        );
        const muscles = [
          ...new Set(
            counted
              .map((s) => findExercise(store, s.exerciseId)?.primaryMuscle)
              .filter(Boolean) as string[],
          ),
        ];
        const cert = {
          id: uid("cert"),
          token: uid("share"),
          sessionId: session.id,
          clientName: user.name,
          date: session.date,
          programLabel: session.programType === "gt" ? "Group training" : `PT · ${session.kind}`,
          validSets: counted.length,
          totalKg,
          durationMin,
          muscles,
        };
        store.certificates.push(cert);
        session.certificateId = cert.id;
        const kcal = Math.round(durationMin * (session.kind === "cardio" ? 9 : 7) + totalKg * 0.04);
        const awarded = counted.length * 12;
        user.kcalBurned = (user.kcalBurned ?? 0) + kcal;
        user.points = (user.points ?? 0) + awarded;
        notify(store, user.id, "Certificate ready", "Your session card is ready to share.");
        const trainer = store.users.find((u) => u.role === "trainer" && u.tenantId === user.tenantId);
        if (trainer) notify(store, trainer.id, "Session complete", `${user.name} finished today's work.`);
        return { session: hydrateSession(store, session.id), certificate: cert };
      }
      case "pt.dashboard": {
        const user = requireUser(actor);
        requireRole(user, ["pt_client"]);
        return {
          programs: store.ptPrograms.filter((p) => p.clientId === user.id),
          bookings: store.bookings.filter((b) => b.clientId === user.id),
          metrics: store.metrics.filter((m) => m.clientId === user.id),
          images: store.images.filter((i) => i.clientId === user.id),
          sessions: store.sessions.filter((s) => s.clientId === user.id),
          profile: publicUser(user),
          bmi: bmi(user.weightKg, user.heightCm),
          leaderboard: studioBoard(store, user.tenantId, "pt_client"),
        };
      }
      case "pt.profile": {
        const user = requireUser(actor);
        requireRole(user, ["pt_client"]);
        user.weightKg = Number(body.weightKg ?? user.weightKg);
        user.heightCm = Number(body.heightCm ?? user.heightCm);
        user.bodyFatPct = Number(body.bodyFatPct ?? user.bodyFatPct);
        store.metrics.push({
          id: uid("m"),
          clientId: user.id,
          recordedAt: todayISO(),
          weightKg: user.weightKg,
          heightCm: user.heightCm,
          bodyFatPct: user.bodyFatPct,
          bmi: bmi(user.weightKg, user.heightCm),
        });
        if (typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image")) {
          store.images.push({
            id: uid("img"),
            clientId: user.id,
            kind: body.imageKind === "after" ? "after" : body.imageKind === "progress" ? "progress" : "before",
            dataUrl: String(body.imageDataUrl),
            capturedAt: new Date().toISOString(),
          });
        }
        return { profile: publicUser(user), bmi: bmi(user.weightKg, user.heightCm) };
      }
      case "pt.program.update": {
        const user = requireUser(actor);
        requireRole(user, ["pt_client"]);
        const program = store.ptPrograms.find((p) => p.clientId === user.id && p.kind === body.kind);
        if (!program) throw new ApiError(404, "Program not found");
        if (program.trainerLocked) throw new ApiError(403, "Trainer locked this program");
        const exercises = body.exercises as { exerciseId: string; prescribedSets: number }[] | undefined;
        if (exercises) program.exercises = exercises;
        return { program };
      }
      case "pt.book": {
        const user = requireUser(actor);
        requireRole(user, ["pt_client"]);
        const startAt = String(body.startAt);
        const endAt = String(body.endAt);
        const clash = store.bookings.some(
          (b) => b.trainerId === "u_tr" && b.status === "booked" && b.startAt === startAt,
        );
        if (clash) throw new ApiError(409, "That slot is taken");
        const booking = {
          id: uid("bk"),
          tenantId: user.tenantId ?? "",
          trainerId: store.users.find((u) => u.role === "trainer" && u.tenantId === user.tenantId)?.id ?? "u_tr",
          clientId: user.id,
          startAt,
          endAt,
          status: "booked" as const,
          graceMinutes: 15,
          rescheduledFromId: null,
        };
        store.bookings.push(booking);
        notify(store, booking.trainerId, "New booking", `${user.name} booked ${new Date(startAt).toLocaleString()}`);
        return { booking };
      }
      case "trainer.board": {
        const user = requireUser(actor);
        requireRole(user, ["trainer"]);
        requireTrainerPaid(store, user);
        const clients = store.users.filter(
          (u) => u.tenantId === user.tenantId && (u.role === "gt_client" || u.role === "pt_client"),
        );
        const today = todayISO();
        const rows = clients.map((c) => {
          const last = store.sessions
            .filter((s) => s.clientId === c.id)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
          const todaySession = store.sessions.find((s) => s.clientId === c.id && s.date === today);
          const noshows = store.bookings.filter((b) => b.clientId === c.id && b.status === "no_show").length;
          return {
            ...publicUser(c),
            program: c.role === "gt_client" ? "GT" : "PT",
            lastWorkout: last?.date ?? "—",
            todayStatus: todaySession?.status ?? "not_started",
            bmi: bmi(c.weightKg, c.heightCm),
            noshows,
            goal: c.goal ?? "fat_loss",
            kcal: c.kcalBurned ?? 0,
            points: c.points ?? 0,
          };
        });
        return {
          rows,
          floor: rows.filter((r) => r.program === "GT"),
          studio: rows.filter((r) => r.program === "PT"),
          goals: {
            fat_loss: rows.filter((r) => r.goal === "fat_loss"),
            weight_gain: rows.filter((r) => r.goal === "weight_gain"),
            shredding: rows.filter((r) => r.goal === "shredding"),
          },
          bookings: store.bookings.filter((b) => b.trainerId === user.id),
          messages: store.messages.filter((m) => m.fromId === user.id || m.toId === user.id),
          plans: store.gtPlans.filter((p) => p.tenantId === user.tenantId),
          live: rows.filter((r) => r.todayStatus === "in_progress"),
        };
      }
      case "trainer.message": {
        const user = requireUser(actor);
        requireRole(user, ["trainer"]);
        requireTrainerPaid(store, user);
        const toId = String(body.toId);
        const msg = {
          id: uid("msg"),
          tenantId: user.tenantId ?? "",
          fromId: user.id,
          toId,
          body: String(body.body ?? ""),
          createdAt: new Date().toISOString(),
          readAt: null,
        };
        store.messages.push(msg);
        notify(store, toId, "Message from your trainer", "Open your dashboard to read it.");
        return { message: msg };
      }
      case "trainer.plan.save": {
        const user = requireUser(actor);
        requireRole(user, ["trainer"]);
        requireTrainerPaid(store, user);
        const date = String(body.date);
        const groups = body.groups as { muscle: string; exerciseIds: string[] }[];
        assertFive(groups);
        let plan = store.gtPlans.find((p) => p.tenantId === user.tenantId && p.date === date);
        if (!plan) {
          plan = { id: uid("plan"), tenantId: user.tenantId ?? "", date, revision: 1, groups };
          store.gtPlans.push(plan);
        } else {
          plan.groups = groups;
          plan.revision += 1;
        }
        return { plan };
      }
      case "trainer.pt.lock": {
        const user = requireUser(actor);
        requireRole(user, ["trainer"]);
        requireTrainerPaid(store, user);
        const program = store.ptPrograms.find((p) => p.clientId === body.clientId && p.kind === body.kind);
        if (!program) throw new ApiError(404, "Program not found");
        program.trainerLocked = Boolean(body.locked);
        return { program };
      }
      case "admin.overview": {
        const user = requireUser(actor);
        requireRole(user, ["platform_admin"]);
        const byRole = {
          gt_client: store.users.filter((u) => u.role === "gt_client" && u.status === "active").length,
          pt_client: store.users.filter((u) => u.role === "pt_client" && u.status === "active").length,
          trainer: store.users.filter((u) => u.role === "trainer" && u.status === "active").length,
          platform_admin: store.users.filter((u) => u.role === "platform_admin" && u.status === "active").length,
        };
        const subs = {
          active: store.tenants.filter((t) => t.subscriptionStatus === "active" || t.subscriptionStatus === "trialing").length,
          revoked: store.tenants.filter((t) => t.subscriptionStatus !== "active" && t.subscriptionStatus !== "trialing").length,
        };
        return {
          users: store.users.map(publicUser),
          tenants: store.tenants,
          byRole,
          subs,
          audit: store.audit.slice(-40).reverse(),
          revenue: [
            { month: "May", amount: 4200 },
            { month: "Jun", amount: 4800 },
            { month: "Jul", amount: 5100 },
            { month: "Aug", amount: 5600 },
            { month: "Sep", amount: 6100 },
          ],
        };
      }
      case "admin.user": {
        const user = requireUser(actor);
        requireRole(user, ["platform_admin"]);
        const target = store.users.find((u) => u.id === body.userId);
        if (!target) throw new ApiError(404, "User not found");
        if (body.status === "suspended" || body.status === "active" || body.status === "deleted") {
          target.status = body.status;
        }
        if (typeof body.email === "string") target.email = body.email;
        if (body.goal === "fat_loss" || body.goal === "weight_gain" || body.goal === "shredding") {
          target.goal = body.goal;
        }
        store.audit.push({
          id: uid("a"),
          at: new Date().toISOString(),
          actorId: user.id,
          action: "admin.user",
          detail: `${target.email} → ${target.status}`,
        });
        return { user: publicUser(target) };
      }
      case "admin.register": {
        const user = requireUser(actor);
        requireRole(user, ["platform_admin"]);
        const email = String(body.email ?? "").toLowerCase().trim();
        const name = String(body.name ?? "").trim();
        const role = body.role === "pt_client" ? "pt_client" : "gt_client";
        const rawGoal = String(body.goal);
        const goal: TrainingGoal | null =
          rawGoal === "fat_loss" || rawGoal === "weight_gain" || rawGoal === "shredding" ? rawGoal : null;
        if (!email || !name) throw new ApiError(422, "Name and email are required");
        if (!goal) throw new ApiError(422, "Select fat loss, weight gain, or shredding");
        if (store.users.some((u) => u.email === email)) throw new ApiError(409, "Email already exists");
        const tenant = store.tenants.find((t) => t.slug === "atelier-singh") ?? store.tenants[0];
        const created: User = {
          id: uid("u"),
          email,
          name,
          passwordHash: hashPassword("elevate-demo"),
          role,
          tenantId: tenant?.id ?? "ten_atelier",
          status: "active",
          heightCm: Number(body.heightCm ?? 170),
          weightKg: Number(body.weightKg ?? 70),
          bodyFatPct: Number(body.bodyFatPct ?? 22),
          streak: 0,
          badges: [],
          goal,
          startWeightKg: Number(body.weightKg ?? 70),
          kcalBurned: 0,
          points: 0,
        };
        store.users.push(created);
        if (role === "pt_client") {
          store.ptPrograms.push({
            id: uid("pt"),
            tenantId: created.tenantId ?? "",
            clientId: created.id,
            kind: "strength",
            trainerLocked: false,
            exercises: [
              { exerciseId: "ex_squat", prescribedSets: 3 },
              { exerciseId: "ex_bench", prescribedSets: 3 },
              { exerciseId: "ex_row", prescribedSets: 3 },
              { exerciseId: "ex_ohp", prescribedSets: 3 },
              { exerciseId: "ex_rdl", prescribedSets: 3 },
            ],
          });
          store.ptPrograms.push({
            id: uid("pt"),
            tenantId: created.tenantId ?? "",
            clientId: created.id,
            kind: "cardio",
            trainerLocked: false,
            exercises: [
              { exerciseId: "ex_bike", prescribedSets: 3 },
              { exerciseId: "ex_run", prescribedSets: 3 },
              { exerciseId: "ex_rower", prescribedSets: 3 },
              { exerciseId: "ex_ski", prescribedSets: 3 },
              { exerciseId: "ex_jump", prescribedSets: 3 },
            ],
          });
        }
        store.audit.push({
          id: uid("a"),
          at: new Date().toISOString(),
          actorId: user.id,
          action: "admin.register",
          detail: `${created.email} · ${role} · ${goal}`,
        });
        return { user: publicUser(created) };
      }
      case "admin.recovery": {
        const user = requireUser(actor);
        requireRole(user, ["platform_admin"]);
        const target = store.users.find((u) => u.id === body.userId);
        if (!target) throw new ApiError(404, "User not found");
        store.audit.push({
          id: uid("a"),
          at: new Date().toISOString(),
          actorId: user.id,
          action: "admin.recovery",
          detail: `Reset issued for ${target.email} (password never exposed)`,
        });
        notify(store, target.id, "Account recovery", "Use elevate-demo after confirming the reset email (demo).");
        return { ok: true };
      }
      case "admin.subscription": {
        const user = requireUser(actor);
        requireRole(user, ["platform_admin"]);
        const tenant = store.tenants.find((t) => t.id === body.tenantId);
        if (!tenant) throw new ApiError(404, "Tenant not found");
        tenant.subscriptionStatus = body.status === "active" ? "active" : "canceled";
        store.audit.push({
          id: uid("a"),
          at: new Date().toISOString(),
          actorId: user.id,
          action: "billing.revoke",
          detail: `${tenant.slug} → ${tenant.subscriptionStatus}`,
        });
        return { tenant };
      }
      case "certificate.get": {
        const token = String(body.token ?? "");
        const cert = store.certificates.find((c) => c.token === token || c.id === token);
        if (!cert) throw new ApiError(404, "Certificate not found");
        return { certificate: cert };
      }
      default:
        throw new ApiError(400, `Unknown operation ${op}`);
    }
  });
}

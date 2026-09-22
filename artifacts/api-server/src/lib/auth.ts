import crypto from 'crypto';
import type { AuthUser } from '@workspace/api-zod';
import { db, employeeAccessTable, sessionsTable } from '@workspace/db';
import { and, eq } from 'drizzle-orm';
import { type Request, type Response } from 'express';

export const EMPLOYEE_ROLES = [
  'technician',
  'managerial',
  'administrator',
  'visitor',
] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_EMPLOYEE_IDS_ENV = 'QC_ADMIN_EMPLOYEE_IDS';

export interface SessionData {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString('hex');
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(res: Response, sid?: string): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers['authorization'];
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}

export function normalizeEmployeeId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function getEmployeeIdFromUser(user: AuthUser | null | undefined): string | null {
  const id = user?.id;
  return id?.startsWith('employee:') ? normalizeEmployeeId(id.slice(9)) : null;
}

export function getConfiguredAdminEmployeeIds(): Set<string> {
  return new Set(
    (process.env[ADMIN_EMPLOYEE_IDS_ENV] ?? '')
      .split(',')
      .map((employeeId) => normalizeEmployeeId(employeeId))
      .filter((employeeId): employeeId is string => Boolean(employeeId)),
  );
}

export async function isConfiguredAdministrator(
  user: AuthUser | null | undefined,
): Promise<boolean> {
  const employeeId = getEmployeeIdFromUser(user);
  if (!employeeId) return false;
  if (getConfiguredAdminEmployeeIds().has(employeeId)) return true;

  const [entry] = await db
    .select({
      administrator: employeeAccessTable.administrator,
      role: employeeAccessTable.role,
    })
    .from(employeeAccessTable)
    .where(and(
      eq(employeeAccessTable.employeeId, employeeId),
      eq(employeeAccessTable.active, true),
    ));
  return entry?.administrator === true || entry?.role === 'administrator';
}

export async function getEmployeeRole(
  user: AuthUser | null | undefined,
): Promise<EmployeeRole | null> {
  const employeeId = getEmployeeIdFromUser(user);
  if (!employeeId) return null;
  if (getConfiguredAdminEmployeeIds().has(employeeId)) return 'administrator';

  const [entry] = await db
    .select({
      active: employeeAccessTable.active,
      administrator: employeeAccessTable.administrator,
      role: employeeAccessTable.role,
    })
    .from(employeeAccessTable)
    .where(eq(employeeAccessTable.employeeId, employeeId));

  if (!entry?.active) return null;
  if (entry.administrator || entry.role === 'administrator') return 'administrator';
  return EMPLOYEE_ROLES.includes(entry.role as EmployeeRole)
    ? (entry.role as EmployeeRole)
    : 'technician';
}

export async function hasApprovedEmployeeAccess(
  user: AuthUser | null | undefined,
): Promise<boolean> {
  const employeeId = getEmployeeIdFromUser(user);
  if (!employeeId) return false;

  const [entry] = await db
    .select({
      active: employeeAccessTable.active,
      administrator: employeeAccessTable.administrator,
      role: employeeAccessTable.role,
    })
    .from(employeeAccessTable)
    .where(eq(employeeAccessTable.employeeId, employeeId));

  return entry?.active === true;
}

export async function ensureConfiguredAdminAccess(
  employeeId: string | null | undefined,
): Promise<void> {
  const normalized = normalizeEmployeeId(employeeId);
  if (!normalized || !getConfiguredAdminEmployeeIds().has(normalized)) return;

  await db
    .insert(employeeAccessTable)
    .values({
      employeeId: normalized,
      active: true,
      administrator: true,
      role: 'administrator',
    })
    .onConflictDoUpdate({
      target: employeeAccessTable.employeeId,
      set: {
        active: true,
        administrator: true,
        role: 'administrator',
        updatedAt: new Date(),
      },
    });
}

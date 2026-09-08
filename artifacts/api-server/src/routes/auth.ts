import {
  CreateEmployeeAccessBody,
  CreateEmployeeAccessResponse,
  GetCurrentAuthUserResponse,
  GetEmployeeAccessResponse,
  LogoutMobileSessionResponse,
  UpdateEmployeeAccessBody,
  UpdateEmployeeAccessParams,
  UpdateEmployeeAccessResponse,
} from '@workspace/api-zod';
import { db, employeeAccessTable, usersTable } from '@workspace/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Router, type IRouter, type Request, type Response } from 'express';

import {
  clearSession,
  createSession,
  deleteSession,
  ensureConfiguredAdminAccess,
  getSessionId,
  hasApprovedEmployeeAccess,
  isConfiguredAdministrator,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from '../lib/auth';
import {
  getActiveEmployee,
  normalizeEmployeeId,
} from '../lib/employee-access';
import {
  requireAdministrator,
  requireAuthenticated,
} from '../middlewares/requireAuthenticated';

const router: IRouter = Router();

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return '/';
  }
  return value;
}

router.get('/auth/user', (req: Request, res: Response) => {
  void (async () => {
    const user = req.isAuthenticated() ? req.user : null;
    const accessAllowed = user ? await hasApprovedEmployeeAccess(user) : false;
    res.json(
      GetCurrentAuthUserResponse.parse({
        user,
        accessAllowed,
        isAdmin: user ? await isConfiguredAdministrator(user) : false,
      }),
    );
  })().catch(() => {
    res.status(500).json({ error: 'Unable to verify employee access.' });
  });
});

router.post('/employee-login', async (req: Request, res: Response) => {
  const employeeId = normalizeEmployeeId(req.body?.employeeId);
  const employee = await getActiveEmployee(employeeId);
  if (!employee) {
    res.status(401).json({ error: 'This employee ID is not registered.' });
    return;
  }

  const userId = `employee:${employeeId}`;
  const [dbUser] = await db
    .insert(usersTable)
    .values({
      id: userId,
      email: null,
      firstName: employee.name,
      lastName: null,
      profileImageUrl: null,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        firstName: employee.name,
        lastName: null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureConfiguredAdminAccess(employeeId);

  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: `employee-session:${employeeId}`,
    expires_at: Math.floor((Date.now() + SESSION_TTL) / 1000),
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ user: sessionData.user });
});

router.get('/login', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Employee ID login is required.' });
});

router.get('/callback', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Employee ID login is required.' });
});

router.get('/logout', async (req: Request, res: Response) => {
  const returnTo = getSafeReturnTo(req.query.returnTo);
  await clearSession(res, getSessionId(req));
  res.redirect(returnTo);
});

router.post('/mobile-auth/token-exchange', (_req: Request, res: Response) => {
  res.status(410).json({ error: 'Employee ID login is required.' });
});

router.post('/mobile-auth/logout', async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

function employeeAccessResponse(
  entry: typeof employeeAccessTable.$inferSelect,
  displayName: string | null,
) {
  return {
    id: entry.id,
    employeeId: entry.employeeId,
    displayName: displayName || `Employee ${entry.employeeId}`,
    active: entry.active,
    administrator: entry.administrator,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

router.get(
  '/auth/employee-access',
  requireAuthenticated,
  requireAdministrator,
  async (_req: Request, res: Response) => {
    const rows = await db
      .select({
        entry: employeeAccessTable,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(employeeAccessTable)
      .leftJoin(
        usersTable,
        eq(
          usersTable.id,
          sql<string>`'employee:' || ${employeeAccessTable.employeeId}`,
        ),
      )
      .orderBy(desc(employeeAccessTable.active), asc(employeeAccessTable.employeeId));

    res.json(
      GetEmployeeAccessResponse.parse({
        employees: rows.map(({ entry, firstName, lastName }) =>
          employeeAccessResponse(
            entry,
            [firstName, lastName].filter(Boolean).join(' ') || null,
          ),
        ),
      }),
    );
  },
);

router.post(
  '/auth/employee-access',
  requireAuthenticated,
  requireAdministrator,
  async (req: Request, res: Response) => {
    const parsed = CreateEmployeeAccessBody.safeParse(req.body);
    const employeeId = parsed.success
      ? normalizeEmployeeId(parsed.data.employeeId)
      : '';
    const employee = employeeId ? await getActiveEmployee(employeeId) : null;
    if (!employeeId || !employee) {
      res.status(400).json({ error: 'A registered employee ID is required.' });
      return;
    }

    const [entry] = await db
      .insert(employeeAccessTable)
      .values({ employeeId, active: true })
      .onConflictDoUpdate({
        target: employeeAccessTable.employeeId,
        set: { active: true, updatedAt: new Date() },
      })
      .returning();

    const [user] = await db
      .select({
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(usersTable)
      .where(eq(usersTable.id, `employee:${entry.employeeId}`));

    res.status(201).json(
      CreateEmployeeAccessResponse.parse(
        employeeAccessResponse(
          entry,
          [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
            employee.name ||
            null,
        ),
      ),
    );
  },
);

router.patch(
  '/auth/employee-access/:id',
  requireAuthenticated,
  requireAdministrator,
  async (req: Request, res: Response) => {
    const parsedParams = UpdateEmployeeAccessParams.safeParse(req.params);
    const parsedBody = UpdateEmployeeAccessBody.safeParse(req.body);
    if (
      !parsedParams.success ||
      !parsedBody.success ||
      (parsedBody.data.active === undefined && parsedBody.data.administrator === undefined)
    ) {
      res.status(400).json({ error: 'Invalid employee access update.' });
      return;
    }

    const [currentEntry] = await db
      .select()
      .from(employeeAccessTable)
      .where(eq(employeeAccessTable.id, parsedParams.data.id));
    if (!currentEntry) {
      res.status(404).json({ error: 'Employee access entry not found.' });
      return;
    }

    if (parsedBody.data.administrator === false && currentEntry.administrator) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeeAccessTable)
        .where(and(
          eq(employeeAccessTable.active, true),
          eq(employeeAccessTable.administrator, true),
        ));
      if (Number(count) <= 1) {
        res.status(400).json({ error: 'At least one active administrator must remain.' });
        return;
      }
    }

    if (parsedBody.data.active === false && currentEntry.active && currentEntry.administrator) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeeAccessTable)
        .where(and(
          eq(employeeAccessTable.active, true),
          eq(employeeAccessTable.administrator, true),
        ));
      if (Number(count) <= 1) {
        res.status(400).json({ error: 'At least one active administrator must remain.' });
        return;
      }
    }

    const [entry] = await db
      .update(employeeAccessTable)
      .set({
        ...(parsedBody.data.active === undefined ? {} : { active: parsedBody.data.active }),
        ...(parsedBody.data.administrator === undefined ? {} : { administrator: parsedBody.data.administrator }),
        updatedAt: new Date(),
      })
      .where(eq(employeeAccessTable.id, parsedParams.data.id))
      .returning();
    if (!entry) {
      res.status(404).json({ error: 'Employee access entry not found.' });
      return;
    }

    const [user] = await db
      .select({
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
      })
      .from(usersTable)
      .where(eq(usersTable.id, `employee:${entry.employeeId}`));

    res.json(
      UpdateEmployeeAccessResponse.parse(
        employeeAccessResponse(
          entry,
          [user?.firstName, user?.lastName].filter(Boolean).join(' ') || null,
        ),
      ),
    );
  },
);

export default router;

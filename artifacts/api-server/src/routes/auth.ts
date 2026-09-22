import {
  CreateEmployeeAccessBody,
  CreateEmployeeAccessResponse,
  DeleteEmployeeAccessParams,
  GetCurrentAuthUserResponse,
  GetEmployeeAccessResponse,
  LogoutMobileSessionResponse,
  UpdateEmployeeAccessBody,
  UpdateEmployeeAccessParams,
  UpdateEmployeeAccessResponse,
} from '@workspace/api-zod';
import { db, employeeAccessTable, usersTable } from '@workspace/db';
import { employeeDirectoryTable } from '@workspace/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { Router, type IRouter, type Request, type Response } from 'express';

import {
  clearSession,
  createSession,
  deleteSession,
  ensureConfiguredAdminAccess,
  getEmployeeRole,
  getSessionId,
  hasApprovedEmployeeAccess,
  isConfiguredAdministrator,
  SESSION_COOKIE,
  SESSION_TTL,
  type EmployeeRole,
  type SessionData,
} from '../lib/auth';
import {
  getActiveEmployee,
  normalizeEmployeeId,
} from '../lib/employee-access';
import {
  hashEmployeePassword,
  isValidEmployeePassword,
  verifyEmployeePassword,
} from '../lib/employee-password';
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
        role: user ? await getEmployeeRole(user) : null,
      }),
    );
  })().catch(() => {
    res.status(500).json({ error: 'Unable to verify employee access.' });
  });
});

router.post('/employee-login', async (req: Request, res: Response) => {
  const employeeId = normalizeEmployeeId(req.body?.employeeId);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const employee = await getActiveEmployee(employeeId);
  if (!employee || !isValidEmployeePassword(password) ||
      !(await verifyEmployeePassword(password, employee.passwordHash))) {
    res.status(401).json({ error: 'Invalid employee ID or password.' });
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
  passwordSet: boolean,
) {
  const role: EmployeeRole =
    entry.administrator || entry.role === 'administrator'
      ? 'administrator'
      : entry.role === 'managerial' || entry.role === 'visitor'
        ? entry.role
        : 'technician';
  return {
    id: entry.id,
    employeeId: entry.employeeId,
    displayName: displayName || `Employee ${entry.employeeId}`,
    active: entry.active,
    administrator: entry.administrator,
    role,
    passwordSet,
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
        passwordHash: employeeDirectoryTable.passwordHash,
        directoryName: employeeDirectoryTable.name,
      })
      .from(employeeAccessTable)
      .leftJoin(
        employeeDirectoryTable,
        eq(employeeDirectoryTable.employeeId, employeeAccessTable.employeeId),
      )
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
        employees: rows.map(({ entry, firstName, lastName, passwordHash, directoryName }) =>
          employeeAccessResponse(
            entry,
              [firstName, lastName].filter(Boolean).join(' ') || directoryName || null,
            Boolean(passwordHash),
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
    const name = parsed.success && typeof parsed.data.name === 'string'
      ? parsed.data.name.trim()
      : '';
    const role = parsed.success ? parsed.data.role ?? 'technician' : 'technician';
    if (!employeeId || (name && name.length > 255)) {
      res.status(400).json({ error: 'A valid employee ID is required.' });
      return;
    }

    const [entry, employee] = await db.transaction(async (tx) => {
      let [directoryEmployee] = await tx
        .select()
        .from(employeeDirectoryTable)
        .where(eq(employeeDirectoryTable.employeeId, employeeId))
        .limit(1);

      if (!directoryEmployee) {
        if (!name) {
          return [null, null] as const;
        }
        [directoryEmployee] = await tx
          .insert(employeeDirectoryTable)
          .values({ employeeId, name, active: true })
          .returning();
      } else if (!directoryEmployee.active) {
        [directoryEmployee] = await tx
          .update(employeeDirectoryTable)
          .set({ active: true, updatedAt: new Date() })
          .where(eq(employeeDirectoryTable.id, directoryEmployee.id))
          .returning();
      }

      const [accessEntry] = await tx
        .insert(employeeAccessTable)
        .values({
          employeeId,
          active: true,
          administrator: role === 'administrator',
          role,
        })
        .onConflictDoUpdate({
          target: employeeAccessTable.employeeId,
          set: {
            active: true,
            administrator: role === 'administrator',
            role,
            updatedAt: new Date(),
          },
        })
        .returning();

      return [accessEntry, directoryEmployee] as const;
    });

    if (!entry || !employee) {
      res.status(400).json({ error: 'Enter an employee name when adding a new employee.' });
      return;
    }

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
          Boolean(employee.passwordHash),
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
      (parsedBody.data.active === undefined &&
        parsedBody.data.administrator === undefined &&
        parsedBody.data.role === undefined &&
        parsedBody.data.password === undefined &&
        parsedBody.data.name === undefined)
    ) {
      res.status(400).json({ error: 'Invalid employee access update.' });
      return;
    }
    const normalizedName = parsedBody.success && parsedBody.data.name !== undefined
      ? parsedBody.data.name.trim()
      : undefined;
    if (parsedBody.success && parsedBody.data.name !== undefined && !normalizedName) {
      res.status(400).json({ error: 'Employee name cannot be blank.' });
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

    const currentIsAdministrator =
      currentEntry.administrator || currentEntry.role === 'administrator';
    const requestedRole = parsedBody.data.role;
    const roleWillBeAdministrator =
      requestedRole !== undefined
        ? requestedRole === 'administrator'
        : parsedBody.data.administrator !== undefined
          ? parsedBody.data.administrator
          : currentIsAdministrator;

    if (!roleWillBeAdministrator && currentIsAdministrator) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeeAccessTable)
        .where(and(
          eq(employeeAccessTable.active, true),
          sql`(${employeeAccessTable.administrator} = true OR ${employeeAccessTable.role} = 'administrator')`,
        ));
      if (Number(count) <= 1) {
        res.status(400).json({ error: 'At least one active administrator must remain.' });
        return;
      }
    }

    if (parsedBody.data.active === false && currentEntry.active && currentIsAdministrator) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeeAccessTable)
        .where(and(
          eq(employeeAccessTable.active, true),
          sql`(${employeeAccessTable.administrator} = true OR ${employeeAccessTable.role} = 'administrator')`,
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
        ...(requestedRole === undefined && parsedBody.data.administrator === undefined
          ? {}
          : {
              administrator: roleWillBeAdministrator,
              role: requestedRole ?? (roleWillBeAdministrator ? 'administrator' : 'technician'),
            }),
        updatedAt: new Date(),
      })
      .where(eq(employeeAccessTable.id, parsedParams.data.id))
      .returning();
    if (!entry) {
      res.status(404).json({ error: 'Employee access entry not found.' });
      return;
    }

    if (normalizedName !== undefined) {
      await db
        .update(employeeDirectoryTable)
        .set({ name: normalizedName, updatedAt: new Date() })
        .where(eq(employeeDirectoryTable.employeeId, entry.employeeId));
      await db
        .update(usersTable)
        .set({ firstName: normalizedName, lastName: null, updatedAt: new Date() })
        .where(eq(usersTable.id, `employee:${entry.employeeId}`));
    }

    if (parsedBody.data.password !== undefined) {
      await db
        .update(employeeDirectoryTable)
        .set({
          passwordHash: await hashEmployeePassword(parsedBody.data.password),
          updatedAt: new Date(),
        })
        .where(eq(employeeDirectoryTable.employeeId, entry.employeeId));
    }

    const [directoryEmployee] = await db
      .select({
        name: employeeDirectoryTable.name,
        passwordHash: employeeDirectoryTable.passwordHash,
      })
      .from(employeeDirectoryTable)
      .where(eq(employeeDirectoryTable.employeeId, entry.employeeId));
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
          [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
            directoryEmployee?.name ||
            null,
          Boolean(directoryEmployee?.passwordHash),
        ),
      ),
    );
  },
);

router.delete(
  '/auth/employee-access/:id',
  requireAuthenticated,
  requireAdministrator,
  async (req: Request, res: Response) => {
    const parsedParams = DeleteEmployeeAccessParams.safeParse(req.params);
    if (!parsedParams.success) {
      res.status(400).json({ error: 'Invalid employee access entry.' });
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

    if (
      currentEntry.active &&
      (currentEntry.administrator || currentEntry.role === 'administrator')
    ) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(employeeAccessTable)
        .where(and(
          eq(employeeAccessTable.active, true),
          sql`(${employeeAccessTable.administrator} = true OR ${employeeAccessTable.role} = 'administrator')`,
        ));
      if (Number(count) <= 1) {
        res.status(400).json({ error: 'At least one active administrator must remain.' });
        return;
      }
    }

    await db
      .delete(employeeAccessTable)
      .where(eq(employeeAccessTable.id, parsedParams.data.id));
    res.status(204).send();
  },
);

export default router;

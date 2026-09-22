import type { NextFunction, Request, Response } from "express";
import {
  getEmployeeRole,
  hasApprovedEmployeeAccess,
  isConfiguredAdministrator,
  type EmployeeRole,
} from "../lib/auth";

export async function requireAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  try {
    if (!(await hasApprovedEmployeeAccess(req.user))) {
      res.status(403).json({
        code: "EMPLOYEE_ACCESS_REQUIRED",
        error: "Your account is authenticated but has not been approved for QC access.",
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Unable to verify employee access." });
  }
}

export async function requireAdministrator(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  if (!(await isConfiguredAdministrator(req.user))) {
    res.status(403).json({
      code: "ADMINISTRATOR_ACCESS_REQUIRED",
      error: "Administrator access is required.",
    });
    return;
  }

  try {
    if (!(await hasApprovedEmployeeAccess(req.user))) {
      res.status(403).json({
        code: "EMPLOYEE_ACCESS_REQUIRED",
        error: "Your account is authenticated but has not been approved for QC access.",
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Unable to verify employee access." });
  }
}

export function requireRole(...allowedRoles: EmployeeRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }

    try {
      const role = await getEmployeeRole(req.user);
      if (!role || !allowedRoles.includes(role)) {
        res.status(403).json({
          code: "ROLE_ACCESS_REQUIRED",
          error: "Your role does not allow this action.",
        });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Unable to verify employee access." });
    }
  };
}

export const requireQcEditor = requireRole(
  "technician",
  "managerial",
  "administrator",
);
export const requireComplaintEditor = requireRole(
  "managerial",
  "administrator",
);
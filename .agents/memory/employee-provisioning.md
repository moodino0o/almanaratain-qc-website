---
name: Employee provisioning
description: Product rule for adding employee access through administrator settings.
---

The administrator add-employee flow must provision the employee directory identity and the role-based access entry together. It should also reactivate a previously disabled directory identity instead of treating it as a new or invalid ID.

**Why:** Access approval depends on the employee directory used by the login flow; granting an access row alone does not make a new person able to sign in.

**How to apply:** New employee forms must collect a name and employee ID, and the server must keep directory and access records synchronized while preserving administrator-only authorization.
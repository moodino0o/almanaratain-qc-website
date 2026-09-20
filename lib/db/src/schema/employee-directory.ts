import { boolean, index, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const employeeDirectoryTable = pgTable(
  "employee_directory",
  {
    id: serial("id").primaryKey(),
    employeeId: varchar("employee_id", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    activeIndex: index("employee_directory_active_idx").on(table.active),
  }),
);

export type EmployeeDirectoryRow = typeof employeeDirectoryTable.$inferSelect;
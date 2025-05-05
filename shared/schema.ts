import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("staff"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
});

// Common fields for both expenses and gains
const transactionFields = {
  id: serial("id").primaryKey(),
  slNo: varchar("sl_no", { length: 10 }).notNull().unique(),
  date: varchar("date", { length: 10 }).notNull(),
  time: varchar("time", { length: 10 }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  detail: text("detail").notNull(),
  paymentType: text("payment_type").notNull(),
  amount: doublePrecision("amount").notNull(),
  createdBy: integer("created_by").notNull(),
};

export const expenses = pgTable("expenses", transactionFields);

export const gains = pgTable("gains", transactionFields);

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
});

export const insertGainSchema = createInsertSchema(gains).omit({
  id: true,
});

export const customExpenseTypeSchema = z.object({
  type: z.string().min(1, "Type is required")
});

export const customGainTypeSchema = z.object({
  type: z.string().min(1, "Type is required")
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Gain = typeof gains.$inferSelect;
export type InsertGain = z.infer<typeof insertGainSchema>;
export type CustomExpenseType = z.infer<typeof customExpenseTypeSchema>;
export type CustomGainType = z.infer<typeof customGainTypeSchema>;

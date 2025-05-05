import { 
  users, type User, type InsertUser,
  expenses, type Expense, type InsertExpense,
  gains, type Gain, type InsertGain 
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Expense operations
  createExpense(expense: InsertExpense): Promise<Expense>;
  getExpenses(): Promise<Expense[]>;
  getExpense(id: number): Promise<Expense | undefined>;
  updateExpense(id: number, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: number): Promise<boolean>;
  getNextExpenseSlNo(): Promise<string>;
  
  // Gain operations
  createGain(gain: InsertGain): Promise<Gain>;
  getGains(): Promise<Gain[]>;
  getGain(id: number): Promise<Gain | undefined>;
  updateGain(id: number, gain: Partial<InsertGain>): Promise<Gain | undefined>;
  deleteGain(id: number): Promise<boolean>;
  getNextGainSlNo(): Promise<string>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Ensure role is always provided, defaulting to 'staff' if undefined
    const userData = {
      ...insertUser,
      role: insertUser.role || 'staff'
    };
    
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  // Expense operations
  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expenses).values(insertExpense).returning();
    return expense;
  }

  async getExpenses(): Promise<Expense[]> {
    return await db.select().from(expenses).orderBy(desc(expenses.date));
  }

  async getExpense(id: number): Promise<Expense | undefined> {
    const [expense] = await db.select().from(expenses).where(eq(expenses.id, id));
    return expense;
  }

  async updateExpense(id: number, expenseUpdate: Partial<InsertExpense>): Promise<Expense | undefined> {
    const [updatedExpense] = await db
      .update(expenses)
      .set(expenseUpdate)
      .where(eq(expenses.id, id))
      .returning();
    
    return updatedExpense;
  }

  async deleteExpense(id: number): Promise<boolean> {
    const result = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
    return result.length > 0;
  }

  async getNextExpenseSlNo(): Promise<string> {
    // Get the maximum numeric part of the existing slNo values
    const query = db
      .select({ 
        maxSlNo: sql<string>`max(substring(${expenses.slNo} from 4))` 
      })
      .from(expenses);
    
    const [result] = await query;
    
    // If no expenses exist yet, start from 1, otherwise increment
    let counter = 1;
    if (result && result.maxSlNo) {
      counter = parseInt(result.maxSlNo) + 1;
    }
    
    return `EXP${String(counter).padStart(3, '0')}`;
  }

  // Gain operations
  async createGain(insertGain: InsertGain): Promise<Gain> {
    const [gain] = await db.insert(gains).values(insertGain).returning();
    return gain;
  }

  async getGains(): Promise<Gain[]> {
    return await db.select().from(gains).orderBy(desc(gains.date));
  }

  async getGain(id: number): Promise<Gain | undefined> {
    const [gain] = await db.select().from(gains).where(eq(gains.id, id));
    return gain;
  }

  async updateGain(id: number, gainUpdate: Partial<InsertGain>): Promise<Gain | undefined> {
    const [updatedGain] = await db
      .update(gains)
      .set(gainUpdate)
      .where(eq(gains.id, id))
      .returning();
    
    return updatedGain;
  }

  async deleteGain(id: number): Promise<boolean> {
    const result = await db.delete(gains).where(eq(gains.id, id)).returning({ id: gains.id });
    return result.length > 0;
  }

  async getNextGainSlNo(): Promise<string> {
    // Get the maximum numeric part of the existing slNo values
    const query = db
      .select({ 
        maxSlNo: sql<string>`max(substring(${gains.slNo} from 3))` 
      })
      .from(gains);
    
    const [result] = await query;
    
    // If no gains exist yet, start from 1, otherwise increment
    let counter = 1;
    if (result && result.maxSlNo) {
      counter = parseInt(result.maxSlNo) + 1;
    }
    
    return `GN${String(counter).padStart(3, '0')}`;
  }

  // Initialize default users if they don't exist
  async initializeDefaultUsers() {
    const adminUser = await this.getUserByUsername("admin");
    if (!adminUser) {
      await this.createUser({
        name: "Admin User",
        username: "admin",
        password: "786786",
        role: "admin"
      });
    }
    
    const staffUser = await this.getUserByUsername("staff1");
    if (!staffUser) {
      await this.createUser({
        name: "Staff User",
        username: "staff1",
        password: "1234",
        role: "staff"
      });
    }
  }
}

// Create and initialize the storage
const storage = new DatabaseStorage();

// Initialize default users (admin and staff)
(async () => {
  try {
    await storage.initializeDefaultUsers();
    console.log("Default users initialized successfully");
  } catch (error) {
    console.error("Failed to initialize default users:", error);
  }
})();

export { storage };

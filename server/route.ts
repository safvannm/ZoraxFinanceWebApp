import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertExpenseSchema, insertGainSchema, customExpenseTypeSchema, customGainTypeSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

// Session data type
declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  const session = (await import("express-session")).default;
  
  app.use(
    session({
      secret: "zorax-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 1 day
    })
  );

  // Authentication routes
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      // Store user ID in session
      req.session.userId = user.id;
      
      // Return user info without password
      const { password: _, ...userInfo } = user;
      return res.status(200).json(userInfo);
    } catch (error) {
      console.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });
  
  // Auth middleware
  const authenticate = async (req: Request, res: Response, next: Function) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    // Add user to request for controllers to use
    (req as any).user = user;
    next();
  };
  
  // Admin middleware
  const requireAdmin = (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admin access required" });
    }
    next();
  };
  
  // User routes
  app.get("/api/users/me", authenticate, (req: Request, res: Response) => {
    const user = (req as any).user;
    const { password, ...userInfo } = user;
    res.status(200).json(userInfo);
  });
  
  app.post("/api/users", authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const newUser = await storage.createUser(userData);
      const { password, ...userInfo } = newUser;
      res.status(201).json(userInfo);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Create user error:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  // Expense routes
  app.get("/api/expenses", authenticate, async (req: Request, res: Response) => {
    try {
      const expenses = await storage.getExpenses();
      res.status(200).json(expenses);
    } catch (error) {
      console.error("Get expenses error:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  
  app.get("/api/expenses/next-slno", authenticate, async (req: Request, res: Response) => {
    try {
      const slNo = await storage.getNextExpenseSlNo();
      res.status(200).json({ slNo });
    } catch (error) {
      console.error("Get next SL NO error:", error);
      res.status(500).json({ message: "Failed to generate next SL NO" });
    }
  });
  
  app.post("/api/expenses", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const expenseData = insertExpenseSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const newExpense = await storage.createExpense(expenseData);
      res.status(201).json(newExpense);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Create expense error:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });
  
  app.put("/api/expenses/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }
      
      const expense = await storage.getExpense(id);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      const expenseUpdate = req.body;
      const updatedExpense = await storage.updateExpense(id, expenseUpdate);
      
      res.status(200).json(updatedExpense);
    } catch (error) {
      console.error("Update expense error:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });
  
  app.delete("/api/expenses/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }
      
      const expense = await storage.getExpense(id);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      
      await storage.deleteExpense(id);
      res.status(200).json({ message: "Expense deleted successfully" });
    } catch (error) {
      console.error("Delete expense error:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
  
  // Gain routes
  app.get("/api/gains", authenticate, async (req: Request, res: Response) => {
    try {
      const gains = await storage.getGains();
      res.status(200).json(gains);
    } catch (error) {
      console.error("Get gains error:", error);
      res.status(500).json({ message: "Failed to fetch gains" });
    }
  });
  
  app.get("/api/gains/next-slno", authenticate, async (req: Request, res: Response) => {
    try {
      const slNo = await storage.getNextGainSlNo();
      res.status(200).json({ slNo });
    } catch (error) {
      console.error("Get next SL NO error:", error);
      res.status(500).json({ message: "Failed to generate next SL NO" });
    }
  });
  
  app.post("/api/gains", authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const gainData = insertGainSchema.parse({
        ...req.body,
        createdBy: user.id
      });
      
      const newGain = await storage.createGain(gainData);
      res.status(201).json(newGain);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Create gain error:", error);
      res.status(500).json({ message: "Failed to create gain" });
    }
  });
  
  app.put("/api/gains/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid gain ID" });
      }
      
      const gain = await storage.getGain(id);
      if (!gain) {
        return res.status(404).json({ message: "Gain not found" });
      }
      
      const gainUpdate = req.body;
      const updatedGain = await storage.updateGain(id, gainUpdate);
      
      res.status(200).json(updatedGain);
    } catch (error) {
      console.error("Update gain error:", error);
      res.status(500).json({ message: "Failed to update gain" });
    }
  });
  
  app.delete("/api/gains/:id", authenticate, requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid gain ID" });
      }
      
      const gain = await storage.getGain(id);
      if (!gain) {
        return res.status(404).json({ message: "Gain not found" });
      }
      
      await storage.deleteGain(id);
      res.status(200).json({ message: "Gain deleted successfully" });
    } catch (error) {
      console.error("Delete gain error:", error);
      res.status(500).json({ message: "Failed to delete gain" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

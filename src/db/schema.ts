import { pgTable, uuid, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});

export const loginCodes = pgTable("login_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: false }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: false }),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  dedication: text("dedication").notNull().default(""),
  theme: text("theme").notNull().default("parchment"),
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  shareToken: text("share_token").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});

export const chapters = pgTable("chapters", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  era: text("era").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  orderIndex: integer("order_index").notNull(),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  imageCaption: text("image_caption").notNull().default(""),
  status: text("status").notNull().default("unwritten"), // unwritten | drafting | complete
  updatedAt: timestamp("updated_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});

export const questions = pgTable("questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  chapterId: uuid("chapter_id")
    .notNull()
    .references(() => chapters.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  orderIndex: integer("order_index").notNull(),
  answer: text("answer").notNull().default(""),
  answeredAt: timestamp("answered_at", { withTimezone: false }),
});

export const projectMembers = pgTable(
  "project_members",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"), // owner | editor | viewer
    createdAt: timestamp("created_at", { withTimezone: false })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })]
);

export const projectsRelations = relations(projects, ({ many, one }) => ({
  chapters: many(chapters),
  members: many(projectMembers),
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));

export const printOrders = pgTable("print_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  email: text("email").notNull().default(""),
  /** digital | softcover | heirloom */
  edition: text("edition").notNull().default("heirloom"),
  quantity: integer("quantity").notNull().default(1),
  /** Discounted price per copy, in cents. */
  unitCents: integer("unit_cents").notNull().default(8900),
  /** quantity × unitCents — what the customer actually pays. */
  amountCents: integer("amount_cents").notNull().default(8900),
  discountRate: integer("discount_rate").notNull().default(0), // whole percent
  status: text("status").notNull().default("pending"),
  // pending → paid → fulfilled; or "reserved" when Stripe isn't configured
  stripeSessionId: text("stripe_session_id").notNull().default(""),
  luluJobId: text("lulu_job_id").notNull().default(""),
  shipName: text("ship_name").notNull().default(""),
  shipLine1: text("ship_line1").notNull().default(""),
  shipLine2: text("ship_line2").notNull().default(""),
  shipCity: text("ship_city").notNull().default(""),
  shipState: text("ship_state").notNull().default(""),
  shipPostal: text("ship_postal").notNull().default(""),
  shipCountry: text("ship_country").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: false })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(projectMembers),
}));

export const chaptersRelations = relations(chapters, ({ one, many }) => ({
  project: one(projects, {
    fields: [chapters.projectId],
    references: [projects.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  chapter: one(chapters, {
    fields: [questions.chapterId],
    references: [chapters.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type User = typeof users.$inferSelect;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type PrintOrder = typeof printOrders.$inferSelect;

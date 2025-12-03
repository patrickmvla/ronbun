// lib/drizzle/schema.ts
// Postgres (Supabase) schema for Ronbun using Drizzle ORM.
// Includes enums, tables, indexes, and minimal relations.
// Notes:
// - We do NOT create or reference auth.users via FK to avoid cross-schema DDL/permissions.
//   Use UUIDs + RLS (user_id = auth.uid()) instead.
// - Numeric defaults in Drizzle should be strings (e.g., .default('0')).

import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ================= Enums ================= */

export const watchlistType = pgEnum("watchlist_type", ["keyword", "author", "benchmark", "institution"]);
export const saveStatus = pgEnum("save_status", ["queued", "saved", "reading", "done"]);
export const explainLevel = pgEnum("explain_level", ["eli5", "student", "expert"]);
export const digestStatus = pgEnum("digest_status", ["scheduled", "sent", "failed"]);

// New enums for personalization
export const viewSource = pgEnum("view_source", ["feed", "search", "digest", "direct", "similar"]);
export const interactionType = pgEnum("interaction_type", [
  "abstract_expand",
  "pdf_click",
  "code_click",
  "arxiv_click",
  "tab_summary",
  "tab_explainer",
  "tab_reviewer",
  "tab_leaderboard",
  "share_click",
  "copy_bibtex",
]);
export const interestType = pgEnum("interest_type", ["category", "author", "benchmark", "task"]);

/* ================= Profiles ================= */

export const profiles = pgTable(
  "profiles",
  {
    // Primary key equals the user's auth.uid(), but no FK
    id: uuid("id").primaryKey(),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    preferences: jsonb("preferences").$type<{
      categories: string[];
      defaultView?: "today" | "week" | "for-you";
    }>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxUpdated: index("idx_profiles_updated").on(t.updatedAt),
  })
);

/* ================= Papers ================= */

export const papers = pgTable(
  "papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    arxivIdBase: varchar("arxiv_id_base", { length: 32 }).notNull(), // e.g., 2501.12345
    latestVersion: integer("latest_version").notNull().default(1),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    categories: text("categories").array().notNull(),
    primaryCategory: varchar("primary_category", { length: 32 }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
    pdfUrl: text("pdf_url"),
    absUrl: text("abs_url"),
    comment: text("comment"),
    // Optional: tsvector column maintained by DB trigger, stored as text for simplicity here.
    tsv: text("tsv"),
  },
  (t) => ({
    uniqArxiv: uniqueIndex("uniq_papers_arxiv").on(t.arxivIdBase),
    idxCats: index("idx_papers_primary_cat").on(t.primaryCategory),
    idxPublished: index("idx_papers_published").on(t.publishedAt),
  })
);

export const paperRelations = relations(papers, ({ many, one }) => ({
  versions: many(paperVersions),
  authors: many(paperAuthors),
  enrich: many(paperEnrich),
  structured: many(paperStructured),
  scores: one(paperScores, {
    fields: [papers.id],
    references: [paperScores.paperId],
  }),
  explanations: many(explanations),
  reviews: many(reviews),
  pwcLink: many(pwcLinks),
}));

/* ================= Paper versions ================= */

export const paperVersions = pgTable(
  "paper_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (t) => ({
    uniqPaperVersion: uniqueIndex("uniq_paper_version").on(t.paperId, t.version),
    idxUpdated: index("idx_paper_versions_updated").on(t.updatedAt),
  })
);

export const paperVersionsRelations = relations(paperVersions, ({ one }) => ({
  paper: one(papers, {
    fields: [paperVersions.paperId],
    references: [papers.id],
  }),
}));

/* ================= Authors and join ================= */

export const authors = pgTable(
  "authors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    normName: text("norm_name"),
    orcid: varchar("orcid", { length: 32 }),
  },
  (t) => ({
    uniqName: uniqueIndex("uniq_authors_name").on(t.name),
    idxNorm: index("idx_authors_norm_name").on(t.normName),
  })
);

export const authorsRelations = relations(authors, ({ many }) => ({
  papers: many(paperAuthors),
}));

export const paperAuthors = pgTable(
  "paper_authors",
  {
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    authorId: uuid("author_id")
      .references(() => authors.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ name: "pk_paper_authors", columns: [t.paperId, t.authorId] }),
    idxPosition: index("idx_paper_authors_position").on(t.position),
  })
);

export const paperAuthorsRelations = relations(paperAuthors, ({ one }) => ({
  paper: one(papers, { fields: [paperAuthors.paperId], references: [papers.id] }),
  author: one(authors, { fields: [paperAuthors.authorId], references: [authors.id] }),
}));

/* ================= Enrichment ================= */

export const paperEnrich = pgTable(
  "paper_enrich",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    codeUrls: jsonb("code_urls").$type<string[]>().default([]),
    primaryRepo: text("primary_repo"),
    repoLicense: text("repo_license"),
    repoStars: integer("repo_stars"),
    hasWeights: boolean("has_weights"),
    readmeExcerpt: text("readme_excerpt"),
    readmeSha: text("readme_sha"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxPaper: index("idx_paper_enrich_paper").on(t.paperId),
    idxUpdated: index("idx_paper_enrich_updated").on(t.updatedAt),
  })
);

export const paperEnrichRelations = relations(paperEnrich, ({ one }) => ({
  paper: one(papers, { fields: [paperEnrich.paperId], references: [papers.id] }),
}));

/* ================= Structured extraction ================= */

export const paperStructured = pgTable(
  "paper_structured",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    method: text("method"),
    tasks: jsonb("tasks").$type<string[]>().default([]),
    datasets: jsonb("datasets").$type<string[]>().default([]),
    benchmarks: jsonb("benchmarks").$type<string[]>().default([]),
    claimedSota: jsonb("claimed_sota").$type<
      Array<{ benchmark: string; metric?: string; value?: string; split?: string }>
    >().default([]),
    params: numeric("params"), // B params, if known
    tokens: numeric("tokens"), // B tokens, if known
    compute: text("compute"),
    codeUrls: jsonb("code_urls").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxPaper: index("idx_paper_structured_paper").on(t.paperId),
    idxCreated: index("idx_paper_structured_created").on(t.createdAt),
  })
);

export const paperStructuredRelations = relations(paperStructured, ({ one }) => ({
  paper: one(papers, { fields: [paperStructured.paperId], references: [papers.id] }),
}));

/* ================= Scoring ================= */

export const paperScores = pgTable(
  "paper_scores",
  {
    paperId: uuid("paper_id")
      .primaryKey()
      .references(() => papers.id, { onDelete: "cascade" }),
    globalScore: numeric("global_score").notNull().default("0"),
    components: jsonb("components").$type<{
      recency: number;
      code: number;
      stars: number;
      watchlist: number;
    }>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxUpdated: index("idx_paper_scores_updated").on(t.updatedAt),
  })
);

export const paperScoresRelations = relations(paperScores, ({ one }) => ({
  paper: one(papers, { fields: [paperScores.paperId], references: [papers.id] }),
}));

/* ================= Explanations ================= */

export const explanations = pgTable(
  "explanations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    level: explainLevel("level").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqExplainer: uniqueIndex("uniq_explainer").on(t.paperId, t.level),
    idxCreated: index("idx_explanations_created").on(t.createdAt),
  })
);

export const explanationsRelations = relations(explanations, ({ one }) => ({
  paper: one(papers, { fields: [explanations.paperId], references: [papers.id] }),
}));

/* ================= Reviews ================= */

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    strengths: jsonb("strengths").$type<string[]>().default([]),
    weaknesses: jsonb("weaknesses").$type<string[]>().default([]),
    risks: jsonb("risks").$type<string[]>().default([]),
    nextExperiments: jsonb("next_experiments").$type<string[]>().default([]),
    reproducibilityNotes: text("reproducibility_notes"),
    noveltyScore: integer("novelty_score"),
    clarityScore: integer("clarity_score"),
    caveats: text("caveats"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxPaper: index("idx_reviews_paper").on(t.paperId),
    idxCreated: index("idx_reviews_created").on(t.createdAt),
  })
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  paper: one(papers, { fields: [reviews.paperId], references: [papers.id] }),
}));

/* ================= PwC Links ================= */

export const pwcLinks = pgTable(
  "pwc_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    found: boolean("found").notNull().default(false),
    paperUrl: text("paper_url"),
    repoUrl: text("repo_url"),
    repoStars: integer("repo_stars"),
    searchUrl: text("search_url"),
    sotaLinks: jsonb("sota_links").$type<Array<{ label: string; url: string }>>().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxPaper: index("idx_pwc_links_paper").on(t.paperId),
    idxUpdated: index("idx_pwc_links_updated").on(t.updatedAt),
  })
);

export const pwcLinksRelations = relations(pwcLinks, ({ one }) => ({
  paper: one(papers, { fields: [pwcLinks.paperId], references: [papers.id] }),
}));

/* ================= Watchlists & saves ================= */

export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No FK to auth.users; use RLS auth.uid()
    userId: uuid("user_id").notNull(),
    type: watchlistType("type").notNull(),
    name: text("name").notNull(),
    terms: jsonb("terms").$type<string[]>().default([]),
    categories: jsonb("categories").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxUser: index("idx_watchlists_user").on(t.userId),
    idxType: index("idx_watchlists_type").on(t.type),
  })
);

export const userSaves = pgTable(
  "user_saves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No FK to auth.users; use RLS auth.uid()
    userId: uuid("user_id").notNull(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    status: saveStatus("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqSave: uniqueIndex("uniq_user_save").on(t.userId, t.paperId),
    idxUser: index("idx_user_saves_user").on(t.userId),
  })
);

export const digests = pgTable(
  "digests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // No FK to auth.users; use RLS auth.uid()
    userId: uuid("user_id").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    items: jsonb("items").$type<Array<{ paperId: string; reason: string }>>().default([]),
    status: digestStatus("status").default("scheduled"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    idxUser: index("idx_digests_user").on(t.userId),
    idxScheduled: index("idx_digests_scheduled_for").on(t.scheduledFor),
    idxStatus: index("idx_digests_status").on(t.status),
  })
);

/* ================= Ingest runs ================= */

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").default("ok"),
    itemsFetched: integer("items_fetched").default(0),
    note: text("note"),
  },
  (t) => ({
    idxStarted: index("idx_ingest_runs_started_at").on(t.startedAt),
  })
);

/* ================= Paper Views (Personalization) ================= */

export const paperViews = pgTable(
  "paper_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).defaultNow().notNull(),
    source: viewSource("source").notNull().default("feed"),
    durationMs: integer("duration_ms"),
    arxivIdBase: varchar("arxiv_id_base", { length: 32 }),
  },
  (t) => ({
    idxUserViewed: index("idx_paper_views_user_viewed").on(t.userId, t.viewedAt),
    idxUserPaper: index("idx_paper_views_user_paper").on(t.userId, t.paperId),
    idxPaperViewed: index("idx_paper_views_paper_viewed").on(t.paperId, t.viewedAt),
  })
);

export const paperViewsRelations = relations(paperViews, ({ one }) => ({
  paper: one(papers, { fields: [paperViews.paperId], references: [papers.id] }),
}));

/* ================= Paper Interactions ================= */

export const paperInteractions = pgTable(
  "paper_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    type: interactionType("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
  },
  (t) => ({
    idxUserCreated: index("idx_paper_interactions_user_created").on(t.userId, t.createdAt),
    idxPaperType: index("idx_paper_interactions_paper_type").on(t.paperId, t.type),
    idxUserPaper: index("idx_paper_interactions_user_paper").on(t.userId, t.paperId),
  })
);

export const paperInteractionsRelations = relations(paperInteractions, ({ one }) => ({
  paper: one(papers, { fields: [paperInteractions.paperId], references: [papers.id] }),
}));

/* ================= User Scores (Cached Personalized) ================= */

export const userScores = pgTable(
  "user_scores",
  {
    userId: uuid("user_id").notNull(),
    paperId: uuid("paper_id")
      .references(() => papers.id, { onDelete: "cascade" })
      .notNull(),
    personalizedScore: numeric("personalized_score").notNull().default("0"),
    components: jsonb("components").$type<{
      recency: number;
      code: number;
      stars: number;
      watchlist: number;
      viewed: number;
      implicit: number;
      collaborative: number;
    }>(),
    watchlistVersion: integer("watchlist_version").default(0),
    computedAt: timestamp("computed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ name: "pk_user_scores", columns: [t.userId, t.paperId] }),
    idxUserScore: index("idx_user_scores_user_score").on(t.userId, t.personalizedScore),
    idxComputed: index("idx_user_scores_computed").on(t.computedAt),
    idxUserVersion: index("idx_user_scores_user_version").on(t.userId, t.watchlistVersion),
  })
);

export const userScoresRelations = relations(userScores, ({ one }) => ({
  paper: one(papers, { fields: [userScores.paperId], references: [papers.id] }),
}));

/* ================= User Interests (Derived Affinities) ================= */

export const userInterests = pgTable(
  "user_interests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    type: interestType("type").notNull(),
    value: text("value").notNull(),
    normValue: text("norm_value"),
    score: numeric("score").notNull().default("0"),
    source: text("source").default("implicit"),
    viewCount: integer("view_count").default(0),
    saveCount: integer("save_count").default(0),
    interactionCount: integer("interaction_count").default(0),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqInterest: uniqueIndex("uniq_user_interest").on(t.userId, t.type, t.value),
    idxUserTypeScore: index("idx_user_interests_user_type_score").on(t.userId, t.type, t.score),
    idxTypeValue: index("idx_user_interests_type_value").on(t.type, t.value),
  })
);

/* ================= Watchlist Versions (Cache Invalidation) ================= */

export const watchlistVersions = pgTable(
  "watchlist_versions",
  {
    userId: uuid("user_id").primaryKey(),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    idxUpdated: index("idx_watchlist_versions_updated").on(t.updatedAt),
  })
);

/* ================= Type exports ================= */

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;

export type PaperVersion = typeof paperVersions.$inferSelect;
export type NewPaperVersion = typeof paperVersions.$inferInsert;

export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;

export type PaperAuthor = typeof paperAuthors.$inferSelect;
export type NewPaperAuthor = typeof paperAuthors.$inferInsert;

export type PaperEnrich = typeof paperEnrich.$inferSelect;
export type NewPaperEnrich = typeof paperEnrich.$inferInsert;

export type PaperStructured = typeof paperStructured.$inferSelect;
export type NewPaperStructured = typeof paperStructured.$inferInsert;

export type PaperScores = typeof paperScores.$inferSelect;
export type NewPaperScores = typeof paperScores.$inferInsert;

export type Explanation = typeof explanations.$inferSelect;
export type NewExplanation = typeof explanations.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;

export type PwcLink = typeof pwcLinks.$inferSelect;
export type NewPwcLink = typeof pwcLinks.$inferInsert;

export type Watchlist = typeof watchlists.$inferSelect;
export type NewWatchlist = typeof watchlists.$inferInsert;

export type UserSave = typeof userSaves.$inferSelect;
export type NewUserSave = typeof userSaves.$inferInsert;

export type Digest = typeof digests.$inferSelect;
export type NewDigest = typeof digests.$inferInsert;

export type IngestRun = typeof ingestRuns.$inferSelect;
export type NewIngestRun = typeof ingestRuns.$inferInsert;

export type PaperView = typeof paperViews.$inferSelect;
export type NewPaperView = typeof paperViews.$inferInsert;

export type PaperInteraction = typeof paperInteractions.$inferSelect;
export type NewPaperInteraction = typeof paperInteractions.$inferInsert;

export type UserScore = typeof userScores.$inferSelect;
export type NewUserScore = typeof userScores.$inferInsert;

export type UserInterest = typeof userInterests.$inferSelect;
export type NewUserInterest = typeof userInterests.$inferInsert;

export type WatchlistVersion = typeof watchlistVersions.$inferSelect;
export type NewWatchlistVersion = typeof watchlistVersions.$inferInsert;
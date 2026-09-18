// Run with: mongosh "<your Atlas connection string>" scripts/mongo_setup.js
// Safe to re-run (idempotent) — createIndex is a no-op if the index exists.

const dbName = process.env.MONGODB_DB_NAME || "ip_sakti";
const database = db.getSiblingDB(dbName);

// -----------------------------------------------------------------------
// 1. NEW: ip_sakti_chunks — canonical, full-text chunk store.
//    audit_logs / chat_messages / product_analyses should store only
//    {chunk_id, index} going forward and look the rest up from here,
//    instead of copy-pasting title/authority/excerpt into every record.
// -----------------------------------------------------------------------
database.createCollection("ip_sakti_chunks");
database.ip_sakti_chunks.createIndex({ document_id: 1 });
database.ip_sakti_chunks.createIndex({ authority: 1 });
database.ip_sakti_chunks.createIndex({ language: 1 });
database.ip_sakti_chunks.createIndex(
  { qdrant_point_id: 1 },
  { unique: true, sparse: true },
);
database.ip_sakti_chunks.createIndex({ full_text: "text", title: "text" });

// -----------------------------------------------------------------------
// 2. NEW: legal_sources — one row per Act/Regulation, tracks currency
//    (this is what your audit_logs "10+ years old, verify amendments"
//    warnings should actually be checked against, instead of being a
//    hardcoded string).
// -----------------------------------------------------------------------
database.createCollection("legal_sources");
database.legal_sources.createIndex({ authority: 1 });

// -----------------------------------------------------------------------
// 3. Indexes on your EXISTING collections (none of these existed before,
//    based on the export you shared — every query against these was
//    doing a full collection scan).
// -----------------------------------------------------------------------
database.conversations.createIndex({ user_id: 1, updated_at: -1 });
database.chat_messages.createIndex({ conversation_id: 1, created_at: 1 });
database.audit_logs.createIndex({ conversation_id: 1 });
database.audit_logs.createIndex({ created_at: -1 });
database.classification_records.createIndex({ conversation_id: 1 });
database.classification_records.createIndex({ user_id: 1 });
database.validation_results.createIndex({ conversation_id: 1 });
database.expert_escalations.createIndex({ status: 1, priority: -1 });
database.expert_escalations.createIndex({ user_id: 1 });
database.product_analyses.createIndex({ user_id: 1, created_at: -1 });
database.saved_research.createIndex({ user_id: 1 });
database.user_ingested_documents.createIndex({ user_id: 1 });
database.feedback.createIndex({ conversation_id: 1 });

// users: email must be unique; also enforce it lowercase-normalized at the
// app layer so "Sd@gmail.com" and "sd@gmail.com" aren't treated as different.
database.users.createIndex({ email: 1 }, { unique: true });

// -----------------------------------------------------------------------
// 4. Fix: users has both `role` (string) and `roles` (array), which will
//    drift out of sync. This migrates existing docs to `roles` only and
//    drops `role`. Update your app code to stop reading/writing `role`
//    before running this.
// -----------------------------------------------------------------------
database.users.updateMany({ role: { $exists: true } }, [
  {
    $set: {
      roles: {
        $cond: [
          { $in: ["$role", { $ifNull: ["$roles", []] }] },
          "$roles",
          { $concatArrays: [{ $ifNull: ["$roles", []] }, ["$role"]] },
        ],
      },
    },
  },
  { $unset: "role" },
]);

print(
  "Mongo setup complete: ip_sakti_chunks + legal_sources created, " +
    "indexes applied, users.role migrated into users.roles.",
);

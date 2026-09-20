// mongosh equivalent of app/database/migrations.py (idempotent).
// Usage:  mongosh "$MONGODB_URI" --file scripts/mongo_migration_001.js
// (The app also applies these automatically on startup; use this if you
// prefer to migrate before deploying.)
const d = db.getSiblingDB(process.env.MONGODB_DB_NAME || "ip_sakti");
const cols = ["email_otps","notifications","user_devices","login_events","email_logs",
              "expert_certificates","chat_attachments","schema_migrations"];
const existing = d.getCollectionNames();
cols.forEach(c => { if (!existing.includes(c)) d.createCollection(c); });

d.email_otps.createIndex({user_id:1, purpose:1, status:1});
d.email_otps.createIndex({created_at:1});
d.email_otps.createIndex({purge_at:1}, {expireAfterSeconds:0, name:"purge_at_ttl"});
d.notifications.createIndex({user_id:1, is_read:1, created_at:-1});
d.notifications.createIndex({user_id:1, dedupe_key:1});
d.user_devices.createIndex({user_id:1, device_key:1}, {unique:true});
d.login_events.createIndex({user_id:1, created_at:1});
d.login_events.createIndex({purge_at:1}, {expireAfterSeconds:0, name:"purge_at_ttl"});
d.email_logs.createIndex({user_id:1, created_at:1});
d.email_logs.createIndex({purge_at:1}, {expireAfterSeconds:0, name:"purge_at_ttl"});
d.expert_certificates.createIndex({issuing_authority_norm:1, certificate_number_norm:1});
d.expert_certificates.createIndex({user_id:1, status:1});
d.expert_certificates.createIndex({sha256:1});
d.chat_attachments.createIndex({user_id:1, conversation_id:1});
d.chat_attachments.createIndex({created_at:1});

// Existing users: add verification fields (NOT auto-verified).
d.users.updateMany({email_verified:{$exists:false}},
  {$set:{email_verified:false, email_verified_at:null, updated_at:new Date(), last_login_at:null}});
[[1,"users_email_verification_fields"],[2,"ttl_indexes_for_otp_login_events_email_logs"]].forEach(([v,n]) =>
  d.schema_migrations.updateOne({_id:v},{$setOnInsert:{name:n, applied_at:new Date()}},{upsert:true}));
print("migration 001/002 complete");
// OPTIONAL, explicit decision only: trust all pre-existing accounts
// d.users.updateMany({email_verified:{$ne:true}},{$set:{email_verified:true,email_verified_at:new Date()}});

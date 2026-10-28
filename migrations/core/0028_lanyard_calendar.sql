-- Live subscription authority never travels in an installation archive.
CREATE TABLE l_calendar_feeds (
 staff_id TEXT PRIMARY KEY,
 operator_id TEXT NOT NULL,
 operator_version INTEGER NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 revision INTEGER NOT NULL,
 revoked_at TEXT
);
-- Retained assignment projections contain no credential, private notes or coworker facts.
CREATE TABLE l_calendar_events (
 staff_id TEXT NOT NULL,
 lineage TEXT NOT NULL,
 sequence INTEGER NOT NULL,
 data TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY(staff_id,lineage)
);
-- Existing published assignments start at sequence zero; no subscription existed before this migration.
INSERT INTO l_calendar_events(staff_id,lineage,sequence,data,updated_at)
 SELECT json_extract(x.data,'$.staffId'),coalesce(json_extract(x.data,'$.lineage'),x.id),0,
 json_object('staffId',json_extract(x.data,'$.staffId'),'lineage',coalesce(json_extract(x.data,'$.lineage'),x.id),
 'start',json_extract(x.data,'$.start'),'end',json_extract(x.data,'$.end'),
 'site',coalesce(nullif(json_extract(x.data,'$.site'),''),nullif(json_extract(x.data,'$.rateBasis.site'),''),p.site,''),
 'timezone',coalesce(json_extract(r.data,'$.timezone'),(SELECT timezone FROM l_meta WHERE id=1)),'status','CONFIRMED'),
 coalesce(json_extract(r.data,'$.publishedAt'),json_extract(x.data,'$.start'))
 FROM l_records x JOIN l_staff p ON p.id=json_extract(x.data,'$.staffId')
 JOIN l_records r ON r.kind='rosters' AND r.id=json_extract(x.data,'$.rosterId')
 WHERE x.kind='shifts' AND json_extract(x.data,'$.status')='published';
CREATE TRIGGER l_calendar_staff_revocation AFTER UPDATE OF active,email,erased_at ON l_staff
 WHEN NEW.active=0 OR NEW.erased_at IS NOT NULL OR OLD.email<>NEW.email
 BEGIN UPDATE l_calendar_feeds SET revoked_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),revision=revision+1 WHERE staff_id=NEW.id AND revoked_at IS NULL; END;

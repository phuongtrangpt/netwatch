CREATE TABLE monitor_states(project_id TEXT NOT NULL,target_id TEXT NOT NULL,label TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,observed_at INTEGER NOT NULL,PRIMARY KEY(project_id,target_id));
CREATE TABLE monitor_segments(id INTEGER PRIMARY KEY,project_id TEXT NOT NULL,target_id TEXT NOT NULL,label TEXT NOT NULL,kind TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,ended_at INTEGER NOT NULL);
CREATE INDEX monitor_segments_project_time ON monitor_segments(project_id,ended_at);
CREATE TABLE maintenance(project_id TEXT NOT NULL,target_id TEXT NOT NULL,started_at INTEGER NOT NULL,until_at INTEGER NOT NULL,reason TEXT NOT NULL,PRIMARY KEY(project_id,target_id));

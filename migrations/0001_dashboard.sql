CREATE TABLE dashboard_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL
);
CREATE TABLE dashboard_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0,
  settings_revision INTEGER NOT NULL,
  data TEXT NOT NULL
);
INSERT INTO dashboard_settings(id, revision, data) VALUES(1, 0, '{"revision":0,"account":null,"credentials":{},"capabilities":{}}');

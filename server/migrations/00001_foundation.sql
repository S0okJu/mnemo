-- +goose Up
CREATE TABLE cluster_connections (
 id smallint PRIMARY KEY CHECK (id = 1),
 generation bigint NOT NULL DEFAULT 1,
 metadata jsonb NOT NULL,
 encrypted_kubeconfig bytea,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE resources (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 connection_id smallint NOT NULL REFERENCES cluster_connections(id),
 generation bigint NOT NULL,
 uid text NOT NULL,
 api_group text NOT NULL,
 kind text NOT NULL,
 namespace text NOT NULL DEFAULT '',
 name text NOT NULL,
 data jsonb NOT NULL,
 resource_version text NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 deleted_at timestamptz,
 UNIQUE(connection_id,generation,uid)
);
CREATE INDEX resources_lookup ON resources(connection_id,generation,kind,namespace,name,uid) WHERE deleted_at IS NULL;
CREATE TABLE resource_relations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 source_id bigint NOT NULL REFERENCES resources(id),
 target_id bigint NOT NULL REFERENCES resources(id),
 relation_type text NOT NULL,
 evidence jsonb NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 valid_from timestamptz NOT NULL DEFAULT now(),
 valid_to timestamptz,
 UNIQUE(source_id,target_id,relation_type)
);
CREATE INDEX relations_target ON resource_relations(target_id,relation_type);
CREATE TABLE resource_changes (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 resource_id bigint NOT NULL REFERENCES resources(id),
 observed_at timestamptz NOT NULL DEFAULT now(),
 change_type text NOT NULL,
 summary jsonb NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX changes_retention ON resource_changes(expires_at);
CREATE TABLE sync_states (
 connection_id smallint NOT NULL REFERENCES cluster_connections(id),
 generation bigint NOT NULL,
 kind text NOT NULL,
 initialized boolean NOT NULL DEFAULT false,
 stale boolean NOT NULL DEFAULT true,
 last_success_at timestamptz,
 error text,
 PRIMARY KEY(connection_id,generation,kind)
);
CREATE TABLE audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor text NOT NULL,
 action text NOT NULL,
 context_name text NOT NULL DEFAULT '',
 server_url text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT now()
);
-- +goose Down
DROP TABLE audit_logs,sync_states,resource_changes,resource_relations,resources,cluster_connections;

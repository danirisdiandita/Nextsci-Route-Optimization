-- Runs once, when the router-db service starts with an empty pgdata/ folder.
-- Enable pgvector in the app database, and in template1 so databases
-- created later (such as Django's test database) have it too.
CREATE EXTENSION IF NOT EXISTS vector;
\c template1
CREATE EXTENSION IF NOT EXISTS vector;

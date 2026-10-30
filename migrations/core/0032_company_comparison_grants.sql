ALTER TABLE l_agent_keys ADD COLUMN company_agents INTEGER NOT NULL DEFAULT 0 CHECK(company_agents IN (0,1));

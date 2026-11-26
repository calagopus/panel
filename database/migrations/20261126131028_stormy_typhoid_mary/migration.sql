CREATE INDEX "allocations_ip_port_idx" ON "node_allocations" (host("ip"),"port");
CREATE INDEX "allocations_ip_alias_idx" ON "node_allocations" ("ip_alias");
// Neo4j Constraints and Indexes for Campus Trace
// Do not allow duplicate student or location nodes.

// Constraints (Uniqueness)
CREATE CONSTRAINT student_id_unique IF NOT EXISTS
FOR (s:Student) REQUIRE s.student_id IS UNIQUE;

CREATE CONSTRAINT student_code_unique IF NOT EXISTS
FOR (s:Student) REQUIRE s.student_code IS UNIQUE;

CREATE CONSTRAINT location_id_unique IF NOT EXISTS
FOR (l:Location) REQUIRE l.location_id IS UNIQUE;

CREATE CONSTRAINT location_name_unique IF NOT EXISTS
FOR (l:Location) REQUIRE l.name IS UNIQUE;

CREATE CONSTRAINT disease_id_unique IF NOT EXISTS
FOR (d:Disease) REQUIRE d.disease_id IS UNIQUE;

CREATE CONSTRAINT case_id_unique IF NOT EXISTS
FOR (c:Case) REQUIRE c.case_id IS UNIQUE;

CREATE CONSTRAINT contact_event_id_unique IF NOT EXISTS
FOR (e:ContactEvent) REQUIRE e.event_id IS UNIQUE;

// Indexes for fast lookup
CREATE INDEX student_name_idx IF NOT EXISTS
FOR (s:Student) ON (s.full_name);

CREATE INDEX event_timestamp_idx IF NOT EXISTS
FOR (e:ContactEvent) ON (e.timestamp);

CREATE INDEX contacted_timestamp_idx IF NOT EXISTS
FOR ()-[r:CONTACTED]-() ON (r.timestamp);

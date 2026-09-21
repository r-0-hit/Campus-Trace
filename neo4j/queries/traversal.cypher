// Campus Trace – Exposure Graph Traversal Cypher Queries
// Controlled breadth-first-search avoiding infinite cycles and redundant evaluations

// 1. Direct 1st-degree contacts within exposure window
MATCH (index:Student {student_id: $student_id})-[r:CONTACTED]-(contact:Student)
WHERE r.timestamp >= $exposure_start_time
RETURN contact.student_id AS student_id,
       contact.student_code AS student_code,
       1 AS graph_distance,
       r.duration_seconds AS duration_seconds,
       r.estimated_distance AS estimated_distance,
       r.encounter_count AS encounter_count,
       r.indoor AS indoor,
       r.timestamp AS timestamp;

// 2. Bounded 2nd-degree exposure traversal (Depth 2)
MATCH path = (index:Student {student_id: $student_id})-[:CONTACTED*1..2]-(contact:Student)
WHERE ALL(r IN relationships(path) WHERE r.timestamp >= $exposure_start_time)
  AND contact <> index
WITH contact, min(length(path)) AS shortest_distance, relationships(path) AS rels
RETURN contact.student_id AS student_id,
       contact.student_code AS student_code,
       shortest_distance AS graph_distance
ORDER BY shortest_distance, contact.student_code;

// 3. Potential Exposure Clusters (shared location and overlapping window)
MATCH (s:Student)-[v:VISITED]->(loc:Location)
WHERE v.timestamp >= $window_start
WITH loc, collect(DISTINCT s.student_code) AS attendees, count(v) AS total_visits
WHERE size(attendees) >= 5
RETURN loc.name AS location_name,
       loc.environment_type AS environment_type,
       size(attendees) AS unique_students,
       total_visits,
       attendees AS student_list
ORDER BY unique_students DESC;

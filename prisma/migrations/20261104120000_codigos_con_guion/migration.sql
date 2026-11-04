-- Códigos de packings y rutas tarifas con guion, como formatearCodigo (COX005 → COX-005). Se
-- salta el que quedaría repetido con otro, para no fallar por el índice único.
WITH candidatos AS (
  SELECT id, codigo, m[1] || '-' || CASE WHEN length(m[2]) < 3 THEN lpad(m[2], 3, '0') ELSE m[2] END AS nuevo
  FROM (SELECT id, codigo, regexp_match(upper(trim(codigo)), '^([A-Z]+)[[:space:]_.-]*([0-9]+)$') AS m FROM "Packing") x
  WHERE m IS NOT NULL
), unicos AS (
  SELECT id, nuevo FROM (
    SELECT id, codigo, nuevo, count(*) OVER (PARTITION BY nuevo) AS n FROM candidatos
  ) c
  WHERE codigo <> nuevo AND n = 1 AND NOT EXISTS (SELECT 1 FROM "Packing" o WHERE o.codigo = c.nuevo)
)
UPDATE "Packing" p SET codigo = u.nuevo FROM unicos u WHERE p.id = u.id;

WITH candidatos AS (
  SELECT id, codigo, m[1] || '-' || CASE WHEN length(m[2]) < 3 THEN lpad(m[2], 3, '0') ELSE m[2] END AS nuevo
  FROM (SELECT id, codigo, regexp_match(upper(trim(codigo)), '^([A-Z]+)[[:space:]_.-]*([0-9]+)$') AS m FROM "RutaTarifa") x
  WHERE m IS NOT NULL
), unicos AS (
  SELECT id, nuevo FROM (
    SELECT id, codigo, nuevo, count(*) OVER (PARTITION BY nuevo) AS n FROM candidatos
  ) c
  WHERE codigo <> nuevo AND n = 1 AND NOT EXISTS (SELECT 1 FROM "RutaTarifa" o WHERE o.codigo = c.nuevo)
)
UPDATE "RutaTarifa" r SET codigo = u.nuevo FROM unicos u WHERE r.id = u.id;

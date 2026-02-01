-- Add missing permission records for new resources
INSERT INTO permissions (role, resource, action, allowed)
SELECT 
  r.role::app_role, 
  res.resource, 
  act.action, 
  CASE 
    WHEN r.role = 'super_admin' THEN true
    WHEN r.role = 'admin' THEN true
    ELSE false 
  END
FROM (VALUES ('super_admin'), ('admin'), ('staff')) AS r(role)
CROSS JOIN (
  VALUES 
    ('inventory'), 
    ('hrm'), 
    ('invoices'),
    ('suppliers')
) AS res(resource)
CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('delete')) AS act(action)
WHERE NOT EXISTS (
  SELECT 1 FROM permissions p 
  WHERE p.role = r.role::app_role 
    AND p.resource = res.resource 
    AND p.action = act.action
);
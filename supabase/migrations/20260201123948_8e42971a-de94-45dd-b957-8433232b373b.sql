-- Update customers_safe view to include GPS and additional fields
DROP VIEW IF EXISTS customers_safe;

CREATE VIEW customers_safe AS
SELECT 
    id,
    user_id,
    full_name,
    phone,
    alt_phone,
    address,
    area_id,
    router_id,
    package_id,
    billing_start_date,
    expiry_date,
    status,
    auto_renew,
    total_due,
    latitude,
    longitude,
    connection_type,
    billing_cycle,
    created_at,
    updated_at
FROM customers;
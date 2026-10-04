import { stmt } from "./security.js";
// Only unconverted sales enquiries expire automatically. Orders and consumer-rights
// requests require their own legal retention review and are not removed here.
export async function pruneExpired(env) {
  const expired =
    "SELECT e.id FROM enquiries e WHERE e.kind='enquiry' AND julianday(e.updated_at)<julianday('now','-365 days') AND NOT EXISTS(SELECT 1 FROM offers o WHERE o.enquiry_id=e.id AND (o.order_id IS NOT NULL OR (o.status='open' AND o.expires_at>unixepoch())))";
  await env.DB.batch([
    stmt(env, "DELETE FROM sessions WHERE expires_at<unixepoch()"),
    stmt(env, "DELETE FROM rate_limits WHERE expires_at<unixepoch()"),
    stmt(
      env,
      "DELETE FROM notes WHERE entity_type='enquiry' AND entity_id IN(" +
        expired +
        ")",
    ),
    stmt(
      env,
      "DELETE FROM outbox WHERE entity_type='enquiry' AND entity_id IN(" +
        expired +
        ")",
    ),
    stmt(
      env,
      "DELETE FROM audit WHERE entity_type='enquiry' AND entity_id IN(" +
        expired +
        ")",
    ),
    stmt(
      env,
      "DELETE FROM offers WHERE order_id IS NULL AND enquiry_id IN(" +
        expired +
        ")",
    ),
    stmt(env, "DELETE FROM enquiries WHERE id IN(" + expired + ")"),
    stmt(
      env,
      "DELETE FROM notes WHERE entity_type='customer' AND NOT EXISTS(SELECT 1 FROM enquiries e WHERE e.customer_id=notes.entity_id) AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.customer_id=notes.entity_id)",
    ),
    stmt(
      env,
      "DELETE FROM customers WHERE NOT EXISTS(SELECT 1 FROM enquiries e WHERE e.customer_id=customers.id) AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.customer_id=customers.id)",
    ),
  ]);
}

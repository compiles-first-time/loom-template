extends Node
## The EventBus autoload: the signal table of spec §5 (fixture for the observe tests).

signal actor_damaged(target_id: String, source_id: String, amount: float, damage_type: String)
signal actor_healed(target_id: String, source_id: String, amount: float)
signal item_consumed(actor_id: String, item_id: String, count: int)
signal debug_ping(payload: String)

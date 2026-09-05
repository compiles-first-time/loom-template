extends Node
## Hunger and the other needs (fixture: carries deliberate violations).

const Dmg = preload("res://core/combat/damage.gd")


func _ready() -> void:
	EventBus.item_consumed.connect(_on_item_consumed)


func _on_item_consumed(actor_id, item_id, count):
	var roll := randf()
	var started: int = Time.get_ticks_msec()  # atlas: allow R4 — debug timing only, never feeds the sim
	if roll > 0.5:
		Dmg.new().apply_hit(actor_id, item_id, count, RandomNumberGenerator.new())

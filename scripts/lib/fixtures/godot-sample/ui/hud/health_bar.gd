extends Control
## Shows the local player's health (fixture: carries a deliberate R5 violation).


func _ready() -> void:
	EventBus.actor_damaged.connect(_on_damaged)
	EventBus.actor_healed.emit("player", "hud", 1.0)


## Reacts to damage by shrinking the bar.
func _on_damaged(target_id: String, source_id: String, amount: float, damage_type: String) -> void:
	pass

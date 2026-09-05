class_name DamageModel
extends RefCounted
## Resolves hits into damage numbers; emits actor_damaged.


## Applies a hit to a target and emits actor_damaged.
func apply_hit(target_id: String, source_id: String, amount: float, rng: RandomNumberGenerator) -> void:
	var variance: float = rng.randf_range(0.9, 1.1)
	EventBus.actor_damaged.emit(target_id, source_id, amount * variance, "physical")

from database.rules_table import RulesRepository
from database.table_dataclass import Rule


rules_repo = RulesRepository()

def get_rules_for_dataset(dataset_id: str):
    """Retrieve rules for a dataset."""
    return rules_repo.find({"dataset_id": dataset_id})


def add_rules_to_dataset(dataset_id: str, rules: list):
    """Add rules to a dataset."""
    for rule in rules:
        rules_repo.insert(Rule(dataset_id=dataset_id, **rule))
    return {"message": "Rules added successfully"}

def update_rule(dataset_id: str, rule_id: str, **kwargs):
    """Update a rule."""
    rules_repo.update({"dataset_id": dataset_id, "id": rule_id}, kwargs)
    return {"message": "Rule updated successfully"}

def delete_rule(dataset_id: str, rule_id: str):
    """Delete a rule."""
    rules_repo.delete({"dataset_id": dataset_id, "id": rule_id})
    return {"message": "Rule deleted successfully"}

def delete_rules_for_dataset(dataset_id: str):
    """Delete all rules for a dataset."""
    rules_repo.delete({"dataset_id": dataset_id})
    return {"message": "All rules deleted successfully"}
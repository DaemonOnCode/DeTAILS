import json
from typing import List, Dict, Any
from utils.tfidf_util import calculate_tfidf
from utils.spacy_util import get_spacy_stopwords


class TokenFilteringService:
    def __init__(self):
        self.datasets = {}  # Simulate a database of datasets
        self.filter_rules = {}  # Store filter rules for each dataset

    def list_datasets(self) -> List[Dict[str, Any]]:
        return [{"id": key, "name": value["name"]} for key, value in self.datasets.items()]

    def get_filter_rules(self, dataset_id: str) -> List[Dict[str, Any]]:
        return self.filter_rules.get(dataset_id, [])

    def apply_filter_rules(self, dataset_id: str, rules: List[Dict[str, Any]]):
        dataset = self.datasets.get(dataset_id)
        if not dataset:
            raise ValueError("Dataset not found")

        # Apply rules to the dataset tokens
        filtered_tokens = []
        for token in dataset["tokens"]:
            if self._apply_rules_to_token(token, rules):
                filtered_tokens.append(token)
        dataset["filtered_tokens"] = filtered_tokens
        self.filter_rules[dataset_id] = rules

        return {"message": "Rules applied successfully", "remaining_tokens": len(filtered_tokens)}

    def save_filter_rules(self, data: Dict[str, Any]):
        dataset_id = data.get("dataset_id")
        rules = data.get("rules")
        self.filter_rules[dataset_id] = rules
        return {"message": "Rules saved successfully"}

    def load_filter_rules(self, data: Dict[str, Any]):
        dataset_id = data.get("dataset_id")
        rules = data.get("rules")
        self.filter_rules[dataset_id] = rules
        return {"message": "Rules loaded successfully"}

    def _apply_rules_to_token(self, token: Dict[str, Any], rules: List[Dict[str, Any]]) -> bool:
        """
        Apply rules to a single token. Return True if the token should be included.
        """
        for rule in rules:
            if rule["type"] == "remove" and rule["value"] == token["text"]:
                return False
            if rule["type"] == "include" and rule["value"] == token["text"]:
                return True
        return True


token_filtering_service = TokenFilteringService()

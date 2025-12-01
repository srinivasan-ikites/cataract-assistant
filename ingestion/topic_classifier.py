from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import yaml


@dataclass
class KeywordRule:
    topic: str
    keywords: List[str]


@dataclass
class TopicRules:
    default_topic: str
    article_rules: List[KeywordRule]
    qa_category_map: Dict[str, str]
    qa_keyword_rules: List[KeywordRule]


class TopicClassifier:
    def __init__(self, rules: TopicRules):
        self.rules = rules

    def classify_article(self, section_title: str, text: str, tags: Optional[List[str]] = None) -> str:
        haystack = " ".join(filter(None, [section_title, text])).lower()
        for rule in self.rules.article_rules:
            if any(keyword in haystack for keyword in rule.keywords):
                return rule.topic
        if tags:
            for tag in tags:
                topic = self.rules.qa_category_map.get(tag)
                if topic:
                    return topic
        return self.rules.default_topic

    def classify_qa(self, categories: List[str], text: str) -> str:
        for category in categories:
            topic = self.rules.qa_category_map.get(category)
            if topic:
                return topic
        haystack = text.lower()
        for rule in self.rules.qa_keyword_rules:
            if any(keyword in haystack for keyword in rule.keywords):
                return rule.topic
        return self.rules.default_topic


def load_topic_classifier(config_path: Path) -> TopicClassifier:
    data = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    article_rules = [
        KeywordRule(topic=rule["topic"], keywords=[kw.lower() for kw in rule.get("keywords", [])])
        for rule in data.get("article_rules", [])
    ]
    qa_keyword_rules = [
        KeywordRule(topic=rule["topic"], keywords=[kw.lower() for kw in rule.get("keywords", [])])
        for rule in data.get("qa_keyword_rules", [])
    ]
    qa_category_map = {key: value for key, value in (data.get("qa_category_map") or {}).items()}
    rules = TopicRules(
        default_topic=data.get("default_topic", "OTHER"),
        article_rules=article_rules,
        qa_category_map=qa_category_map,
        qa_keyword_rules=qa_keyword_rules,
    )
    return TopicClassifier(rules)


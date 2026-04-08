from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple


_TOKEN_RE = re.compile(r"[a-zA-Z0-9]+")


@dataclass(frozen=True)
class Course:
    code: str
    name: str
    description: str


@dataclass(frozen=True)
class School:
    name: str
    location: str
    courses: List[Course]


@dataclass(frozen=True)
class MatchResult:
    source_school: str
    source_course: Course
    target_school: str
    target_course: Course
    confidence: float
    reward_score: float
    explanation: str


FEATURE_NAMES = [
    "bias",
    "code_prefix_match",
    "course_level_similarity",
    "course_number_closeness",
    "name_token_jaccard",
    "description_token_jaccard",
    "stem_keyword_overlap",
    "lab_signal_match",
]


STEM_KEYWORDS = {
    "calculus",
    "physics",
    "mechanics",
    "electromagnetism",
    "programming",
    "algorithm",
    "data",
    "engineering",
    "dynamics",
    "integration",
    "derivative",
    "graph",
    "tree",
}


LAB_WORDS = {"lab", "laboratory", "experiment", "experiments"}


def _tokenize(text: str) -> set[str]:
    return set(_TOKEN_RE.findall(text.lower()))


def _extract_code_parts(code: str) -> Tuple[str, int]:
    letters = "".join(ch for ch in code if ch.isalpha()).upper()
    numbers = "".join(ch for ch in code if ch.isdigit())
    if not numbers:
        return letters, 0
    return letters, int(numbers)


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 0.0
    intersection = len(a.intersection(b))
    union = len(a.union(b))
    if union == 0:
        return 0.0
    return intersection / union


def _dot(a: Sequence[float], b: Sequence[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _sigmoid(x: float) -> float:
    if x < -30:
        return 0.0
    if x > 30:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def _softmax(logits: Sequence[float], temperature: float = 1.0) -> List[float]:
    if not logits:
        return []
    t = max(temperature, 1e-6)
    scaled = [x / t for x in logits]
    m = max(scaled)
    exps = [math.exp(x - m) for x in scaled]
    total = sum(exps)
    if total <= 0:
        return [1.0 / len(logits)] * len(logits)
    return [x / total for x in exps]


def load_schools_from_dict(payload: Dict) -> List[School]:
    schools: List[School] = []
    for school in payload.get("schools", []):
        courses = [
            Course(
                code=str(course.get("code", "")).strip(),
                name=str(course.get("name", "")).strip(),
                description=str(course.get("description", "")).strip(),
            )
            for course in school.get("courses", [])
        ]
        schools.append(
            School(
                name=str(school.get("name", "")).strip(),
                location=str(school.get("location", "")).strip(),
                courses=courses,
            )
        )
    return schools


def load_schools_from_json(path: str | Path) -> List[School]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return load_schools_from_dict(data)


class FeatureExtractor:
    def featurize(self, source: Course, target: Course) -> List[float]:
        src_code_prefix, src_num = _extract_code_parts(source.code)
        tgt_code_prefix, tgt_num = _extract_code_parts(target.code)

        src_name_tokens = _tokenize(source.name)
        tgt_name_tokens = _tokenize(target.name)
        src_desc_tokens = _tokenize(source.description)
        tgt_desc_tokens = _tokenize(target.description)

        src_keywords = src_desc_tokens.intersection(STEM_KEYWORDS)
        tgt_keywords = tgt_desc_tokens.intersection(STEM_KEYWORDS)

        src_has_lab = float(bool(src_desc_tokens.intersection(LAB_WORDS)))
        tgt_has_lab = float(bool(tgt_desc_tokens.intersection(LAB_WORDS)))

        code_prefix_match = 1.0 if src_code_prefix and src_code_prefix == tgt_code_prefix else 0.0

        src_level = src_num // 100 if src_num else 0
        tgt_level = tgt_num // 100 if tgt_num else 0
        level_similarity = 1.0 - min(abs(src_level - tgt_level), 5) / 5.0

        number_closeness = 1.0 - min(abs(src_num - tgt_num), 200) / 200.0 if src_num and tgt_num else 0.0

        features = [
            1.0,
            code_prefix_match,
            level_similarity,
            number_closeness,
            _jaccard(src_name_tokens, tgt_name_tokens),
            _jaccard(src_desc_tokens, tgt_desc_tokens),
            _jaccard(src_keywords, tgt_keywords),
            1.0 - abs(src_has_lab - tgt_has_lab),
        ]
        return features


class LinearRewardModel:
    def __init__(self, n_features: int, seed: int = 7) -> None:
        rng = random.Random(seed)
        self.weights = [rng.uniform(-0.05, 0.05) for _ in range(n_features)]

    def score(self, features: Sequence[float]) -> float:
        return _dot(self.weights, features)

    def train_pairwise(
        self,
        preferred_pairs: Sequence[Tuple[Sequence[float], Sequence[float]]],
        epochs: int = 12,
        lr: float = 0.08,
    ) -> None:
        for _ in range(max(1, epochs)):
            for better, worse in preferred_pairs:
                diff = [b - w for b, w in zip(better, worse)]
                margin = _dot(self.weights, diff)
                # Pairwise logistic objective: maximize log(sigmoid(margin)).
                grad_scale = 1.0 - _sigmoid(margin)
                for i, d in enumerate(diff):
                    self.weights[i] += lr * grad_scale * d


class PolicyModel:
    def __init__(self, n_features: int, seed: int = 13) -> None:
        rng = random.Random(seed)
        self.base_weights = [rng.uniform(-0.1, 0.1) for _ in range(n_features)]
        self.weights = list(self.base_weights)

    def logits(self, feature_rows: Sequence[Sequence[float]]) -> List[float]:
        return [_dot(self.weights, row) for row in feature_rows]

    def probs(self, feature_rows: Sequence[Sequence[float]], temperature: float = 1.0) -> List[float]:
        return _softmax(self.logits(feature_rows), temperature=temperature)

    def sample_action(self, feature_rows: Sequence[Sequence[float]], temperature: float, rng: random.Random) -> int:
        probs = self.probs(feature_rows, temperature=temperature)
        if not probs:
            return 0
        r = rng.random()
        cumulative = 0.0
        for idx, prob in enumerate(probs):
            cumulative += prob
            if r <= cumulative:
                return idx
        return len(probs) - 1

    def greedy_action(self, feature_rows: Sequence[Sequence[float]]) -> int:
        logits = self.logits(feature_rows)
        if not logits:
            return 0
        return max(range(len(logits)), key=lambda i: logits[i])

    def reinforce_step(
        self,
        feature_rows: Sequence[Sequence[float]],
        action_index: int,
        reward: float,
        baseline: float,
        lr: float,
        kl_coef: float,
    ) -> None:
        probs = self.probs(feature_rows, temperature=1.0)
        if not probs:
            return

        expected_features = [0.0] * len(self.weights)
        for p, row in zip(probs, feature_rows):
            for i, val in enumerate(row):
                expected_features[i] += p * val

        selected = feature_rows[action_index]
        advantage = reward - baseline

        for i in range(len(self.weights)):
            grad = selected[i] - expected_features[i]
            reg = self.weights[i] - self.base_weights[i]
            self.weights[i] += lr * (advantage * grad - kl_coef * reg)


class RLHFCourseMatcher:
    def __init__(
        self,
        rounds: int = 3,
        reward_epochs: int = 16,
        rl_episodes: int = 80,
        policy_lr: float = 0.08,
        reward_lr: float = 0.08,
        kl_coef: float = 0.15,
        temperature: float = 0.9,
        seed: int = 42,
    ) -> None:
        self.rounds = rounds
        self.reward_epochs = reward_epochs
        self.rl_episodes = rl_episodes
        self.policy_lr = policy_lr
        self.reward_lr = reward_lr
        self.kl_coef = kl_coef
        self.temperature = temperature
        self.seed = seed

        self.extractor = FeatureExtractor()
        self.policy = PolicyModel(n_features=len(FEATURE_NAMES), seed=seed + 1)
        self.reward_model = LinearRewardModel(n_features=len(FEATURE_NAMES), seed=seed + 2)

        # Simulated human preference function for prototyping RLHF without a labeling UI.
        self.oracle_weights = [0.0, 0.9, 0.55, 0.45, 0.95, 1.3, 1.2, 0.3]

    def _feature_rows(self, source: Course, targets: Sequence[Course]) -> List[List[float]]:
        return [self.extractor.featurize(source, tgt) for tgt in targets]

    def _simulate_human_preference(
        self,
        source: Course,
        candidates: Sequence[Course],
        rng: random.Random,
    ) -> Tuple[int, int]:
        if len(candidates) < 2:
            return 0, 0
        i, j = rng.sample(range(len(candidates)), k=2)
        fi = self.extractor.featurize(source, candidates[i])
        fj = self.extractor.featurize(source, candidates[j])

        score_i = _dot(self.oracle_weights, fi) + rng.uniform(-0.03, 0.03)
        score_j = _dot(self.oracle_weights, fj) + rng.uniform(-0.03, 0.03)
        return (i, j) if score_i >= score_j else (j, i)

    def _collect_preference_pairs(
        self,
        source_courses: Sequence[Course],
        target_courses: Sequence[Course],
        pairs_per_course: int,
        rng: random.Random,
    ) -> List[Tuple[List[float], List[float]]]:
        pairs: List[Tuple[List[float], List[float]]] = []
        if not source_courses or len(target_courses) < 2:
            return pairs

        for src in source_courses:
            for _ in range(max(1, pairs_per_course)):
                better_idx, worse_idx = self._simulate_human_preference(src, target_courses, rng)
                better_f = self.extractor.featurize(src, target_courses[better_idx])
                worse_f = self.extractor.featurize(src, target_courses[worse_idx])
                pairs.append((better_f, worse_f))
        return pairs

    def _optimize_policy(
        self,
        source_courses: Sequence[Course],
        target_courses: Sequence[Course],
        rng: random.Random,
    ) -> None:
        if not source_courses or not target_courses:
            return

        running_baseline = 0.0
        for episode in range(max(1, self.rl_episodes)):
            source = source_courses[episode % len(source_courses)]
            feature_rows = self._feature_rows(source, target_courses)
            action_idx = self.policy.sample_action(feature_rows, temperature=self.temperature, rng=rng)
            reward = self.reward_model.score(feature_rows[action_idx])

            running_baseline = 0.9 * running_baseline + 0.1 * reward
            self.policy.reinforce_step(
                feature_rows=feature_rows,
                action_index=action_idx,
                reward=reward,
                baseline=running_baseline,
                lr=self.policy_lr,
                kl_coef=self.kl_coef,
            )

    def fit(
        self,
        source_school: School,
        target_school: School,
        preference_pairs_per_course: int = 4,
    ) -> None:
        rng = random.Random(self.seed)

        for _ in range(max(1, self.rounds)):
            preference_pairs = self._collect_preference_pairs(
                source_courses=source_school.courses,
                target_courses=target_school.courses,
                pairs_per_course=preference_pairs_per_course,
                rng=rng,
            )
            if not preference_pairs:
                return

            self.reward_model.train_pairwise(
                preferred_pairs=preference_pairs,
                epochs=self.reward_epochs,
                lr=self.reward_lr,
            )
            self._optimize_policy(
                source_courses=source_school.courses,
                target_courses=target_school.courses,
                rng=rng,
            )

    def _explain_match(self, source: Course, target: Course) -> str:
        features = self.extractor.featurize(source, target)
        weighted = [w * f for w, f in zip(self.reward_model.weights, features)]
        ranked = sorted(
            ((FEATURE_NAMES[i], weighted[i]) for i in range(len(weighted))),
            key=lambda item: item[1],
            reverse=True,
        )
        top = [name for name, value in ranked[:3] if value > 0]
        if not top:
            return "Low signal overlap; consider manual advisor review."
        return "Top alignment signals: " + ", ".join(top)

    def match_courses(
        self,
        source_school: School,
        target_school: School,
        top_k: int = 1,
    ) -> List[MatchResult]:
        results: List[MatchResult] = []
        if not source_school.courses or not target_school.courses:
            return results

        for source in source_school.courses:
            feature_rows = self._feature_rows(source, target_school.courses)
            logits = self.policy.logits(feature_rows)
            probs = _softmax(logits)

            ranked_indices = sorted(range(len(target_school.courses)), key=lambda i: probs[i], reverse=True)
            for idx in ranked_indices[: max(1, top_k)]:
                target = target_school.courses[idx]
                reward_score = self.reward_model.score(feature_rows[idx])
                results.append(
                    MatchResult(
                        source_school=source_school.name,
                        source_course=source,
                        target_school=target_school.name,
                        target_course=target,
                        confidence=probs[idx],
                        reward_score=reward_score,
                        explanation=self._explain_match(source, target),
                    )
                )
        return results


def save_schools_to_json(path: str | Path, schools_payload: Dict) -> None:
    Path(path).write_text(json.dumps(schools_payload, indent=2), encoding="utf-8")

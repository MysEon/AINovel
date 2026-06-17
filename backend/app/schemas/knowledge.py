"""Schemas for story knowledge graph and change proposals."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

EntityType = Literal["character", "location", "organization", "worldview"]
ProposalStatus = Literal["pending", "accepted", "rejected", "conflicted"]
OperationStatus = Literal["pending", "accepted", "rejected", "conflicted"]
OperationType = Literal["entity_field_update", "relationship_upsert", "relationship_delete", "entity_state_event"]


class ProposalOperationCreate(BaseModel):
    operation_type: OperationType
    entity_type: EntityType | None = None
    entity_id: int | None = Field(None, gt=0)
    field_name: str | None = Field(None, max_length=100)
    relation_type: str | None = Field(None, max_length=80)
    target_type: EntityType | None = None
    target_id: int | None = Field(None, gt=0)
    state_key: str | None = Field(None, max_length=100)
    expected_old_value: Any = None
    new_value: Any = None
    payload: dict[str, Any] | None = None


class EntityChangeProposalCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    chapter_id: int | None = Field(None, gt=0)
    summary: str | None = None
    evidence: str | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    source: str = Field("manual", max_length=30)
    raw_payload: dict[str, Any] | None = None
    operations: list[ProposalOperationCreate] = Field(..., min_length=1, max_length=50)


class ChapterKnowledgeAnalyzeRequest(BaseModel):
    model_config_id: int = Field(..., gt=0)
    force: bool = False


class KnowledgeOperationDraft(BaseModel):
    operation_type: OperationType
    entity_type: EntityType | None = None
    entity_name: str | None = Field(None, max_length=100)
    field_name: str | None = Field(None, max_length=100)
    relation_type: str | None = Field(None, max_length=80)
    target_type: EntityType | None = None
    target_name: str | None = Field(None, max_length=100)
    state_key: str | None = Field(None, max_length=100)
    expected_old_value: Any = None
    new_value: Any = None
    payload: dict[str, Any] | None = None


class KnowledgeProposalDraft(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    summary: str | None = None
    evidence: str | None = None
    confidence: float | None = Field(None, ge=0, le=1)
    operations: list[KnowledgeOperationDraft] = Field(default_factory=list, max_length=30)


class ChapterKnowledgeAnalysisDraft(BaseModel):
    proposals: list[KnowledgeProposalDraft] = Field(default_factory=list, max_length=10)
    notes: str | None = None


class ChapterKnowledgeAnalysisResponse(BaseModel):
    success: bool
    project_id: int
    chapter_id: int
    proposal_count: int
    skipped_proposal_count: int = 0
    proposals: list[EntityChangeProposalResponse] = Field(default_factory=list)
    message: str


class ProposalAcceptRequest(BaseModel):
    accepted_operation_ids: list[int] | None = None
    rejected_operation_ids: list[int] = Field(default_factory=list)
    force_conflicts: bool = False


class ProposalRejectRequest(BaseModel):
    reason: str | None = None


class ProposalOperationResponse(BaseModel):
    id: int
    proposal_id: int
    sort_order: int
    operation_type: str
    status: str
    entity_type: str | None = None
    entity_id: int | None = None
    field_name: str | None = None
    relation_type: str | None = None
    target_type: str | None = None
    target_id: int | None = None
    state_key: str | None = None
    expected_old_value: Any = None
    new_value: Any = None
    payload: dict[str, Any] | None = None
    conflict_reason: str | None = None
    applied_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class EntityChangeProposalResponse(BaseModel):
    id: int
    project_id: int
    chapter_id: int | None = None
    title: str
    summary: str | None = None
    evidence: str | None = None
    confidence: float | None = None
    status: str
    source: str
    raw_payload: dict[str, Any] | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    operations: list[ProposalOperationResponse] = Field(default_factory=list)


class EntityRelationshipResponse(BaseModel):
    id: int
    project_id: int
    source_type: str
    source_id: int
    relation_type: str
    target_type: str
    target_id: int
    status: str
    description: str | None = None
    evidence: str | None = None
    confidence: float | None = None
    properties: dict[str, Any] | None = None
    source: str
    proposal_id: int | None = None
    proposal_operation_id: int | None = None
    created_at: datetime
    updated_at: datetime


class EntityStateEventResponse(BaseModel):
    id: int
    project_id: int
    chapter_id: int | None = None
    entity_type: str
    entity_id: int
    state_key: str
    old_value: Any = None
    new_value: Any = None
    summary: str | None = None
    evidence: str | None = None
    confidence: float | None = None
    source: str
    metadata: dict[str, Any] | None = None
    proposal_id: int | None = None
    proposal_operation_id: int | None = None
    created_at: datetime
    updated_at: datetime


class ChapterAnalysisStatusResponse(BaseModel):
    run_id: int | None
    status: str | None
    created_at: datetime | None
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None = None

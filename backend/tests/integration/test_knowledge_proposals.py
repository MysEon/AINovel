"""Knowledge proposal API integration tests."""

from httpx import AsyncClient

from app.application.knowledge_graph_service import KnowledgeGraphService
from app.schemas.knowledge import ChapterKnowledgeAnalysisResponse


class TestKnowledgeProposals:
    async def test_analyze_chapter_endpoint_passes_model_config_and_force(
        self,
        client: AsyncClient,
        auth_headers: dict,
        monkeypatch,
    ):
        project_resp = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={"name": "Knowledge Analyze API"},
        )
        assert project_resp.status_code == 201
        project_id = project_resp.json()["id"]
        chapter_resp = await client.post(
            f"/api/v1/projects/{project_id}/chapters",
            headers=auth_headers,
            json={"title": "Analyze Me", "content": "Lin Zhao joins Ash Guild."},
        )
        assert chapter_resp.status_code == 201
        chapter_id = chapter_resp.json()["id"]
        captured = {}

        async def fake_analyze_chapter(
            self,
            project_id: int,
            chapter_id: int,
            user_id: int,
            *,
            model_config_id: int,
            force: bool = False,
        ):
            captured.update(
                {
                    "project_id": project_id,
                    "chapter_id": chapter_id,
                    "user_id": user_id,
                    "model_config_id": model_config_id,
                    "force": force,
                }
            )
            return ChapterKnowledgeAnalysisResponse(
                success=True,
                project_id=project_id,
                chapter_id=chapter_id,
                proposal_count=0,
                skipped_proposal_count=0,
                proposals=[],
                message="ok",
            )

        monkeypatch.setattr(KnowledgeGraphService, "analyze_chapter", fake_analyze_chapter)

        response = await client.post(
            f"/api/v1/knowledge/projects/{project_id}/chapters/{chapter_id}/analyze",
            headers=auth_headers,
            json={"model_config_id": 42, "force": True},
        )

        assert response.status_code == 200
        assert response.json()["message"] == "ok"
        assert captured["project_id"] == project_id
        assert captured["chapter_id"] == chapter_id
        assert captured["model_config_id"] == 42
        assert captured["force"] is True

    async def test_create_and_accept_proposal_updates_knowledge_graph(
        self,
        client: AsyncClient,
        auth_headers: dict,
    ):
        project_resp = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={"name": "Knowledge Graph API"},
        )
        assert project_resp.status_code == 201
        project_id = project_resp.json()["id"]

        org_resp = await client.post(
            f"/api/v1/projects/{project_id}/organizations",
            headers=auth_headers,
            json={"name": "Ash Guild", "influence": "controls the harbor"},
        )
        assert org_resp.status_code == 201
        organization_id = org_resp.json()["id"]

        char_resp = await client.post(
            f"/api/v1/projects/{project_id}/characters",
            headers=auth_headers,
            json={"name": "Lin Zhao", "description": "agent", "alignment": "loyal"},
        )
        assert char_resp.status_code == 201
        character_id = char_resp.json()["id"]

        proposal_resp = await client.post(
            f"/api/v1/knowledge/projects/{project_id}/proposals",
            headers=auth_headers,
            json={
                "title": "Lin Zhao betrays Ash Guild",
                "evidence": "Lin Zhao hands over the guild seal.",
                "operations": [
                    {
                        "operation_type": "entity_field_update",
                        "entity_type": "character",
                        "entity_id": character_id,
                        "field_name": "alignment",
                        "expected_old_value": "loyal",
                        "new_value": "defector",
                    },
                    {
                        "operation_type": "relationship_upsert",
                        "entity_type": "character",
                        "entity_id": character_id,
                        "relation_type": "enemy_of",
                        "target_type": "organization",
                        "target_id": organization_id,
                        "payload": {"description": "openly opposes the guild"},
                    },
                    {
                        "operation_type": "entity_state_event",
                        "entity_type": "character",
                        "entity_id": character_id,
                        "state_key": "status",
                        "new_value": "defected",
                    },
                ],
            },
        )
        assert proposal_resp.status_code == 201
        proposal = proposal_resp.json()

        accept_resp = await client.post(
            f"/api/v1/knowledge/proposals/{proposal['id']}/accept",
            headers=auth_headers,
            json={},
        )
        assert accept_resp.status_code == 200
        accepted = accept_resp.json()
        assert accepted["status"] == "accepted"
        assert {operation["status"] for operation in accepted["operations"]} == {"accepted"}

        updated_character = await client.get(f"/api/v1/characters/{character_id}", headers=auth_headers)
        assert updated_character.status_code == 200
        assert updated_character.json()["alignment"] == "defector"

        relationships_resp = await client.get(
            f"/api/v1/knowledge/projects/{project_id}/relationships",
            headers=auth_headers,
        )
        assert relationships_resp.status_code == 200
        relationships = relationships_resp.json()
        assert len(relationships) == 1
        assert relationships[0]["relation_type"] == "enemy_of"
        assert relationships[0]["description"] == "openly opposes the guild"

        state_resp = await client.get(
            f"/api/v1/knowledge/projects/{project_id}/state-events",
            headers=auth_headers,
        )
        assert state_resp.status_code == 200
        state_events = state_resp.json()
        # entity_field_update 现在同步写入状态时间线，alignment 与 status 两条均可见
        assert len(state_events) == 2
        assert {event["state_key"] for event in state_events} == {"alignment", "status"}
        status_event = next(event for event in state_events if event["state_key"] == "status")
        assert status_event["new_value"] == "defected"

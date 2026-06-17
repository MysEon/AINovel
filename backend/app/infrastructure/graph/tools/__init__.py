"""Chat assistant graph tools."""

from .chapter_tools import get_chapter_summary
from .character_tools import get_character_detail, list_characters
from .entity_write_tools import (
    create_character,
    create_location,
    create_organization,
    create_worldview,
    delete_character,
    delete_location,
    delete_organization,
    delete_worldview,
    update_character,
    update_location,
    update_organization,
    update_worldview,
)
from .worldbuilding_tools import (
    get_location_detail,
    get_organization_detail,
    get_worldview_detail,
    list_locations,
    list_organizations,
    list_worldviews,
)

CHAT_TOOLS = [
    # Read tools
    list_characters,
    get_character_detail,
    list_locations,
    get_location_detail,
    list_organizations,
    get_organization_detail,
    list_worldviews,
    get_worldview_detail,
    get_chapter_summary,
    # Write tools
    create_character,
    update_character,
    delete_character,
    create_location,
    update_location,
    delete_location,
    create_organization,
    update_organization,
    delete_organization,
    create_worldview,
    update_worldview,
    delete_worldview,
]

__all__ = [
    "CHAT_TOOLS",
    "list_characters",
    "get_character_detail",
    "list_locations",
    "get_location_detail",
    "list_organizations",
    "get_organization_detail",
    "list_worldviews",
    "get_worldview_detail",
    "get_chapter_summary",
    "create_character",
    "update_character",
    "delete_character",
    "create_location",
    "update_location",
    "delete_location",
    "create_organization",
    "update_organization",
    "delete_organization",
    "create_worldview",
    "update_worldview",
    "delete_worldview",
]

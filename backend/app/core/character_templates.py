"""角色面板模板定义（基础模板 + 题材增量模板）"""

from __future__ import annotations

from copy import deepcopy
from typing import Any

BASE_TEMPLATE: dict[str, Any] = {
    "template_id": "character.base.v1",
    "label": "通用角色模板",
    "field_groups": [
        "心理与动机",
        "剧情功能",
        "关系网络",
        "元数据",
        "世界观专属",
    ],
    "fields": [
        {
            "key": "psych.core_desire",
            "label": "核心欲望",
            "group": "心理与动机",
            "value_type": "textarea",
            "placeholder": "角色最想得到什么？",
        },
        {
            "key": "psych.core_fear",
            "label": "核心恐惧",
            "group": "心理与动机",
            "value_type": "textarea",
            "placeholder": "角色最害怕失去什么？",
        },
        {
            "key": "psych.taboos",
            "label": "底线 / 禁忌",
            "group": "心理与动机",
            "value_type": "tags",
            "allow_custom": True,
        },
        {
            "key": "story.role_function",
            "label": "剧情功能",
            "group": "剧情功能",
            "value_type": "combobox",
            "allow_custom": True,
            "options": ["主角", "配角", "反派", "导师", "镜像角色", "推动者", "阻碍者"],
        },
        {
            "key": "story.arc_type",
            "label": "角色弧线类型",
            "group": "剧情功能",
            "value_type": "combobox",
            "allow_custom": True,
            "options": ["成长弧", "堕落弧", "觉醒弧", "救赎弧", "稳定弧", "循环弧"],
        },
        {
            "key": "story.short_goal",
            "label": "短期目标",
            "group": "剧情功能",
            "value_type": "textarea",
        },
        {
            "key": "story.long_goal",
            "label": "长期目标",
            "group": "剧情功能",
            "value_type": "textarea",
        },
        {
            "key": "relations.key_relationships",
            "label": "关键关系（简述）",
            "group": "关系网络",
            "value_type": "textarea",
            "placeholder": "可先用自然语言记录，后续再细化为结构化关系",
        },
        {
            "key": "meta.tags",
            "label": "角色标签",
            "group": "元数据",
            "value_type": "tags",
            "allow_custom": True,
        },
        {
            "key": "meta.info_confidence",
            "label": "设定确定度",
            "group": "元数据",
            "value_type": "select",
            "options": ["确定", "暂定", "待确认", "保密"],
        },
    ],
    "default_visible_groups": ["心理与动机", "剧情功能"],
}


FANTASY_DELTA: dict[str, Any] = {
    "template_id": "character.delta.fantasy.v1",
    "extends": "character.base.v1",
    "label": "奇幻增量",
    "add_fields": [
        {
            "key": "fantasy.race_subtype",
            "label": "种族分支",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "fantasy.class_role",
            "label": "职业 / 职阶",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "fantasy.magic_affinity",
            "label": "魔法亲和",
            "group": "世界观专属",
            "value_type": "multi_select",
            "allow_custom": True,
            "options": ["火", "水", "风", "土", "雷", "光", "暗", "自然", "空间", "时间", "死灵"],
        },
        {
            "key": "fantasy.magic_source",
            "label": "力量来源",
            "group": "世界观专属",
            "value_type": "multi_select",
            "allow_custom": True,
            "options": ["天赋", "血脉", "神赐", "契约", "学院训练", "仪式", "遗物", "诅咒"],
        },
        {
            "key": "fantasy.cast_style",
            "label": "施法方式",
            "group": "世界观专属",
            "value_type": "multi_select",
            "allow_custom": True,
            "options": ["咏唱", "手势", "符文", "法阵", "媒介", "瞬发", "祈祷", "献祭"],
        },
        {
            "key": "fantasy.bloodline",
            "label": "血脉 / 传承",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "fantasy.deity_or_patron",
            "label": "神祇 / 庇护者",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "fantasy.oath",
            "label": "誓约 / 戒律",
            "group": "世界观专属",
            "value_type": "textarea",
        },
        {
            "key": "fantasy.curse_blessing",
            "label": "诅咒 / 祝福",
            "group": "世界观专属",
            "value_type": "list_of_objects",
            "item_hint": "先用文本或 JSON 记录也可",
        },
        {
            "key": "fantasy.magic_cost",
            "label": "魔法代价",
            "group": "弱点与代价",
            "value_type": "textarea",
        },
    ],
}


SCIFI_DELTA: dict[str, Any] = {
    "template_id": "character.delta.scifi.v1",
    "extends": "character.base.v1",
    "label": "科幻增量",
    "add_fields": [
        {
            "key": "scifi.origin_world",
            "label": "母星 / 出生殖民地",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "scifi.faction_clearance",
            "label": "权限等级",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "scifi.implant_rate",
            "label": "义体化程度",
            "group": "世界观专属",
            "value_type": "rating",
            "min": 0,
            "max": 100,
        },
        {
            "key": "scifi.implants",
            "label": "植入体",
            "group": "世界观专属",
            "value_type": "list_of_objects",
            "item_hint": "建议每项包含部位/型号/效果/副作用",
        },
        {
            "key": "scifi.bio_mods",
            "label": "生物改造",
            "group": "世界观专属",
            "value_type": "list_of_objects",
        },
        {
            "key": "scifi.ai_companion",
            "label": "AI伴随体",
            "group": "关系网络",
            "value_type": "text",
            "placeholder": "可先填写名称 / 代号，后续接入引用实体",
        },
        {
            "key": "scifi.neural_link",
            "label": "神经链接协议",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "scifi.net_id",
            "label": "网络身份 / 代号",
            "group": "元数据",
            "value_type": "text",
        },
        {
            "key": "scifi.manufacturer",
            "label": "义体制造商",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "scifi.system_risks",
            "label": "系统风险 / 副作用",
            "group": "弱点与代价",
            "value_type": "multi_select",
            "allow_custom": True,
            "options": ["排异反应", "过热", "延迟", "记忆污染", "成瘾", "精神负荷", "远程劫持风险"],
        },
    ],
}


XIANXIA_DELTA: dict[str, Any] = {
    "template_id": "character.delta.xianxia.v1",
    "extends": "character.base.v1",
    "label": "修仙增量",
    "add_fields": [
        {
            "key": "xianxia.spiritual_root",
            "label": "灵根",
            "group": "世界观专属",
            "value_type": "list_of_objects",
            "item_hint": "如：火灵根/纯度/品阶",
        },
        {
            "key": "xianxia.constitution",
            "label": "体质 / 圣体",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "xianxia.realm",
            "label": "当前境界",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "xianxia.realm_stage",
            "label": "境界阶段",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "xianxia.cultivation_path",
            "label": "修行体系",
            "group": "世界观专属",
            "value_type": "multi_select",
            "allow_custom": True,
            "options": ["炼气", "炼体", "剑修", "丹修", "器修", "符修", "阵修", "魂修", "御兽"],
        },
        {
            "key": "xianxia.main_gongfa",
            "label": "主修功法",
            "group": "世界观专属",
            "value_type": "combobox",
            "allow_custom": True,
        },
        {
            "key": "xianxia.sub_gongfa",
            "label": "辅修功法",
            "group": "世界观专属",
            "value_type": "multi_select",
            "allow_custom": True,
        },
        {
            "key": "xianxia.natal_magic_treasure",
            "label": "本命法宝",
            "group": "世界观专属",
            "value_type": "list_of_objects",
        },
        {
            "key": "xianxia.master_lineage",
            "label": "师承谱系",
            "group": "关系网络",
            "value_type": "textarea",
        },
        {
            "key": "xianxia.heart_demon",
            "label": "心魔 / 执念",
            "group": "弱点与代价",
            "value_type": "textarea",
        },
        {
            "key": "xianxia.tribulation_history",
            "label": "渡劫记录",
            "group": "时间状态",
            "value_type": "list_of_objects",
        },
        {
            "key": "xianxia.lifespan",
            "label": "寿元",
            "group": "世界观专属",
            "value_type": "number_with_unit",
            "unit_options": ["年", "甲子", "纪元"],
        },
        {
            "key": "xianxia.pill_tolerance",
            "label": "丹毒 / 药抗",
            "group": "弱点与代价",
            "value_type": "rating",
            "min": 0,
            "max": 100,
        },
    ],
}


DELTA_TEMPLATES: dict[str, dict[str, Any]] = {
    "fantasy": FANTASY_DELTA,
    "scifi": SCIFI_DELTA,
    "xianxia": XIANXIA_DELTA,
}


def merge_character_template(base: dict[str, Any], *deltas: dict[str, Any]) -> dict[str, Any]:
    """合并基础模板与一个或多个题材增量模板"""
    merged = deepcopy(base)
    merged.setdefault("fields", [])
    merged.setdefault("field_groups", [])
    merged.setdefault("default_visible_groups", [])
    merged["applied_deltas"] = []

    field_by_key: dict[str, dict[str, Any]] = {f["key"]: f for f in merged["fields"]}

    for delta in deltas:
        if not delta:
            continue
        merged["applied_deltas"].append(delta["template_id"])

        for field in delta.get("add_fields", []):
            key = field["key"]
            if key not in field_by_key:
                new_field = deepcopy(field)
                merged["fields"].append(new_field)
                field_by_key[key] = new_field
                continue

            # 同键字段仅允许补充选项 / 辅助信息，不覆盖 value_type。
            existing = field_by_key[key]
            if "options" in field:
                existing_options = list(existing.get("options", []))
                for opt in field.get("options", []):
                    if opt not in existing_options:
                        existing_options.append(opt)
                existing["options"] = existing_options
            for k in ("label", "placeholder", "help_text"):
                if field.get(k) and not existing.get(k):
                    existing[k] = field[k]

        for group in delta.get("add_groups", []):
            if group not in merged["field_groups"]:
                merged["field_groups"].append(group)

        for group in delta.get("default_visible_groups", []):
            if group not in merged["default_visible_groups"]:
                merged["default_visible_groups"].append(group)

    # 根据实际字段反推 group 列表，确保前端能完整渲染
    for field in merged["fields"]:
        group = field.get("group")
        if group and group not in merged["field_groups"]:
            merged["field_groups"].append(group)

    return merged


def build_character_template_registry() -> dict[str, Any]:
    """提供前端使用的模板注册表与常用合并结果"""
    return {
        "base_template": deepcopy(BASE_TEMPLATE),
        "delta_templates": deepcopy(DELTA_TEMPLATES),
        "merged_templates": {
            key: merge_character_template(BASE_TEMPLATE, delta) for key, delta in DELTA_TEMPLATES.items()
        },
        "merge_rules": {
            "base_first": True,
            "delta_order_sensitive": True,
            "field_conflict_policy": "preserve_value_type_extend_options",
        },
    }

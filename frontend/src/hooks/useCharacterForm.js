import { useState, useCallback } from 'react';
import { Form, notification } from 'antd';
import { createCharacter, updateCharacter } from '../services/characterService';
import {
  DIMENSION_KEYS,
  GENDER_PROFILE_KEY,
  extractExtraAttributeFormState,
  extractGenderProfileFormState,
  sanitizeGenderProfile,
  deriveCurrentGenderFromProfile,
  buildExtraAttributesJson,
  normalizeCoreCharacterPayload,
} from '../components/worldbuilding/characterConstants';

export function useCharacterForm({ projectId, templateRegistry, loadCharacters }) {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [saving, setSaving] = useState(false);

  const showModal = useCallback((character = null) => {
    setEditingCharacter(character);
    if (character) {
      let dims = {};
      try { dims = character.dimensions ? JSON.parse(character.dimensions) : {}; } catch { /* ignore */ }
      const { templateDeltas, extraFieldValues } = extractExtraAttributeFormState(character, templateRegistry);
      const genderProfileFormValue = extractGenderProfileFormState(character);
      form.setFieldsValue({
        ...character,
        species: character.species ? [character.species] : undefined,
        alignment: character.alignment ? [character.alignment] : undefined,
        ...dims,
        __gender_profile: genderProfileFormValue,
        __template_deltas: templateDeltas,
        __extra_attrs: extraFieldValues,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        __gender_profile: {
          initial_gender: undefined,
          initial_female_traits: {},
          transitions: [],
          notes: undefined,
        },
        __template_deltas: [],
        __extra_attrs: {},
      });
    }
    setIsModalVisible(true);
  }, [form, templateRegistry]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = normalizeCoreCharacterPayload(values);

      // 把三维 Slider 值收集成 JSON
      const dims = {};
      DIMENSION_KEYS.forEach(d => {
        if (payload[d.key] != null) {
          dims[d.key] = payload[d.key];
          delete payload[d.key];
        }
      });
      if (Object.keys(dims).length > 0) {
        payload.dimensions = JSON.stringify(dims);
      }

      const selectedTemplateDeltas = Array.isArray(payload.__template_deltas) ? payload.__template_deltas : [];
      const extraFieldValues = payload.__extra_attrs && typeof payload.__extra_attrs === 'object'
        ? payload.__extra_attrs
        : {};
      const genderProfile = sanitizeGenderProfile(payload.__gender_profile);
      if (genderProfile) {
        extraFieldValues[GENDER_PROFILE_KEY] = genderProfile;
      }
      payload.gender = deriveCurrentGenderFromProfile(genderProfile) || null;
      payload.extra_attributes = buildExtraAttributesJson({
        templateRegistry,
        templateDeltas: selectedTemplateDeltas,
        extraFieldValues,
      });

      delete payload.__gender_profile;
      delete payload.__template_deltas;
      delete payload.__extra_attrs;

      if (editingCharacter) {
        await updateCharacter(editingCharacter.id, payload);
        notification.success({ message: `角色「${payload.name}」已更新` });
      } else {
        await createCharacter(projectId, payload);
        notification.success({ message: `角色「${payload.name}」已创建` });
      }
      setIsModalVisible(false);
      form.resetFields();
      setEditingCharacter(null);
      await loadCharacters();
    } catch (error) {
      if (error.errorFields) return; // form validation error
      notification.error({ message: '保存失败', description: error.message });
    } finally {
      setSaving(false);
    }
  }, [form, editingCharacter, projectId, templateRegistry, loadCharacters]);

  const handleCancel = useCallback(() => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingCharacter(null);
  }, [form]);

  return {
    form,
    isModalVisible,
    editingCharacter,
    saving,
    showModal,
    handleSave,
    handleCancel,
  };
}

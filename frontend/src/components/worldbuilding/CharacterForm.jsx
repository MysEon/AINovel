import React from 'react';
import { Modal, Form } from 'antd';
import CharacterFormBody from './CharacterFormBody';

const CharacterForm = ({
  visible, editing, form, saving, onSave, onCancel,
  templateRegistry, templateLoading,
}) => (
  <Modal
    title={editing ? '编辑角色' : '新建角色'}
    open={visible}
    onOk={onSave}
    onCancel={onCancel}
    confirmLoading={saving}
    okText={editing ? '保存' : '创建'}
    cancelText="取消"
    width={720}
    destroyOnClose
    styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
  >
    <Form form={form} layout="vertical" requiredMark="optional">
      <CharacterFormBody
        form={form}
        templateRegistry={templateRegistry}
        templateLoading={templateLoading}
      />
    </Form>
  </Modal>
);

export default CharacterForm;

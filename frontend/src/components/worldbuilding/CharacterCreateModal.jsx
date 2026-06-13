import React from 'react';
import { Modal } from 'antd';
import CharacterCreatorTabs from './CharacterCreatorTabs';

const CharacterCreateModal = ({
  open,
  onClose,
  projectId,
  templateRegistry,
  templateLoading,
  onCreated,
}) => (
  <Modal
    title="新建角色"
    open={open}
    onCancel={onClose}
    footer={null}
    destroyOnClose
    width={720}
    styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
  >
    <CharacterCreatorTabs
      projectId={projectId}
      templateRegistry={templateRegistry}
      templateLoading={templateLoading}
      onCreated={onCreated}
      onCancel={onClose}
    />
  </Modal>
);

export default CharacterCreateModal;
